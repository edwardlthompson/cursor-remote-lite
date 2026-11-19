#!/usr/bin/env bash
# Build CursorRemote-*-linux-x64.tar.gz and a .deb for Linux Mint / Ubuntu.
# Usage: ./packaging/linux/build.sh [VERSION] [APK_PATH]
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${1:-1.6.0}"
APK_PATH="${2:-}"
OUT="$ROOT/packaging/out"
PAYLOAD="$OUT/linux-payload"
STAGE="$OUT/linux-stage"
ARCH=amd64
NODE_VER=v22.14.0

echo "== Building Cursor Remote Linux packages v$VERSION =="
rm -rf "$PAYLOAD" "$STAGE"
mkdir -p "$PAYLOAD" "$STAGE" "$OUT"

echo "Downloading Node $NODE_VER (linux-x64)…"
NODE_TGZ="$OUT/node-$NODE_VER-linux-x64.tar.xz"
curl -fsSL "https://nodejs.org/dist/$NODE_VER/node-$NODE_VER-linux-x64.tar.xz" -o "$NODE_TGZ"
tar -xJf "$NODE_TGZ" -C "$OUT"
mkdir -p "$PAYLOAD/node"
cp -a "$OUT/node-$NODE_VER-linux-x64/." "$PAYLOAD/node/"

echo "Copying app files…"
for f in server.mjs auth.mjs devices.mjs files.mjs notify.mjs setup.mjs twofa.mjs \
         adb-pair.mjs linux-run.mjs win-run.mjs package.json package-lock.json \
         start-cursor.sh start-cursor.ps1 setup-windows.ps1 LICENSE README.md README.en.md; do
  [[ -f "$ROOT/$f" ]] && cp -a "$ROOT/$f" "$PAYLOAD/"
done
cp -a "$ROOT/app" "$PAYLOAD/app"
cp -a "$ROOT/packaging/linux/cursor-remote.sh" "$PAYLOAD/cursor-remote"
chmod +x "$PAYLOAD/cursor-remote" "$PAYLOAD/start-cursor.sh" "$PAYLOAD/linux-run.mjs" || true

echo "npm install (payload)…"
(
  cd "$PAYLOAD"
  ./node/bin/npm install --omit=dev
)

echo "Downloading cloudflared…"
mkdir -p "$PAYLOAD/tools"
curl -fsSL "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
  -o "$PAYLOAD/tools/cloudflared"
chmod +x "$PAYLOAD/tools/cloudflared"

if [[ -z "$APK_PATH" ]]; then
  for c in "$ROOT/CursorRemote.apk" "$OUT/CursorRemote.apk"; do
    [[ -f "$c" ]] && APK_PATH="$c" && break
  done
fi
if [[ -n "$APK_PATH" && -f "$APK_PATH" ]]; then
  cp -a "$APK_PATH" "$PAYLOAD/CursorRemote.apk"
  echo "Bundled APK: $APK_PATH"
fi

# Desktop entry for Mint / GNOME
mkdir -p "$PAYLOAD/share/applications" "$PAYLOAD/share/icons/hicolor/256x256/apps"
cat > "$PAYLOAD/share/applications/cursor-remote.desktop" <<EOF
[Desktop Entry]
Name=Cursor Remote
Comment=Control desktop Cursor from your phone
Exec=/opt/cursor-remote/cursor-remote
Icon=cursor-remote
Terminal=true
Type=Application
Categories=Development;Utility;
EOF

TGZ="$OUT/CursorRemote-$VERSION-linux-x64.tar.gz"
tar -C "$PAYLOAD" -czf "$TGZ" .
echo "Wrote $TGZ"

# --- .deb (build on a native Linux filesystem; /mnt/c breaks dpkg-deb mode checks) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/make-deb-from-payload.sh" "$VERSION"
echo Done.
