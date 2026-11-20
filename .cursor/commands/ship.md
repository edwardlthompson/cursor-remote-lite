# Ship (Cursor Remote Lite)

Publish only when the user intends a release. Invoking this command grants explicit approval for `git push` / tags per destructive-ops rules — never silent push.

1. **Verify first** — run @.cursor/commands/verify.md (or confirm it just passed).
2. **Changelog** — ensure `CHANGELOG.md` describes what ships; bump `package.json` version if needed.
3. **Commit** — only if the user asked; follow repo commit rules (no amend of others’ commits).
4. **Tag + push** — `git push origin HEAD` then annotated tag `vX.Y.Z` and `git push origin vX.Y.Z` when the user wants a GitHub Release.
5. **Release workflow** — `.github/workflows/release.yml` builds EXE / MSI / deb / APK / VSIX. Watch Actions; do not force-push `main`.
6. **Pages UI** — if `app/` changed, remind to sync GitHub Pages (`cursor-remote-app`) / LocalAppData and **⋯ → Reload app UI**.

If parent `scripts/agent-run.py` / `pre-release-gate.sh` exist (GAP_LIST **T1**), prefer those after step 1. Until then, `npm test` + manual CHANGELOG skim is the gate.

Begin only when the user confirmed they want a release.
