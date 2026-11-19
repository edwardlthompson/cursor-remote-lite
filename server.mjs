import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { WebSocketServer } from 'ws';
import qrcode from 'qrcode-terminal';
import { workspaces, workspaceForTitle, fileSize, readFile, readDiff, parseRef, searchFiles } from './files.mjs';
import {
  DATA_DIR, encryptUrl, createPairing, pairingValid, consumePairing, listDevices, addDevice, findDevice, updateDevice,
  removeDevice, totpConfig, verifyTotp, needsTotp, saveState, readState, appBase,
} from './auth.mjs';
import { pushPublicKey, openEventStream, closeEventStreams, addViewer, removeViewer, deliver, startWatcher, watcherStats, watcherWindowStates, listViewers } from './notify.mjs';
import { startTelegramBot, telegramEnabled } from './telegram.mjs';
import { createHeadless } from './headless.mjs';
import {
  claim as presenceClaim, heartbeat as presenceHeartbeat, release as presenceRelease,
  releaseAllForDevice, canControl, CONTROL_TYPES, snapshot as presenceSnapshot, allSnapshots,
} from './presence.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3939);
const CDP_URL = (process.env.CDP_URL || 'http://127.0.0.1:9222').replace(/\/$/, '');
const TUNNEL = process.argv.includes('--tunnel') || process.env.CR_NETWORK === 'tunnel';
const LOCALHOST_ONLY = process.argv.includes('--localhost') || process.env.CR_NETWORK === 'localhost';
const HOST = process.env.HOST || (LOCALHOST_ONLY ? '127.0.0.1' : TUNNEL ? '127.0.0.1' : '0.0.0.0');
const NETWORK_MODE = TUNNEL ? 'tunnel' : (HOST === '127.0.0.1' || HOST === '::1' ? 'localhost' : 'lan');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const APP_DIR = path.join(__dirname, 'app');

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });

const CONFIG = loadConfig();
const PUBLISH_REPO = process.argv.find(a => a.startsWith('--publish='))?.slice('--publish='.length) || process.env.CR_PUBLISH_REPO || CONFIG.publishRepo || '';
const APP_ORIGIN = PUBLISH_REPO ? `https://${PUBLISH_REPO.split('/')[0].toLowerCase()}.github.io` : '';
const ALLOWED_ORIGINS = new Set([APP_ORIGIN, ...(process.env.CR_ALLOWED_ORIGINS || '').split(',')].filter(Boolean));

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; }
}

// A device is usable once paired and, when 2FA asks for it, re-verified.
function deviceFor(req) {
  return findDevice(bearer(req));
}

function bearer(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  return m ? m[1] : '';
}

// Behind cloudflared every request arrives from loopback; only then trust its client-IP header.
function clientIp(req) {
  const remote = req.socket.remoteAddress || '';
  const loopback = remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
  return (loopback && req.headers['cf-connecting-ip']) || remote;
}

const failures = new Map();
let globalFailures = [];
const PER_IP_LIMIT = 5, GLOBAL_LIMIT = 20, LOCK_MS = 15 * 60 * 1000;

function lockedOut(ip) {
  const now = Date.now();
  globalFailures = globalFailures.filter(t => now - t < LOCK_MS);
  const mine = (failures.get(ip) || []).filter(t => now - t < LOCK_MS);
  failures.set(ip, mine);
  return mine.length >= PER_IP_LIMIT || globalFailures.length >= GLOBAL_LIMIT;
}

