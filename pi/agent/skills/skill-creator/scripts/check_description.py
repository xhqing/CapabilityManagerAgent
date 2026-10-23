#!/usr/bin/env python3
"""Check SKILL.md frontmatter description length against the Agent Skills spec cap.

The Agent Skills spec caps `description` at 1024 characters, measured the way
JS `string.length` does it (UTF-16 code units: one CJK char = 1, one emoji = 2).
Loaders warn on every session start when exceeded (pi shows "[Skill conflicts]");
the skill still loads, but the warning persists until fixed. This script measures
the exact same quantity so pass/fail here matches the loader's verdict.

Usage:
    python3 check_description.py <SKILL.md> [more SKILL.md paths ...]

Exit codes: 0 = all pass, 1 = any file over the cap or unparseable.
"""

import re
import sys

MAX = 1024


def js_length(s: str) -> int:
    """Length in UTF-16 code units, matching JS string.length semantics."""
    return len(s.encode("utf-16-le")) // 2


def extract_description(text: str) -> str | None:
    """Extract the description value from YAML frontmatter.

    Handles the common shapes: single-line (quoted or bare) and block scalars
    (| or > with their - / + chomping variants). Returns None if frontmatter
    or the description key cannot be found.
    """
    m = re.match(r"\A---\s*\n(.*?)\n---\s*\n?", text, re.S)
    if not m:
        return None
    fm = m.group(1)
    for line in fm.splitlines():
        stripped = line.strip()
        if not stripped.startswith("description:"):
            continue
        value = stripped[len("description:"):].strip()
        if value in ("|", "|-", "|+", ">", ">-", ">+"):
            # Block scalar: collect following lines that are more indented.
            block = []
            for cont in fm.splitlines()[fm.splitlines().index(line) + 1:]:
                if cont.strip() == "":
                    block.append("")
                    continue
                if cont.startswith((" ", "\t")) or cont[:1] not in ("", "-"):
                    if cont.startswith((" ", "\t")):
                        block.append(cont.strip())
                        continue
                break
            joined = "\n".join(block) if value.startswith("|") else " ".join(b for b in block if b)
            return joined.strip() or None
        # Single-line value: strip one matching pair of quotes if present.
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]
        return value.strip() or None
    return None


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    ok = True
    for path in sys.argv[1:]:
        try:
            text = open(path, encoding="utf-8").read()
        except OSError as e:
            print(f"ERR   {path}  cannot read: {e}")
            ok = False
            continue
        desc = extract_description(text)
        if desc is None:
            print(f"ERR   {path}  no parseable frontmatter description")
            ok = False
            continue
        n = js_length(desc)
        if n > MAX:
            print(f"FAIL  {path}  {n}/{MAX}  OVER by {n - MAX}")
            ok = False
        else:
            print(f"PASS  {path}  {n}/{MAX}  ({MAX - n} headroom)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
