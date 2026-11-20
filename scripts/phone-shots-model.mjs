#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_EN = path.join(ROOT, 'docs', 'en');
const OUT = path.join(ROOT, 'docs');
const SERIAL = '8bf09993';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function adb(...args) {
  const r = spawnSync('adb', ['-s', SERIAL, ...args], { encoding: 'utf8', maxBuffer: 10 << 20 });
  if (r.status !== 0) throw new Error(String(r.stderr || r.stdout));
  return r.stdout;
}
function shot(name) {
  adb('shell', 'screencap', '-p', '/sdcard/cr-shot.png');
  const dest = path.join(OUT_EN, name);
  adb('pull', '/sdcard/cr-shot.png', dest);
  fs.copyFileSync(dest, path.join(OUT, name));
  console.log('✓', name, fs.statSync(dest).size);
}
async function connect() {
  const appPid = adb('shell', 'pidof', 'com.cursorremote.lite').trim().split(/\s+/)[0];
  spawnSync('adb', ['-s', SERIAL, 'forward', '--remove', 'tcp:9229'], { encoding: 'utf8' });
  adb('forward', 'tcp:9229', `localabstract:webview_devtools_remote_${appPid}`);
  const list = await fetch('http://127.0.0.1:9229/json/list').then(r => r.json());
  const page = list[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  let id = 0;
  const pending = new Map();
  ws.on('message', raw => {
    const msg = JSON.parse(String(raw));
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const i = ++id;
    pending.set(i, { resolve, reject });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const ev = async (expression, awaitPromise = true) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400));
    return r.result?.value;
  };
  return { ws, send, ev, url: page.url };
}

async function main() {
  adb('shell', 'am', 'start', '-n', 'com.cursorremote.lite/.MainActivity');
  await sleep(500);
  let cdp = await connect();
  console.log('page', cdp.url);

  // Leave setup if needed
  if (/android_asset|setup\.html/i.test(cdp.url)) {
    await cdp.ev(`(() => { document.getElementById('cancel')?.click(); location.href = 'https://edwardlthompson.github.io/cursor-remote-app/'; true; })()`, false);
    await sleep(2500);
    cdp.ws.close();
    cdp = await connect();
    console.log('page2', cdp.url);
  }

  await cdp.ev(`document.getElementById('tabChat')?.click()`);
  await sleep(800);

  // Model picker UI (Cursor model button unavailable while Agent is generating — show real sheet chrome)
  await cdp.ev(`(() => {
    const items = [
      { label: 'Auto', checked: false, params: false },
      { label: 'Composer', checked: true, params: true, id: 'composer' },
      { label: 'GPT-5', checked: false, params: true, id: 'gpt' },
      { label: 'Claude Opus', checked: false, params: true, id: 'opus' },
      { label: 'Gemini', checked: false, params: true, id: 'gemini' },
    ];
    showMenu('model', items, false);
    return true;
  })()`);
  await sleep(700);
  shot('ui-model.png');

  await cdp.ev(`(() => {
    showParams({
      label: 'Composer',
      model: 'composer',
      sections: [
        { title: 'Context', items: [
          { label: '200K', checked: true },
          { label: '1M', checked: false },
        ]},
        { title: 'Effort', items: [
          { label: 'Low', checked: false },
          { label: 'Medium', checked: false },
          { label: 'High', checked: true },
          { label: 'Extra High', checked: false },
        ]},
        { title: 'Options', items: [
          { label: 'Fast', checked: false, toggle: true },
        ]},
      ],
    });
    return true;
  })()`);
  await sleep(700);
  shot('ui-params.png');

  await cdp.ev(`window.closeSheet?.()`);
  // Ensure running shot is chat with Stop banner
  await cdp.ev(`document.getElementById('tabChat')?.click()`);
  await sleep(500);
  shot('ui-running.png');

  cdp.ws.close();
  console.log('done');
}

main().catch(e => { console.error(e); process.exit(1); });
