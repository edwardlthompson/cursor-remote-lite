#!/usr/bin/env node
/**
 * Sync app/ → GitHub Pages, wait for CDN, then force-reload phone/tablet shells.
 * Usage: node scripts/sync-ui.mjs [--no-adb] [--no-ws] [--no-wait]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  pagesUrl,
  readSwCacheName,
  readUiBuild,
  syncAppFiles,
  waitPagesSwCache,
} from '../sync-app.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(os.homedir(), '.cursor-remote-lite');
const args = new Set(process.argv.slice(2));
const PORT = Number(process.env.PORT || 3939);
const PKG = 'com.cursorremote.lite';
const ACTIVITY = `${PKG}/.MainActivity`;

function loadPublishRepo() {
  if (process.env.CR_PUBLISH_REPO) return process.env.CR_PUBLISH_REPO;
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, 'config.json'), 'utf8')).publishRepo || '';
  } catch {
    return '';
  }
}

function findAdb() {
  const fromPath = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['adb'], { encoding: 'utf8' });
  if (fromPath.status === 0) {
    const line = String(fromPath.stdout || '').split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (line && fs.existsSync(line)) return line;
  }
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      : path.join(os.homedir(), 'Android', 'Sdk'));
  const candidate = path.join(home, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return fs.existsSync(candidate) ? candidate : null;
}

function onlineDevices(bin) {
  const r = spawnSync(bin, ['devices'], { encoding: 'utf8' });
  if (r.status !== 0) return [];
  return String(r.stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.endsWith('\tdevice'))
    .map(line => line.split(/\s+/)[0]);
}

function clearUiOnDevices() {
  const bin = findAdb();
  if (!bin) return { ok: false, reason: 'adb-not-found', devices: [] };
  const devices = onlineDevices(bin);
  if (!devices.length) return { ok: false, reason: 'no-device', devices: [] };
  const results = [];
  for (const serial of devices) {
    // Force-stop so clearUi always runs through onCreate (onNewIntent can be flaky).
    spawnSync(bin, ['-s', serial, 'shell', 'am', 'force-stop', PKG], { encoding: 'utf8' });
    const r = spawnSync(bin, [
      '-s', serial, 'shell', 'am', 'start',
      '-n', ACTIVITY,
      '--ez', 'clearUi', 'true',
    ], { encoding: 'utf8' });
    results.push({
      serial,
      ok: r.status === 0,
      message: (r.stderr || r.stdout || '').trim().slice(0, 200),
    });
  }
  return { ok: results.every(x => x.ok), devices: results };
}

async function postReload() {
  const url = `http://127.0.0.1:${PORT}/api/ui/reload`;
  try {
    const r = await fetch(url, { method: 'POST' });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, status: r.status, body };
    return { ok: true, ...body };
  } catch (e) {
    return { ok: false, reason: 'relay-down', message: e.message };
  }
}

async function main() {
  const publishRepo = loadPublishRepo();
  if (!publishRepo) {
    console.error('FAIL: no publishRepo in ~/.cursor-remote-lite/config.json — run npm run setup first');
    process.exit(1);
  }
  const build = readUiBuild(path.join(ROOT, 'app'));
  const cache = readSwCacheName(path.join(ROOT, 'app'));
  console.log(`== sync-ui ==`);
  console.log(`Pages: ${pagesUrl(publishRepo)}`);
  console.log(`Local shell: UI ${build ?? '?'} · ${cache || '?'}`);

  const sync = await syncAppFiles({ publishRepo, appDir: path.join(ROOT, 'app') });

  if (!args.has('--no-wait')) {
    await waitPagesSwCache(publishRepo, cache || `cursor-remote-v${build}`);
  } else {
    console.log('Skipped Pages wait (--no-wait)');
  }

  let ws = { ok: false, skipped: true };
  if (!args.has('--no-ws')) {
    ws = await postReload();
    if (ws.ok) console.log(`WS reload → ${ws.viewers ?? 0} viewer(s)`);
    else console.log(`WS reload skipped: ${ws.reason || ws.message || JSON.stringify(ws.body) || 'failed'}`);
  } else {
    console.log('Skipped WS reload (--no-ws)');
  }

  let adb = { ok: false, skipped: true, devices: [] };
  if (!args.has('--no-adb')) {
    adb = clearUiOnDevices();
    if (adb.reason === 'adb-not-found') console.log('ADB reload skipped: adb not found');
    else if (adb.reason === 'no-device') console.log('ADB reload skipped: no devices online');
    else {
      for (const d of adb.devices) {
        console.log(`ADB clearUi ${d.serial}: ${d.ok ? 'OK' : 'FAIL'} ${d.message || ''}`);
      }
    }
  } else {
    console.log('Skipped ADB reload (--no-adb)');
  }

  console.log('---');
  console.log(`Synced files: ${sync.changed}`);
  console.log(`Look for "UI ${build}" on the dock after reload.`);
  if (!ws.ok && !(adb.devices || []).some(d => d.ok)) {
    console.log('Tip: open the app and use ⋯ → Reload app UI if devices were offline.');
  }
}

main().catch(err => {
  console.error('FAIL:', err.message || err);
  process.exit(1);
});
