import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDiff } from '../files.mjs';

function git(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || 'git failed');
  return r.stdout;
}

test('readDiff returns unified diff for modified tracked file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crl-diff-'));
  try {
    git(dir, ['init']);
    git(dir, ['config', 'user.email', 'test@example.com']);
    git(dir, ['config', 'user.name', 'Test']);
    const file = path.join(dir, 'hello.txt');
    fs.writeFileSync(file, 'one\n');
    git(dir, ['add', 'hello.txt']);
    git(dir, ['commit', '-m', 'init']);
    fs.writeFileSync(file, 'one\ntwo\n');
    const d = await readDiff(null, file);
    assert.ok(!d.error, d.error);
    assert.match(d.text, /\+two/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('readDiff shows added content for untracked file', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crl-diff-u-'));
  try {
    git(dir, ['init']);
    const file = path.join(dir, 'new.txt');
    fs.writeFileSync(file, 'fresh\n');
    const d = await readDiff(null, file);
    assert.ok(!d.error, d.error);
    assert.match(d.text, /\+fresh/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
