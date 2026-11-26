import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

test('transcript module lists and reads Cursor agent jsonl', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crl-transcript-'));
  const proj = path.join(tmp, 'demo-project', 'agent-transcripts', 'abc-123');
  fs.mkdirSync(proj, { recursive: true });
  const file = path.join(proj, 'abc-123.jsonl');
  fs.writeFileSync(file, [
    JSON.stringify({ role: 'user', message: { content: [{ type: 'text', text: '<user_query>Hello from test</user_query>' }] } }),
    JSON.stringify({ role: 'assistant', message: { content: [{ type: 'text', text: 'Hi there **world**' }, { type: 'tool_use', name: 'Read' }] } }),
    '',
  ].join('\n'));

  process.env.CURSOR_PROJECTS_DIR = tmp;
  try {
    const { listTranscriptWindows, readTranscriptChat } = await import('../transcript.mjs');
    const wins = listTranscriptWindows();
    assert.ok(wins.length >= 1);
    assert.equal(wins[0].kind, 'transcript');
    assert.match(wins[0].title, /Hello from test|Cursor:/);

    const chat = readTranscriptChat(wins[0].file);
    assert.ok(chat);
    assert.equal(chat.source, 'transcript');
    assert.equal(chat.readonly, true);
    assert.ok(chat.items.some(i => i.k === 'human' && /Hello from test/.test(i.t)));
    assert.ok(chat.items.some(i => i.k === 'assistant' && /world/.test(i.h || '')));
  } finally {
    delete process.env.CURSOR_PROJECTS_DIR;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('fallbackWorkspaceTabs returns known repo files', async () => {
  const { fallbackWorkspaceTabs } = await import('../files.mjs');
  const tabs = fallbackWorkspaceTabs(path.join(root, '..'));
  assert.ok(tabs.some(t => t.name === 'BUILD_PLAN.md'));
  assert.ok(tabs.some(t => t.name === 'transcript.mjs'));
});
