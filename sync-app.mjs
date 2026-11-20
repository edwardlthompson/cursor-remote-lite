// Sync local app/ shell files to the user's GitHub Pages publish repo (changed files only).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

export const APP_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

export function gitBlobSha(buf) {
  return crypto.createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

export function pagesUrl(publishRepo) {
  const [owner, repo] = String(publishRepo || '').split('/');
  if (!owner || !repo) return '';
  return `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

export function readUiBuild(appDir = path.join(ROOT, 'app')) {
  try {
    const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
    const m = /UI_BUILD\s*=\s*(\d+)/.exec(html);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export function readSwCacheName(appDir = path.join(ROOT, 'app')) {
  try {
    const sw = fs.readFileSync(path.join(appDir, 'sw.js'), 'utf8');
    const m = /CACHE\s*=\s*['"]([^'"]+)['"]/.exec(sw);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

function runGh(args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve(out.trim()) : reject(new Error(err.trim() || `gh exited ${code}`))));
    p.stdin.end(input ?? '');
  });
}

export async function remoteShas(publishRepo) {
  const out = await runGh(['api', `repos/${publishRepo}/contents`, '--jq', '.[] | [.name, .sha] | @tsv']).catch(() => '');
  return new Map(out.split('\n').filter(Boolean).map(l => l.split('\t')));
}

export async function putFile(publishRepo, name, buf, sha) {
  const body = { message: `update ${name}`, content: buf.toString('base64'), ...(sha ? { sha } : {}) };
  await runGh(['api', '-X', 'PUT', `repos/${publishRepo}/contents/${name}`, '--input', '-'], JSON.stringify(body));
}

/**
 * @returns {{ changed: number, files: string[] }}
 */
export async function syncAppFiles({
  publishRepo,
  appDir = path.join(ROOT, 'app'),
  log = console.log,
} = {}) {
  if (!publishRepo) throw new Error('publishRepo missing — run npm run setup first');
  const remote = await remoteShas(publishRepo);
  const files = [];
  for (const name of fs.readdirSync(appDir)) {
    if (!APP_MIME[path.extname(name)] || name === 'url.json') continue;
    const buf = fs.readFileSync(path.join(appDir, name));
    if (remote.get(name) === gitBlobSha(buf)) continue;
    await putFile(publishRepo, name, buf, remote.get(name));
    files.push(name);
  }
  if (files.length) log(`Synced ${files.length} app file(s) to GitHub Pages`);
  else log('App shell already up to date on GitHub Pages');
  return { changed: files.length, files };
}

/** Poll public Pages sw.js until it contains the expected CACHE name. */
export async function waitPagesSwCache(publishRepo, wantCache, {
  timeoutMs = 120000,
  intervalMs = 3000,
  log = console.log,
} = {}) {
  const base = pagesUrl(publishRepo);
  if (!base || !wantCache) throw new Error('pages URL or cache name missing');
  const url = base + 'sw.js';
  const end = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < end) {
    try {
      const r = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      last = await r.text();
      if (last.includes(wantCache)) {
        log(`Pages ready: ${wantCache}`);
        return true;
      }
    } catch (e) {
      last = String(e.message || e);
    }
    log(`Waiting for Pages (${wantCache})…`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for Pages sw.js to include ${wantCache}. Last: ${last.slice(0, 120)}`);
}
