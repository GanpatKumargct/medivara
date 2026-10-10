"""BE-1.3: copy every labelled JSON block from the API contract into contracts/.

Usage: python scripts/extract_fixtures.py
A block is labelled by a preceding line "Fixture: `contracts/<path>`".
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTRACT = ROOT / "docs" / "srd" / "11-api-contract.md"
OUT = ROOT / "contracts"

LABEL = re.compile(r"^Fixture: `contracts/(?P<path>[^`]+)`\s*$")

# Fixtures the contract describes in prose only; they must be derived by hand.
DERIVED = [
    "API-11.200.ready.json",
    "API-11.200.failed-no-text-layer.json",
    "API-11.200.suspicious.json",
    "API-11.200.cached.json",
    "API-19.200.json",
    "API-21.200.withheld.json",
    "API-21.200.out-of-scope.json",
]


def extract() -> dict[str, str]:
    lines = CONTRACT.read_text(encoding="utf-8").splitlines()
    fixtures: dict[str, str] = {}
    i = 0
    while i < len(lines):
        m = LABEL.match(lines[i])
        if not m:
            i += 1
            continue
        path = m.group("path")
        i += 1
        while i < len(lines) and lines[i].strip() != "```json":
            i += 1
        i += 1
        body = []
        while i < len(lines) and lines[i].strip() != "```":
            body.append(lines[i])
            i += 1
        fixtures[path] = "\n".join(body) + "\n"
    return fixtures


def main() -> int:
    fixtures = extract()
    errors = 0
    for path, text in fixtures.items():
        try:
            json.loads(text)
        except json.JSONDecodeError as exc:
            print(f"INVALID {path}: {exc}", file=sys.stderr)
            errors += 1
            continue
        target = OUT / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")
    print(f"Wrote {len(fixtures) - errors} fixtures to {OUT.relative_to(ROOT)}/")
    missing = [p for p in DERIVED if not (OUT / p).exists()]
    if missing:
        print("Still to derive by hand (described in prose in the contract):")
        for p in missing:
            print(f"  - {p}")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
