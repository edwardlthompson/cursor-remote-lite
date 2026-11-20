"""Sync open Dependabot / release PRs into BUILD_PLAN open-prs-sync markers."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

BEGIN = "<!-- open-prs-sync:begin -->"
END = "<!-- open-prs-sync:end -->"
EMPTY = "_No open Dependabot or Release Please PRs._"
RELEASE_TITLE = re.compile(r"^chore(\([^)]*\))?:\s*release\b", re.I)
TALLY_BEGIN = "<!-- remaining-tally -->"
TALLY_END = "<!-- /remaining-tally -->"


def classify_pr(pr: dict[str, Any]) -> str | None:
    author = ((pr.get("author") or {}).get("login") or "").lower()
    labels = {str((lab or {}).get("name") or "").lower() for lab in (pr.get("labels") or [])}
    head = str(pr.get("headRefName") or "")
    title = str(pr.get("title") or "")
    if author in {"dependabot[bot]", "dependabot"} or "dependencies" in labels:
        return "dependabot"
    if head.startswith("release-please") or RELEASE_TITLE.match(title.strip()):
        return "release"
    return None


def render_inner(prs: list[dict[str, Any]]) -> str:
    rows: list[str] = []
    for pr in prs:
        kind = classify_pr(pr)
        if not kind:
            continue
        number = pr.get("number")
        title = str(pr.get("title") or "").strip()
        url = str(pr.get("url") or "").strip()
        link = f"[#{number}]({url})" if url else f"#{number}"
        if kind == "dependabot":
            rows.append(f"- 🔲 [AUTO] Merge Dependabot {link} ({title})")
        else:
            rows.append(f"- 🔲 [AGENT] Merge release {link} ({title})")
    if not rows:
        return EMPTY
    autos = [r for r in rows if "[AUTO]" in r]
    agents = [r for r in rows if "[AGENT]" in r]
    return "\n".join(autos + agents)


def replace_block(text: str, begin: str, end: str, inner: str) -> str:
    b = text.find(begin)
    e = text.find(end)
    if b < 0 or e < 0 or e < b:
        raise ValueError(f"missing {begin} / {end}")
    return text[: b + len(begin)] + "\n" + inner + "\n" + text[e:]


def _strip_managed_mirrors(text: str) -> str:
    """Drop auto-synced mirrors so they do not double-count sprint rows."""
    out = text
    for begin, end in (
        (BEGIN, END),
        ("<!-- template-gaps-sync:begin -->", "<!-- template-gaps-sync:end -->"),
        ("<!-- local-agent-lane:begin -->", "<!-- local-agent-lane:end -->"),
        ("<!-- cloud-agent-lane:begin -->", "<!-- cloud-agent-lane:end -->"),
    ):
        b, e = out.find(begin), out.find(end)
        if b >= 0 and e > b:
            out = out[:b] + out[e + len(end) :]
    return out


def refresh_tally(text: str) -> str:
    counts = {"AGENT": 0, "AUTO": 0, "HUMAN": 0, "ADB": 0}
    body = _strip_managed_mirrors(text)
    # Only bullet task rows (skip prose that mentions 🔲 [AGENT]).
    for m in re.finditer(r"(?m)^-\s*🔲\s*\[(AGENT|AUTO|HUMAN|ADB)\]", body):
        counts[m.group(1)] += 1
    open_n = sum(counts.values())
    parked = " (+ parked)" if re.search(r"(?m)^-\s*⏸\s*\[", body) else ""
    line = (
        f"**Remaining:** AGENT {counts['AGENT']} · AUTO {counts['AUTO']} · "
        f"HUMAN {counts['HUMAN']} · ADB {counts['ADB']} · **{open_n} open**"
        + (parked and " (+ parked)" or "")
    )
    if TALLY_BEGIN not in text or TALLY_END not in text:
        return text
    return replace_block(text, TALLY_BEGIN, TALLY_END, line)


def fetch_open_prs(root: Path) -> list[dict[str, Any]]:
    gh = shutil.which("gh")
    if not gh:
        raise RuntimeError("gh not found on PATH")
    out = subprocess.check_output(
        [
            gh,
            "pr",
            "list",
            "--state",
            "open",
            "--limit",
            "50",
            "--json",
            "number,title,url,author,labels,headRefName",
        ],
        cwd=root,
        text=True,
        timeout=60,
    )
    data = json.loads(out or "[]")
    if not isinstance(data, list):
        raise RuntimeError("unexpected gh pr list JSON")
    return data


def sync_file(path: Path, prs: list[dict[str, Any]] | None, *, apply: bool, check: bool, root: Path) -> int:
    if not path.is_file():
        print(f"SKIP: {path} missing", file=sys.stderr)
        return 0
    raw = path.read_text(encoding="utf-8")
    if BEGIN not in raw or END not in raw:
        print(f"FAIL: {path} missing open-prs-sync markers", file=sys.stderr)
        return 1
    if prs is None:
        try:
            prs = fetch_open_prs(root)
        except (OSError, subprocess.TimeoutExpired, RuntimeError, json.JSONDecodeError) as exc:
            msg = f"gh unavailable or failed: {exc}"
            if check:
                print(f"FAIL: {msg}", file=sys.stderr)
                return 1
            print(f"SKIP: {msg}", file=sys.stderr)
            return 0
    relevant = [p for p in prs if classify_pr(p)]
    updated = refresh_tally(replace_block(raw, BEGIN, END, render_inner(relevant)))
    if raw == updated:
        print(f"OK: {path.name} open-prs-sync")
        return 0
    if check:
        print(f"FAIL: {path} open-prs-sync stale; run with --apply", file=sys.stderr)
        return 1
    if apply:
        path.write_text(updated, encoding="utf-8", newline="\n")
        print(f"Updated {path}")
        return 0
    print(f"DRY-RUN: {path.name} would update open-prs-sync")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", default=".")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--check", action="store_true")
    p.add_argument("--prs-json")
    args = p.parse_args(argv)
    if args.apply and args.check:
        print("FAIL: use --apply or --check, not both", file=sys.stderr)
        return 1
    root = Path(args.root).resolve()
    prs = None
    if args.prs_json:
        prs = json.loads(Path(args.prs_json).read_text(encoding="utf-8"))
    return sync_file(root / "BUILD_PLAN.md", prs, apply=args.apply, check=args.check, root=root)


if __name__ == "__main__":
    sys.exit(main())
