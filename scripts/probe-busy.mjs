import WebSocket from 'ws';

const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
const t = targets.find((x) => /Agents/i.test(x.title || '')) || targets.find((x) => x.type === 'page');
if (!t?.webSocketDebuggerUrl) {
  console.error('no Agents CDP target');
  process.exit(1);
}

const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.on('message', (d) => {
  const m = JSON.parse(d);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((res) => {
  const i = ++id;
  pending.set(i, res);
  ws.send(JSON.stringify({ id: i, method, params }));
});

await new Promise((r) => ws.on('open', r));
await send('Runtime.enable');

const expression = `(() => {
  const vis = e => {
    if (!e) return false;
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
  };
  const oldBusy = [...document.querySelectorAll(
    '.composer-button-area .codicon-debug-stop, .send-with-mode .codicon-debug-stop'
  )].some(vis);
  const stopIcons = [...document.querySelectorAll('.codicon-debug-stop')].filter(vis).map(e => ({
    aria: e.getAttribute('aria-label'),
    cls: (e.className || '').toString().slice(0, 140),
    parent: (e.parentElement?.className || '').toString().slice(0, 120),
    grand: (e.parentElement?.parentElement?.className || '').toString().slice(0, 120),
  }));
  const ariaStops = [...document.querySelectorAll('[aria-label]')].filter(vis)
    .map(e => ({ aria: e.getAttribute('aria-label'), cls: (e.className || '').toString().slice(0, 100), tag: e.tagName }))
    .filter(x => /stop|cancel|generat|abort/i.test(x.aria || ''));
  const sendBtns = [...document.querySelectorAll(
    '.composer-button-area button, .send-with-mode button, [class*="composer"] button, [class*="prompt"] button'
  )].filter(vis).map(e => ({
    aria: e.getAttribute('aria-label'),
    text: (e.innerText || '').trim().slice(0, 40),
    cls: (e.className || '').toString().slice(0, 120),
  })).slice(0, 30);
  const thinking = [...document.querySelectorAll('[class*="thinking"], [class*="loading"], [class*="spinner"], [class*="streaming"]')]
    .filter(vis).map(e => (e.className || '').toString().slice(0, 100)).slice(0, 20);
  const isBusy = () => {
    if ([...document.querySelectorAll('.composer-button-area .codicon-debug-stop, .send-with-mode .codicon-debug-stop')].some(vis)) return true;
    if ([...document.querySelectorAll('button[aria-label]')].some(e => {
      if (!vis(e)) return false;
      const a = e.getAttribute('aria-label') || '';
      return /^(Stop generation|Stop(\\s|$| Ctrl))/i.test(a);
    })) return true;
    if ([...document.querySelectorAll('.agent-transcript-tail-status')].some(e => {
      if (!vis(e)) return false;
      const t = ((e.getAttribute('aria-label') || '') + ' ' + (e.innerText || ''));
      return /\\bRunning\\b/i.test(t);
    })) return true;
    return false;
  };
  return { oldBusy, newBusy: isBusy(), stopIcons, ariaStops, sendBtns, thinking };
})()`;

const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: false });
console.log(JSON.stringify(r.result?.result?.value ?? r, null, 2));
ws.close();
