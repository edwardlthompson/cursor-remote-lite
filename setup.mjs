// Interactive / non-interactive first-run setup: checks dependencies, creates the GitHub Pages app, installs the service.
// Usage: node setup.mjs [--yes] [--repo NAME] [--no-pages] [--2fa]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(os.homedir(), '.cursor-remote-lite');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';

const args = new Set(process.argv.slice(2));
const auto = args.has('--yes') || args.has('-y');
const skipPages = args.has('--no-pages');
const want2fa = args.has('--2fa');
const repoArg = (() => {
  const i = process.argv.indexOf('--repo');
  return i >= 0 ? process.argv[i + 1] : '';
})();

const rl = auto ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q, def = '') => {
  if (auto) return def;
  return (await rl.question(def ? `${q} [${def}] ` : `${q} `)).trim() || def;
};
const yes = async (q, def = 'y') => {
  if (auto) return /^y/i.test(def);
  return /^y/i.test(await ask(`${q} (y/n)`, def));
};
const has = cmd => {
  if (isWin) return spawnSync('where.exe', [cmd], { encoding: 'utf8' }).status === 0;
  return spawnSync('sh', ['-c', `command -v ${cmd}`]).status === 0;
};
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opts });
// readline keeps the TTY in raw mode even when paused; child prompts need cooked mode to see Enter.
const interactive = (cmd, args) => {
  if (rl) {
    rl.pause();
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
  }
  const r = run(cmd, args, { stdio: 'inherit' });
  if (rl) {
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    rl.resume();
  }
  return r;
};

fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
const config = (() => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); } catch { return {}; } })();
const saveConfig = () => fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });

const cloudflaredHint = isMac
  ? 'brew install cloudflared'
  : isWin
    ? 'winget install --id Cloudflare.cloudflared'
    : 'https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/';
const ghHint = isMac
  ? 'brew install gh'
  : isWin
    ? 'winget install --id GitHub.cli'
    : 'https://cli.github.com/';

console.log('\n== Cursor Remote setup ==\n');
if (auto) console.log('(non-interactive: --yes)\n');

console.log('1/4 Checking dependencies');
const missing = [];
if (!has('cloudflared')) missing.push(['cloudflared', cloudflaredHint]);
if (!has('gh')) missing.push(['gh', ghHint]);
for (const [name, how] of missing) console.log(`  Missing ${name}: ${how}`);
if (missing.length && !await yes('  Missing tools only affect public access / fixed address. Continue?', 'y')) process.exit(1);
if (!missing.length) console.log('  cloudflared and gh are installed');

console.log('\n2/4 Fixed address (phone app)');
console.log('  Creates a public repo on your GitHub account and hosts the phone app on GitHub Pages.');
console.log('  The repo only has the app page and an encrypted computer address; the decrypt key is given to your phone only when pairing.');
const doPages = !skipPages && has('gh') && await yes('  Set this up?', 'y');
if (doPages) {
  if (run('gh', ['auth', 'status']).status !== 0) {
    if (auto) {
      console.log('  GitHub CLI is not logged in. Run: gh auth login');
      process.exit(1);
    }
    console.log('  Sign in to GitHub first:');
    if (interactive('gh', ['auth', 'login']).status !== 0) {
      console.log('  GitHub login did not finish. Run gh auth login, then npm run setup again.');
      process.exit(1);
    }
  }
  const login = run('gh', ['api', 'user', '--jq', '.login']).stdout.trim();
  const name = repoArg || await ask('  Repository name', config.publishRepo?.split('/')[1] || 'cursor-remote-app');
  const repo = `${login}/${name}`;
  if (run('gh', ['repo', 'view', repo]).status !== 0) {
    const r = run('gh', ['repo', 'create', repo, '--public', '--description', 'My Cursor Remote phone app']);
    if (r.status !== 0) { console.log(r.stderr); process.exit(1); }
  }
  // Pages needs at least one commit before it can be enabled; the server uploads the rest on start.
  const index = fs.readFileSync(path.join(DIR, 'app', 'index.html'));
  const sha = run('gh', ['api', `repos/${repo}/contents/index.html`, '--jq', '.sha']).stdout.trim();
  const uploaded = run('gh', ['api', '-X', 'PUT', `repos/${repo}/contents/index.html`, '--input', '-'], {
    input: JSON.stringify({ message: 'add app', content: index.toString('base64'), ...(sha ? { sha } : {}) }),
  });
  if (uploaded.status !== 0) { console.log(uploaded.stderr); process.exit(1); }
  // gh repo create uses the account's default branch, which is master on many accounts.
  const branchResult = run('gh', ['api', `repos/${repo}`, '--jq', '.default_branch']);
  const branch = branchResult.stdout.trim();
  if (branchResult.status !== 0 || !branch) {
    console.log('  Failed to read the repository default branch:');
    console.log((branchResult.stderr || branchResult.stdout || 'API did not return a default branch').trim());
    process.exit(1);
  }
  const pages = run('gh', ['api', '-X', 'POST', `repos/${repo}/pages`, '--input', '-'], {
    input: JSON.stringify({ source: { branch, path: '/' } }),
  });
  if (pages.status !== 0) {
    const existing = run('gh', ['api', `repos/${repo}/pages`, '--jq', '.source']);
    let source = null;
    if (existing.status === 0) {
      try { source = JSON.parse(existing.stdout); } catch {}
    }
    if (source?.branch !== branch || source?.path !== '/') {
      console.log(`  Failed to enable GitHub Pages (branch ${branch}):`);
      console.log((pages.stderr || pages.stdout || 'GitHub Pages was not enabled').trim());
      if (existing.status === 0) console.log('  Existing Pages config does not match the expected branch or path.');
      process.exit(1);
    }
  }
  config.publishRepo = repo;
  saveConfig();
  console.log(`  Phone app URL: https://${login.toLowerCase()}.github.io/${name}/`);
} else if (skipPages) {
  console.log('  Skipped (--no-pages)');
}

console.log('\n3/4 Background service');
if (isMac && await yes('  Start at login (always-on, auto-restart on crash)?', auto ? 'n' : 'y')) {
  run('bash', [path.join(DIR, 'service.sh'), 'install'], { stdio: 'inherit' });
} else {
  const startHint = isWin
    ? 'Manual start: npm run public (public) or npm start (LAN only). On Windows keep that window open.'
    : 'Manual start: npm run public (public) or npm start (LAN only)';
  console.log(`  ${startHint}`);
}

console.log('\n4/4 Security');
console.log('  Phones sign in by pairing (no password): scan a QR code once per phone.');
if (want2fa || await yes('  Add Authenticator two-factor verification (Google / Microsoft Authenticator)?', 'n')) {
  if (auto && !want2fa) {
    console.log('  Skipped 2FA in non-interactive mode (pass --2fa to enable interactively).');
  } else {
    interactive('node', [path.join(DIR, 'twofa.mjs')]);
  }
}

const cursorCmd = isMac
  ? './start-cursor.sh'
  : isWin
    ? 'powershell -ExecutionPolicy Bypass -File .\\start-cursor.ps1'
    : './start-cursor.sh';

console.log(`
Done! Two more steps:
  1. Restart Cursor with the debugging port: ${cursorCmd}
  2. Run npm run pair and scan the QR code with your phone. Repeat once for each new phone.`);
if (rl) rl.close();
