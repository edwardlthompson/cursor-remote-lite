# Release supply chain

Cursor Remote Lite ships a **multi-artifact** release (Windows EXE/MSI, Linux deb/tar.gz, Android APK, Cursor VSIX) from a custom [`.github/workflows/release.yml`](../.github/workflows/release.yml) on `v*` tags.

## What we use

| Channel | Mechanism |
|---------|-----------|
| Version / changelog | Manual tag + [`CHANGELOG.md`](../CHANGELOG.md) |
| Build + publish | `release.yml` (and `android.yml` for APK-only) |
| Extension (GitHub) | VSIX attached to the GitHub Release |
| Extension (Open VSX) | Optional job when repo secret `OVSX_PAT` is set — see [`EXTENSION.md`](EXTENSION.md) |

## What we defer (parent template)

| Parent feature | Status here |
|----------------|-------------|
| **Release Please** | Deferred — multi-artifact packaging does not map cleanly to a single npm version bump PR |
| **SBOM attach** | Optional follow-up (e.g. `anchore/sbom-action` or `gh attestation`) once release.yml is stable |
| **Package attestation** | Optional — see [GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds) |

Keeping custom `release.yml` is intentional (GAP_LIST **T7**). Do not enable Release Please without a migration plan for EXE/MSI/deb/APK/VSIX.

## Verify a release

1. Tag `vX.Y.Z` and push (or `workflow_dispatch` with version).
2. Confirm Actions **Release** is green and the GitHub Release lists all four asset types.
3. Optional: `npm run ext:publish:ovsx` locally or wait for the gated OVSX job when `OVSX_PAT` exists.
