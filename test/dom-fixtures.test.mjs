import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const load = name => fs.readFileSync(path.join(DIR, 'fixtures', name), 'utf8');

function docOf(name) {
  const { document } = parseHTML(load(name));
  return document;
}

const WAIT_OK = /^(?!.*(background|后台))((run|allow|accept|approve|continue|yes)\b|运行|允许|接受|批准|继续)/i;
const WAIT_NO = /^((skip|reject|deny|cancel|no)\b|跳过|拒绝|取消)/i;

test('fixture: agents-waiting exposes Run/Skip and ignores Run in background', () => {
  const document = docOf('agents-waiting.html');
  const panel = document.querySelector('.agent-panel');
  assert.ok(panel);
  const labels = [...panel.querySelectorAll('button')].map(b => b.textContent.trim());
  assert.deepEqual(labels, ['Run', 'Skip', 'Run in background']);
  const approve = labels.filter(l => WAIT_OK.test(l));
  const reject = labels.filter(l => WAIT_NO.test(l));
  assert.deepEqual(approve, ['Run']);
  assert.deepEqual(reject, ['Skip']);
  assert.ok(panel.querySelector('.composer-react-virtual-plane-row'));
  assert.ok(panel.querySelector('[data-message-kind="assistant"]'));
  assert.ok(panel.querySelector('.aislash-editor-input[contenteditable="true"]'));
});

test('fixture: questionnaire option labels are distinct from letter chips', () => {
  const document = docOf('agents-questionnaire.html');
  const labels = [...document.querySelectorAll('.composer-questionnaire-toolbar-option-label')]
    .map(e => e.textContent.trim());
  assert.deepEqual(labels, ['Refactor in place', 'Rewrite module']);
  const letters = [...document.querySelectorAll('.composer-questionnaire-toolbar-option-letter')]
    .map(e => e.textContent.trim());
  assert.deepEqual(letters, ['A', 'B']);
});

test('fixture: sidebar chat rows are discoverable for history pick', () => {
  const document = docOf('agents-sidebar.html');
  const rows = [...document.querySelectorAll('.agent-sidebar-chat-row')]
    .map(e => ({ name: e.getAttribute('aria-label') || e.textContent.trim(), selected: e.classList.contains('selected') }));
  assert.equal(rows.length, 3);
  assert.equal(rows.filter(r => r.selected).length, 1);
  assert.equal(rows.find(r => r.selected).name, 'Ship 1.7');
  assert.ok(document.querySelector('.agent-panel .composer-react-virtual-plane-row'));
});

test('fixture corpus files are committed', () => {
  for (const name of ['agents-waiting.html', 'agents-questionnaire.html', 'agents-sidebar.html']) {
    assert.ok(fs.existsSync(path.join(DIR, 'fixtures', name)), name);
  }
});
