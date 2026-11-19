import * as vscode from 'vscode';
import type { ServerManager } from './server-manager';

export class SetupPanel {
  public static current: SetupPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly manager: ServerManager,
  ) {
    this.panel = panel;
    this.panel.webview.html = this.html();
    this.panel.onDidDispose(() => { SetupPanel.current = undefined; });
    this.panel.webview.onDidReceiveMessage(async (msg) => {
      const cfg = vscode.workspace.getConfiguration('cursorRemoteLite');
      switch (msg.type) {
        case 'save': {
          await cfg.update('networkMode', msg.networkMode, vscode.ConfigurationTarget.Global);
          await cfg.update('port', Number(msg.port) || 3939, vscode.ConfigurationTarget.Global);
          await cfg.update('autoStart', Boolean(msg.autoStart), vscode.ConfigurationTarget.Global);
          if (typeof msg.repoPath === 'string') {
            await cfg.update('repoPath', msg.repoPath, vscode.ConfigurationTarget.Global);
          }
          void vscode.window.showInformationMessage('Cursor Remote Lite settings saved.');
          this.refresh();
          break;
        }
        case 'start': await this.manager.start(); this.refresh(); break;
        case 'stop': await this.manager.stop(); this.refresh(); break;
        case 'pair': await this.manager.pair(); break;
        case 'adb': await this.manager.adbPair(); break;
        case 'open': await this.manager.openApp(); break;
        case 'logs': void vscode.commands.executeCommand('cursorRemoteLite.showLogs'); break;
        case 'refresh': this.refresh(); break;
      }
    });
    this.refresh();
  }

  static show(context: vscode.ExtensionContext, manager: ServerManager): void {
    if (SetupPanel.current) {
      SetupPanel.current.panel.reveal();
      SetupPanel.current.refresh();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      'cursorRemoteLiteSetup',
      'Cursor Remote Lite Setup',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    SetupPanel.current = new SetupPanel(panel, manager);
    context.subscriptions.push(panel);
  }

  private refresh(): void {
    const cfg = vscode.workspace.getConfiguration('cursorRemoteLite');
    const s = this.manager.snapshot;
    void this.panel.webview.postMessage({
      type: 'state',
      networkMode: cfg.get('networkMode', 'tunnel'),
      port: cfg.get('port', 3939),
      autoStart: cfg.get('autoStart', true),
      repoPath: cfg.get('repoPath', ''),
      snapshot: s,
    });
  }

  private html(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  body { font: 13px/1.45 var(--vscode-font-family); color: var(--vscode-foreground); padding: 20px 24px 40px; max-width: 640px; }
  h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
  h2 { font-size: 13px; font-weight: 600; margin: 22px 0 8px; text-transform: uppercase; letter-spacing: .04em; opacity: .85; }
  p, li { opacity: .9; }
  .muted { opacity: .7; font-size: 12px; }
  label { display: block; margin: 10px 0 4px; font-weight: 500; }
  input, select { width: 100%; box-sizing: border-box; padding: 6px 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border, transparent); border-radius: 2px; }
  .row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
  button { padding: 6px 12px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .card { border: 1px solid var(--vscode-widget-border, rgba(127,127,127,.35)); border-radius: 4px; padding: 12px 14px; margin-top: 8px; }
  .stat { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid var(--vscode-widget-border, rgba(127,127,127,.2)); }
  .stat:last-child { border-bottom: none; }
  code { font-family: var(--vscode-editor-font-family); font-size: 12px; }
</style>
</head>
<body>
  <h1>Cursor Remote Lite</h1>
  <p class="muted">Free forever. Pair phones with a QR — no license key.</p>

  <h2>Live status</h2>
  <div class="card" id="status">Loading…</div>
  <div class="row">
    <button data-cmd="start">Start relay</button>
    <button class="secondary" data-cmd="stop">Stop</button>
    <button class="secondary" data-cmd="refresh">Refresh</button>
    <button class="secondary" data-cmd="logs">Logs</button>
  </div>

  <h2>Networking</h2>
  <label for="mode">Mode</label>
  <select id="mode">
    <option value="tunnel">Cloudflare tunnel (cellular / away from home)</option>
    <option value="lan">LAN / Tailscale (bind 0.0.0.0)</option>
    <option value="localhost">Localhost only (127.0.0.1)</option>
  </select>
  <label for="port">Port</label>
  <input id="port" type="number" min="1" max="65535" />
  <label><input id="autoStart" type="checkbox" /> Auto-start relay when Cursor launches</label>
  <label for="repo">Repo path (folder with server.mjs)</label>
  <input id="repo" type="text" placeholder="Leave empty to auto-detect" />
  <div class="row">
    <button data-cmd="save">Save settings</button>
  </div>

  <h2>Phone</h2>
  <div class="row">
    <button data-cmd="pair">Pair (QR in Output)</button>
    <button class="secondary" data-cmd="adb">ADB install + pair</button>
    <button class="secondary" data-cmd="open">Open phone app</button>
  </div>
  <p class="muted">Android app name: <strong>Cursor Remote</strong>. Put <code>CursorRemote.apk</code> next to the EXE or in the repo for ADB auto-install.</p>

  <h2>Telegram (optional)</h2>
  <ol>
    <li>Create a bot with <code>@BotFather</code> and copy the token.</li>
    <li>Set env <code>TELEGRAM_BOT_TOKEN</code> (or write it into <code>~/.cursor-remote-lite/telegram.json</code>).</li>
    <li>Restart the relay, then send <code>/start</code> to the bot.</li>
    <li>Waiting alerts include <strong>Approve / Skip / Stop</strong>; plain text is sent as a prompt.</li>
  </ol>

  <script>
    const vscode = acquireVsCodeApi();
    const $ = id => document.getElementById(id);
    function render(s) {
      const snap = s.snapshot || {};
      $('mode').value = s.networkMode || 'tunnel';
      $('port').value = s.port || 3939;
      $('autoStart').checked = !!s.autoStart;
      $('repo').value = s.repoPath || '';
      $('status').innerHTML = [
        ['Relay', snap.state || '—'],
        ['Network', snap.networkMode || '—'],
        ['CDP', snap.cdpOk ? (snap.windows + ' window(s)') : 'not connected'],
        ['Devices', snap.devices ?? '—'],
        ['App URL', snap.appUrl || '—'],
        ['Public URL', snap.relayUrl || '—'],
      ].map(([k,v]) => '<div class="stat"><span>'+k+'</span><span><code>'+String(v).replace(/</g,'&lt;')+'</code></span></div>').join('');
    }
    window.addEventListener('message', e => { if (e.data?.type === 'state') render(e.data); });
    document.querySelectorAll('[data-cmd]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-cmd');
        if (type === 'save') {
          vscode.postMessage({
            type: 'save',
            networkMode: $('mode').value,
            port: Number($('port').value),
            autoStart: $('autoStart').checked,
            repoPath: $('repo').value.trim(),
          });
        } else vscode.postMessage({ type });
      });
    });
  </script>
</body>
</html>`;
  }
}
