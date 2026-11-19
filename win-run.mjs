#!/usr/bin/env node
// Windows first-run / everyday launcher used by CursorRemote.exe (tray or console).
// Ensures setup, starts Cursor with CDP when needed, starts the public relay,
// then auto-installs/pairs over ADB when a phone (and optional companion APK) is present.
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
const HIDDEN = process.argv.includes('--hidden') || process.env.CURSOR_REMOTE_TRAY === '1';

fs.mkdirSync(DATA, { recursive: true });

let relayChild = null;

function say(msg) {
  if (HIDDEN && !/^Warning:|Error|FAIL|!!/.test(msg)) {
    // Still mirror important lines into the relay log via ensureRelay pipes; keep stdout quiet in tray mode.
    try { fs.appendFileSync(path.join(DATA, 'relay.log'), `[win-run] ${msg}\n`); } catch { /* */ }
    return;
  }
  console.log(msg);
}

function hasCmd(cmd) {
  const r = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0;
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', cwd: DIR, ...opts });
}

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

function writePid(name, pid) {
  try { fs.writeFileSync(path.join(DATA, name), String(pid) + '\n'); } catch { /* */ }
}

function clearPid(name) {
  try { fs.rmSync(path.join(DATA, name), { force: true }); } catch { /* */ }
}

function ensureDeps() {
  if (fs.existsSync(path.join(DIR, 'node_modules', 'ws'))) return;
  say('Installing npm dependencies…');
  const npmCmd = hasCmd('npm') ? 'npm' : path.join(path.dirname(process.execPath), 'npm.cmd');
  const install = run(npmCmd, ['install', '--omit=dev'], { stdio: HIDDEN ? 'ignore' : 'inherit', shell: true });
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
  const setup = run(process.execPath, ['setup.mjs', '--yes'], { stdio: HIDDEN ? 'ignore' : 'inherit' });
  if (setup.status !== 0) say('Setup reported an error; continuing with tunnel-only mode.');
}

async function ensureCursorCdp() {
  if (await portOpen(CDP_PORT)) {
    say(`Cursor CDP already on port ${CDP_PORT}`);
    return;
  }
  const ps1 = path.join(DIR, 'start-cursor.ps1');
  if (!fs.existsSync(ps1)) {
    say('start-cursor.ps1 missing; start Cursor yourself with --remote-debugging-port=9222');
    return;
  }
  say('Starting Cursor with remote debugging…');
  run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1], {
    stdio: HIDDEN ? 'ignore' : 'inherit',
    windowsHide: HIDDEN,
  });
  if (!(await waitPort(CDP_PORT, 45000))) {
    say(`Warning: CDP port ${CDP_PORT} did not come up. Remote control needs Cursor restarted with the debug port.`);
  }
}

function ensureRelay() {
  return portOpen(RELAY_PORT).then(async up => {
    if (up) {
      say(`Relay already listening on ${RELAY_PORT}`);
      return null;
    }
    say('Starting public relay (Cloudflare tunnel)…');
    const child = spawn(process.execPath, ['server.mjs', '--tunnel'], {
      cwd: DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    relayChild = child;
    writePid('relay.pid', child.pid);
    child.unref();
    const log = path.join(DATA, 'relay.log');
    const stream = fs.createWriteStream(log, { flags: 'a' });
    child.stdout.pipe(stream);
    child.stderr.pipe(stream);
    child.stdout.on('data', buf => {
      const t = buf.toString();
      if (!HIDDEN && /Public URL:|paired|Cursor Remote Lite started|Connected to Cursor/i.test(t)) process.stdout.write(t);
    });
    child.on('exit', () => {
      if (relayChild === child) {
        relayChild = null;
        clearPid('relay.pid');
      }
    });
    if (!(await waitPort(RELAY_PORT, 20000))) {
      say(`Warning: relay port ${RELAY_PORT} did not open. Check ${log}`);
    } else {
      say(`Relay started (log: ${log})`);
    }
    return child;
  });
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

function shutdown() {
  try {
    if (relayChild && !relayChild.killed) {
      try { process.kill(relayChild.pid); } catch { /* */ }
      // On Windows, kill the tree via taskkill when available.
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(relayChild.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      }
    }
  } catch { /* */ }
  clearPid('relay.pid');
  clearPid('win-run.pid');
}

async function main() {
  writePid('win-run.pid', process.pid);
  process.on('SIGINT', () => { shutdown(); process.exit(0); });
  process.on('SIGTERM', () => { shutdown(); process.exit(0); });
  // Windows console close / tray Kill(entireProcessTree) — best-effort.
  process.on('exit', () => { try { clearPid('win-run.pid'); } catch { /* */ } });

  say('');
  say('== Cursor Remote (Windows) ==');
  say('');
  process.chdir(DIR);
  ensureDeps();
  ensureSetup();
  await ensureCursorCdp();
  await ensureRelay();
  // Give url.json / tunnel a moment when Pages is configured.
  await new Promise(r => setTimeout(r, 2500));
  autoAdb();
  const n = listDevices().length;
  say('');
  say(`Paired devices on this computer: ${n}`);
  if (HIDDEN) {
    say('Tray mode: relay stays in the background. Quit from the tray icon to stop.');
  } else {
    say('Leave this window open while you use your phone. Press Ctrl+C to stop watching (relay keeps running in the background).');
    say('Tip: install/run CursorRemote.exe for tray + Start with Windows.');
  }
  say('');
  // Keep the process alive so the tray / console shortcut feels like a running app.
  setInterval(() => {}, 1 << 30);
}

main().catch(err => {
  console.error(err);
  shutdown();
  process.exit(1);
});
