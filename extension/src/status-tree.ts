import * as vscode from 'vscode';
import type { ServerManager, RelaySnapshot } from './server-manager';

export class StatusTreeProvider implements vscode.TreeDataProvider<StatusItem> {
  private readonly _onDidChange = new vscode.EventEmitter<StatusItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;

  constructor(private readonly manager: ServerManager) {}

  refresh(): void {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(element: StatusItem): vscode.TreeItem {
    return element;
  }

  getChildren(): StatusItem[] {
    const s = this.manager.snapshot;
    return [
      item('Relay', labelState(s), s.state === 'running' ? 'pass' : s.state === 'starting' ? 'loading' : 'error'),
      item('Network', s.networkMode || '—'),
      item('Port', String(s.port || '—')),
      item('CDP', s.cdpOk ? `${s.windows} window(s)` : 'not connected'),
      item('Devices', String(s.devices ?? '—')),
      item('App URL', s.appUrl || '(run setup / start tunnel)'),
      item('Public URL', s.relayUrl || '—'),
    ];
  }
}

function labelState(s: RelaySnapshot): string {
  if (s.state === 'running') return 'Running';
  if (s.state === 'starting') return 'Starting…';
  if (s.lastError) return `Stopped (${s.lastError})`;
  return 'Stopped';
}

function item(label: string, description: string, icon?: string): StatusItem {
  const t = new StatusItem(label, description);
  if (icon === 'pass') t.iconPath = new vscode.ThemeIcon('check');
  else if (icon === 'loading') t.iconPath = new vscode.ThemeIcon('loading~spin');
  else if (icon === 'error') t.iconPath = new vscode.ThemeIcon('circle-slash');
  return t;
}

class StatusItem extends vscode.TreeItem {
  constructor(label: string, description: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.description = description;
  }
}
