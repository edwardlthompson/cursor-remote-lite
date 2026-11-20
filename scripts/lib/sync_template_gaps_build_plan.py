"""Sync open GAP_LIST section B rows into BUILD_PLAN template-gaps-sync markers."""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

BEGIN = "<!-- template-gaps-sync:begin -->"
END = "<!-- template-gaps-sync:end -->"
EMPTY = "_No open template gaps in docs/GAP_LIST.md section B._"
ROW = re.compile(
    r"^\|\s*(T[\w–-]+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$",
    re.M,
)


def parse_open_b_gaps(gap_text: str) -> list[tuple[str, str]]:
    """Return (id, title) for open (🔲) rows under section B."""
    # Slice section B until next ## heading
    m = re.search(r"^## B\..*$", gap_text, re.M)
    if not m:
        return []
    rest = gap_text[m.end() :]
    n = re.search(r"^## ", rest, re.M)
    block = rest[: n.start()] if n else rest
    out: list[tuple[str, str]] = []
    for row in ROW.finditer(block):
        gid, title, status = row.group(1), row.group(2).strip(), row.group(3).strip()
        if gid.lower() in {"#", "---"} or title.lower() == "gap":
            continue
        if "🔲" in status or status.lower().startswith("open"):
            # strip markdown bold
            clean = re.sub(r"\*+", "", title).strip()
            out.append((gid, clean))
    return out


def render_inner(gaps: list[tuple[str, str]]) -> str:
    if not gaps:
        return EMPTY
    lines = [f"- 🔲 [AGENT] **{gid}** {title} — see GAP_LIST **B**" for gid, title in gaps]
    return "\n".join(lines)


def replace_block(text: str, begin: str, end: str, inner: str) -> str:
    b = text.find(begin)
    e = text.find(end)
    if b < 0 or e < 0 or e < b:
        raise ValueError(f"missing {begin} / {end}")
    return text[: b + len(begin)] + "\n" + inner + "\n" + text[e:]


def sync_file(plan: Path, gaps_path: Path, *, apply: bool, check: bool) -> int:
    if not plan.is_file():
        print(f"SKIP: {plan} missing", file=sys.stderr)
        return 0
    if not gaps_path.is_file():
        print(f"FAIL: {gaps_path} missing", file=sys.stderr)
        return 1
    raw = plan.read_text(encoding="utf-8")
    if BEGIN not in raw or END not in raw:
        print(f"FAIL: {plan} missing template-gaps-sync markers", file=sys.stderr)
        return 1
    gaps = parse_open_b_gaps(gaps_path.read_text(encoding="utf-8"))
    updated = replace_block(raw, BEGIN, END, render_inner(gaps))
    if raw == updated:
        print(f"OK: {plan.name} template-gaps-sync ({len(gaps)} open)")
        return 0
    if check:
        print(f"FAIL: {plan} template-gaps-sync stale; run with --apply", file=sys.stderr)
        return 1
    if apply:
        plan.write_text(updated, encoding="utf-8", newline="\n")
        print(f"Updated {plan} ({len(gaps)} open B gaps)")
        return 0
    print(f"DRY-RUN: {plan.name} would list {len(gaps)} open B gaps")
    print(render_inner(gaps))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--root", default=".")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--check", action="store_true")
    args = p.parse_args(argv)
    if args.apply and args.check:
        print("FAIL: use --apply or --check, not both", file=sys.stderr)
        return 1
    root = Path(args.root).resolve()
    return sync_file(
        root / "BUILD_PLAN.md",
        root / "docs" / "GAP_LIST.md",
        apply=args.apply,
        check=args.check,
    )


if __name__ == "__main__":
    sys.exit(main())