function recordFailure(ip) {
  const now = Date.now();
  failures.set(ip, [...(failures.get(ip) || []), now]);
  globalFailures.push(now);
  console.log(`!! Auth failed ip=${ip} (last 15 min: this IP ${failures.get(ip).length}, total ${globalFailures.length})`);
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => { body += c; if (body.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

// Same-origin (app served by this relay) or the user's own GitHub Pages app.
function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

async function listWindows() {
  const res = await fetch(`${CDP_URL}/json/list`).catch(() => {
    throw new Error('Cannot reach Cursor: it was not started with start-cursor.sh / start-cursor.ps1 (debug port is off)');
  });
  const targets = await res.json();
  return targets
    .filter(t => t.type === 'page' && /workbench/.test(t.url))
    .map(t => ({
      id: t.id,
      title: t.title,
      ws: t.webSocketDebuggerUrl,
      kind: t.title === 'Cursor Agents' ? 'agents' : /\[SSH: /.test(t.title) ? 'ssh' : 'local',
    }));
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.onclose = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error(`CDP connect failed: ${this.wsUrl}`));
      ws.onclose = () => {
        for (const { reject } of this.pending.values()) reject(new Error('CDP closed'));
        this.pending.clear();
        this.onclose?.();
      };
      ws.onmessage = ev => {
        const msg = JSON.parse(ev.data);
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
        } else if (msg.method) {
          this.handlers.get(msg.method)?.(msg.params);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, fn) {
    this.handlers.set(method, fn);
  }

  async evaluate(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.value;
  }

  close() {
    try { this.ws?.close(); } catch {}
  }
}

const MOD = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };
const NAMED_KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Escape: { code: 'Escape', vk: 27 },
  Backspace: { code: 'Backspace', vk: 8 },
  Tab: { code: 'Tab', vk: 9 },
  Delete: { code: 'Delete', vk: 46 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
};

// Cursor's chat composer is a ProseMirror contenteditable; selectors ordered from most to least specific.
const FOCUS_COMPOSER = `(() => {
  const visible = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const selectors = ['.aislash-editor-input[contenteditable="true"]', '.ui-prompt-input-editor__input[contenteditable="true"]', '.composer-bar [contenteditable="true"]', '.auxiliarybar [contenteditable="true"]'];
  let eds = [];
  for (const s of selectors) { eds = [...document.querySelectorAll(s)].filter(visible); if (eds.length) break; }
  if (!eds.length) return null;
  const el = eds.find(e => e.contains(document.activeElement)) || eds[eds.length - 1];
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
})()`;

// Cursor 2.x shows attached images as .ui-prompt-input-image-preview (legacy: .context-pill-image).
const IMAGE_ATTACH_COUNT = `() => document.querySelectorAll(
  '.ui-prompt-input-image-preview, .context-pill-image, [aria-label^="Remove image"]'
).length`;

// Fallback: synthetic paste into the focused composer (older Cursor builds without a file input).
const pasteImage = (b64, name, type) => `(async () => {
  if (!${FOCUS_COMPOSER}) return null;
  const ed = document.activeElement.closest('[contenteditable="true"]') || document.activeElement;
  const before = (${IMAGE_ATTACH_COUNT})();
  const bin = Uint8Array.from(atob(${JSON.stringify(b64)}), c => c.charCodeAt(0));
  const dt = new DataTransfer();
  dt.items.add(new File([bin], ${JSON.stringify(name)}, { type: ${JSON.stringify(type)} }));
  ed.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  for (let i = 0; i < 25 && (${IMAGE_ATTACH_COUNT})() <= before; i++) await new Promise(r => setTimeout(r, 100));
  return (${IMAGE_ATTACH_COUNT})() > before;
})()`;

// Runs inside Cursor's renderer (injected via toString). Emits only whitelisted tags with escaped text, never raw DOM HTML.
function pageHelpers() {
  const vis = e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
  const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const SKIP = /ui-collapsible-header|md-clickable-code|output-preview|codicon-find|widget-close|model-picker/;
  const ACTION = /^(run|skip|allow|accept|reject|deny|approve|keep|undo|continue|stop|cancel|build|retry|yes|no\b|运行|跳过|允许|接受|拒绝|继续|停止|取消)/i;
  const BLOCK = new Set(['P', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'DIV']);
  const INLINE = new Set(['STRONG', 'B', 'EM', 'I', 'CODE', 'DEL']);
  const CODE_BLOCK = '.composer-code-block-container, .composer-message-codeblock, .ui-code-block, pre';
  const FILE_REF = 'code.md-inline-path-filename-like';

  // Edit/read tool cards keep the absolute path in the header's title; fall back to the shown file name.
  const toolFile = el => {
    const titled = [...el.querySelectorAll('[title]')].map(e => e.getAttribute('title')).find(t => /^(\/|~\/|[A-Za-z]:\\)\S+$/.test(t));
    return titled || el.querySelector('.ui-edit-tool-call__filename')?.innerText.trim() || null;
  };

  const findPanel = () => {
    // Agents window (newer Cursor): active chat panel with a virtualized transcript + live composer.
    const agentPanels = [...document.querySelectorAll('.agent-panel, .ui-tiling-panel')]
      .filter(vis)
      .filter(p => p.querySelector('.composer-react-transcript-root')
        && p.querySelector('.ui-prompt-input-editor__input[contenteditable="true"], .aislash-editor-input[contenteditable="true"]'));
    if (agentPanels.length) {
      return agentPanels.sort((a, b) =>
        ((b.querySelector('.composer-react-transcript-root')?.innerText || '').length)
        - ((a.querySelector('.composer-react-transcript-root')?.innerText || '').length))[0];
    }
    // IDE / older layouts: walk up from a visible composer to a message list.
    for (const ed of [...document.querySelectorAll('.aislash-editor-input, .ui-prompt-input-editor__input')]
      .filter(e => vis(e) && e.getAttribute('contenteditable') === 'true')) {
      let p = ed;
      while (p && !p.querySelector('[data-flat-index], .composer-react-transcript-root')) p = p.parentElement;
      if (p) return p;
    }
    const f = [...document.querySelectorAll('[data-flat-index]')].find(vis);
    return f ? f.closest('.composer-bar') || f.parentElement : null;
  };

  const buttonsIn = (root, strict) => [...root.querySelectorAll('button, [role=button], .anysphere-button, .anysphere-secondary-button, .composer-run-button, .composer-skip-button')]
    .filter(b => {
      if (!vis(b) || SKIP.test(b.className)) return false;
      // Inline file path chips are <code role="button"> — never treat as chat action buttons.
      if (b.matches('code, a, .md-inline-path-filename, .ui-markdown__inline-code, .ui-markdown__inline-path-filename')) return false;
      if (b.closest('code, pre, .ui-markdown__inline-code, .md-inline-path-filename')) return false;
      if (b.parentElement?.closest('button, [role=button]') && b.parentElement.closest('button, [role=button]') !== b) return false;
      return true;
    })
    .map(b => ({ el: b, label: ((b.innerText || '').trim() || b.getAttribute('aria-label') || b.title || '').split('\n')[0].slice(0, 30) }))
    .filter(x => x.label && x.label !== 'Shell command options' && !/\.\w{1,12}$/.test(x.label) && !/^Review$/i.test(x.label)
      && (!strict || ACTION.test(x.label)));

  const codeText = n => {
    const lines = n.querySelectorAll('.view-line');
    return lines.length ? [...lines].map(l => l.innerText).join('\n') : n.innerText;
  };

  const clean = node => {
    let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += esc(n.textContent); continue; }
      if (n.nodeType !== 1) continue;
      if (n.matches(CODE_BLOCK)) { out += `<pre>${esc(codeText(n).replace(/\n$/, ''))}</pre>`; continue; }
      const tag = n.tagName;
      if (['STYLE', 'SCRIPT', 'BUTTON', 'svg', 'SVG', 'IMG'].includes(tag)) continue;
      if (tag === 'BR') { out += '<br>'; continue; }
      if (tag === 'HR') { out += '<hr>'; continue; }
      // Plain text only — no file chips/buttons in chat (open via Dual pane / Files → Open…).
      if (n.matches(FILE_REF)) { out += esc(n.innerText.trim()); continue; }
      const inner = clean(n);
      const t = tag.toLowerCase();
      out += BLOCK.has(tag) || INLINE.has(tag) ? `<${t}>${inner}</${t}>` : inner;
    }
    return out;
  };

  const summary = el => {
    const head = el.querySelector('.ui-tool-call-card__header, .ui-collapsible-header, [class*="header"]') || el;
    return head.innerText.trim().replace(/\s*\n\s*/g, ' · ').slice(0, 240);
  };

  const topItems = panel => {
    const flats = [...panel.querySelectorAll('[data-flat-index]')].filter(e => !e.parentElement.closest('[data-flat-index]'));
    if (flats.length) return flats;
    // Newer Agents UI: virtualized transcript rows (no data-flat-index).
    const root = [...panel.querySelectorAll('.composer-react-transcript-root')].filter(vis)
      .sort((a, b) => ((b.innerText || '').length) - ((a.innerText || '').length))[0];
    if (!root) return [];
    const skip = /^(\d+[smhd] ago|New messages below|Thinking(\s+Thinking)*)$/i;
    return [...root.querySelectorAll('.composer-react-virtual-plane-row, .virtualized-composer-messages-row')]
      .filter(vis)
      .filter(row => {
        const t = (row.innerText || '').trim();
        return t && !skip.test(t.replace(/\s+/g, ' '));
      });
  };

  // Messages sent while the Agent is running wait in Cursor's queue tray until the current turn ends.
  const QUEUE_ROW = '[data-queue-row], .composer-toolbar-queue-item[data-queue-item-id]';
  const queueRows = () => [...document.querySelectorAll(QUEUE_ROW)].filter(vis);
  const queued = () => queueRows().map(e => ({
    id: e.dataset.queueItemId,
    t: (e.dataset.queueItemQuery || e.innerText || '').trim().slice(0, 4000),
  }));
  const isBusy = () => [...document.querySelectorAll('.composer-button-area .codicon-debug-stop, .send-with-mode .codicon-debug-stop')].some(vis);

  // First call (no action) returns the row center to hover over; hover-only buttons appear after that.
  const queueTarget = (id, action) => {
    const row = queueRows().find(e => e.dataset.queueItemId === id);
    if (!row) return null;
    row.scrollIntoView({ block: 'nearest' });
    if (!action) return center(row);
    const b = row.querySelector(`[data-queue-action="${CSS.escape(action)}"]`)
      || [...row.querySelectorAll('[aria-label]')].find(e => e.getAttribute('aria-label') === { send: 'Send now', remove: 'Remove', edit: 'Edit' }[action]);
    return b && vis(b) ? center(b) : null;
  };

  // Running subagents: task cards in the transcript plus the "N subagents running" tray above the composer.
  // Clicking a tray row opens that subagent's own transcript as a chat-editor tab (no composer there).
  const SUB_ROW = '.composer-toolbar-background-job-item';
  const subRowName = e => e.querySelector('.composer-toolbar-background-job-item-text')?.innerText.trim() || '';
  const subagents = () => {
    const names = new Set();
    for (const h of document.querySelectorAll('.task-tool-call-header')) {
      if (!vis(h) || !h.closest('[data-flat-index]')?.querySelector('.ui-subagent-status-indicator--running-loader, .task-subagent-header-pill-button--stop')) continue;
      const n = h.querySelector('span.truncate')?.childNodes[0]?.textContent.trim();
      if (n) names.add(n);
    }
    for (const r of document.querySelectorAll(SUB_ROW)) if (subRowName(r)) names.add(subRowName(r));
    return [...names];
  };
  const subTrayHeader = () => [...document.querySelectorAll('div')].find(e => vis(e) && [...e.childNodes].some(n => n.nodeType === 3 && /^\d+ subagents? running$/.test(n.textContent.trim())));
  const subTarget = (name, part) => {
    const row = [...document.querySelectorAll(SUB_ROW)].find(r => vis(r) && subRowName(r) === name);
    if (!row) { const h = subTrayHeader(); return h ? { expand: true, ...center(h) } : null; }
    if (part === 'stop') {
      const s = [...row.querySelectorAll('span.truncate')].find(e => e.innerText.trim() === 'Stop');
      return s ? center(s) : null;
    }
    return center(row.querySelector('.composer-toolbar-background-job-item-text') || row);
  };
  const activeChatTab = () => [...document.querySelectorAll('.tab.active')].map(e => e.getAttribute('aria-label') || '').find(l => /Chat Editors/.test(l)) || null;
  const tabTarget = label => {
    const t = [...document.querySelectorAll('.tab')].find(e => vis(e) && e.getAttribute('aria-label') === label);
    return t ? center(t) : null;
  };
  const hasComposer = () => [...document.querySelectorAll('.aislash-editor-input[contenteditable="true"], .ui-prompt-input-editor__input[contenteditable="true"]')].some(vis);

  // Editor / Changes / Simple Browser tabs in Agents (ui-tab-system-tab) and classic workbench tabs.
  const editorTabName = t => {
    const raw = (t.getAttribute('aria-label')
      || t.querySelector('.ui-tab-system-tab__content, .tab-label, .label-name')?.innerText
      || t.innerText || '').trim().replace(/\s+/g, ' ');
    return raw.replace(/\s*[●\*].*$/, '').replace(/\s+U$/i, '').replace(/\s*preview$/i, '').trim() || raw;
  };
  const isSyncedEditorTab = name => {
    if (!name) return false;
    if (/^Changes$/i.test(name)) return true;
    if (/^(Simple Browser|Preview)/i.test(name)) return true;
    // File-like tabs (BUILD_PLAN.md, path/to/file.ts). Skip the chat-title tab in the strip.
    return /\.\w{1,16}$/.test(name) || /[\\/]/.test(name);
  };
  const editorTabEls = () => {
    const modern = [...document.querySelectorAll('.ui-tab-system-tab')];
    const classic = [...document.querySelectorAll('.tabs-container .tab, .editor-group-container .tab, .monaco-workbench .tabs .tab')];
    return [...modern, ...classic].filter(e => {
      if (!vis(e)) return false;
      const l = e.getAttribute('aria-label') || '';
      if (/Chat Editors/i.test(l)) return false;
      return isSyncedEditorTab(editorTabName(e));
    });
  };
  const editorTabs = () => editorTabEls().map(t => ({
    name: editorTabName(t),
    label: t.getAttribute('aria-label') || editorTabName(t),
    active: t.getAttribute('aria-selected') === 'true' || t.classList.contains('active') || t.classList.contains('selected') || t.dataset.state === 'active',
    dirty: !!(t.querySelector('.dirty, .codicon-circle-filled') || /[●\*]|\sU$/i.test(t.getAttribute('aria-label') || t.innerText || '')),
  })).filter(t => t.name);
  const editorTabTarget = (name, part) => {
    const t = editorTabEls().find(e => {
      const n = editorTabName(e);
      return n === name || (e.getAttribute('aria-label') || '').startsWith(name);
    });
    if (!t) return null;
    if (part === 'close') {
      const c = t.querySelector('.codicon-close, .actions-container .codicon-close, .tab-actions .action-label, [aria-label*="Close" i], [class*="close"]');
      return c ? center(c.closest('a, button, .action-label, [role=button]') || c) : null;
    }
    return center(t);
  };

  // The Agent's ask-question tool renders as a toolbar above the composer, outside the message list.
  const QN = '.composer-questionnaire-toolbar';
  const qnBox = () => [...document.querySelectorAll(QN)].find(vis);
  const inQn = el => !!el.closest(QN);
  const qnOptions = q => [...q.querySelectorAll('.composer-questionnaire-toolbar-option')];
  const qnAction = (box, re) => [...box.querySelectorAll('.composer-questionnaire-toolbar-actions > *')].find(e => vis(e) && re.test(e.innerText));
  const questions = () => {
    const box = qnBox();
    if (!box) return null;
    const list = [...box.querySelectorAll('.composer-questionnaire-toolbar-question')].map(q => ({
      text: (q.querySelector('.composer-questionnaire-toolbar-question-label .markdown-root') || q.querySelector('.composer-questionnaire-toolbar-question-label'))?.innerText.trim() || '',
      options: qnOptions(q).map(o => {
        const ta = o.querySelector('textarea');
        return {
          label: ta ? '' : o.querySelector('.composer-questionnaire-toolbar-option-label')?.innerText.trim() || '',
          free: !!ta, value: ta?.value || '',
          sel: !!o.querySelector('.composer-questionnaire-toolbar-option-letter-selected'),
        };
      }),
    }));
    const submit = qnAction(box, /continue|submit|继续|提交/i);
    return { list, canSubmit: !!submit && submit.dataset.disabled !== 'true' };
  };
  const questionTarget = (qi, oi, part) => {
    const box = qnBox();
    if (!box) return null;
    if (part === 'submit' || part === 'skip') {
      const b = qnAction(box, part === 'skip' ? /skip|跳过/i : /continue|submit|继续|提交/i);
      return b ? center(b) : null;
    }
    const q = box.querySelectorAll('.composer-questionnaire-toolbar-question')[qi];
    const o = q && qnOptions(q)[oi];
    if (!o) return null;
    o.scrollIntoView({ block: 'nearest' });
    return center(o.querySelector('textarea') || o);
  };

  // Files changed by the Agent — legacy composer list OR Agents "Changes" tab cards.
  const filesToggle = () => [...document.querySelectorAll('span.cursor-pointer, span, button')].find(e =>
    vis(e) && /^\d+\s*files?$/i.test(e.innerText.trim().replace(/\s+/g, ' ')));
  const changedCount = () => parseInt(filesToggle()?.innerText || '0', 10) || 0;
  const changedRowsLegacy = () => [...document.querySelectorAll('.composer-file-list-item')].filter(vis);
  const changeCards = () => [...document.querySelectorAll('.ui-card')].filter(e =>
    vis(e) && e.querySelector('.ui-card__title-button, .ui-card__title'));
  const parseChangeTitle = raw => {
    // Strip bidi / isolate marks Cursor wraps around paths (U+200E–U+200F, U+2066–U+2069, BOM).
    const clean = String(raw || '').replace(/[\u200e\u200f\ufeff\u2066-\u2069]/g, '').trim();
    const add = (clean.match(/\+(\d+)/) || [])[1];
    const del = (clean.match(/[-−](\d+)/) || [])[1];
    const name = clean.split('\n')[0].replace(/\s+[+\-][\d\sNew]+$/i, '').replace(/\s+\+\d+.*$/, '').trim();
    return {
      name,
      add: add ? `+${add}` : '',
      del: del ? `-${del}` : '',
    };
  };
  const changedFilesLegacy = () => changedRowsLegacy().map(r => {
    const stat = [...r.querySelectorAll('.tabular-nums span')].map(s => s.innerText.trim());
    return {
      name: r.querySelector('span[style*="nowrap"]')?.innerText.trim() || r.innerText.trim().split('\n')[0],
      add: stat.find(s => s.startsWith('+')) || '',
      del: stat.find(s => /^[-−]/.test(s)) || '',
    };
  });
  const changedFilesCards = () => changeCards().map(card => {
    const title = card.querySelector('.ui-card__title-button, .ui-card__title')?.innerText || '';
    return parseChangeTitle(title);
  }).filter(f => f.name);
  const changedRows = () => {
    const legacy = changedRowsLegacy();
    return legacy.length ? legacy : changeCards();
  };
  const changedFiles = () => {
    const legacy = changedFilesLegacy();
    return legacy.length ? legacy : changedFilesCards();
  };
  const changesTab = () => [...document.querySelectorAll('.ui-tab-system-tab')].find(e =>
    vis(e) && /^Changes$/i.test((e.getAttribute('aria-label') || editorTabName(e) || '').trim()));
  const filesBar = () => {
    let t = filesToggle();
    while (t && !t.querySelector('[data-click-ready]')) t = t.parentElement;
    return t;
  };
  // Bar-level actions besides Stop (handled elsewhere) and Review (desktop-only diff view), e.g. Keep All / Undo All.
  const fileBarButtons = () => [...(filesBar()?.querySelectorAll('[data-click-ready]') || [])].filter(vis)
    .map(e => ({ el: e, label: (e.querySelector('.truncate') || e).innerText.trim() }))
    .filter(x => x.label && !/^(stop|review)$/i.test(x.label));
  const filesState = () => ({ files: changedFiles(), actions: fileBarButtons().map(x => x.label) });
  const fileTarget = (i, name, act) => {
    if (act === 'toggle') {
      const tab = changesTab();
      if (tab) return center(tab);
      const t = filesToggle();
      return t ? center(t) : null;
    }
    if (act === 'bar') return (b => b ? center(b.el) : null)(fileBarButtons().find(x => x.label === name));
    const rows = changedRows();
    const files = changedFiles();
    const row = rows[i];
    if (!row || files[i]?.name !== name) {
      // Name-based fallback (list may have reordered).
      const idx = files.findIndex(f => f.name === name);
      if (idx < 0 || !rows[idx]) return null;
      return fileTarget(idx, name, act);
    }
    row.scrollIntoView({ block: 'nearest' });
    if (act === 'row') return center(row.querySelector('.ui-card__title-button, .ui-card__title') || row);
    const icon = row.querySelector(act === 'undo' ? '.codicon-x-two' : '.codicon-check-two');
    return icon ? center(icon.closest('.anysphere-icon-button, button') || icon) : null;
  };

  // Editing a queued message loads it into the main composer, which is tagged with the item id until saved.
  const focusQueueEdit = id => {
    const bar = [...document.querySelectorAll('[data-editing-queue-item-id]')].find(e => vis(e) && e.dataset.editingQueueItemId === id);
    const ed = bar && [...bar.querySelectorAll('[contenteditable="true"]')].find(vis);
    if (!ed) return false;
    ed.focus();
    return true;
  };

  const stopTarget = () => {
    const icon = [...document.querySelectorAll('.composer-button-area .codicon-debug-stop, .send-with-mode .codicon-debug-stop')].find(vis);
    if (!icon) return null;
    return center(icon.closest('button, [role=button], .anysphere-icon-button') || icon);
  };

  const extract = () => {
    const panel = findPanel();
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const items = topItems(panel).map((el, idx) => {
      const kindEl = el.matches('[data-message-kind]') ? el : el.querySelector('[data-message-kind]');
      let k = kindEl?.dataset.messageKind
        || (el.querySelector('.composer-human-message, .ui-agent-transcript-human-bubble, .aislash-editor-input-readonly') ? 'human' : null)
        || (el.querySelector('.ui-tool-call-card, .ui-collapsible-header, .task-tool-call-header, .ui-edit-tool-call__filename') ? 'tool' : null)
        || (el.querySelector('.markdown-root, .anysphere-markdown-body, .agent-transcript-row-markdown') ? 'assistant' : null)
        || 'other';
      if (k === 'thinking') k = 'other';
      const item = { i: el.dataset.flatIndex || String(idx), k };
      if (k === 'human') {
        item.t = (el.querySelector('.aislash-editor-input-readonly, .composer-human-message, .ui-prompt-input-tiptap-readonly__content, .composer-human-message-content') || el).innerText.trim();
      } else if (k === 'assistant') {
        const md = el.querySelector('.markdown-root, .anysphere-markdown-body, .ui-markdown');
        item.h = md ? clean(md) : esc(el.innerText);
      } else item.t = summary(el);
      if (k === 'tool') { const f = toolFile(el); if (f) item.f = f; }
      // Only real Agent actions (Run / Stop / …) — never file-name pills after a turn.
      const b = buttonsIn(el, true);
      if (b.length) item.b = b.map(x => x.label);
      return item;
    }).filter(it => it.t || it.h);
    const global = buttonsIn(panel, true)
      .filter(x => !x.el.closest('[data-flat-index], .composer-react-virtual-plane-row, .virtualized-composer-messages-row') && !inQn(x.el))
      .map(x => x.label);
    const modeEl = [...document.querySelectorAll('.composer-unified-dropdown[data-mode]')].find(vis);
    const modelEl = [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis);
    return {
      rect: [r.x, r.y, r.width, r.height].map(Math.round),
      items,
      global,
      busy: isBusy(),
      queued: queued(),
      subagents: subagents(),
      changed: changedCount(),
      questions: questions(),
      readonly: !hasComposer(),
      mode: modeEl ? modeEl.innerText.trim() || modeEl.dataset.mode : null,
      model: modelEl ? modelEl.innerText.trim() : null,
    };
  };

  // Named controls in Cursor's UI; each entry lists fallbacks from newest to oldest Cursor layouts.
  const CONTROLS = {
    mode: () => [...document.querySelectorAll('.composer-unified-dropdown[data-mode]')].find(vis),
    model: () => [...document.querySelectorAll('.ui-model-picker__trigger, .composer-unified-dropdown-model')].find(vis),
    history: () => [...document.querySelectorAll('[aria-label^="Show Chat History"], [aria-label^="Show Agent History"], [aria-label^="Open Chat History"]')].find(vis)
      || [...document.querySelectorAll('button, [role=button]')].find(el => vis(el) && /^(Show|Open)( Chat| Agent)? History\b/i.test(el.getAttribute('aria-label') || '')),
    newChat: () => [...document.querySelectorAll('[aria-label^="New Agent"], [aria-label^="New Chat"]')].find(vis)
      || [...document.querySelectorAll('.ui-sidebar-menu-button-trigger')].find(el => vis(el) && /^New Chat$/i.test((el.innerText || '').trim().split('\n')[0])),
  };

  // Agents window: past chats live in the left sidebar (no separate History popup anymore).
  const agentSidebarVisible = () => [...document.querySelectorAll('.glass-sidebar-agent-list-container, [aria-label="Sidebar"].ui-sidebar, [aria-label=Sidebar]')].some(vis);
  const ensureAgentSidebar = () => {
    if (agentSidebarVisible()) return null;
    const show = [...document.querySelectorAll('button, [role=button]')].find(el => {
      if (!vis(el)) return false;
      const a = el.getAttribute('aria-label') || '';
      return /^(Show Sidebar|Toggle Primary Sidebar|Toggle Sidebar)$/i.test(a) || /show sidebar/i.test(a);
    });
    return show ? center(show) : null;
  };
  const agentSidebarChats = () => {
    const skip = /^(New Chat|Automations|Customize|Projects|Pinned|Agents|Ctrl\+N)$/i;
    const items = [...document.querySelectorAll('.glass-sidebar-agent-list-container li.ui-sidebar-menu-item, [aria-label="Sidebar"] li.ui-sidebar-menu-item, [aria-label=Sidebar] li.ui-sidebar-menu-item')]
      .filter(vis)
      .map(el => {
        const texts = [...el.querySelectorAll('.ui-sidebar-menu-button-content .ui-text')].map(s => s.innerText.trim()).filter(Boolean);
        const label = (texts[0] || (el.innerText || '').trim().split('\n')[0] || '').slice(0, 80);
        const btn = el.querySelector('.ui-sidebar-menu-button-trigger, .ui-sidebar-menu-button') || el;
        const checked = el.getAttribute('aria-selected') === 'true'
          || btn.getAttribute('aria-current') === 'page'
          || /\b(active|selected|current)\b/i.test(`${el.className} ${btn.className}`);
        return { el: btn, label, checked };
      })
      .filter(x => x.label && !skip.test(x.label));
    // Deduplicate identical labels by keeping first occurrence (sidebar order).
    const seen = new Set();
    return items.filter(x => (seen.has(x.label) ? false : (seen.add(x.label), true)));
  };

  const center = el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  const control = name => {
    const el = CONTROLS[name]?.();
    return el ? center(el) : null;
  };

  const MENU_ITEMS = {
    mode: () => [...document.querySelectorAll('.composer-unified-context-menu-item')].map(e => ({ el: e, label: e.innerText.trim().split('\n')[0], checked: !!e.querySelector('.codicon-check') })),
    model: () => [...document.querySelectorAll('.ui-menu__row')].filter(e => e.querySelector('.ui-model-picker__item-content-name')).map(e => ({ el: e, id: e.dataset.testid, params: !!e.querySelector('[data-testid=parameter-edit-btn]'), label: e.querySelector('.ui-model-picker__item-content-name').innerText.trim(), checked: !!e.querySelector('.codicon-check, .ui-model-picker__item-right-section [class*=check]') })),
    history: () => {
      const rows = [...document.querySelectorAll('.composer-history-hover-menu .ui-menu__row')];
      if (rows.length) return rows.map(e => ({ el: e, label: (e.querySelector('.compact-agent-history-react-menu-label, .ui-menu__item-content') || e).innerText.trim().split('\n')[0].slice(0, 80), checked: e.getAttribute('aria-checked') === 'true' || /\b(selected|active|current)\b/.test(e.className) }));
      const sidebar = agentSidebarChats();
      if (sidebar.length) return sidebar;
      return [...document.querySelectorAll('.quick-input-widget .monaco-list-row')].map(e => ({ el: e, label: (e.getAttribute('aria-label') || e.innerText).trim().split('\n')[0].slice(0, 80), checked: e.classList.contains('focused') }));
    },
  };

  const menuItems = kind => (MENU_ITEMS[kind]?.() || []).filter(x => vis(x.el) && x.label).map(({ el, ...rest }) => rest);

  const menuOpen = () => [...document.querySelectorAll('.ui-menu, .composer-unified-context-menu-item, .composer-history-hover-menu')].some(vis);

  // Model parameters (context size, effort, fast…) live in a per-model submenu behind its "Edit" button.
  const maxToggle = () => {
    const t = [...document.querySelectorAll('[data-testid=max-mode-toggle]')].find(vis);
    return t ? { ...center(t), on: t.getAttribute('aria-checked') === 'true' } : null;
  };
  const modelTarget = (id, part) => {
    const row = [...document.querySelectorAll('[data-testid=model-picker-menu] .ui-menu__row')].find(e => e.dataset.testid === id);
    if (!row) return null;
    row.scrollIntoView({ block: 'nearest' });
    if (part !== 'edit') return center(row);
    const b = row.querySelector('[data-testid=parameter-edit-btn]');
    return b && vis(b) ? center(b) : null;
  };
  const paramRows = () => {
    const menu = [...document.querySelectorAll('[data-testid=parameter-submenu]')].find(vis);
    if (!menu) return null;
    return [...menu.querySelectorAll('.ui-menu__section')].map(s => ({
      title: s.querySelector('.ui-menu__section-title')?.innerText.trim() || '',
      rows: [...s.querySelectorAll('.ui-menu__row, .ui-menu__toggle-row')].filter(vis).map(r => {
        const toggle = r.matches('.ui-menu__toggle-row');
        return { el: r, label: (r.querySelector('.ui-menu__item-content') || r).innerText.trim(), toggle, checked: toggle ? r.getAttribute('aria-checked') === 'true' : !!r.querySelector('.ui-model-picker__param-check') };
      }),
    }));
  };
  const modelParams = () => paramRows()?.map(s => ({ title: s.title, items: s.rows.map(({ el, ...rest }) => rest) })) || null;
  const paramTarget = (title, label) => {
    const row = paramRows()?.find(s => s.title === title)?.rows.find(r => r.label === label);
    return row ? center(row.el) : null;
  };

  const menuItem = (kind, label) => {
    const hit = (MENU_ITEMS[kind]?.() || []).find(x => vis(x.el) && x.label === label);
    if (!hit) return null;
    hit.el.scrollIntoView({ block: 'nearest' });
    return center(hit.el);
  };

  // Returns the button's on-screen center so the click goes through real mouse events.
  const locate = (item, n) => {
    const panel = findPanel();
    if (!panel) return null;
    let root = item === 'g' ? panel : panel.querySelector(`[data-flat-index="${CSS.escape(item)}"]`);
    if (!root && item !== 'g') {
      const list = topItems(panel);
      root = list[Number(item)] || list.find(el => el.dataset.flatIndex === item) || null;
    }
    if (!root) return null;
    const list = item === 'g'
      ? buttonsIn(panel, true).filter(x => !x.el.closest('[data-flat-index], .composer-react-virtual-plane-row, .virtualized-composer-messages-row') && !inQn(x.el))
      : buttonsIn(root, false);
    const b = list[n]?.el;
    if (!b) return null;
    b.scrollIntoView({ block: 'center' });
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };

  const panelRect = () => {
    const p = findPanel();
    if (!p) return null;
    const r = p.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height].map(Math.round);
  };

  // Cheap per-window check for notifications: is the Agent running, and is it waiting on a button?
  // "Run in background" shows up on any command running longer than ~5 s; it is not a request for approval.
  const WAIT = /^(?!.*(background|后台))(run|allow|accept|approve|continue|yes\b|运行|允许|接受|批准|继续)/i;
  const agentState = () => {
    const panel = findPanel();
    if (!panel) return null;
    const busy = isBusy();
    const items = topItems(panel);
    let waiting = null, waitingText = '';
    for (const el of items.slice(-3)) {
      const labels = buttonsIn(el, false).map(x => x.label).filter(l => WAIT.test(l));
      if (labels.length) { waiting = `${el.dataset.flatIndex}:${labels.join('/')}`; waitingText = summary(el); }
    }
    const global = buttonsIn(panel, true).filter(x => !x.el.closest('[data-flat-index]') && !inQn(x.el) && WAIT.test(x.label)).map(x => x.label);
    if (!waiting && global.length) { waiting = `g:${global.join('/')}`; waitingText = global.join(' / '); }
    const qs = questions();
    if (qs?.list.length) {
      const text = qs.list.map(q => q.text).join(' / ');
      waiting = `q:${text.slice(0, 120)}`;
      waitingText = text;
    }
    const lastReply = [...items].reverse().find(el => el.matches('[data-message-kind="assistant"]') || el.querySelector('[data-message-kind="assistant"]'));
    const last = lastReply ? lastReply.innerText.trim().replace(/\s+/g, ' ').slice(0, 160) : '';
    return { busy, waiting, waitingText, last };
  };

  const quickOpenRows = () => {
    const w = document.querySelector('.quick-input-widget');
    if (!w || !vis(w)) return null;
    return [...w.querySelectorAll('.monaco-list-row')].filter(vis).map(e => ({
      name: e.querySelector('.label-name')?.innerText.trim() || '',
      dir: e.querySelector('.label-description')?.innerText.trim() || '',
    }));
  };

  // Selection in the editor, else the last visible code block, else last assistant text snippet.
  const clipboardPull = () => {
    const sel = (getSelection()?.toString() || '').trim();
    if (sel) return { source: 'selection', text: sel.slice(0, 100000) };
    const blocks = [...document.querySelectorAll(CODE_BLOCK)].filter(vis);
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock) {
      const t = (lastBlock.innerText || '').trim();
      if (t) return { source: 'code', text: t.slice(0, 100000) };
    }
    const assistants = [...document.querySelectorAll('[data-message-kind="assistant"], .markdown-root, .anysphere-markdown-body')].filter(vis);
    const last = assistants[assistants.length - 1];
    const t = (last?.innerText || '').trim();
    if (t) return { source: 'assistant', text: t.slice(0, 100000) };
    return { source: 'empty', text: '' };
  };

  return { extract, locate, panelRect, control, menuItems, menuItem, quickOpenRows, agentState, queueTarget, stopTarget, focusQueueEdit,
    menuOpen, maxToggle, modelTarget, modelParams, paramTarget, subTarget, activeChatTab, tabTarget, hasComposer, filesState, fileTarget, questionTarget,
    editorTabs, editorTabTarget, ensureAgentSidebar, agentSidebarVisible, clipboardPull };
}

