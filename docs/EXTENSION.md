# Cursor / VS Code extension

## Install (shipped)

From [GitHub Releases](https://github.com/edwardlthompson/cursor-remote-lite/releases/latest):

```bash
cursor --install-extension cursor-remote-lite.vsix
```

Or from this repo:

```bash
npm run ext:package
cursor --install-extension packaging/out/cursor-remote-lite.vsix
```

Then: **Cursor Remote Lite: Open Setup Panel**.

Set `cursorRemoteLite.repoPath` if the extension cannot find `server.mjs`.

## Open VSX / Marketplace

The package is marketplace-ready (`icon`, `galleryBanner`, `repository`, keywords).

### Automated (preferred)

1. Create a token at https://open-vsx.org/user-settings/tokens
2. Store it on the repo: `gh secret set OVSX_PAT`
3. Tag a release (`v*`). The **Release** workflow’s `ovsx` job publishes the VSIX when `OVSX_PAT` is set; if the secret is missing the job is skipped and CI stays green.

Supply-chain notes: [`RELEASE_SUPPLY_CHAIN.md`](RELEASE_SUPPLY_CHAIN.md).

### Manual

```bash
# create a token at https://open-vsx.org/user-settings/tokens
export OVSX_PAT=...
npm run ext:publish:ovsx
```

VS Marketplace requires a publisher identity at https://marketplace.visualstudio.com/manage and:

```bash
npx @vscode/vsce publish -p "$VSCE_PAT"
```

Until `OVSX_PAT` exists, **GitHub Releases remains the official distribution channel** (same VSIX users install today).
