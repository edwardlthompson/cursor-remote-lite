#!/usr/bin/env node
// Linux first-run / everyday launcher (Mint, Ubuntu, etc.).
// Mirrors win-run.mjs: setup → Cursor CDP → public relay → ADB auto-pair when possible.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pairOverAdb } from './adb-pair.mjs';
import { readConfig, listDevices, appBase } from './auth.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(os.homedir(), '.cursor-remote-lite');
const CDP_PORT = Number(process.env.CDP_PORT || 9222);
const RELAY_PORT = Number(process.env.PORT || 3939);

fs.mkdirSync(DATA, { recursive: true });

const say = msg => console.log(msg);
const hasCmd = cmd => spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', cwd: DIR, ...opts });

function portOpen(port) {
  return new Promise(resolve => {
    const s = net.connect({ host: '127.0.0.1', port }, () => { s.end(); resolve(true); });
    s.on('error', () => resolve(false));
  });
}

async function waitPort(port, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await portOpen(port)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

function ensurePathTools() {
  const extras = [
    path.join(DIR, 'node', 'bin'),
    path.join(DIR, 'tools'),
  ].filter(p => fs.existsSync(p));
  if (extras.length) process.env.PATH = extras.join(path.delimiter) + path.delimiter + (process.env.PATH || '');
}

function ensureDeps() {
  if (fs.existsSync(path.join(DIR, 'node_modules', 'ws'))) return;
  say('Installing npm dependencies…');
  const npm = hasCmd('npm') ? 'npm' : path.join(DIR, 'node', 'bin', 'npm');
  const install = run(npm, ['install', '--omit=dev'], { stdio: 'inherit' });
  if (install.status !== 0) throw new Error('npm install failed');
}

function ensureSetup() {
  const cfg = readConfig();
  if (cfg.publishRepo) {
    say(`Phone app: ${appBase()}`);
    return;
  }
  if (!hasCmd('gh')) {
    say('GitHub CLI (gh) not found — skipping fixed Pages address. You can still pair via the temporary tunnel URL.');
    return;
  }
  const auth = run('gh', ['auth', 'status']);
  if (auth.status !== 0) {
    say('GitHub CLI is not logged in. Run: gh auth login');
    say('Then re-run Cursor Remote. Continuing with a temporary tunnel URL for now.');
    return;
  }
  say('First run: creating your phone app on GitHub Pages…');
  const setup = run(process.execPath, ['setup.mjs', '--yes'], { stdio: 'inherit' });
  if (setup.status !== 0) say('Setup reported an error; continuing with tunnel-only mode.');
}

async function ensureCursorCdp() {
  if (await portOpen(CDP_PORT)) {
    say(`Cursor CDP already on port ${CDP_PORT}`);
    return;
  }
  const sh = path.join(DIR, 'start-cursor.sh');
  if (!fs.existsSync(sh)) {
    say('start-cursor.sh missing; start Cursor yourself with --remote-debugging-port=9222');
    return;
  }
  say('Starting Cursor with remote debugging…');
  fs.chmodSync(sh, 0o755);
  run('bash', [sh], { stdio: 'inherit' });
  if (!(await waitPort(CDP_PORT, 45000))) {
    say(`Warning: CDP port ${CDP_PORT} did not come up. Remote control needs Cursor restarted with the debug port.`);
  }
}

async function ensureRelay() {
  if (await portOpen(RELAY_PORT)) {
    say(`Relay already listening on ${RELAY_PORT}`);
    return;
  }
  say('Starting public relay (Cloudflare tunnel)…');
  const child = spawn(process.execPath, ['server.mjs', '--tunnel'], {
    cwd: DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.unref();
  const log = path.join(DATA, 'relay.log');
  const stream = fs.createWriteStream(log, { flags: 'a' });
  child.stdout.pipe(stream);
  child.stderr.pipe(stream);
  child.stdout.on('data', buf => {
    const t = buf.toString();
    if (/Public URL:|paired|Cursor Remote Lite started|Connected to Cursor/i.test(t)) process.stdout.write(t);
  });
  if (!(await waitPort(RELAY_PORT, 20000))) say(`Warning: relay port ${RELAY_PORT} did not open. Check ${log}`);
  else say(`Relay started (log: ${log})`);
}

function autoAdb() {
  say('');
  say('Checking for ADB phone / companion APK…');
  const report = pairOverAdb({});
  if (report.reason === 'adb-not-found' || report.reason === 'no-device') {
    say(report.message);
    say('To auto-pair later: connect a phone over USB (or ADB Wi‑Fi), put CursorRemote.apk next to this app, and re-run.');
    return;
  }
  for (const line of report.results || []) {
    say(`[${line.step}${line.serial ? ':' + line.serial : ''}] ${line.ok ? 'OK' : 'FAIL'} ${line.message}`);
  }
  if (report.link) say(`Pairing link:\n${report.link}`);
  if (report.ok || report.softOk) say('Phone should open Cursor Remote and finish pairing automatically.');
}

async function main() {
  say('');
  say('== Cursor Remote (Linux) ==');
  say('');
  process.chdir(DIR);
  ensurePathTools();
  ensureDeps();
  ensureSetup();
  await ensureCursorCdp();
  await ensureRelay();
  await new Promise(r => setTimeout(r, 2500));
  autoAdb();
  say('');
  say(`Paired devices on this computer: ${listDevices().length}`);
  say('Leave this terminal open while you use your phone. Press Ctrl+C to stop watching (relay keeps running in the background).');
  say('');
  setInterval(() => {}, 1 << 30);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
