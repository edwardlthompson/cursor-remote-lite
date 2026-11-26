#!/usr/bin/env node
// Install the companion APK (if present) on every ADB device and open a fresh pairing deep link.
// Usage: node adb-pair.mjs [--apk PATH] [--no-install] [--no-pair]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPairing, appBase, listDevices } from './auth.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(name);
const opt = name => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : '';
};

function findAdb() {
  const fromPath = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['adb'], { encoding: 'utf8' });
  if (fromPath.status === 0) {
    const line = fromPath.stdout.split(/\r?\n/).map(s => s.trim()).find(Boolean);
    if (line && fs.existsSync(line)) return line;
  }
  const home = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
    || (process.platform === 'win32'
      ? path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk')
      : path.join(os.homedir(), 'Android', 'Sdk'));
  const candidate = path.join(home, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');
  return fs.existsSync(candidate) ? candidate : null;
}

function findApk(explicit) {
  if (explicit && fs.existsSync(explicit)) return path.resolve(explicit);
  if (process.env.CURSOR_REMOTE_APK && fs.existsSync(process.env.CURSOR_REMOTE_APK)) {
    return path.resolve(process.env.CURSOR_REMOTE_APK);
  }
  const names = ['CursorRemote.apk', 'cursor-remote.apk', 'app-release.apk'];
  const roots = [process.cwd(), DIR, path.join(DIR, 'dist'), path.join(DIR, 'packaging', 'out'), path.dirname(process.execPath)];
  for (const root of roots) {
    for (const name of names) {
      const p = path.join(root, name);
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function adb(bin, argv) {
  return spawnSync(bin, argv, { encoding: 'utf8' });
}

function sleepSync(ms) {
  // Portable short sleep without async (Windows timeout.exe needs cmd /c).
  try {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.max(1, ms | 0));
  } catch {
    const end = Date.now() + ms;
    while (Date.now() < end) { /* spin */ }
  }
}

function onlineDevices(bin) {
  const r = adb(bin, ['devices']);
  if (r.status !== 0) return [];
  return String(r.stdout || '')
    .split(/\r?\n/)
    .slice(1)
    .map(line => line.trim())
    .filter(line => line.endsWith('\tdevice'))
    .map(line => line.split(/\s+/)[0]);
}

function deepLink(appUrl, pairData) {
  const q = new URLSearchParams({ app: appUrl.replace(/\/?$/, '/'), d: pairData });
  return `cursorremote://pair?${q.toString()}`;
}

export function pairOverAdb({ apkPath = '', install = true, pair = true } = {}) {
  const bin = findAdb();
  if (!bin) {
    return { ok: false, reason: 'adb-not-found', message: 'ADB not found. Install Android platform-tools or connect a device with USB debugging.' };
  }
  const devices = onlineDevices(bin);
  if (!devices.length) {
    return { ok: false, reason: 'no-device', message: 'No ADB device online. Plug in a phone with USB debugging, or pair wirelessly.' };
  }

  const apk = findApk(apkPath);
  const results = [];
  let pairingLink = null;

  if (install) {
    if (!apk) {
      results.push({ step: 'install', ok: false, message: 'Companion APK not found next to the app (expected CursorRemote.apk).' });
    } else {
      for (const serial of devices) {
        const r = adb(bin, ['-s', serial, 'install', '-r', apk]);
        const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
        const ok = r.status === 0 && /Success/i.test(out);
        results.push({ step: 'install', serial, ok, message: ok ? `Installed ${path.basename(apk)}` : (out || 'adb install failed') });
      }
    }
  }

  if (pair) {
    const base = appBase();
    if (!base) {
      results.push({
        step: 'pair',
        ok: false,
        message: 'Phone app address unknown. Run setup first so the Pages URL exists.',
      });
    } else {
      // Pairing codes are one-use: open a fresh link per device (never share one code across phones).
      for (const serial of devices) {
        const before = new Set(listDevices().map(d => d.id));
        const { link, minutes } = createPairing(base);
        pairingLink = link;
        const m = /[#&]pair=([\w.-]+)/.exec(link);
        const data = m?.[1];
        if (!data) {
          results.push({ step: 'pair', serial, ok: false, message: 'Failed to build pairing payload.' });
          continue;
        }
        const uri = deepLink(base, data);
        // Quote for the *device* shell so & in the query string is not interpreted.
        const quoted = `'${uri.replace(/'/g, `'\\''`)}'`;
        const r = adb(bin, ['-s', serial, 'shell', `am start -a android.intent.action.VIEW -d ${quoted}`]);
        const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
        const opened = r.status === 0 && !/Error/i.test(out);
        if (!opened) {
          results.push({
            step: 'pair',
            serial,
            ok: false,
            minutes,
            message: out || 'adb am start failed',
          });
          continue;
        }
        // Wait until this device consumes the pairing code (new device id appears).
        let paired = false;
        const deadline = Date.now() + 45000;
        while (Date.now() < deadline) {
          sleepSync(1500);
          const now = listDevices();
          if (now.some(d => !before.has(d.id) && (Date.now() - (d.lastSeen || 0)) < 60000)) {
            paired = true;
            break;
          }
          // pairing.json gone means code was consumed (success path)
          try {
            if (!fs.existsSync(path.join(os.homedir(), '.cursor-remote-lite', 'pairing.json'))) {
              sleepSync(800);
              paired = listDevices().some(d => !before.has(d.id));
              break;
            }
          } catch {}
        }
        results.push({
          step: 'pair',
          serial,
          ok: paired,
          minutes,
          message: paired
            ? `Paired ${serial} (fresh one-use link, ${minutes} min)`
            : `Opened link on ${serial} but pairing did not finish within 45s — complete in the app, then re-run for remaining devices`,
        });
        if (!paired) break;
      }
    }
  }

  const installFailed = install && results.some(r => r.step === 'install' && !r.ok && apk);
  const pairFailed = pair && results.some(r => r.step === 'pair' && !r.ok);
  // Missing APK is non-fatal if pairing still works (app already installed).
  const missingApkOnly = install && !apk && results.every(r => r.step !== 'pair' || r.ok);
  return {
    ok: !pairFailed && !installFailed,
    softOk: missingApkOnly && !pairFailed,
    adb: bin,
    devices,
    apk,
    link: pairingLink,
    pairedCount: listDevices().length,
    results,
    message: pairFailed || installFailed ? 'ADB pairing did not fully succeed.' : undefined,
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const report = pairOverAdb({
    apkPath: opt('--apk'),
    install: !flag('--no-install'),
    pair: !flag('--no-pair'),
  });
  for (const line of report.results || []) {
    console.log(`[${line.step}${line.serial ? ':' + line.serial : ''}] ${line.ok ? 'OK' : 'FAIL'} ${line.message}`);
  }
  if (report.link) console.log(`\nPairing link:\n${report.link}\n`);
  if (!report.ok && !report.softOk) {
    console.error(report.message || 'ADB pairing did not fully succeed.');
    process.exit(1);
  }
  console.log(`\nDone. Online device(s): ${report.devices.join(', ')}`);
}
