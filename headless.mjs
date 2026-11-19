// Headless CDP actions for Telegram (and other non-phone clients): approve/skip, stop, send prompt.

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

const WAIT_OK = /^(?!.*(background|后台))(run|allow|accept|approve|continue|yes\b|运行|允许|接受|批准|继续)/i;
const WAIT_NO = /^(skip|reject|deny|cancel|no\b|跳过|拒绝|取消)/i;

export function createHeadless({ listWindows, openCdp, helpersCall }) {
  async function withWindow(winId, fn) {
    const wins = await listWindows();
    const win = winId ? wins.find(w => w.id === winId) : wins[0];
    if (!win) throw new Error('No Cursor window available');
    const cdp = await openCdp(win.ws);
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
      return await fn(cdp, win);
    } finally {
      cdp.close();
    }
  }

  async function tap(cdp, x, y) {
    const base = { x, y, button: 'left', clickCount: 1 };
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  }

  async function key(cdp, name) {
    const map = {
      Enter: { key: 'Enter', code: 'Enter', vk: 13, text: '\r' },
      Backspace: { key: 'Backspace', code: 'Backspace', vk: 8 },
      'Ctrl+A': { key: 'a', code: 'KeyA', vk: 65, modifiers: 2 },
      'Meta+A': { key: 'a', code: 'KeyA', vk: 65, modifiers: 4 },
    };
    const spec = map[name] || { key: name, code: name, vk: 0 };
    const modifiers = spec.modifiers || 0;
    const ev = { key: spec.key, code: spec.code, windowsVirtualKeyCode: spec.vk, nativeVirtualKeyCode: spec.vk, modifiers };
    const withText = Boolean(spec.text);
    await cdp.send('Input.dispatchKeyEvent', { type: withText ? 'keyDown' : 'rawKeyDown', ...ev, ...(withText ? { text: spec.text } : {}) });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ev });
  }

  async function typeText(cdp, text) {
    const lines = String(text).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) {
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8, text: '\r' });
        await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 8 });
      }
      if (lines[i]) await cdp.send('Input.insertText', { text: lines[i] });
    }
  }

  /** Click the first matching wait button in a window. action: 'approve' | 'reject' */
  async function clickWait(winId, action = 'approve') {
    return withWindow(winId, async (cdp, win) => {
      const state = await cdp.evaluate(helpersCall('agentState()'));
      if (!state?.waiting) throw new Error('Nothing is waiting for approval in that window');
      const [item, labelsJoined] = String(state.waiting).includes(':')
        ? (() => {
          const i = String(state.waiting).indexOf(':');
          return [String(state.waiting).slice(0, i), String(state.waiting).slice(i + 1)];
        })()
        : ['g', String(state.waiting)];
      const labels = labelsJoined.split('/');
      const prefer = action === 'reject' ? WAIT_NO : WAIT_OK;
      let n = labels.findIndex(l => prefer.test(l));
      if (n < 0 && action === 'reject') n = labels.findIndex(l => WAIT_NO.test(l) || /skip/i.test(l));
      if (n < 0 && action === 'approve') n = labels.findIndex(l => WAIT_OK.test(l));
      if (n < 0) n = 0;
      const pos = await cdp.evaluate(helpersCall(`locate(${JSON.stringify(item)}, ${n})`));
      if (!pos) throw new Error('Approval button not found (UI may have changed)');
      await tap(cdp, pos.x, pos.y);
      return { win: win.id, title: win.title, label: labels[n] || labels[0], action };
    });
  }

  async function stop(winId) {
    return withWindow(winId, async (cdp, win) => {
      const pos = await cdp.evaluate(helpersCall('stopTarget()'));
      if (!pos) throw new Error('Stop button not found (agent may already be idle)');
      await tap(cdp, pos.x, pos.y);
      return { win: win.id, title: win.title, action: 'stop' };
    });
  }

  async function sendPrompt(winId, text) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('Empty prompt');
    return withWindow(winId, async (cdp, win) => {
      const found = await cdp.evaluate(FOCUS_COMPOSER);
      if (!found) throw new Error('No visible chat input in that window');
      await typeText(cdp, trimmed);
      await key(cdp, 'Enter');
      return { win: win.id, title: win.title, action: 'send', chars: trimmed.length };
    });
  }

  return { clickWait, stop, sendPrompt, withWindow };
}
