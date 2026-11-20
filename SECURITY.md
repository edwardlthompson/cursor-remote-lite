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
