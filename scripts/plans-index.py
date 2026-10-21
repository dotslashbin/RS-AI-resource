#!/usr/bin/env python3
"""Generate .plans/INDEX.md from each plan's header lines.

INDEX.md is generated — never hand-edit it. Re-run this after creating or
closing a plan:

    python3 scripts/plans-index.py          # rewrite .plans/INDEX.md
    python3 scripts/plans-index.py --check  # exit 1 if INDEX.md is stale

Reads, per plan: the first H1, the date (from the filename), the scope line
(`**App / scope:**` and its older variants), the `**Status:**` line, and any
predecessor / supersession reference. Plans whose status says `legacy` are
listed in a separate trailing section. Standard library only.

⚠️ A plan that git does not track yet is listed WITHOUT a link, marked
`(uncommitted)`. That is what makes this file safe to commit from a tree that
also holds someone else's work in progress: the index is generated from every
plan on DISK, so a linked row for an untracked plan ships a dead link to
everyone who pulls it. Listing it unlinked keeps the row — another session
still needs to see that the work exists before starting something overlapping —
without pointing at a file that is not there. A row re-links itself on the next
run after its plan is committed.

⚠️ Therefore `--check` depends on git state, not just the plan files: it goes
stale when a plan is committed, which is correct — the index really is out of
date at that moment.

"Tracked" is read from `git ls-files`, which includes files that are STAGED but
not yet committed. So the order that produces a correct index is:

    git add -- .plans/<the plans this commit ships>   # stage the plans FIRST
    python3 scripts/plans-index.py                    # now they count as tracked
    git add -- .plans/INDEX.md                        # stage the index it wrote

Regenerating BEFORE staging marks this commit's own plans `(uncommitted)`,
which is wrong the moment the commit lands.
"""
import re
import subprocess
import sys
from pathlib import Path

PLANS = Path(__file__).resolve().parent.parent / ".plans"
INDEX = PLANS / "INDEX.md"

STATUS_RE = re.compile(r"^Status:\s*(?:[✅🔄✖⏸⬜]️?\s*)?(DRAFT|IN PROGRESS|COMPLETE|BLOCKED|ABORTED)\b[\s—–:.-]*(.*)")
SCOPE_RE = re.compile(r"^\*{0,2}(?:App / scope|Scope|Target|Applies to|Page)\*{0,2}:\*{0,2}\s*(.*)")
RELATED_RE = re.compile(r"(Predecessor|Supersedes|superseded by|Successor)\b[^`\n]*`\.plans/([^`]+?)\.md`", re.I)


def tracked():
    """Plan filenames git has under `.plans/`, or None if that cannot be answered.

    None means "do not mark anything" — outside a checkout, or without git on
    PATH, an unmarked index is the honest output, and is what this script
    produced before. Read-only: `ls-files` never touches the index or the tree.
    """
    try:
        out = subprocess.run(
            ["git", "ls-files", "-z", "--", "."],
            cwd=PLANS, capture_output=True, timeout=15, check=True, text=True,
        ).stdout
    except (OSError, subprocess.SubprocessError):
        return None
    # Paths come out relative to `cwd`, so a top-level plan is its bare filename.
    return {p for p in out.split("\0") if p and "/" not in p}


def clean(text, limit):
    text = re.sub(r"[*`]", "", text).replace("|", "/").strip()
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def parse(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    head = lines[:40]
    title = next((re.sub(r"^(> )?# ", "", l) for l in lines if re.match(r"^(> )?# ", l)), path.stem)
    status, note = "—", ""
    for l in head:
        m = STATUS_RE.match(l.replace("*", ""))
        if m:
            status, note = m.group(1), m.group(2)
            break
    scope = next((m.group(1) for l in head if (m := SCOPE_RE.match(l))), "")
    related = sorted({f"{k.lower()} {v[:10]}" for k, v in RELATED_RE.findall("\n".join(head))})
    return {
        "file": path.name,
        "date": path.name[:10],
        "title": clean(title, 80),
        "status": status,
        "note": clean(note, 110),
        "scope": clean(scope, 70),
        "related": "; ".join(related),
        "legacy": "legacy" in note.lower(),
    }


def table(rows, known):
    out = ["| Date | Plan | Status | Scope | Related |", "|---|---|---|---|---|"]
    for r in rows:
        sep = " " if r["note"].startswith("(") else " — "
        status = r["status"] + (sep + r["note"] if r["note"] else "")
        # Unlinked when git does not track it yet — see the note at the top.
        plan = (f"[{r['title']}]({r['file']})" if known is None or r["file"] in known
                else f"{r['title']} (uncommitted)")
        out.append(f"| {r['date']} | {plan} | {status} | {r['scope']} | {r['related']} |")
    return out


def render():
    rows = sorted((parse(p) for p in PLANS.glob("2*.md")), key=lambda r: r["file"], reverse=True)
    current = [r for r in rows if not r["legacy"]]
    legacy = [r for r in rows if r["legacy"]]
    counts = {}
    for r in current:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    summary = " · ".join(f"{k} {v}" for k, v in sorted(counts.items()))
    known = tracked()
    pending = 0 if known is None else sum(1 for r in rows if r["file"] not in known)
    out = [
        "# Plans index",
        "",
        "<!-- GENERATED by scripts/plans-index.py — do not edit by hand; re-run the script. -->",
        "",
        f"{len(rows)} plans — current: {summary} · legacy: {len(legacy)}.",
        "Status and scope come from each plan's own header; open the plan before relying on it.",
        *([
            "",
            f"⚠️ {pending} of these are **not committed yet** — listed unlinked and marked "
            "`(uncommitted)`, because a link to a file that is not in the repo breaks for "
            "everyone else. Each re-links itself once its plan is committed and this script "
            "is re-run.",
        ] if pending else []),
        "",
        "## Current",
        "",
        *table(current, known),
        "",
        "## Legacy (pre-pivot DriveBook — apps no longer in the workspace)",
        "",
        *table(legacy, known),
        "",
    ]
    return "\n".join(out)


def main():
    text = render()
    if "--check" in sys.argv[1:]:
        if not INDEX.exists() or INDEX.read_text(encoding="utf-8") != text:
            print("INDEX.md is stale — run: python3 scripts/plans-index.py", file=sys.stderr)
            return 1
        return 0
    INDEX.write_text(text, encoding="utf-8")
    print(f"wrote {INDEX.relative_to(PLANS.parent)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
