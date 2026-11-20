#!/usr/bin/env node
/** Re-capture model, params, changes, pair shots that missed. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_EN = path.join(ROOT, 'docs', 'en');
const OUT = path.join(ROOT, 'docs');
const SERIAL = '8bf09993';
const CDP = 'http://127.0.0.1:9229';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function adb(...args) {
  const r = spawnSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', maxBuffer: 10 << 20 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return r.stdout;
}
function shot(name) {
  adb('shell', 'screencap', '-p', '/sdcard/cr-shot.png');
  const dest = path.join(OUT_EN, name);
  adb('pull', '/sdcard/cr-shot.png', dest);
  fs.copyFileSync(dest, path.join(OUT, name));
  console.log('✓', name, fs.statSync(dest).size);
}

async function getWsUrl() {
  const list = await fetch(`${CDP}/json/list`).then(r => r.json());
  return (list.find(p => /cursor-remote-app/i.test(p.url)) || list[0]).webSocketDebuggerUrl;
}

class Cdp {
  constructor(u) { this.u = u; this.id = 0; this.pending = new Map(); }
  async connect() {
    this.ws = new WebSocket(this.u);
    await new Promise((res, rej) => { this.ws.once('open', res); this.ws.once('error', rej); });
    this.ws.on('message', raw => {
      const msg = JSON.parse(String(raw));
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
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
  async eval(expression, awaitPromise = true) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result?.value;
  }
}

async function waitSheet(cdp, ms = 5000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const open = await cdp.eval(`document.getElementById('sheet')?.classList.contains('open')`);
    if (open) return true;
    await sleep(200);
  }
  return false;
}

async function main() {
  const appPid = adb('shell', 'pidof', 'com.cursorremote.lite').trim().split(/\s+/)[0];
  spawnSync('adb', ['-s', SERIAL, 'forward', '--remove', 'tcp:9229'], { encoding: 'utf8' });
  adb('forward', `tcp:9229`, `localabstract:webview_devtools_remote_${appPid}`);
  adb('shell', 'am', 'start', '-n', 'com.cursorremote.lite/.MainActivity');
  await sleep(800);

  const cdp = new Cdp(await getWsUrl());
  await cdp.connect();
  await cdp.send('Runtime.enable');

  const closeSheet = async () => {
    await cdp.eval(`(() => { window.closeSheet?.(); document.getElementById('askNo')?.click(); })()`);
    await sleep(400);
  };

  // Ensure back on Pages app
  await cdp.eval(`(() => {
    if (/android_asset/.test(location.href)) location.href = 'https://edwardlthompson.github.io/cursor-remote-app/';
    return location.href;
  })()`);
  await sleep(1500);

  await cdp.eval(`document.getElementById('tabChat')?.click()`);
  await sleep(800);
  await closeSheet();

  // Reveal model picker (hidden on Files)
  const modelInfo = await cdp.eval(`(() => {
    const b = document.getElementById('pickModel');
    return { exists: !!b, hidden: !!b?.hidden, text: b?.textContent || '', display: b ? getComputedStyle(b).display : null };
  })()`);
  console.log('modelBtn', modelInfo);

  await cdp.eval(`document.getElementById('pickModel')?.click()`);
  let opened = await waitSheet(cdp, 6000);
  console.log('model sheet', opened);
  if (!opened) {
    // Retry via send
    await cdp.eval(`send({ t: 'openMenu', kind: 'model' })`);
    opened = await waitSheet(cdp, 6000);
    console.log('model sheet retry', opened);
  }
  if (opened) {
    await sleep(400);
    shot('ui-model.png');
    // Params on selected / first model with Params
    const params = await cdp.eval(`(() => {
      const b = [...document.querySelectorAll('#sheet button')].find(e => /Params/i.test(e.textContent || ''));
      if (!b) return false; b.click(); return true;
    })()`);
    console.log('params click', params);
    if (params && await waitSheet(cdp, 4000)) {
      await sleep(400);
      shot('ui-params.png');
    }
  }
  await closeSheet();

  // Changes tab
  await cdp.eval(`document.getElementById('tabFiles')?.click()`);
  await sleep(900);
  await cdp.eval(`(() => {
    const b = [...document.querySelectorAll('#paneTabStrip button')].find(e => /^Changes/i.test((e.textContent || '').trim()));
    b?.click();
    return b?.textContent;
  })()`);
  await sleep(1000);
  // If empty, force changes poll UI
  await cdp.eval(`send({ t: 'changes' })`);
  await sleep(1200);
  shot('ui-changes.png');

  // Pair / change address via native bridge
  await closeSheet();
  const pair = await cdp.eval(`(() => {
    if (window.CursorRemoteApp?.changeUrl) { window.CursorRemoteApp.changeUrl(); return 'changeUrl'; }
    location.href = 'file:///android_asset/setup.html?change=1';
    return 'href';
  })()`);
  console.log('pair', pair);
  await sleep(2000);
  // Reconnect CDP if navigated away from Pages
  try {
    shot('ui-pair.png');
  } catch (e) {
    console.log('shot pair via adb only');
    shot('ui-pair.png');
  }

  // Verify pair page
  // Return
  adb('shell', 'input', 'keyevent', '4');
  await sleep(1000);

  cdp.close();
  console.log('fix done');
}

main().catch(e => { console.error(e); process.exit(1); });
