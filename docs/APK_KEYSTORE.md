# APK signing keystore backup

Release APKs are signed in GitHub Actions (`.github/workflows/release.yml` / `android.yml`).

## Secrets (required for update-in-place installs)

| Secret | Purpose |
|--------|---------|
| `KEYSTORE_B64` | PKCS12 keystore, base64-encoded (`base64 -w0 release.p12`) |
| `KEYSTORE_PASSWORD` | Store (and key) password for that PKCS12 |

If `KEYSTORE_B64` is missing, CI generates a **throwaway** keystore. That APK installs, but the next release with a different key forces uninstall.

## Backup (HUMAN)

1. Keep an offline copy of `release.p12` (or the raw bytes before base64) in a password manager / encrypted drive — not in git.
2. Store `KEYSTORE_PASSWORD` with the same backup.
3. After rotating GitHub secrets, confirm a tag build still installs over the previous APK (`adb install -r`).
4. Never commit `*.p12`, `local.properties`, or decoded keystore files.

## Recreate `KEYSTORE_B64`

```bash
# from a machine that already has the PKCS12
base64 -w0 release.p12 | gh secret set KEYSTORE_B64
gh secret set KEYSTORE_PASSWORD   # paste password when prompted
```

On Windows (PowerShell):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('release.p12')) | gh secret set KEYSTORE_B64
```