const helpersCall = call => `(${pageHelpers.toString()})().${call}`;

function deviceName(id) {
  return listDevices().find(d => d.id === id)?.name || 'Device';
}

function broadcastPresence(winId) {
  if (!winId) return;
  for (const v of listViewers()) {
    if (typeof v.emit === 'function') v.emit({ t: 'presence', ...presenceSnapshot(winId, v.deviceId) });
  }
}

class Session {
  constructor(client, deviceId) {
    this.client = client;
    this.deviceId = deviceId;
    // The phone reports when the app goes to the background; notifications skip the window it is looking at.
    this.visible = true;
    this.cdp = null;
    this.viewport = { w: 1000, h: 800 };
    this.screencast = { format: 'jpeg', quality: 60, maxWidth: 1280, maxHeight: 2400 };
    this.awaitingAck = null;
    this.lastFrameAt = 0;
    this.lastHash = '';
    this.mode = 'chat';
    this.lastChat = '';
    this.lastPanel = '';
    this.idleTimer = setInterval(() => this.pollIfIdle(), 2000);
  }

  async setMode(mode) {
    this.mode = mode === 'screen' ? 'screen' : 'chat';
    clearInterval(this.chatTimer);
    if (!this.cdp) return;
    if (this.mode === 'chat') {
      await this.cdp.send('Page.stopScreencast').catch(() => {});
      this.lastChat = '';
      this.chatTimer = setInterval(() => this.pollChat().catch(() => {}), 700);
      await this.pollChat();
    } else {
      this.lastPanel = '';
      await this.sendPanelRect();
      await this.snapshot(true);
      await this.startScreencast();
    }
  }

