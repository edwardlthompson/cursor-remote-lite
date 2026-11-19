import * as vscode from 'vscode';

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  item.command = 'cursorRemoteLite.showLogs';
  item.text = '$(radio-tower) Cursor Remote';
  item.tooltip = 'Cursor Remote Lite';
  item.show();
  context.subscriptions.push(item);
  return item;
}
