# Security Policy

## Supported Versions

Supported app versions: the latest GitHub Release tag on `main`. Template pin: see `.template-version`.

| Version | Supported |
|---------|-----------|
| latest Release | :white_check_mark: |
| older | best-effort |

## Threat model (product)

Cursor Remote Lite relays control of a desktop Cursor session to paired phones. A paired device can approve commands and edit via the Agent — treat pairing links as **secrets**.

- Debugging port and relay bind to localhost; public access is via Cloudflare tunnel + device token.
- GitHub Pages `url.json` is encrypted; the URL key is only delivered in the pairing link.
- Optional TOTP 2FA: `npm run 2fa`.

See README **Security** for pairing / 2FA / device removal.

### ADB / USB pairing vs PhoneBox GHSA-j6qc-pm3p-fhg7 (reviewed 2026-11-25)

[PhoneBox GHSA-j6qc-pm3p-fhg7](https://github.com/ersinkoc/phonebox/security/advisories/GHSA-j6qc-pm3p-fhg7) (High): while USB-connected, `adb reverse tcp:…` forwarded the PC’s **loopback agent API** onto the phone so *any* app with `INTERNET` could call it as if it were localhost (no pairing key).

**Cursor Remote Lite is not affected by that pattern:**

| Check | This project |
|-------|----------------|
| `adb reverse` | **Not used** anywhere (`adb-pair.mjs`, `win-run.mjs`, tray) |
| ADB role | `adb install -r` + `am start` VIEW deep link only |
| Control plane | Phone → Cloudflare tunnel (or LAN) → relay; **Bearer device token** after pair |
| Pairing secret | One-time code in `#pair=` / `cursorremote://pair?…` (10 min, single use); not an open loopback port on the phone |
| Loopback-only routes | e.g. `POST /api/ui/reload` require a real loopback client IP — not exposed via USB reverse |

Residual ADB risks (orthogonal to GHSA-j6qc): a malicious app that **intercepts** an in-flight pairing deep link could consume the one-time code; keep USB debugging off when unused, and do not leave pairing QR/links where other apps can read them. Wi-Fi-only use (no USB) never touches ADB.

## Reporting a Vulnerability

**Do not** open public GitHub issues for security vulnerabilities.

1. Use GitHub **Private vulnerability reporting** on [edwardlthompson/cursor-remote-lite](https://github.com/edwardlthompson/cursor-remote-lite/security/advisories/new), or
2. Contact the maintainer privately with description, repro, impact, and suggested fix.

## Response Timeline

| Stage | Target |
|-------|--------|
| Acknowledgment | 3 business days |
| Initial assessment | 7 business days |
| Fix or mitigation plan | 30 days (severity-dependent) |