  async pollChat() {
    if (!this.cdp || this.polling) return;
    this.polling = true;
    try {
      const chat = await this.cdp.evaluate(helpersCall('extract()'));
      const json = JSON.stringify(chat);
      if (json !== this.lastChat) {
        this.lastChat = json;
        this.emit({ t: 'chat', chat });
      }
    } finally {
      this.polling = false;
    }
  }

  async sendPanelRect() {
    const rect = await this.cdp.evaluate(helpersCall('panelRect()')).catch(() => null);
    const json = JSON.stringify(rect);
    if (json !== this.lastPanel) {
      this.lastPanel = json;
      this.emit({ t: 'panel', rect });
    }
  }

  async clickButton(item, n) {
    const pos = await this.cdp.evaluate(helpersCall(`locate(${JSON.stringify(String(item))}, ${Number(n) || 0})`));
    if (!pos) throw new Error('That button is gone; the state may have changed');
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async editQueued(id, text) {
    if (!text.trim()) throw new Error('The message cannot be empty; use "Delete" to drop it');
    await this.queueAction(id, 'edit');
    const focus = () => this.cdp.evaluate(helpersCall(`focusQueueEdit(${JSON.stringify(String(id))})`));
    let ok = false;
    for (let i = 0; i < 10 && !ok; i++) {
      await new Promise(r => setTimeout(r, 100));
      ok = await focus();
    }
    if (!ok) throw new Error('Cursor did not enter edit mode; nothing changed');
    await this.key(process.platform === 'darwin' ? 'Meta+A' : 'Ctrl+A');
    await this.typeText(text);
    await this.key('Enter');
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async queueAction(id, action) {
    if (!['send', 'remove', 'edit'].includes(action)) throw new Error('Unsupported queue action');
    const call = a => this.cdp.evaluate(helpersCall(`queueTarget(${JSON.stringify(String(id))}${a ? `, ${JSON.stringify(a)}` : ''})`));
    const row = await call();
    if (!row) throw new Error('That queued message is gone (it may have just been sent)');
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
    let pos = null;
    for (let i = 0; i < 6 && !pos; i++) {
      await new Promise(r => setTimeout(r, 80));
      pos = await call(action);
    }
    if (!pos) throw new Error('Could not find the queue buttons (your Cursor version may differ)');
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async subagentAction(name, part) {
    const call = `subTarget(${JSON.stringify(String(name))}, ${JSON.stringify(part)})`;
    let pos = await this.cdp.evaluate(helpersCall(call));
    if (pos?.expand) {
      await this.tapCss(pos.x, pos.y);
      for (let i = 0; i < 8 && (!pos || pos.expand); i++) {
        await new Promise(r => setTimeout(r, 120));
        pos = await this.cdp.evaluate(helpersCall(call));
      }
    }
    if (!pos || pos.expand) throw new Error('That subagent has finished, or Cursor cannot find it');
    if (part === 'open') {
      const tab = await this.cdp.evaluate(helpersCall('activeChatTab()'));
      if (tab && await this.cdp.evaluate(helpersCall('hasComposer()'))) this.mainTab = tab;
    }
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 500);
  }

  // Opens Cursor's changed-files list / Changes tab if needed, runs fn, then leaves the tab open
  // (Agents Changes tab is useful to keep; legacy composer list is collapsed again).
  async withFiles(fn) {
    const state = () => this.cdp.evaluate(helpersCall('filesState()'));
    let s = await state();
    const opened = !s.files.length;
    if (opened) {
      const t = await this.cdp.evaluate(helpersCall('fileTarget(0, "", "toggle")'));
      if (!t) return fn(s);
      await this.tapCss(t.x, t.y);
      for (let i = 0; i < 12 && !s.files.length; i++) {
        await new Promise(r => setTimeout(r, 150));
        s = await state();
      }
    }
    return fn(s);
  }

  async listChanges() {
    const s = await this.withFiles(async s => s);
    this.emit({ t: 'changes', ...s });
  }

  async changeAction(i, name, act) {
    if (!['keep', 'undo', 'bar'].includes(act)) throw new Error('Unsupported action');
    await this.withFiles(async () => {
      const call = a => helpersCall(`fileTarget(${Number(i) || 0}, ${JSON.stringify(String(name))}, ${JSON.stringify(a)})`);
      if (act !== 'bar') {
        const row = await this.cdp.evaluate(call('row'));
        if (!row) throw new Error('The file list changed; open it again');
        await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
        await new Promise(r => setTimeout(r, 120));
      }
      const pos = await this.cdp.evaluate(call(act));
      if (!pos) throw new Error('Button not found (your Cursor version may differ)');
      await this.tapCss(pos.x, pos.y);
      await new Promise(r => setTimeout(r, 400));
    });
    await this.listChanges();
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async backToMain() {
    const pos = this.mainTab && await this.cdp.evaluate(helpersCall(`tabTarget(${JSON.stringify(this.mainTab)})`));
    if (!pos) throw new Error('Cannot find the main chat tab; switch back manually in "Screen"');
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 400);
  }

  async stopAgent() {
    const pos = await this.cdp.evaluate(helpersCall('stopTarget()'));
    if (!pos) throw new Error('The Agent is not running');
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async pressControl(name) {
    const pos = await this.cdp.evaluate(helpersCall(`control(${JSON.stringify(name)})`));
    if (!pos) throw new Error('This window has no such button (your Cursor version or layout may differ)');
    await this.tapCss(pos.x, pos.y);
  }

  // Menus are read by opening them in Cursor, then closed again so the desktop UI is left as it was.
  async openMenu(kind) {
    // Agents window: history is the left sidebar list, not a composer History popup.
    if (kind === 'history') {
      const show = await this.cdp.evaluate(helpersCall('ensureAgentSidebar()'));
      if (show?.x != null) {
        await this.tapCss(show.x, show.y);
        await new Promise(r => setTimeout(r, 250));
      }
      let items = [];
      for (let i = 0; i < 12 && !items.length; i++) {
        await new Promise(r => setTimeout(r, 150));
        items = await this.cdp.evaluate(helpersCall(`menuItems('history')`));
      }
      if (!items.length) {
        // Last resort: try the legacy History button if this is an IDE composer window.
        const legacy = await this.cdp.evaluate(helpersCall(`control('history')`));
        if (legacy) {
          await this.tapCss(legacy.x, legacy.y);
          for (let i = 0; i < 10 && !items.length; i++) {
            await new Promise(r => setTimeout(r, 150));
            items = await this.cdp.evaluate(helpersCall(`menuItems('history')`));
          }
          await this.closeMenus();
        }
      }
      if (!items.length) throw new Error('No chat history found. In the Agents window, show the left sidebar (chat list) and try again.');
      this.emit({ t: 'menu', kind, items, max: null });
      return;
    }
    await this.pressControl(kind);
    let items = [];
    for (let i = 0; i < 10 && !items.length; i++) {
      await new Promise(r => setTimeout(r, 150));
      items = await this.cdp.evaluate(helpersCall(`menuItems(${JSON.stringify(kind)})`));
    }
    const max = kind === 'model' ? await this.cdp.evaluate(helpersCall('maxToggle()?.on ?? null')) : null;
    await this.closeMenus();
    this.emit({ t: 'menu', kind, items, max });
  }

  async closeMenus() {
    for (let i = 0; i < 3 && await this.cdp.evaluate(helpersCall('menuOpen()')); i++) {
      await this.key('Escape');
      await new Promise(r => setTimeout(r, 120));
    }
  }

  async waitFor(call, tries = 10) {
    for (let i = 0; i < tries; i++) {
      await new Promise(r => setTimeout(r, 120));
      const v = await this.cdp.evaluate(helpersCall(call));
      if (v) return v;
    }
    return null;
  }

  async toggleMax() {
    await this.pressControl('model');
    const t = await this.waitFor('maxToggle()');
    if (!t) { await this.closeMenus(); throw new Error('This Cursor version has no MAX Mode toggle'); }
    await this.tapCss(t.x, t.y);
    await new Promise(r => setTimeout(r, 250));
    await this.closeMenus();
    await this.openMenu('model');
  }

  // Leaves the parameter submenu open; callers must closeMenus().
  async openParamMenu(model) {
    const id = JSON.stringify(String(model));
    await this.pressControl('model');
    const row = await this.waitFor(`modelTarget(${id})`);
    if (!row) { await this.closeMenus(); throw new Error('That model is not in the list'); }
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: row.x, y: row.y });
    const edit = await this.waitFor(`modelTarget(${id}, 'edit')`, 6);
    if (!edit) { await this.closeMenus(); throw new Error('This model has no adjustable parameters'); }
    await this.tapCss(edit.x, edit.y);
    const params = await this.waitFor('modelParams()');
    if (!params) { await this.closeMenus(); throw new Error('The parameter menu did not open (your Cursor version may differ)'); }
    return params;
  }

  async showParams(model, label) {
    try {
      this.emit({ t: 'params', model, label, sections: await this.openParamMenu(model) });
    } finally {
      await this.closeMenus();
    }
  }

  async pickParam(model, label, section, value) {
    try {
      await this.openParamMenu(model);
      const pos = await this.cdp.evaluate(helpersCall(`paramTarget(${JSON.stringify(String(section))}, ${JSON.stringify(String(value))})`));
      if (!pos) throw new Error(`Parameter not found: ${section} / ${value}`);
      await this.tapCss(pos.x, pos.y);
      await new Promise(r => setTimeout(r, 250));
    } finally {
      await this.closeMenus();
    }
    await this.showParams(model, label);
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async pickMenu(kind, label) {
    if (kind === 'history') {
      const show = await this.cdp.evaluate(helpersCall('ensureAgentSidebar()'));
      if (show?.x != null) {
        await this.tapCss(show.x, show.y);
        await new Promise(r => setTimeout(r, 250));
      }
      let pos = null;
      for (let i = 0; i < 12 && !pos; i++) {
        await new Promise(r => setTimeout(r, 150));
        pos = await this.cdp.evaluate(helpersCall(`menuItem('history', ${JSON.stringify(String(label))})`));
      }
      if (!pos) {
        const legacy = await this.cdp.evaluate(helpersCall(`control('history')`));
        if (legacy) {
          await this.tapCss(legacy.x, legacy.y);
          for (let i = 0; i < 10 && !pos; i++) {
            await new Promise(r => setTimeout(r, 150));
            pos = await this.cdp.evaluate(helpersCall(`menuItem('history', ${JSON.stringify(String(label))})`));
          }
        }
      }
      if (!pos) throw new Error(`Option not found: ${label}`);
      await this.tapCss(pos.x, pos.y);
      // Agents chats take a moment to swap the virtualized transcript; force several refreshes.
      this.lastChat = '';
      for (const ms of [400, 900, 1600, 2800]) {
        setTimeout(() => { this.lastChat = ''; this.pollChat().catch(() => {}); }, ms);
      }
      return;
    }
    await this.pressControl(kind);
    let pos = null;
    for (let i = 0; i < 10 && !pos; i++) {
      await new Promise(r => setTimeout(r, 150));
      pos = await this.cdp.evaluate(helpersCall(`menuItem(${JSON.stringify(kind)}, ${JSON.stringify(String(label))})`));
    }
    if (!pos) {
      await this.key('Escape');
      throw new Error(`Option not found: ${label}`);
    }
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.pollChat().catch(() => {}), 500);
  }

  async scrollChat(dy) {
    const rect = await this.cdp.evaluate(helpersCall('panelRect()'));
    if (!rect) return;
    const [x, y, w, h] = rect;
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: x + w / 2, y: y + h / 2, deltaX: 0, deltaY: dy });
    setTimeout(() => this.pollChat().catch(() => {}), 400);
  }

  emit(obj) {
    if (this.client.readyState === 1) this.client.send(JSON.stringify(obj));
  }

  // Asks Cursor's own Cmd+P index where a bare file name lives.
  // open=false (default): return matches then Escape. open=true: Enter the best match.
  async quickOpen(name, { open = false } = {}) {
    await this.key(process.platform === 'darwin' ? 'Meta+p' : 'Ctrl+p');
    try {
      let rows = null;
      for (let i = 0; i < 6 && !rows; i++) {
        await new Promise(r => setTimeout(r, 150));
        rows = await this.cdp.evaluate(helpersCall('quickOpenRows()'));
      }
      if (!rows) return [];
      await this.cdp.send('Input.insertText', { text: name });
      let hits = [];
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 250));
        const all = await this.cdp.evaluate(helpersCall('quickOpenRows()')) || [];
        hits = all.filter(r => r.name === name || r.name?.includes(name) || name.includes(r.name));
        if (!hits.length) hits = all;
        if (hits.length) break;
      }
      if (open && hits.length) {
        await this.key('Enter');
        return hits;
      }
      return hits;
    } finally {
      if (!open) await this.key('Escape');
    }
  }

  async listEditors() {
    const tabs = await this.cdp.evaluate(helpersCall('editorTabs()')) || [];
    this.emit({ t: 'editors', tabs });
    return tabs;
  }

  async editorFocus(name) {
    const pos = await this.cdp.evaluate(helpersCall(`editorTabTarget(${JSON.stringify(name)}, 'focus')`));
    if (!pos) throw new Error(`Editor tab not found: ${name}`);
    await this.tapCss(pos.x, pos.y);
    setTimeout(() => this.listEditors().catch(() => {}), 200);
  }

  async editorClose(name) {
    const pos = await this.cdp.evaluate(helpersCall(`editorTabTarget(${JSON.stringify(name)}, 'close')`));
    if (!pos) {
      // Fallback: focus then Ctrl+W
      await this.editorFocus(name).catch(() => {});
      await this.key(process.platform === 'darwin' ? 'Meta+w' : 'Ctrl+w');
    } else {
      await this.tapCss(pos.x, pos.y);
    }
    setTimeout(() => this.listEditors().catch(() => {}), 250);
  }

  async editorSuggest(query) {
    // Workspace index only — never poke Cursor Quick Open while the user is typing.
    const q = String(query || '').trim();
    if (!q) {
      this.emit({ t: 'editorSuggest', query: '', hits: [] });
      return [];
    }
    const ws = workspaceForTitle(this.winTitle || '');
    let hits = [];
    if (ws) {
      try { hits = await searchFiles(ws.host, ws.root, q, 24); } catch { hits = []; }
    }
    this.emit({ t: 'editorSuggest', query: q, hits });
    return hits;
  }

  async editorOpen(query) {
    const q = String(query || '').trim();
    if (!q) throw new Error('Enter a file name (e.g. BUILD_PLAN.md)');
    const hits = await this.quickOpen(q, { open: true });
    if (!hits.length) throw new Error(`Nothing matched Quick Open for "${q}"`);
    await new Promise(r => setTimeout(r, 400));
    await this.listEditors();
    // Also load preview into the phone pane when it looks like a file path.
    const preview = hits[0]?.dir ? `${hits[0].dir}/${hits[0].name}` : (hits[0]?.name || q);
    if (/\.\w+$/.test(q) || preview) {
      try { await this.openFile(preview); } catch { /* tab sync is enough */ }
    }
  }

  async resolveFile(text) {
    const { p, line } = parseRef(text);
    if (!p) throw new Error('Not a file path');
    const ws = workspaceForTitle(this.winTitle || '');
    const host = ws ? ws.host : /\[SSH: ([^\]]+)\]/.exec(this.winTitle || '')?.[1] || null;
    const isAbs = /^(\/|~\/)/.test(p);
    const tried = [];
    const tryPath = async (h, abs) => {
      if (tried.some(t => t.h === h && t.abs === abs)) return null;
      tried.push({ h, abs });
      const size = await fileSize(h, abs);
      return size == null ? null : { host: h, path: abs, size, line };
    };
    if (isAbs) {
      const hit = await tryPath(host, p);
      if (hit) return hit;
    } else if (ws) {
      const hit = await tryPath(ws.host, path.posix.join(ws.root, p));
      if (hit) return hit;
    }
    if (this.winTitle === 'Cursor Agents') {
      // The Agents window mixes projects, so try recently opened folders.
      for (const w of workspaces().slice(0, 12)) {
        const hit = await tryPath(w.host, isAbs ? p : path.posix.join(w.root.replace(/\\/g, '/'), p));
        if (hit) return hit;
      }
      // Basename search across recent workspaces (BUILD_PLAN.md, etc.).
      const base = path.posix.basename(p);
      for (const w of workspaces().slice(0, 8)) {
        try {
          const found = await searchFiles(w.host, w.root, base, 8);
          const best = found.find(h => h.name === base) || found[0];
          if (best?.path) {
            const abs = best.path.startsWith('/') || /^[a-zA-Z]:/.test(best.path)
              ? best.path
              : path.posix.join(w.root.replace(/\\/g, '/'), best.path);
            const hit = await tryPath(w.host, abs);
            if (hit) return hit;
          }
        } catch { /* next workspace */ }
      }
      throw new Error(`File not found (it may have been deleted or moved): ${p}`);
    }
    const name = path.posix.basename(p);
    const dir = path.posix.dirname(p);
    const hits = await this.quickOpen(name);
    // Prefer matches inside this workspace (relative dir) whose folder ends with the path the chat showed.
    const ranked = hits
      .map(h => ({ ...h, abs: h.dir.startsWith('/') ? path.posix.join(h.dir, name) : ws ? path.posix.join(ws.root, h.dir, name) : null }))
      .filter(h => h.abs)
      .sort((a, b) => (dir !== '.' && b.abs.endsWith('/' + p)) - (dir !== '.' && a.abs.endsWith('/' + p)) || a.dir.startsWith('/') - b.dir.startsWith('/'));
    for (const h of ranked) {
      const hit = await tryPath(host, h.abs);
      if (hit) return hit;
    }
    throw new Error(`File not found (it may have been deleted or moved): ${p}`);
  }

  async openFile(text) {
    this.emit({ t: 'file', loading: true, name: path.posix.basename(parseRef(text).p) });
    try {
      const f = await this.resolveFile(text);
      const body = await readFile(f.host, f.path, f.size);
      this.emit({ t: 'file', name: path.posix.basename(f.path), path: f.path, host: f.host, size: f.size, line: f.line, ...body });
    } catch (e) {
      this.emit({ t: 'file', error: e.message, name: path.posix.basename(parseRef(text).p) });
    }
  }

  async openDiff(text) {
    const label = path.posix.basename(parseRef(text).p);
    this.emit({ t: 'diff', loading: true, name: label });
    try {
      const f = await this.resolveFile(text);
      const body = await readDiff(f.host, f.path);
      this.emit({ t: 'diff', name: path.posix.basename(f.path), path: f.path, host: f.host, ...body });
    } catch (e) {
      this.emit({ t: 'diff', error: e.message, name: label });
    }
  }

  async attach(targetId) {
    this.detach();
    const wins = await listWindows();
    const win = wins.find(w => w.id === targetId) || wins[0];
    if (!win) throw new Error('No Cursor window found; make sure Cursor was started with --remote-debugging-port=9222');
    const cdp = new Cdp(win.ws);
    await cdp.connect();
    this.cdp = cdp;
    this.targetId = win.id;
    this.winTitle = win.title;
    cdp.onclose = () => {
      if (this.cdp === cdp) {
        this.cdp = null;
        this.emit({ t: 'status', ok: false, msg: 'Lost connection to the Cursor window' });
      }
    };
    cdp.on('Page.screencastFrame', p => this.onFrame(p));
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
    await this.refreshViewport();
    this.emit({ t: 'attached', id: win.id, title: win.title });
    if (this.visible) {
      presenceHeartbeat(win.id, this.deviceId, deviceName(this.deviceId));
      broadcastPresence(win.id);
    }
    await this.setMode(this.mode);
  }

  detach() {
    clearInterval(this.chatTimer);
    const winId = this.targetId;
    if (winId) {
      presenceRelease(winId, this.deviceId);
      broadcastPresence(winId);
    }
    if (this.cdp) {
      const cdp = this.cdp;
      this.cdp = null;
      cdp.send('Page.stopScreencast').catch(() => {}).finally(() => cdp.close());
    }
  }

  async refreshViewport() {
    const v = await this.cdp.evaluate('({ w: innerWidth, h: innerHeight })');
    if (v) this.viewport = v;
  }

  async startScreencast() {
    await this.cdp.send('Page.startScreencast', { ...this.screencast, everyNthFrame: 1 });
  }

  onFrame({ data, metadata, sessionId }) {
    this.lastFrameAt = Date.now();
    if (metadata?.deviceWidth) this.viewport = { w: metadata.deviceWidth, h: metadata.deviceHeight };
    this.sendFrame(data);
    this.awaitingAck = sessionId;
    // Don't let a slow phone stall the stream forever.
    clearTimeout(this.ackTimer);
    this.ackTimer = setTimeout(() => this.ack(), 1500);
  }

  ack() {
    clearTimeout(this.ackTimer);
    if (this.awaitingAck == null || !this.cdp) return;
    const sessionId = this.awaitingAck;
    this.awaitingAck = null;
    this.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  }

  sendFrame(data, force = false) {
    const hash = crypto.createHash('md5').update(data).digest('hex');
    if (!force && hash === this.lastHash) return;
    this.lastHash = hash;
    this.emit({ t: 'frame', data, w: this.viewport.w, h: this.viewport.h });
  }

  // Electron stops painting occluded/minimized windows, so screencast goes quiet; fall back to screenshots.
  async pollIfIdle() {
    if (!this.cdp || this.mode !== 'screen') return;
    await this.sendPanelRect();
    if (Date.now() - this.lastFrameAt < 2000) return;
    await this.snapshot(false).catch(() => {});
  }

  async snapshot(force) {
    const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: this.screencast.quality });
    this.sendFrame(data, force);
  }

  toCss(nx, ny) {
    return { x: Math.round(nx * this.viewport.w), y: Math.round(ny * this.viewport.h) };
  }

  async tap(nx, ny, button = 'left') {
    const { x, y } = this.toCss(nx, ny);
    await this.tapCss(x, y, button);
  }

  async tapCss(x, y, button = 'left') {
    const base = { x, y, button, clickCount: 1 };
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  }

  async wheel(nx, ny, dx, dy) {
    const { x, y } = this.toCss(nx, ny);
    await this.cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy });
  }

  async key(combo) {
    const parts = combo.split('+');
    const name = parts.pop();
    const modifiers = parts.reduce((m, p) => m | (MOD[p] || 0), 0);
    let spec = NAMED_KEYS[name];
    if (!spec && name.length === 1) {
      const up = name.toUpperCase();
      spec = { code: /[A-Z]/.test(up) ? `Key${up}` : /\d/.test(up) ? `Digit${up}` : '', vk: up.charCodeAt(0), text: name };
    }
    if (!spec) throw new Error(`Unknown key: ${combo}`);
    const withText = spec.text && !(modifiers & (MOD.Ctrl | MOD.Meta));
    const ev = { key: name, code: spec.code, windowsVirtualKeyCode: spec.vk, nativeVirtualKeyCode: spec.vk, modifiers };
    await this.cdp.send('Input.dispatchKeyEvent', { type: withText ? 'keyDown' : 'rawKeyDown', ...ev, ...(withText ? { text: spec.text } : {}) });
    await this.cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev });
  }

  async typeText(text) {
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) await this.key('Shift+Enter');
      if (lines[i]) await this.cdp.send('Input.insertText', { text: lines[i] });
    }
  }

  async pushClipboard(text) {
    const body = String(text ?? '');
    if (!body.trim()) throw new Error('Clipboard is empty');
    const found = await this.cdp.evaluate(FOCUS_COMPOSER);
    if (!found) throw new Error('No visible chat input: open the Agent panel in "Screen" first (or tap "Open chat")');
    await this.typeText(body.slice(0, 100000));
    this.emit({ t: 'status', ok: true, msg: 'Pasted into Cursor composer' });
  }

  async pullClipboard() {
    const r = await this.cdp.evaluate(helpersCall('clipboardPull()'));
    if (!r || r.source === 'empty' || !r.text) {
      this.emit({ t: 'clipboard', op: 'pull', source: 'empty', text: '' });
      throw new Error('Nothing selected and no code block found to copy');
    }
    this.emit({ t: 'clipboard', op: 'pull', source: r.source, text: r.text });
  }

  async sendDash() {
    const wins = await listWindows();
    const states = watcherWindowStates();
    const byId = Object.fromEntries(states.map(s => [s.id, s]));
    const list = wins.map(w => {
      const s = byId[w.id];
      return {
        id: w.id,
        title: w.title,
        kind: w.kind,
        name: s?.name || w.title,
        state: s?.state || 'idle',
        waitingText: s?.waitingText || '',
        current: w.id === this.targetId,
      };
    });
    this.emit({ t: 'dash', windows: list });
  }

  async sendMessage(text, submit) {
    const found = await this.cdp.evaluate(FOCUS_COMPOSER);
    if (!found) throw new Error('No visible chat input: open the Agent panel in "Screen" first (or tap "Open chat")');
    const busy = submit && await this.cdp.evaluate(helpersCall('agentState()?.busy'));
    await this.typeText(text);
    if (submit) await this.key('Enter');
    if (this.mode === 'chat') setTimeout(() => this.pollChat().catch(() => {}), 300);
    return Boolean(busy);
  }

  async answerQuestion(qi, oi, part, text) {
    const call = p => helpersCall(`questionTarget(${Number(qi) || 0}, ${Number(oi) || 0}, ${JSON.stringify(p)})`);
    const pos = await this.cdp.evaluate(call(part));
    if (!pos) throw new Error('That question is gone (maybe it was answered on the computer)');
    await this.tapCss(pos.x, pos.y);
    if (part === 'option' && typeof text === 'string') {
      await new Promise(r => setTimeout(r, 150));
      await this.cdp.evaluate(`document.activeElement?.select?.()`);
      if (text) await this.typeText(text);
      else await this.key('Backspace');
    }
    setTimeout(() => this.pollChat().catch(() => {}), 300);
  }

  async attachImage(data, name, type) {
    if (!/^image\/(png|jpeg|gif|webp)$/.test(type) || typeof data !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(data)) {
      throw new Error('Only PNG / JPEG / GIF / WebP images are supported');
    }
    const safe = String(name || 'image').replace(/[^\w.\-]/g, '_').slice(0, 60);
    const ext = ({ 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/jpeg': '.jpg' })[type] || '.jpg';
    const fileName = /\.\w+$/.test(safe) ? safe : safe + ext;
    const before = await this.cdp.evaluate(`(${IMAGE_ATTACH_COUNT})()`);
    const waited = async () => {
      for (let i = 0; i < 30; i++) {
        if (await this.cdp.evaluate(`(${IMAGE_ATTACH_COUNT})()`) > before) return true;
        await new Promise(r => setTimeout(r, 100));
      }
      return false;
    };

    // Preferred path: set files on Cursor's hidden composer <input type=file> (DOM.setFileInputFiles).
    // Synthetic ClipboardEvent paste can still attach, but success used to be detected via the obsolete
    // .context-pill-image selector — the phone showed "didn't accept" even when a preview appeared.
    const tmp = path.join(os.tmpdir(), `crl-attach-${process.pid}-${Date.now()}-${fileName}`);
    await fs.promises.writeFile(tmp, Buffer.from(data, 'base64'));
    try {
      try {
        await this.cdp.send('DOM.enable').catch(() => {});
        const { root } = await this.cdp.send('DOM.getDocument', { depth: 0 });
        const selectors = [
          '.agent-prompt-input-root input[type=file]',
          '.ui-prompt-input-toolbar input[type=file]',
          'input[type=file][accept*="image"]',
          'input[type=file]',
        ];
        let nodeId = 0;
        for (const sel of selectors) {
          const r = await this.cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel });
          if (r?.nodeId) { nodeId = r.nodeId; break; }
        }
        if (nodeId) {
          await this.cdp.send('DOM.setFileInputFiles', { nodeId, files: [tmp] });
          if (await waited()) {
            this.emit({ t: 'status', ok: true, msg: 'Image attached in Cursor; type your message and tap Send' });
            return;
          }
        }
      } catch (e) {
        console.error('!! setFileInputFiles failed', e.message || e);
      }

      const ok = await this.cdp.evaluate(pasteImage(data, fileName, type));
      if (ok === null) throw new Error('No visible chat input: open the Agent panel in "Screen" first (or tap "Open chat")');
      if (!ok) throw new Error("Cursor didn't accept the image (open the Agent chat, or the model may not support images)");
      this.emit({ t: 'status', ok: true, msg: 'Image attached in Cursor; type your message and tap Send' });
    } finally {
      fs.promises.unlink(tmp).catch(() => {});
    }
  }

  async handle(msg) {
    if (msg.t === 'windows') return this.emit({ t: 'windows', list: (await listWindows()).map(({ id, title, kind }) => ({ id, title, kind })), current: this.targetId });
    if (msg.t === 'attach') return this.attach(msg.id);
    if (msg.t === 'mode') return this.setMode(msg.mode);
    if (msg.t === 'visible') {
      this.visible = Boolean(msg.v);
      if (this.targetId && this.visible) {
        presenceHeartbeat(this.targetId, this.deviceId, deviceName(this.deviceId));
        broadcastPresence(this.targetId);
      }
      return;
    }
    if (msg.t === 'lang') { updateDevice(this.deviceId, { lang: msg.v === 'en' ? 'en' : 'zh' }); return; }
    if (msg.t === 'claim') {
      const win = String(msg.win || this.targetId || '');
      if (!win) throw new Error('No window to claim');
      const prev = presenceSnapshot(win);
      presenceClaim(win, this.deviceId, deviceName(this.deviceId));
      broadcastPresence(win);
      if (prev.holder && prev.holder !== this.deviceId) {
        for (const v of listViewers()) {
          if (v.deviceId === prev.holder) v.emit({ t: 'status', ok: true, msg: `Control moved to ${deviceName(this.deviceId)}` });
        }
      }
      return;
    }
    if (msg.t === 'presence') {
      return this.emit({ t: 'presence', ...presenceSnapshot(this.targetId, this.deviceId) });
    }
    if (msg.t === 'dash') return this.sendDash();
    if (!this.cdp) throw new Error('Not connected to a Cursor window yet');
    // Clipboard pull is read-only; push requires the control lock.
    if (msg.t === 'clipboard' && msg.op === 'pull') return this.pullClipboard();
    if (CONTROL_TYPES.has(msg.t) && this.targetId && !canControl(this.targetId, this.deviceId)) {
      const snap = presenceSnapshot(this.targetId, this.deviceId);
      this.emit({ t: 'presence', ...snap });
      throw new Error(`${snap.holderName || 'Another device'} is controlling this window — tap Take control`);
    }
    if (CONTROL_TYPES.has(msg.t) && this.targetId) {
      presenceHeartbeat(this.targetId, this.deviceId, deviceName(this.deviceId));
    }
    switch (msg.t) {
      case 'openMenu': return this.openMenu(msg.kind);
      case 'pickMenu': return this.pickMenu(msg.kind, msg.label);
      case 'toggleMax': return this.toggleMax();
      case 'params': return this.showParams(String(msg.model ?? ''), String(msg.label ?? ''));
      case 'pickParam': return this.pickParam(String(msg.model ?? ''), String(msg.label ?? ''), msg.section, msg.value);
      case 'newChat': return this.pressControl('newChat');
      case 'file': return this.openFile(String(msg.path ?? ''));
      case 'diff': return this.openDiff(String(msg.path ?? msg.name ?? ''));
      case 'editors': return this.listEditors();
      case 'editorSuggest': return this.editorSuggest(String(msg.query ?? ''));
      case 'editorFocus': return this.editorFocus(String(msg.name ?? ''));
      case 'editorClose': return this.editorClose(String(msg.name ?? ''));
      case 'editorOpen': return this.editorOpen(String(msg.query ?? msg.path ?? msg.name ?? ''));
      case 'clipboard': return this.pushClipboard(String(msg.text ?? ''));
      case 'click': return this.clickButton(msg.item, msg.n);
      case 'queue': return msg.action === 'edit' ? this.editQueued(msg.id, String(msg.text ?? '')) : this.queueAction(msg.id, msg.action);
      case 'stop': return this.stopAgent();
      case 'subagent': return this.subagentAction(msg.name, msg.part === 'stop' ? 'stop' : 'open');
      case 'mainChat': return this.backToMain();
      case 'image': return this.attachImage(msg.data, msg.name, msg.type);
      case 'question': return this.answerQuestion(msg.qi, msg.oi, ['option', 'submit', 'skip'].includes(msg.part) ? msg.part : 'option', msg.text);
      case 'changes': return this.listChanges();
      case 'change': return this.changeAction(msg.i, msg.name, msg.act);
      case 'scrollChat': return this.scrollChat(Number(msg.dy) || 0);
      case 'tap': return this.tap(msg.x, msg.y, msg.button);
      case 'wheel': return this.wheel(msg.x, msg.y, msg.dx || 0, msg.dy || 0);
      case 'key': return this.key(msg.key);
      case 'type': return this.typeText(String(msg.text ?? ''));
      case 'send': return this.sendMessage(String(msg.text ?? ''), msg.submit !== false);
      case 'refresh': return this.snapshot(true);
      case 'quality':
        this.screencast.quality = Math.min(90, Math.max(20, Number(msg.quality) || 60));
        this.screencast.maxWidth = Math.min(2560, Math.max(480, Number(msg.maxWidth) || 1280));
        if (this.mode !== 'screen') return;
        await this.cdp.send('Page.stopScreencast');
        return this.startScreencast();
      default: throw new Error(`Unknown command: ${msg.t}`);
    }
  }

  dispose() {
    clearInterval(this.idleTimer);
    clearTimeout(this.ackTimer);
    releaseAllForDevice(this.deviceId);
    this.detach();
  }
}

