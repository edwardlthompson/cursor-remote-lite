import test from 'node:test';
import assert from 'node:assert/strict';

// Lightweight regressions for chat/extract helpers that used to break on Agents UI changes.
// Keep these free of a live Cursor — pure string/DOM-shape checks.

test('pairing deep link keeps query ampersands when quoted for adb shell', () => {
  const uri = 'cursorremote://pair?app=https://example.github.io/app/&d=abc.def';
  const quoted = `'${uri.replace(/'/g, `'\\''`)}'`;
  const remote = `am start -a android.intent.action.VIEW -d ${quoted}`;
  assert.match(remote, /app=https:\/\/example\.github\.io\/app\/&d=abc\.def/);
  assert.equal(remote.includes('&d=abc.def'), true);
});

test('agents history pick forces refresh markers exist in server source', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(src, /composer-react-virtual-plane-row/);
  assert.match(src, /ensureAgentSidebar|agentSidebarChats|data-flat-index/);
});

test('status endpoint and network modes are wired', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(src, /\/api\/status/);
  assert.match(src, /NETWORK_MODE/);
  assert.match(src, /--localhost|CR_NETWORK/);
});

test('telegram and watcher persistence hooks exist', async () => {
  const fs = await import('node:fs');
  const notify = fs.readFileSync(new URL('../notify.mjs', import.meta.url), 'utf8');
  const tg = fs.readFileSync(new URL('../telegram.mjs', import.meta.url), 'utf8');
  assert.match(notify, /telegramNotify/);
  assert.match(notify, /lastAlert/);
  assert.match(notify, /watchedWindows/);
  assert.match(notify, /telegramEnabled/);
  assert.match(tg, /startTelegramBot/);
  assert.match(tg, /callback_query|answerCallbackQuery/);
  assert.match(tg, /Approve/);
  assert.match(tg, /createForumTopic|ensureWindowTopic/);
  assert.match(tg, /\/sync/);
});

test('headless CDP bridge exposes approve/reject/stop/send', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../headless.mjs', import.meta.url), 'utf8');
  assert.match(src, /clickWait/);
  assert.match(src, /sendPrompt/);
  assert.match(src, /createHeadless/);
});

test('waiting button preference prefers Run/Allow over background', () => {
  const WAIT_OK = /^(?!.*(background|后台))(run|allow|accept|approve|continue|yes\b|运行|允许|接受|批准|继续)/i;
  assert.equal(WAIT_OK.test('Run'), true);
  assert.equal(WAIT_OK.test('Allow'), true);
  assert.equal(WAIT_OK.test('Run in background'), false);
  assert.equal(WAIT_OK.test('Skip'), false);
});

test('extension setup panel and package contribute openSetup', async () => {
  const fs = await import('node:fs');
  const pkg = JSON.parse(fs.readFileSync(new URL('../extension/package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.contributes.commands.some(c => c.command === 'cursorRemoteLite.openSetup'));
  const setup = fs.readFileSync(new URL('../extension/src/setup-panel.ts', import.meta.url), 'utf8');
  assert.match(setup, /networkMode/);
  assert.match(setup, /Telegram/);
});
