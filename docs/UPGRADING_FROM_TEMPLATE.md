# Upgrading from the parent template

Upstream: [edwardlthompson/agent-project-bootstrap](https://github.com/edwardlthompson/agent-project-bootstrap) — pin: `.template-version`.

This child does **not** auto-merge the full parent tree. Use:

1. `docs/GAP_LIST.md` section **B** (template gaps) and **D** (Argus).
2. Parent guide: [UPGRADING_FROM_TEMPLATE.md](https://github.com/edwardlthompson/agent-project-bootstrap/blob/main/docs/UPGRADING_FROM_TEMPLATE.md) (Canon / Mixed / Sacred).
3. In Cursor: `/upgrade` — plan only until you name item numbers.

**Already adopted here:** Argus contract + remote stubs, board marker lanes, lineage files (`AGENTS.md`, `.template-update.json`, `SECURITY.md`), `rules.manifest.json`, child-scoped `agent-run` / `validate-bootstrap` / `sprint-status`, CodeQL / Scorecard / Dependabot automerge / weekly health (slim), parallel scope doc for this product.

**Still parent-only / deferred:** full `check-*.sh` farm. Release Please / SBOM stay deferred by design — see [`RELEASE_SUPPLY_CHAIN.md`](RELEASE_SUPPLY_CHAIN.md) (custom `release.yml` kept).
