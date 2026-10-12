#!/usr/bin/env python3
"""The off-chain Lean checker: an agent that compiles every Lean note and attests the result.

Lean and Mathlib do not run inside a canister, so this runs wherever Lean is installed, reads the
notes through the notebook's agent API, compiles each ```lean block with `lake env lean`, and posts a
hash-bound `check` attestation (pass or fail, with the compiler output). An edit to a note makes
its attestation stale in the app until this runs again.

  usage: lean_check.py <notebook url> <agent key> [--project <lake project dir>] [--dry-run]

Make a key on Manage -> Agents. The notebook url is the canister's HTTP origin, e.g.
http://<canister>.localhost:55376 locally or https://<canister>.icp0.io on mainnet.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request

LEAN_BLOCK = re.compile(r"```lean\s*\n(.*?)```", re.S)


def api(base: str, key: str, route: str, body: dict) -> object:
    req = urllib.request.Request(f"{base}/v1/{route}", data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) < 2:
        print(__doc__)
        return 2
    base, key = args[0].rstrip("/"), args[1]
    project = sys.argv[sys.argv.index("--project") + 1] if "--project" in sys.argv else None
    dry = "--dry-run" in sys.argv
    lean = shutil.which("lean")
    if not lean and not dry:
        print("lean is not on PATH; install it (elan) or pass --dry-run to only list the notes")
        return 1
    notes = [n for n in api(base, key, "list", {}) if n["path"].endswith(".md")]
    checked = 0
    for n in notes:
        note = api(base, key, "read", {"path": n["path"]})
        blocks = LEAN_BLOCK.findall(note["content"])
        if not blocks:
            continue
        code = "\n\n".join(blocks)
        if dry:
            print(f"would check {n['path']} ({len(code)} chars of Lean)")
            continue
        with tempfile.TemporaryDirectory() as tmp:
            src = os.path.join(tmp, "Note.lean")
            with open(src, "w") as f:
                f.write(code)
            cmd = ["lake", "env", "lean", src] if project else ["lean", src]
            proc = subprocess.run(cmd, cwd=project or tmp, capture_output=True, text=True, timeout=600)
        ok = proc.returncode == 0 and "sorry" not in (proc.stdout + proc.stderr).lower()
        version = subprocess.run(["lean", "--version"], capture_output=True, text=True).stdout.strip()
        detail = f"{version}\n{'ok' if ok else (proc.stdout + proc.stderr)[-3500:]}"
        res = api(base, key, "attest", {"path": n["path"], "kind": "check", "verdict": "pass" if ok else "fail", "detail": detail})
        print(f"{'PASS' if ok else 'FAIL'} {n['path']} -> attestation {res['id']} (note {res['note_hash'][:8]})")
        checked += 1
    print(f"{checked} Lean note(s) checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