const SECURITY_HEADERS = {
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'cache-control': 'no-store',
};

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function corsHeaders(req) {
  const origin = req.headers.origin;
  if (!origin || !originAllowed(req)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin',
  };
}

function json(req, res, status, obj) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...corsHeaders(req), 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function serveApp(res, name) {
  const file = path.join(APP_DIR, path.basename(name));
  const type = MIME[path.extname(file)];
  if (!type || !fs.existsSync(file)) return false;
  res.writeHead(200, { ...SECURITY_HEADERS, 'content-type': type });
  fs.createReadStream(file).pipe(res);
  return true;
}

async function readJson(req) {
  try { return JSON.parse(await readBody(req)); } catch { return {}; }
}

function deviceView(d, current) {
  return { id: d.id, name: d.name, created: d.created, lastSeen: d.lastSeen, current: d.id === current?.id };
}

async function handleApi(req, res, route) {
  const ip = clientIp(req);
  if (req.method === 'POST' && !originAllowed(req)) return json(req, res, 403, { error: 'bad origin' });
  const device = deviceFor(req);

  // Local status for the VS Code / Cursor extension (and health checks). No device token required.
  if (route === '/api/status') {
    let wins = [];
    let cdpOk = false;
    try {
      wins = await listWindows();
      cdpOk = true;
    } catch { /* Cursor not on CDP yet */ }
    const st = readState();
    return json(req, res, 200, {
      ok: true,
      free: true,
      version: '1.8.3',
      networkMode: NETWORK_MODE,
      host: HOST,
      port: PORT,
      tunnel: TUNNEL,
      cdpOk,
      windows: wins.length,
      windowTitles: wins.map(w => w.title),
      devices: listDevices().length,
      locks: allSnapshots(),
      windowStates: watcherWindowStates(),
      appUrl: appBase() || '',
      relayUrl: st.relayUrl || '',
      telegram: telegramEnabled(),
      watcher: watcherStats(),
    });
  }

  if (route === '/api/me') {
    return json(req, res, 200, { paired: Boolean(device), needTotp: needsTotp(device), totp: Boolean(totpConfig()) });
  }

  if (route === '/api/pair' && req.method === 'POST') {
    if (lockedOut(ip)) return json(req, res, 429, { error: 'Too many attempts; try again in 15 minutes' });
    const { code, name, totp } = await readJson(req);
    if (!pairingValid(code)) {
      recordFailure(ip);
      return json(req, res, 401, { error: 'The pairing link is invalid or expired (valid 10 minutes, single use). Run npm run pair on the computer again.' });
    }
    if (totpConfig() && !verifyTotp(totp)) {
      if (totp) recordFailure(ip);
      return json(req, res, 401, { needTotp: true, error: totp ? 'Wrong code' : '' });
    }
    consumePairing();
    const { device: added, token } = addDevice(name);
    console.log(`[pair] New device "${added.name}" ip=${ip}`);
    return json(req, res, 200, { token });
  }

  if (!device) return json(req, res, 401, { error: 'Device not paired' });

  if (route === '/api/totp' && req.method === 'POST') {
    if (lockedOut(ip)) return json(req, res, 429, { error: 'Too many attempts; try again in 15 minutes' });
    const { code } = await readJson(req);
    if (!verifyTotp(code)) {
      recordFailure(ip);
      return json(req, res, 401, { error: 'Wrong code' });
    }
    updateDevice(device.id, { verifiedAt: Date.now() });
    return json(req, res, 200, { ok: true });
  }
  if (needsTotp(device)) return json(req, res, 401, { needTotp: true, error: 'Two-factor verification required' });

  if (route === '/api/devices') return json(req, res, 200, { devices: listDevices().map(d => deviceView(d, device)) });
  if (route === '/api/devices/remove' && req.method === 'POST') {
    const { id } = await readJson(req);
    removeDevice(String(id));
    closeEventStreams(String(id));
    console.log(`[unpair] Removed device ${id} (from "${device.name}")`);
    return json(req, res, 200, { ok: true });
  }
  if (route === '/api/logout' && req.method === 'POST') {
    removeDevice(device.id);
    closeEventStreams(device.id);
    console.log(`[unpair] Device "${device.name}" unpaired itself`);
    return json(req, res, 200, { ok: true });
  }

  if (route === '/api/events') return openEventStream(req, res, device.id);
  if (route === '/api/push/key') return json(req, res, 200, { key: pushPublicKey() });
  if (route === '/api/push/subscribe' && req.method === 'POST') {
    const { sub } = await readJson(req);
    if (!/^https:\/\//.test(sub?.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) return json(req, res, 400, { error: 'Invalid subscription' });
    updateDevice(device.id, { push: { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } } });
    return json(req, res, 200, { ok: true });
  }
  if (route === '/api/push/unsubscribe' && req.method === 'POST') {
    updateDevice(device.id, { push: null });
    return json(req, res, 200, { ok: true });
  }
  if (route === '/api/push/test' && req.method === 'POST') {
    await deliver({ kind: 'test', win: '', title: 'Cursor Remote', body: 'Test notification: if you see this, notifications are working ✅',
      zh: { body: '测试通知：能看到这条，说明通知已经通了 ✅' } }, device.id);
    return json(req, res, 200, { ok: true });
  }
  return json(req, res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') {
    res.writeHead(originAllowed(req) ? 204 : 403, corsHeaders(req));
    return res.end();
  }
  // The same app also runs from GitHub Pages; there url.json holds the encrypted relay address instead.
  if (url.pathname === '/url.json') return json(req, res, 200, { self: true });
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url.pathname);
  if (req.method === 'GET' && serveApp(res, url.pathname === '/' ? 'index.html' : url.pathname)) return;
  res.writeHead(404, SECURITY_HEADERS).end('not found');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 4 << 20 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname !== '/ws' || !originAllowed(req)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

