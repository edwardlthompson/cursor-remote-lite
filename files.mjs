// Resolves file references from Cursor chats and reads them from the local disk or, for SSH windows, over ssh.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
// spawn used for local git diff as well as SSH.

const TEXT_LIMIT = 512 * 1024;
const IMAGE_LIMIT = 8 * 1024 * 1024;
const IMAGE_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp' };

const STORAGE_DIRS = {
  darwin: '~/Library/Application Support/Cursor/User/workspaceStorage',
  linux: '~/.config/Cursor/User/workspaceStorage',
  win32: `${process.env.APPDATA}/Cursor/User/workspaceStorage`,
};

// vscode-remote://ssh-remote+<host or hex-encoded {"hostName":...}>/path
function parseFolderUri(uri) {
  const u = new URL(uri);
  if (u.protocol === 'file:') return { host: null, root: decodeURIComponent(u.pathname) };
  if (u.protocol !== 'vscode-remote:') return null;
  const authority = decodeURIComponent(u.host);
  const m = /^ssh-remote\+(.+)$/.exec(authority);
  if (!m) return null;
  let host = m[1];
  if (/^[0-9a-f]+$/i.test(host) && host.length % 2 === 0) {
    try { host = JSON.parse(Buffer.from(host, 'hex').toString('utf8')).hostName || host; } catch {}
  }
  return { host, root: decodeURIComponent(u.pathname) };
}

// Every folder Cursor has opened, newest first.
export function workspaces() {
  const dir = (STORAGE_DIRS[process.platform] || STORAGE_DIRS.linux).replace(/^~/, os.homedir());
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch { return []; }
  const out = [];
  for (const name of entries) {
    const file = path.join(dir, name, 'workspace.json');
    try {
      const { folder } = JSON.parse(fs.readFileSync(file, 'utf8'));
      const ws = folder && parseFolderUri(folder);
      if (ws) out.push({ ...ws, mtime: fs.statSync(file).mtimeMs });
    } catch {}
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

// Window titles look like "file.py — Folder [SSH: host]" or "Folder".
export function workspaceForTitle(title) {
  const host = /\[SSH: ([^\]]+)\]/.exec(title)?.[1] || null;
  const folder = title.replace(/\s*\[SSH: [^\]]+\]\s*$/, '').split(' — ').pop().replace(/^●\s*/, '').trim();
  return workspaces().find(w => w.host === host && path.posix.basename(w.root) === folder) || null;
}

