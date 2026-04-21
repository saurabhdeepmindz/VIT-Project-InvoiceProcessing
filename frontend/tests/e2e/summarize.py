"""
summarize.py — EPIC-wise breakdown from Playwright's results.json.

Reads a Playwright JSON report and prints a per-EPIC pass/fail/skip table
plus the aggregate totals. Also writes a Markdown summary next to the
JSON so PR bots and CI annotations can ingest it.

Usage:
    python tests/e2e/summarize.py                               # default: aggregate run
    python tests/e2e/summarize.py tests/e2e/test-output/report/epic-001-auth/results.json

Exit status:
    0 if every test passed or was skipped, 1 if any test failed
    (so CI can gate on this script directly).
"""
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any


def resolve_input(arg: str | None) -> Path:
    if arg:
        return Path(arg)
    here = Path(__file__).resolve().parent
    return here / "test-output" / "report" / "results.json"


def collect(results_path: Path) -> tuple[dict[str, dict[str, float]], dict[str, int]]:
    data: dict[str, Any] = json.loads(results_path.read_text(encoding="utf-8"))
    stats = data.get("stats", {}) or {}

    epics: dict[str, dict[str, float]] = defaultdict(
        lambda: {"pass": 0.0, "fail": 0.0, "skip": 0.0, "dur": 0.0}
    )

    def walk(suites: list[dict[str, Any]], current_spec: str | None = None) -> None:
        for suite in suites:
            spec_file = suite.get("file") or current_spec
            for spec in suite.get("specs", []):
                segments = (spec_file or "").replace("\\", "/").split("/")
                epic_key = next((p for p in segments if p.startswith("epic-")), "unknown")
                for t in spec.get("tests", []):
                    res = (t.get("results") or [{}])[0]
                    status = res.get("status", "?")
                    dur = (res.get("duration") or 0) / 1000.0
                    if status == "passed":
                        epics[epic_key]["pass"] += 1
                    elif status == "skipped":
                        epics[epic_key]["skip"] += 1
                    else:
                        epics[epic_key]["fail"] += 1
                    epics[epic_key]["dur"] += dur
            if suite.get("suites"):
                walk(suite["suites"], spec_file)

    walk(data.get("suites", []))
    return epics, stats


def render_text(epics: dict[str, dict[str, float]], stats: dict[str, int]) -> str:
    lines = [f"{'EPIC folder':32s}  pass  fail  skip   dur(s)", "-" * 60]
    for key in sorted(epics):
        v = epics[key]
        lines.append(
            f"{key:32s}  {int(v['pass']):>4}  {int(v['fail']):>4}  "
            f"{int(v['skip']):>4}  {v['dur']:>7.1f}"
        )
    total = (
        int(stats.get("expected", 0))
        + int(stats.get("skipped", 0))
        + int(stats.get("unexpected", 0))
        + int(stats.get("flaky", 0))
    )
    lines.append("-" * 60)
    lines.append(
        f"{'TOTAL':32s}  {int(stats.get('expected', 0)):>4}  "
        f"{int(stats.get('unexpected', 0)):>4}  {int(stats.get('skipped', 0)):>4}  "
        f"{stats.get('duration', 0) / 1000:>7.1f}   ({total} tests)"
    )
    return "\n".join(lines)


def render_markdown(epics: dict[str, dict[str, float]], stats: dict[str, int]) -> str:
    header = (
        "# Playwright run — EPIC-wise summary\n\n"
        f"- **Total:** {int(stats.get('expected', 0)) + int(stats.get('skipped', 0)) + int(stats.get('unexpected', 0))}"
        f"  ·  **Passed:** {int(stats.get('expected', 0))}"
        f"  ·  **Failed:** {int(stats.get('unexpected', 0))}"
        f"  ·  **Skipped:** {int(stats.get('skipped', 0))}"
        f"  ·  **Duration:** {stats.get('duration', 0) / 1000:.1f}s\n\n"
        "| EPIC | Passed | Failed | Skipped | Duration (s) |\n"
        "| --- | ---: | ---: | ---: | ---: |\n"
    )
    rows = "".join(
        f"| {key} | {int(v['pass'])} | {int(v['fail'])} | {int(v['skip'])} | {v['dur']:.1f} |\n"
        for key, v in sorted(epics.items())
    )
    return header + rows


def main() -> int:
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    results_path = resolve_input(arg)
    if not results_path.exists():
        print(f"results.json not found at {results_path}", file=sys.stderr)
        return 2

    epics, stats = collect(results_path)
    text = render_text(epics, stats)
    print(text)

    summary_md = results_path.parent / "summary.md"
    summary_md.write_text(render_markdown(epics, stats), encoding="utf-8")
    print(f"\nMarkdown summary written to {summary_md}")

    return 1 if int(stats.get("unexpected", 0)) > 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
