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
  assert.match(app, /row composer/);
  assert.match(app, /composer-actions/);
  assert.match(app, /@media \(max-width: 520px\)/);
  assert.match(app, /files-only/);
  assert.match(app, /lockPaneTab/);
  assert.match(app, /readingPinnedFile/);
});

test('image attach uses file input + modern preview selectors', () => {
  const sw = fs.readFileSync(path.join(root, '..', 'app', 'sw.js'), 'utf8');
  assert.match(server, /ui-prompt-input-image-preview/);
  assert.match(server, /DOM\.setFileInputFiles/);
  assert.match(server, /IMAGE_ATTACH_COUNT/);
  assert.match(app, /imageMime/);
  assert.match(sw, /cursor-remote-v\d+/);
  assert.match(sw, /cache: 'no-store'/);
  assert.match(app, /function renderMarkdown/);
  assert.match(app, /white-space:\s*normal/);
  assert.match(app, /draftKey|saveDraft|loadDraft/);
  assert.match(app, /nativeNotifyAllowed|notificationsAllowed/);
  assert.match(app, /usageBar|renderUsage/);
  assert.match(app, /id="statusBell"/);
  assert.match(app, /id="composerToggle"/);
  assert.match(app, /id="composerPanel"/);
  assert.match(app, /id="uiBuild"/);
  assert.match(app, /composer-collapsed/);
  assert.match(app, /UI_BUILD = 32/);
  assert.match(app, /forceReloadUi|reloadUi/);
  assert.match(server, /api\/ui\/reload/);
  assert.match(server, /broadcastReloadUi|reloadUi/);
  assert.match(server, /usagePct/);
  assert.match(server, /t: 'usage'/);
});

test('sync-ui script and sync-app module exist', () => {
  const syncApp = fs.readFileSync(path.join(root, '..', 'sync-app.mjs'), 'utf8');
  const syncUi = fs.readFileSync(path.join(root, '..', 'scripts', 'sync-ui.mjs'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8'));
  assert.match(syncApp, /syncAppFiles/);
  assert.match(syncApp, /waitPagesSwCache/);
  assert.match(syncUi, /sync-ui/);
  assert.match(syncUi, /clearUi/);
  assert.equal(pkg.scripts['sync-ui'], 'node scripts/sync-ui.mjs');
});

test('sprint-status script parses BUILD_PLAN', () => {
  const script = fs.readFileSync(path.join(root, '..', 'scripts', 'build-sprint-status.mjs'), 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, '..', 'package.json'), 'utf8'));
  const release = fs.readFileSync(path.join(root, '..', '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(script, /next_row|sprint_complete/);
  assert.equal(pkg.scripts['sprint-status'], 'node scripts/build-sprint-status.mjs');
  assert.match(release, /ovsx publish|OVSX_PAT/);
  assert.ok(fs.existsSync(path.join(root, '..', 'docs', 'en', 'ui-tablet-dualpane.gif')));
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
