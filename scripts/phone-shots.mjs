#!/usr/bin/env node
/** Drive OP13 WebView via CDP, adb-screencap each README phone shot. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(DIR, '..');
const OUT_EN = path.join(ROOT, 'docs', 'en');
const OUT = path.join(ROOT, 'docs');
const SERIAL = process.env.CR_SHOT_SERIAL || '8bf09993';
const CDP = process.env.CR_SHOT_CDP || 'http://127.0.0.1:9229';
const PHONE = [
  'ui-chat.png', 'ui-windows.png', 'ui-model.png', 'ui-params.png',
  'ui-running.png', 'ui-file.png', 'ui-changes.png', 'ui-confirm.png', 'ui-pair.png',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

function adb(...args) {
  const r = spawnSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', maxBuffer: 10 << 20 });
  if (r.status !== 0) throw new Error(`adb ${args.join(' ')}: ${(r.stderr || r.stdout || '').slice(0, 400)}`);
  return r.stdout;
}

async function getWsUrl() {
  const list = await fetch(`${CDP}/json/list`).then(r => r.json());
  const page = list.find(p => /cursor-remote-app/i.test(p.url)) || list[0];
  if (!page?.webSocketDebuggerUrl) throw new Error('no WebView page');
  return page.webSocketDebuggerUrl;
}

class Cdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }
  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); });
    this.ws.on('message', raw => {
      const msg = JSON.parse(String(raw));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', {
      expression, awaitPromise: true, returnByValue: true, userGesture: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails, null, 0).slice(0, 500));
    return r.result?.value;
  }
  close() { try { this.ws?.close(); } catch {} }
}

function shot(name) {
  const remote = '/sdcard/cr-shot.png';
  adb('shell', 'screencap', '-p', remote);
  const destEn = path.join(OUT_EN, name);
  adb('pull', remote, destEn);
  const dest = path.join(OUT, name);
  fs.copyFileSync(destEn, dest);
  console.log('✓', name, fs.statSync(destEn).size);
}

async function main() {
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0');
  adb('shell', 'settings', 'put', 'system', 'user_rotation', '0');
  adb('shell', 'am', 'start', '-n', 'com.cursorremote.lite/.MainActivity');
  await sleep(1000);

  const cdp = new Cdp(await getWsUrl());
  await cdp.connect();
  await cdp.send('Runtime.enable');

  const click = async (sel) => {
    const ok = await cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return false; el.click(); return true; })()`);
    console.log(' click', sel, ok);
    await sleep(650);
    return ok;
  };
  const closeSheet = async () => {
    await cdp.eval(`(() => { try { window.closeSheet?.(); document.getElementById('shade')?.click(); } catch {}
      const v = document.getElementById('viewer'); if (v?.classList.contains('open')) document.getElementById('vClose')?.click();
      return true; })()`);
    await sleep(450);
  };

  // Take control if needed
  await cdp.eval(`(() => { const b = document.getElementById('takeControl'); if (b && b.offsetParent) b.click(); return true; })()`);
  await sleep(900);

  // --- chat ---
  await click('#tabChat');
  await closeSheet();
  shot('ui-chat.png');

  // --- windows ---
  await click('#title');
  await sleep(500);
  shot('ui-windows.png');
  await closeSheet();

  // --- model ---
  await click('#pickModel');
  await sleep(500);
  shot('ui-model.png');

  // --- params ---
  const paramsOk = await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('#sheet button, .paramBtn, button')].find(e => /Params/i.test(e.textContent || ''));
    if (!b) return false; b.click(); return true;
  })()`);
  console.log(' params', paramsOk);
  await sleep(700);
  if (paramsOk) shot('ui-params.png');
  await closeSheet();

  // --- running (busy banner) ---
  await click('#tabChat');
  await sleep(400);
  shot('ui-running.png');

  // --- file: Files → Open BUILD_PLAN ---
  await click('#tabFiles');
  await sleep(900);
  // Prefer already-open BUILD_PLAN tab
  let opened = await cdp.eval(`(() => {
    const tab = [...document.querySelectorAll('#paneTabStrip button')].find(e => /BUILD_PLAN/i.test(e.textContent || ''));
    if (tab) { tab.click(); return 'tab'; }
    return null;
  })()`);
  if (!opened) {
    await click('#paneOpen');
    await sleep(400);
    await cdp.eval(`(() => {
      const inp = document.getElementById('panePickInput');
      if (!inp) return false;
      inp.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(inp, 'BUILD_PLAN');
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(1000);
    opened = await cdp.eval(`(() => {
      const hit = [...document.querySelectorAll('#panePickHits button')].find(e => /BUILD_PLAN/i.test(e.textContent || ''));
      if (hit) { hit.click(); return 'hit'; }
      document.getElementById('panePickGo')?.click();
      return 'go';
    })()`);
  }
  console.log(' file open', opened);
  await sleep(1400);
  await click('#paneMdPreview');
  await sleep(500);
  shot('ui-file.png');

  // --- changes ---
  await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('button')].find(e => /^Changes$/i.test((e.textContent || '').trim()));
    if (b) { b.click(); return 'tab'; }
    if (typeof send === 'function') { send({ t: 'changes' }); return 'send'; }
    return null;
  })()`);
  await sleep(1100);
  shot('ui-changes.png');

  // --- confirm (ask sheet) ---
  await closeSheet();
  // Do not await the ask() Promise (it resolves only on Cancel/OK).
  await cdp.send('Runtime.evaluate', {
    expression: `ask('Undo the changes to \"session.ts\"?\\nThe file goes back to how it was before the Agent changed it.', 'Undo')`,
    awaitPromise: false,
    userGesture: true,
  });
  await sleep(800);
  shot('ui-confirm.png');
  await cdp.eval(`document.getElementById('askNo')?.click()`);
  await sleep(400);
  await closeSheet();

  // --- pair / setup ---
  // Load setup asset with change=1 (keeps pairing URL cancel)
  await cdp.eval(`location.href = 'file:///android_asset/setup.html?change=1'`);
  await sleep(1600);
  shot('ui-pair.png');

  // Return to Pages app
  adb('shell', 'input', 'keyevent', '4');
  await sleep(1200);
  // If still on setup, force Pages URL
  await cdp.eval(`(() => {
    if (/android_asset\\/setup/.test(location.href)) {
      const u = window.CursorRemoteApp?.getUrl?.() || 'https://edwardlthompson.github.io/cursor-remote-app/';
      location.href = u;
    }
    return location.href;
  })()`).catch(() => {});

  cdp.close();
  adb('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '1');
  console.log('All phone shots:', PHONE.join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });
