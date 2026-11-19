import * as vscode from 'vscode';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EventEmitter } from 'events';

export type RelayState = 'stopped' | 'starting' | 'running';

export interface RelaySnapshot {
  state: RelayState;
  networkMode: string;
  port: number;
  cdpOk: boolean;
  windows: number;
  devices: number;
  appUrl: string;
  relayUrl: string;
  lastError: string;
}

export class ServerManager extends EventEmitter implements vscode.Disposable {
  private child: ChildProcessWithoutNullStreams | undefined;
  private pollTimer: NodeJS.Timeout | undefined;
  private disposed = false;
  snapshot: RelaySnapshot = {
    state: 'stopped',
    networkMode: 'tunnel',
    port: 3939,
    cdpOk: false,
    windows: 0,
    devices: 0,
    appUrl: '',
    relayUrl: '',
    lastError: '',
  };

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
    private readonly statusBar: vscode.StatusBarItem,
  ) {
    super();
  }

  onDidChange(listener: () => void): vscode.Disposable {
    this.on('change', listener);
    return new vscode.Disposable(() => this.off('change', listener));
  }

  private bump(partial: Partial<RelaySnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial };
    const icon = this.snapshot.state === 'running' ? '$(broadcast)' : this.snapshot.state === 'starting' ? '$(sync~spin)' : '$(radio-tower)';
    this.statusBar.text = `${icon} Cursor Remote`;
    this.statusBar.tooltip = `Cursor Remote Lite — ${this.snapshot.state}` + (this.snapshot.relayUrl ? `\n${this.snapshot.relayUrl}` : '');
    this.emit('change');
  }

  private repoRoot(): string {
    const cfg = vscode.workspace.getConfiguration('cursorRemoteLite');
    const configured = (cfg.get<string>('repoPath') || '').trim();
    if (configured && fs.existsSync(path.join(configured, 'server.mjs'))) return configured;

    // Dev: extension/ is inside the repo.
    const parent = path.resolve(this.context.extensionPath, '..');
    if (fs.existsSync(path.join(parent, 'server.mjs'))) return parent;

    const home = path.join(os.homedir(), 'cursor-remote-lite');
    if (fs.existsSync(path.join(home, 'server.mjs'))) return home;

    throw new Error(
      'cursor-remote-lite repo not found. Set cursorRemoteLite.repoPath to your checkout (folder with server.mjs).',
    );
  }

  async start(): Promise<void> {
    if (this.child && !this.child.killed) {
      this.output.appendLine('Relay already running.');
      return;
    }
    let root: string;
    try {
      root = this.repoRoot();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.bump({ state: 'stopped', lastError: msg });
      void vscode.window.showErrorMessage(msg);
      return;
    }

    const cfg = vscode.workspace.getConfiguration('cursorRemoteLite');
    const mode = cfg.get<string>('networkMode', 'tunnel');
    const port = cfg.get<number>('port', 3939);
    const cdpUrl = cfg.get<string>('cdpUrl', 'http://127.0.0.1:9222');

    const args = ['server.mjs'];
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PORT: String(port),
      CDP_URL: cdpUrl,
    };

    if (mode === 'tunnel') {
      args.push('--tunnel');
    } else if (mode === 'localhost') {
      env.HOST = '127.0.0.1';
    } else {
      env.HOST = '0.0.0.0';
    }

    this.bump({ state: 'starting', networkMode: mode, port, lastError: '' });
    this.output.appendLine(`Starting relay in ${root} (${mode}, port ${port})…`);

    const child = spawn('node', args, {
      cwd: root,
      env,
      shell: process.platform === 'win32',
    });
    this.child = child;

    child.stdout.on('data', (buf: Buffer) => this.output.append(buf.toString()));
    child.stderr.on('data', (buf: Buffer) => this.output.append(buf.toString()));
    child.on('exit', (code) => {
      this.output.appendLine(`Relay exited (code ${code})`);
      this.child = undefined;
      this.bump({ state: 'stopped', lastError: code ? `exit ${code}` : '' });
      this.stopPoll();
    });
    child.on('error', (err) => {
      this.output.appendLine(`Relay spawn error: ${err.message}`);
      this.bump({ state: 'stopped', lastError: err.message });
    });

    this.startPoll(port);
  }

  async stop(): Promise<void> {
    this.stopPoll();
    if (!this.child) {
      this.bump({ state: 'stopped' });
      return;
    }
    this.output.appendLine('Stopping relay…');
    const child = this.child;
    this.child = undefined;
    await new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* */ }
        resolve();
      }, 4000);
      child.once('exit', () => { clearTimeout(t); resolve(); });
      try { child.kill('SIGTERM'); } catch { resolve(); }
    });
    this.bump({ state: 'stopped' });
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  async pair(): Promise<void> {
    try {
      const root = this.repoRoot();
      const r = spawn('node', ['devices.mjs', 'pair'], { cwd: root, shell: process.platform === 'win32' });
      r.stdout.on('data', (b: Buffer) => this.output.append(b.toString()));
      r.stderr.on('data', (b: Buffer) => this.output.append(b.toString()));
      this.output.show(true);
      void vscode.window.showInformationMessage('Pairing QR printed in the Cursor Remote Lite output channel.');
    } catch (e) {
      void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }

  async adbPair(): Promise<void> {
    try {
      const root = this.repoRoot();
      const r = spawn('node', ['adb-pair.mjs'], { cwd: root, shell: process.platform === 'win32' });
      r.stdout.on('data', (b: Buffer) => this.output.append(b.toString()));
      r.stderr.on('data', (b: Buffer) => this.output.append(b.toString()));
      this.output.show(true);
    } catch (e) {
      void vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    }
  }

  async openApp(): Promise<void> {
    const url = this.snapshot.appUrl || this.snapshot.relayUrl;
    if (!url) {
      void vscode.window.showWarningMessage('No phone app URL yet. Start the relay (tunnel) or run setup first.');
      return;
    }
    await vscode.env.openExternal(vscode.Uri.parse(url));
  }

  private startPoll(port: number): void {
    this.stopPoll();
    this.pollTimer = setInterval(() => void this.pollStatus(port), 2000);
    void this.pollStatus(port);
  }

  private stopPoll(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  private async pollStatus(port: number): Promise<void> {
    if (this.disposed) return;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/status`, { signal: AbortSignal.timeout(1500) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as {
        ok: boolean;
        cdpOk: boolean;
        windows: number;
        devices: number;
        appUrl?: string;
        relayUrl?: string;
        networkMode?: string;
      };
      this.bump({
        state: 'running',
        cdpOk: Boolean(data.cdpOk),
        windows: Number(data.windows || 0),
        devices: Number(data.devices || 0),
        appUrl: data.appUrl || '',
        relayUrl: data.relayUrl || '',
        networkMode: data.networkMode || this.snapshot.networkMode,
        lastError: '',
      });
    } catch {
      if (this.child && !this.child.killed) {
        this.bump({ state: 'starting' });
      }
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stopPoll();
    void this.stop();
  }
}
