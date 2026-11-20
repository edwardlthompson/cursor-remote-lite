# Bootstrap (Cursor Remote Lite)

Confirm this repo is a healthy **agent-project-bootstrap** child. Do not invent product work.

1. Read @bootstrap.config.json — `parent_template`, `parent_template_version`, stack `node`, `distribution_tier: foss`.
2. Confirm lineage files exist: `.template-version`, `.template-update.json`, @AGENTS.md, @SECURITY.md.
3. Confirm Argus surface: `argus.contract.json`, `argus.remote.json`, `rules.manifest.json`, @docs/ARGUS_REMOTE.md; run `python scripts/argus-remote.py status` (expect `enabled=False`).
4. Confirm board markers on @BUILD_PLAN.md: `remaining-tally`, `open-prs-sync`, `template-gaps-sync`, `local-agent-lane`, `cloud-agent-lane`.
5. Confirm slash surface: `.cursor/commands/` has parent recipes; @docs/help/BATCH_COMMANDS.md is the human cheat sheet.
6. Point at @docs/GAP_LIST.md — sections B/C/D are the upgrade/product/Argus backlog mirrored on BUILD_PLAN.

Report any missing file as a 🔲 `[AGENT][LOCAL]` BUILD_PLAN row. Stop unless the user asks to implement.
