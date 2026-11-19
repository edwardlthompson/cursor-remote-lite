import * as vscode from 'vscode';
import { ServerManager } from './server-manager';
import { StatusTreeProvider } from './status-tree';
import { createStatusBar } from './status-bar';
import { SetupPanel } from './setup-panel';

let manager: ServerManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const output = vscode.window.createOutputChannel('Cursor Remote Lite');
  const statusBar = createStatusBar(context);
  manager = new ServerManager(context, output, statusBar);

  const tree = new StatusTreeProvider(manager);
  context.subscriptions.push(
    output,
    vscode.window.registerTreeDataProvider('cursorRemoteLite.status', tree),
    vscode.commands.registerCommand('cursorRemoteLite.start', () => manager!.start()),
    vscode.commands.registerCommand('cursorRemoteLite.stop', () => manager!.stop()),
    vscode.commands.registerCommand('cursorRemoteLite.restart', () => manager!.restart()),
    vscode.commands.registerCommand('cursorRemoteLite.pair', () => manager!.pair()),
    vscode.commands.registerCommand('cursorRemoteLite.openApp', () => manager!.openApp()),
    vscode.commands.registerCommand('cursorRemoteLite.showLogs', () => output.show(true)),
    vscode.commands.registerCommand('cursorRemoteLite.adbPair', () => manager!.adbPair()),
    vscode.commands.registerCommand('cursorRemoteLite.openSetup', () => SetupPanel.show(context, manager!)),
    manager,
  );

  manager.onDidChange(() => tree.refresh());

  const cfg = vscode.workspace.getConfiguration('cursorRemoteLite');
  if (cfg.get<boolean>('autoStart', true)) {
    void manager.start();
  }
}

export async function deactivate(): Promise<void> {
  await manager?.stop();
}
