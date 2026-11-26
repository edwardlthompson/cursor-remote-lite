// Read-only local Cursor agent-transcript mirror.
// Used when Cursor is not launched with --remote-debugging-port=9222.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function projectsDir() {
  return process.env.CURSOR_PROJECTS_DIR
    || path.join(os.homedir(), '.cursor', 'projects');
}

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);

function cleanUserText(raw) {
  let s = String(raw || '');
  s = s.replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, '');
  const q = /<user_query>([\s\S]*?)<\/user_query>/i.exec(s);
  if (q) s = q[1];
  return s.trim();
}

function contentText(message) {
  const parts = message?.content;
  if (typeof parts === 'string') return parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .filter(p => p && (p.type === 'text' || typeof p.text === 'string'))
    .map(p => p.text || '')
    .join('\n')
    .trim();
}

function contentTools(message) {
  const parts = message?.content;
  if (!Array.isArray(parts)) return [];
  return parts
    .filter(p => p && (p.type === 'tool_use' || p.type === 'tool_call'))
    .map(p => p.name || p.tool || 'tool')
    .filter(Boolean);
}

function renderMarkdownSafe(md) {
  const src = String(md || '').replace(/\r\n/g, '\n').trim();
  if (!src) return '';
  const blocks = [];
  const fenced = src.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, code) => {
    const idx = blocks.length;
    blocks.push(`<pre>${esc(code.replace(/\n$/, ''))}</pre>`);
    return `\u0000BLOCK${idx}\u0000`;
  });
  const inline = txt => esc(txt)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  const lines = fenced.split('\n');
  let html = '';
  let inList = false;
  const closeList = () => { if (inList) { html += '</ul>'; inList = false; } };

  for (const line of lines) {
    const mBlock = /^\u0000BLOCK(\d+)\u0000$/.exec(line.trim());
    if (mBlock) { closeList(); html += blocks[Number(mBlock[1])]; continue; }
    if (!line.trim()) { closeList(); continue; }
    const mHead = /^#{1,4}\s+(.+)$/.exec(line);
    if (mHead) { closeList(); html += `<h4>${inline(mHead[1])}</h4>`; continue; }
    const mLi = /^\s*[-*]\s+(.+)$/.exec(line);
    if (mLi) {
      if (!inList) { html += '<ul>'; inList = true; }
      html += `<li>${inline(mLi[1])}</li>`;
      continue;
    }
    closeList();
    html += `<p>${inline(line)}</p>`;
  }
  closeList();
  return html;
}

function findTranscriptFiles() {
  const out = [];
  const base = projectsDir();
  if (!fs.existsSync(base)) return out;
  let projects = [];
  try { projects = fs.readdirSync(base, { withFileTypes: true }); } catch { return out; }
  for (const proj of projects) {
    if (!proj.isDirectory()) continue;
    const root = path.join(base, proj.name, 'agent-transcripts');
    if (!fs.existsSync(root)) continue;
    let walks = [];
    try { walks = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const entry of walks) {
      const dir = entry.isDirectory() ? path.join(root, entry.name) : root;
      const id = entry.isDirectory() ? entry.name : path.basename(entry.name, '.jsonl');
      let files = [];
      try {
        files = entry.isDirectory()
          ? fs.readdirSync(dir).filter(n => n.endsWith('.jsonl') && !n.includes('compaction'))
          : (entry.name.endsWith('.jsonl') ? [entry.name] : []);
      } catch { continue; }
      for (const name of files) {
        const file = entry.isDirectory() ? path.join(dir, name) : path.join(root, name);
        try {
          const st = fs.statSync(file);
          if (st.isFile() && st.size > 0) {
            out.push({ convId: id, project: proj.name, file, mtimeMs: st.mtimeMs });
          }
        } catch {}
      }
    }
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function summarizeTitle(file, convId, project) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const lines = raw.split(/\r?\n/);
    let lastUser = '';
    for (const l of lines) {
      if (!l.includes('"role":"user"') && !l.includes('"role": "user"')) continue;
      try {
        const obj = JSON.parse(l);
        if (obj.role === 'user') {
          const t = cleanUserText(contentText(obj.message));
          if (t) lastUser = t;
        }
      } catch {}
    }
    const snippet = lastUser.replace(/\s+/g, ' ').slice(0, 42);
    const label = project ? project.replace(/^c-Users-[^-]+-/, '').slice(0, 28) : convId.slice(0, 8);
    return snippet
      ? `Cursor: ${snippet}${lastUser.length > 42 ? '…' : ''}`
      : `Cursor Session ${label}`;
  } catch {
    return `Cursor Session ${convId.slice(0, 8)}`;
  }
}

export function listTranscriptWindows(limit = 6) {
  return findTranscriptFiles().slice(0, limit).map(({ convId, project, file }) => ({
    id: `transcript:${convId}`,
    title: summarizeTitle(file, convId, project),
    kind: 'transcript',
    file,
  }));
}

export function readTranscriptChat(file) {
  if (!file || !fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const lines = raw.split(/\r?\n/);
  const items = [];
  let lastRole = '';
  let lastTs = 0;

  let pendingTools = [];
  const flushTools = idxKey => {
    if (!pendingTools.length) return;
    const counts = new Map();
    for (const n of pendingTools) counts.set(n, (counts.get(n) || 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => c > 1 ? `${n} ×${c}` : n);
    const extra = counts.size > 3 ? ` +${counts.size - 3}` : '';
    items.push({ i: `${idxKey}t`, k: 'tool', t: `Tools (${pendingTools.length}) · ${top.join(', ')}${extra}` });
    pendingTools = [];
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const l = lines[idx];
    if (!l || l[0] !== '{') continue;
    let obj;
    try { obj = JSON.parse(l); } catch { continue; }
    const role = obj.role;
    if (!role) continue;
    const tsMatch = /<timestamp>([^<]+)<\/timestamp>/i.exec(contentText(obj.message) || '');
    if (tsMatch) {
      const ts = Date.parse(tsMatch[1]);
      if (Number.isFinite(ts)) lastTs = ts;
    } else {
      try { lastTs = fs.statSync(file).mtimeMs; } catch {}
    }

    if (role === 'user') {
      const t = cleanUserText(contentText(obj.message));
      if (!t) continue;
      flushTools(idx);
      lastRole = role;
      items.push({ i: String(idx), k: 'human', t: t.slice(0, 8000) });
    } else if (role === 'assistant') {
      lastRole = role;
      const tools = contentTools(obj.message);
      if (tools.length) pendingTools.push(...tools);
      const txt = contentText(obj.message).replace(/<timestamp>[\s\S]*?<\/timestamp>\s*/gi, '').trim();
      if (txt) {
        flushTools(idx);
        items.push({ i: String(idx), k: 'assistant', h: renderMarkdownSafe(txt) });
      }
    }
  }
  flushTools('end');

  const recent = items.slice(-60);
  const busy = lastRole === 'user' && (Date.now() - lastTs) < 45_000;
  return {
    rect: [0, 0, 1200, 800],
    items: recent,
    global: [],
    busy,
    queued: [],
    subagents: [],
    changed: 0,
    questions: null,
    readonly: true,
    mode: 'Transcript',
    model: null,
    source: 'transcript',
  };
}
