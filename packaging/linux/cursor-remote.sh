#!/usr/bin/env bash
# Launcher for the portable Linux payload (and .deb install under /opt).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PATH="$ROOT/node/bin:$ROOT/tools:${PATH:-}"

# Prefer an APK sitting next to the downloaded tarball / launcher.
if [[ -f "$ROOT/CursorRemote.apk" ]]; then
  export CURSOR_REMOTE_APK="$ROOT/CursorRemote.apk"
elif [[ -f "$(dirname "$ROOT")/CursorRemote.apk" ]]; then
  export CURSOR_REMOTE_APK="$(cd "$(dirname "$ROOT")" && pwd)/CursorRemote.apk"
fi

NODE="$ROOT/node/bin/node"
ENTRY="$ROOT/linux-run.mjs"
if [[ ! -x "$NODE" || ! -f "$ENTRY" ]]; then
  echo "Incomplete Cursor Remote install under $ROOT" >&2
  exit 1
fi
exec "$NODE" "$ENTRY"
