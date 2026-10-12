#!/usr/bin/env python3
"""Regenerate frontend/src/queries.ts: the query method names of both canisters."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
names = set()
for f in ["canisters/registry/registry.did", "canisters/notebook/notebook.did"]:
    for m in re.finditer(r'^\s*([A-Za-z0-9_]+)\s*:\s*\([^)]*\)\s*->\s*\([^)]*\)\s*query;', (root / f).read_text(), re.M):
        names.add(m.group(1))
out = root / "frontend/src/queries.ts"
out.write_text('// Query methods of the registry and notebook canisters (from their .did files): fast, never shown as "working".\n// Regenerate: python3 scripts/queries.py\nexport const QUERY_METHODS = new Set<string>(%s);\n' % repr(sorted(names)).replace("'", '"'))
print(f"{len(names)} query methods")