// The token arrives as the first message rather than in the URL, so it never shows up in proxy logs.
wss.on('connection', (ws, req) => {
  let session = null;
  const authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), 5000);
  let queue = Promise.resolve();
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!session) {
      clearTimeout(authTimer);
      const device = msg.t === 'auth' ? findDevice(msg.token) : null;
      if (!device || needsTotp(device)) {
        ws.send(JSON.stringify({ t: 'auth', ok: false, needTotp: Boolean(device) }));
        return ws.close(4001, 'unauthorized');
      }
      updateDevice(device.id, { lastSeen: Date.now() });
      session = new Session(ws, device.id);
      addViewer(session);
      ws.send(JSON.stringify({ t: 'auth', ok: true }));
      console.log(`[+] client ${clientIp(req)}`);
      return;
    }
    // Frame acks bypass the queue so a slow command never stalls the stream.
    if (msg.t === 'ack') return session.ack();
    queue = queue.then(async () => {
      try {
        const queued = await session.handle(msg);
        if (msg.t === 'type') session.emit({ t: 'status', ok: true, msg: 'Sent' });
        if (msg.t === 'queue' && msg.action === 'edit') session.emit({ t: 'status', ok: true, msg: 'Updated, still queued' });
        if (msg.t === 'send') session.emit({ t: 'status', ok: true, msg: queued ? 'Agent is running; queued, and it sends automatically when this turn ends' : 'Sent' });
      } catch (e) {
        session.emit({ t: 'status', ok: false, msg: e.message });
      }
    });
  });
  ws.on('close', () => {
    clearTimeout(authTimer);
    if (!session) return;
    removeViewer(session);
    session.dispose();
    console.log(`[-] client ${clientIp(req)}`);
  });
});