const shq = s => `'${String(s).replace(/'/g, `'\\''`)}'`;
// Remote paths starting with ~/ must leave the tilde unquoted so the remote shell expands it.
const remotePath = p => p.startsWith('~/') ? `"$HOME"/${shq(p.slice(2))}` : shq(p);

// One shared master connection per host: faster, and avoids sshd's MaxStartups dropping bursts of new connections.
const SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-o', 'ControlMaster=auto',
  '-o', `ControlPath=${path.join(os.homedir(), '.cursor-remote-lite', 'ssh-%C')}`, '-o', 'ControlPersist=120'];

async function ssh(host, command, limit) {
  try {
    return await sshOnce(host, command, limit);
  } catch {
    await new Promise(r => setTimeout(r, 500));
    return sshOnce(host, command, limit).catch(e => { throw new Error(`SSH connection to ${host} failed: ${e.message}`); });
  }
}

function sshOnce(host, command, limit) {
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', [...SSH_OPTS, host, command], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let size = 0, err = '';
    child.stdout.on('data', c => { if (size < limit) { chunks.push(c); size += c.length; } });
    child.stderr.on('data', c => { err += c; });
    const timer = setTimeout(() => child.kill(), 20000);
    child.on('error', e => { clearTimeout(timer); reject(e); });
    child.on('close', code => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks).subarray(0, limit));
      else reject(new Error(err.trim().split('\n').pop() || `ssh exited with ${code}`));
    });
  });
}

// Returns the size of a regular file, or null if it doesn't exist.
export async function fileSize(host, p) {
  if (!host) {
    try {
      const st = fs.statSync(p.replace(/^~(?=\/)/, os.homedir()));
      return st.isFile() ? st.size : null;
    } catch { return null; }
  }
  // Exits 0 whether or not the file exists, so a rejection here always means the connection failed.
  const out = await ssh(host, `test -f ${remotePath(p)} && stat -c %s -- ${remotePath(p)} || true`, 64);
  const n = parseInt(out.toString(), 10);
  return Number.isFinite(n) ? n : null;
}

async function readHead(host, p, limit) {
  if (!host) {
    const fd = fs.openSync(p.replace(/^~(?=\/)/, os.homedir()), 'r');
    try {
      const buf = Buffer.alloc(limit);
      const n = fs.readSync(fd, buf, 0, limit, 0);
      return buf.subarray(0, n);
    } finally { fs.closeSync(fd); }
  }
  return ssh(host, `head -c ${limit} -- ${remotePath(p)}`, limit);
}

export async function readFile(host, p, size) {
  const name = path.posix.basename(p);
  const image = IMAGE_TYPES[path.extname(name).toLowerCase()];
  if (image) {
    if (size > IMAGE_LIMIT) throw new Error(`Image too large (${(size / 1048576).toFixed(1)} MB); view it on the computer`);
    const buf = await readHead(host, p, size);
    return { image: `data:${image};base64,${buf.toString('base64')}` };
  }
  const buf = await readHead(host, p, Math.min(size, TEXT_LIMIT));
  if (buf.subarray(0, 8192).includes(0)) throw new Error('Binary file; cannot preview');
  return { text: buf.toString('utf8'), truncated: size > TEXT_LIMIT };
}

const DIFF_LIMIT = 200 * 1024;

function localAbs(p) {
  return p.replace(/^~(?=\/)/, os.homedir());
}

/** Unified diff for a workspace file (git). Falls back to full content for untracked files. */
export async function readDiff(host, filePath) {
  const name = path.posix.basename(filePath);
  if (IMAGE_TYPES[path.extname(name).toLowerCase()]) {
    return { error: 'Binary / image; open preview instead' };
  }

  if (!host) {
    const abs = localAbs(filePath);
    const dir = path.dirname(abs);
    const root = await runLocal(['git', '-C', dir, 'rev-parse', '--show-toplevel']).catch(() => null);
    if (!root) return { error: 'no-git', text: '' };
    const rootDir = root.trim();
    let text = await runLocal(['git', '-C', rootDir, 'diff', '--no-color', '--', abs]).catch(() => '');
    if (!text.trim()) {
      // Untracked or new: show as added file (capped).
      const tracked = await runLocal(['git', '-C', rootDir, 'ls-files', '--', abs]).catch(() => '');
      if (!tracked.trim()) {
        try {
          const body = fs.readFileSync(abs, 'utf8');
          const lines = body.split('\n').slice(0, 4000);
          text = `--- /dev/null\n+++ b/${name}\n` + lines.map(l => `+${l}`).join('\n');
          if (body.length > DIFF_LIMIT) text += '\n… truncated';
        } catch (e) {
          return { error: e.message || 'unreadable' };
        }
      } else {
        text = '(no unstaged diff vs HEAD for this file)';
      }
    }
    const truncated = Buffer.byteLength(text, 'utf8') > DIFF_LIMIT;
    if (truncated) text = text.slice(0, DIFF_LIMIT);
    return { text, truncated };
  }

  // SSH remote
  const rp = remotePath(filePath);
  try {
    const root = (await ssh(host, `git -C "$(dirname -- ${rp})" rev-parse --show-toplevel 2>/dev/null`, 4096)).toString().trim();
    if (!root) return { error: 'no-git', text: '' };
    const rq = remotePath(root);
    let text = (await ssh(host, `git -C ${rq} diff --no-color -- ${rp} 2>/dev/null | head -c ${DIFF_LIMIT}`, DIFF_LIMIT)).toString('utf8');
    if (!text.trim()) {
      const tracked = (await ssh(host, `git -C ${rq} ls-files -- ${rp}`, 4096)).toString().trim();
      if (!tracked) {
        const body = (await ssh(host, `head -c ${DIFF_LIMIT} -- ${rp}`, DIFF_LIMIT)).toString('utf8');
        const lines = body.split('\n').slice(0, 4000);
        text = `--- /dev/null\n+++ b/${name}\n` + lines.map(l => `+${l}`).join('\n');
      } else {
        text = '(no unstaged diff vs HEAD for this file)';
      }
    }
    return { text, truncated: text.length >= DIFF_LIMIT - 16 };
  } catch (e) {
    return { error: e.message || 'diff failed' };
  }
}

function runLocal(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(args[0], args.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    child.stdout.on('data', c => chunks.push(c));
    child.stderr.on('data', c => { err += c; });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(err.trim().split('\n').pop() || `${args[0]} exited ${code}`));
    });
  });
}

// "src/a.py:12", "a.py#L12-20", "a.py (lines 3-9)" → path + first line.
export function parseRef(text) {
  let s = String(text).trim().replace(/^[`'"]+|[`'",;:.)]+$/g, '');
  let line = null;
  const m = /(?::(\d+)(?::\d+)?(?:-\d+)?|#L(\d+)(?:-L?\d+)?)$/.exec(s);
  if (m) { line = Number(m[1] || m[2]); s = s.slice(0, m.index); }
  return { p: s, line };
}
