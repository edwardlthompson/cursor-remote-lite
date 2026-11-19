#!/usr/bin/env bash
# Build .deb from an already-populated packaging/out/linux-payload (native Linux FS).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
VERSION="${1:-1.6.0}"
ARCH=amd64
OUT="$ROOT/packaging/out"
PAYLOAD="$OUT/linux-payload"
STAGE="/tmp/cursor-remote-deb-stage-$$"

if [[ ! -d "$PAYLOAD" ]]; then
  echo "Missing payload at $PAYLOAD — run build.sh first" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$STAGE/deb/DEBIAN" "$STAGE/deb/opt/cursor-remote" \
  "$STAGE/deb/usr/bin" "$STAGE/deb/usr/share/applications" \
  "$STAGE/deb/usr/share/doc/cursor-remote"

# Copy onto ext4 so dpkg-deb permission checks pass.
cp -a "$PAYLOAD/." "$STAGE/deb/opt/cursor-remote/"
ln -sfn /opt/cursor-remote/cursor-remote "$STAGE/deb/usr/bin/cursor-remote"
mkdir -p "$STAGE/deb/opt/cursor-remote/share/applications"
cp -a "$PAYLOAD/share/applications/cursor-remote.desktop" "$STAGE/deb/usr/share/applications/"

cat > "$STAGE/deb/usr/share/doc/cursor-remote/copyright" <<EOF
Format: https://www.debian.org/doc/packaging-manuals/copyright-format/1.0/
Upstream-Name: cursor-remote-lite
Source: https://github.com/edwardlthompson/cursor-remote-lite

Files: *
Copyright: Cursor Remote contributors
License: MIT
EOF

SIZE_KB=$(du -sk "$STAGE/deb/opt" | awk '{print $1}')
cat > "$STAGE/deb/DEBIAN/control" <<EOF
Package: cursor-remote
Version: $VERSION
Section: devel
Priority: optional
Architecture: $ARCH
Maintainer: Cursor Remote <noreply@users.noreply.github.com>
Installed-Size: $SIZE_KB
Depends: ca-certificates
Recommends: adb
Description: Control desktop Cursor from your phone
 Self-hosted relay plus launcher. On first run it starts the public tunnel;
 if a phone is on ADB and CursorRemote.apk is present, pairing is automatic.
EOF

cat > "$STAGE/deb/DEBIAN/postinst" <<'EOF'
#!/bin/sh
set -e
chmod +x /opt/cursor-remote/cursor-remote /opt/cursor-remote/tools/cloudflared 2>/dev/null || true
chmod +x /opt/cursor-remote/node/bin/node /opt/cursor-remote/start-cursor.sh 2>/dev/null || true
exit 0
EOF

chmod 755 "$STAGE/deb/DEBIAN" "$STAGE/deb/DEBIAN/postinst"
chmod 644 "$STAGE/deb/DEBIAN/control"

DEB_TMP="/tmp/CursorRemote_${VERSION}_${ARCH}.deb"
dpkg-deb --build --root-owner-group "$STAGE/deb" "$DEB_TMP"
cp -a "$DEB_TMP" "$OUT/"
cp -a "$DEB_TMP" "$OUT/CursorRemote-linux-x64.deb"
ls -lh "$OUT/CursorRemote-${VERSION}-linux-x64.tar.gz" "$OUT/CursorRemote-linux-x64.deb" "$OUT/CursorRemote_${VERSION}_${ARCH}.deb"
rm -rf "$STAGE"
echo Done.