// Until a first device exists, print a pairing QR so a fresh install works without extra commands.
function offerFirstPairing() {
  if (listDevices().length) return;
  const base = appBase();
  if (!base) return;
  const { link, minutes } = createPairing(base);
  printQr(`No paired devices yet. Scan with your phone to pair (${minutes} minutes; run npm run pair again if it expires)`, link);
}

function printQr(label, url) {
  console.log(`\n${label}:\n${url}`);
  qrcode.generate(url, { small: true });
}

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `${cmd} exited ${code}`)));
    p.stdin.end(input ?? '');
  });
}

async function waitReachable(url) {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${url}/url.json`)).ok) return true; } catch {}
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

function appUrl() {
  const [owner, repo] = PUBLISH_REPO.split('/');
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

const gitBlobSha = buf => crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

async function putFile(name, buf, sha) {
  const body = { message: `update ${name}`, content: buf.toString('base64'), ...(sha ? { sha } : {}) };
  await run('gh', ['api', '-X', 'PUT', `repos/${PUBLISH_REPO}/contents/${name}`, '--input', '-'], JSON.stringify(body));
}

async function remoteShas() {
  const out = await run('gh', ['api', `repos/${PUBLISH_REPO}/contents`, '--jq', '.[] | [.name, .sha] | @tsv']).catch(() => '');
  return new Map(out.split('\n').filter(Boolean).map(l => l.split('\t')));
}

// Keeps the GitHub Pages copy of the app identical to app/, uploading only files that changed.
async function syncApp() {
  const remote = await remoteShas();
  let changed = 0;
  for (const name of fs.readdirSync(APP_DIR)) {
    if (!MIME[path.extname(name)] || name === 'url.json') continue;
    const buf = fs.readFileSync(path.join(APP_DIR, name));
    if (remote.get(name) === gitBlobSha(buf)) continue;
    await putFile(name, buf, remote.get(name));
    changed++;
  }
  if (changed) console.log(`Synced ${changed} app file(s) to GitHub Pages`);
}

// Writes the current tunnel address (encrypted) to url.json, so the app on GitHub Pages can find this relay.
async function publishUrl(url) {
  try {
    await syncApp();
  } catch (e) {
    console.log(`!! Failed to sync app files: ${e.message}`);
  }
  if (!await waitReachable(url)) console.log('!! New address is not reachable from the public internet yet; publishing anyway');
  try {
    const remote = await remoteShas();
    await putFile('url.json', Buffer.from(JSON.stringify(encryptUrl(url)) + '\n'), remote.get('url.json'));
    console.log(`Published the latest address (GitHub Pages takes about 1 minute). Phone app URL: ${appUrl()}`);
    offerFirstPairing();
  } catch (e) {
    console.log(`!! Failed to publish address: ${e.message}`);
  }
}

function cloudflaredBin() {
  const local = path.join(__dirname, 'tools', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
  return fs.existsSync(local) ? local : 'cloudflared';
}

function startTunnel() {
  const child = spawn(cloudflaredBin(), ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${PORT}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  let shown = false;
  const scan = buf => {
    const m = !shown && String(buf).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m) {
      shown = true;
      console.log(`\nPublic URL: ${m[0]}`);
      saveState({ relayUrl: m[0] });
      if (PUBLISH_REPO) publishUrl(m[0]);
      else {
        console.log('(Address changes on every restart; paired phones must re-pair unless you run npm run setup for a fixed address)');
        offerFirstPairing();
      }
    }
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  child.on('error', () => console.log('!! cloudflared not found. Install it: winget install --id Cloudflare.cloudflared  (or brew install cloudflared)'));
  child.on('exit', code => { console.log(`!! cloudflared exited (code ${code})`); process.exit(1); });
  const stop = () => { child.kill(); process.exit(0); };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

server.listen(PORT, HOST, async () => {
  console.log(`Cursor Remote Lite started on port ${PORT} (mode=${NETWORK_MODE}, bind=${HOST})`);
  console.log(`${listDevices().length} device(s) paired. Add another: npm run pair`);
  saveState({ networkMode: NETWORK_MODE, host: HOST, port: PORT, startedAt: Date.now() });
  startWatcher({
    listWindows,
    openCdp: async ws => { const c = new Cdp(ws); await c.connect(); return c; },
    probe: helpersCall('agentState()'),
  });
  const headless = createHeadless({
    listWindows,
    openCdp: async ws => { const c = new Cdp(ws); await c.connect(); return c; },
    helpersCall,
  });
  if (telegramEnabled()) {
    startTelegramBot({
      listWindows: async () => (await listWindows()).map(w => ({ id: w.id, title: w.title })),
      onPrompt: async ({ text, winId }) => {
        const st = readState();
        const target = winId || st.lastAlert?.win || st.lastWindows?.[0]?.id || null;
        const r = await headless.sendPrompt(target, text);
        console.log(`[telegram] Sent prompt to ${r.title} (${r.chars} chars)`);
        return `Sent to ${r.title}`;
      },
      onAction: async ({ action, winId }) => {
        if (action === 'stop') {
          const r = await headless.stop(winId);
          console.log(`[telegram] Stop on ${r.title}`);
          return `Stopped agent in ${r.title}`;
        }
        if (action === 'continue') {
          const r = await headless.sendPrompt(winId, 'Continue');
          console.log(`[telegram] Continue → ${r.title}`);
          return `Sent Continue to ${r.title}`;
        }
        const r = await headless.clickWait(winId, action);
        console.log(`[telegram] ${action} → ${r.label} on ${r.title}`);
        return `${action === 'approve' ? 'Approved' : 'Skipped'} (${r.label}) in ${r.title}`;
      },
    });
  }
  try {
    const wins = await listWindows();
    console.log(`Connected to Cursor, ${wins.length} window(s): ${wins.map(w => w.title).join(' | ')}`);
    saveState({ lastWindows: wins.map(w => ({ id: w.id, title: w.title, kind: w.kind })) });
  } catch {
    console.log(`!! Cannot reach ${CDP_URL}. Restart Cursor with ./start-cursor.sh (Windows: start-cursor.ps1) so it uses --remote-debugging-port=9222`);
  }
  if (TUNNEL) {
    console.log('Opening Cloudflare public tunnel…');
    startTunnel();
  } else if (NETWORK_MODE === 'localhost') {
    console.log(`Localhost only: http://127.0.0.1:${PORT}/  (use Tailscale serve / SSH -L / your own proxy for remote access)`);
    saveState({ relayUrl: `http://127.0.0.1:${PORT}/` });
    offerFirstPairing();
  } else {
    const ips = Object.values(os.networkInterfaces()).flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    for (const ip of ips) console.log(`  LAN / Tailscale URL: http://${ip}:${PORT}/`);
    if (ips[0]) {
      saveState({ relayUrl: `http://${ips[0]}:${PORT}/` });
      offerFirstPairing();
    }
  }
});
