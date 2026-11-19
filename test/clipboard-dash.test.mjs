import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const server = fs.readFileSync(path.join(root, '..', 'server.mjs'), 'utf8');
const app = fs.readFileSync(path.join(root, '..', 'app', 'index.html'), 'utf8');
const notify = fs.readFileSync(path.join(root, '..', 'notify.mjs'), 'utf8');

test('clipboard pull helper and push/pull handlers exist', () => {
  assert.match(server, /clipboardPull/);
  assert.match(server, /pushClipboard/);
  assert.match(server, /pullClipboard/);
  assert.match(server, /case 'clipboard'/);
});

test('watcher exports window states for dashboard', () => {
  assert.match(notify, /watcherWindowStates/);
  assert.match(notify, /windowStates/);
  assert.match(server, /sendDash/);
  assert.match(server, /t: 'dash'/);
});

test('app has clipboard buttons and tablet-dash layout', () => {
  assert.match(app, /id="clipPush"/);
  assert.match(app, /id="clipPull"/);
  assert.match(app, /tablet-dash/);
  assert.match(app, /id="paneView"/);
  assert.match(app, /id="tabPane"/);
  assert.match(app, /id="tabFiles"/);
  assert.match(app, /id="paneSplit"/);
  assert.match(app, /syncTabletDash/);
  assert.match(app, /--dual-split/);
});

test('Dual pane editor sync and file picker suggest exist', () => {
  assert.match(server, /editorTabs/);
  assert.match(server, /ui-tab-system-tab/);
  assert.match(server, /changeCards|ui-card__title/);
  assert.match(server, /editorOpen/);
  assert.match(server, /editorClose/);
  assert.match(server, /editorSuggest/);
  assert.match(server, /searchFiles/);
  assert.match(app, /id="paneTabStrip"/);
  assert.match(app, /id="paneOpen"/);
  assert.match(app, /id="panePickHits"/);
  assert.match(app, /renderEditorTabs/);
  assert.match(app, /syncActiveEditorContent/);
  assert.match(app, /renderPaneSuggestions/);
});
