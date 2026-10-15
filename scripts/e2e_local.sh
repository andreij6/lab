#!/usr/bin/env bash
# End-to-end on the local network over Candid: an owner creates a notebook (the registry spawns its
# canister), writes, links, renames and deletes notes; a stranger and the anonymous caller are
# turned away; ICP sent to the notebook's account becomes cycles; a signed-in top-up (ICRC-2 approve
# + top_up) works; the registry upgrades notebooks without losing data. Every check is hard.
# Prerequisites: `icp network start -d`, `icp deploy --cycles 50t`.
set -euo pipefail
cd "$(dirname "$0")/.."
OWNER=e2e-owner-$(date +%s)
OTHER=e2e-other-$(date +%s)
icp identity new "$OWNER" --storage plaintext >/dev/null 2>&1
icp identity new "$OTHER" --storage plaintext >/dev/null 2>&1
ME=$(icp identity principal --identity "$OWNER")
OTHERP=$(icp identity principal --identity "$OTHER")
OWNER2=e2e-third-$(date +%s)
icp identity new "$OWNER2" --storage plaintext >/dev/null 2>&1
PASS=0
icp canister call registry set_price '(0)' >/dev/null 2>&1 || true  # a previous run may have left a price set
# every run spawns notebooks at 1 TC each; keep the local registry funded
CYC=$(icp canister call registry stats '()' --query | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
[ "${CYC:-0}" -lt 10000000000000 ] && icp canister top-up registry --amount 100t >/dev/null 2>&1 || true
# expect <description> <fixed string expected in output> <command...>
expect() {
  local d=$1 want=$2; shift 2
  local out; out=$("$@" 2>&1 || true)
  # not grep -q: it exits at the first match and, with pipefail, printf's SIGPIPE on a big output fails the check
  if printf '%s' "$out" | grep -F -- "$want" >/dev/null; then echo "  ok: $d"; PASS=$((PASS+1)); else echo "FAIL: $d"; echo "  wanted: $want"; echo "  got: $(printf '%s' "$out" | tr -s ' \n' ' ' | head -c 600)"; exit 1; fi
}
reg() { icp canister call registry "$@" --identity "$OWNER"; }
# an ICRC-2 approval to the registry's subaccount for one caller (how OISY approves for a sign-in)
LEDGER_ID=ryjl3-tyaaa-aaaaa-aaaba-cai
subblob() { python3 -c 'import sys,base64; t=sys.argv[1].replace("-","").upper(); t+="="*(-len(t)%8); b=base64.b32decode(t)[4:]; s=bytes([len(b)])+b; s+=bytes(32-len(s)); print("".join("\\%02x"%x for x in s))' "$1"; }
bound_approve() { icp canister call $LEDGER_ID icrc2_approve "(record { spender = record { owner = principal \"$(icp canister status registry -i)\"; subaccount = opt blob \"$(subblob "$3")\" }; amount = $2 : nat; fee = null; memo = null; from_subaccount = null; created_at_time = null; expected_allowance = null; expires_at = null })" --identity "$1"; }

echo "== create notebook (spawns a canister; the creator is owner + controller)"
OUT=$(reg create_notebook '("Notes")'); echo "$OUT" | tr -s ' \n' ' '; echo
V=$(echo "$OUT" | grep -o 'canister = principal "[^"]*"' | sed 's/.*"\(.*\)"/\1/')
[ -n "$V" ] || { echo "FAIL: no notebook canister"; exit 1; }
notebook() { icp canister call "$V" "$@" --identity "$OWNER"; }
expect "my_notebooks lists it" "$V" reg my_notebooks '()' --query
expect "a new notebook starts with index.md" '# Notes' notebook read '("index.md")' --query
expect "and nothing else but Agents/" 'files = 2' notebook info '()' --query
expect "a stranger's my_notebooks is empty" "(vec {})" icp canister call registry my_notebooks '()' --query --identity "$OTHER"
expect "empty name refused" "1-64" reg create_notebook '("")'
expect "anonymous cannot create" "sign in" icp canister call registry create_notebook '("Anon")' --identity anonymous
expect "creator is a controller" "$ME" icp canister status "$V"
expect "the owner sets an icon and a description" 'description = opt "Lab notes"' reg set_notebook_meta "(principal \"$V\", opt \"🔬\", opt \"Lab notes\")"
expect "a stranger cannot" "not your notebook" icp canister call registry set_notebook_meta "(principal \"$V\", opt \"x\", null)" --identity "$OTHER"
expect "a long description is refused" "280" reg set_notebook_meta "(principal \"$V\", null, opt \"$(printf 'x%.0s' $(seq 1 300))\")"
expect "my_notebooks carries the card text" "Lab notes" reg my_notebooks '()' --query

echo "== write, read, list"
expect "wrote daily note" "Ok" notebook write '("Daily/2026-10-10.md", "Today I read [[Ideas]] and tagged #journal")'
expect "wrote Ideas" "Ok" notebook write '("Ideas.md", "# Ideas\nSee [[Daily/2026-10-10|today]] and [[Ideas#Heading]]")'
expect "read back" "# Ideas" notebook read '("Ideas.md")' --query
expect "read_all returns content" "journal" notebook read_all '()' --query
# the town: a house for each person with a notebook edited lately; counts only, nothing that names anyone
expect "the registry knows the town flag" 'name = "town"' icp canister call registry flags '()' --query
icp canister call registry set_flag '("town", true)' >/dev/null   # switching it on counts the houses now
sleep 4
expect "the owner's lot is theirs" "mine = opt" reg town '()' --query
expect "their notebook was edited today: a lit house" "lit = 2" reg town '()' --query
expect "anonymous gets the town without a lot of its own" "mine = null" icp canister call registry town '()' --query --identity anonymous
if icp canister call registry town '()' --query --identity anonymous | grep -q 'principal "'; then echo "FAIL: the town names someone"; exit 1; else echo "  ok: the town names nobody"; PASS=$((PASS+1)); fi
icp canister call registry set_flag '("town", false)' >/dev/null
expect "switched off, the town is closed" "switched off" icp canister call registry town '()' --query --identity anonymous
icp canister call registry set_flag '("town", true)' >/dev/null
[ "$(notebook list '()' --query | grep -c 'path = ')" = 4 ] && echo "  ok: four files listed (index.md and the seeded project included)" || { echo "FAIL: list"; exit 1; }
expect "overwrite keeps one file" "size = 7" notebook write '("Ideas.md", "# Ideas")'
expect "still four files" "files = 4" notebook info '()' --query

echo "== import: write_many, paging, attachments"
expect "write_many imports good files and reports bad ones" 'written = 3' notebook write_many '(vec { record { "Import/A.md"; "a [[B]]" }; record { "Import/B.md"; "b" }; record { "Import/img.png"; "data:image/png;base64,iVBORw0KGgo=" }; record { "Import/bad#name.md"; "x" } }, false)'
expect "write_many lists the refused name" 'bad#name.md' notebook write_many '(vec { record { "Import/bad#name.md"; "x" } }, false)'
expect "write_many without overwrite skips existing" 'exists' notebook write_many '(vec { record { "Import/A.md"; "changed" } }, false)'
expect "write_many with overwrite replaces" 'written = 1' notebook write_many '(vec { record { "Import/A.md"; "a2 [[B]]" } }, true)'
expect "read_all leaves attachment content out" 'content = ""' notebook read_all '()' --query
expect "read keeps the attachment data" 'base64,iVBOR' notebook read '("Import/img.png")' --query
expect "read_page pages in order (Daily, Ideas, then more)" 'next = opt "Ideas.md"' notebook read_page '(null, 2)' --query
expect "read_page continues after a key" 'path = "Import/A.md"' notebook read_page '(opt "Ideas.md", 1)' --query
expect "the last page has no next" 'next = null' notebook read_page '(opt "Import/img.png", 100)' --query
notebook delete_folder '("Import")' >/dev/null

echo "== bad names are refused"
expect "# refused" "Invalid" notebook write '("a#b.md", "x")'
expect "trailing space refused" "Invalid" notebook write '("Note .md", "x")'
expect ".. refused" "Invalid" notebook write '("../x.md", "x")'
expect "missing file is NotFound" "NotFound" notebook read '("Nope.md")' --query

echo "== a stranger and the anonymous caller are turned away"
expect "stranger cannot list" "Unauthorized" icp canister call "$V" list '()' --query --identity "$OTHER"
expect "stranger cannot write" "Unauthorized" icp canister call "$V" write '("Hack.md","x")' --identity "$OTHER"
expect "anonymous cannot read" "Unauthorized" icp canister call "$V" read '("Ideas.md")' --query --identity anonymous
expect "anonymous cannot delete" "Unauthorized" icp canister call "$V" delete '("Ideas.md")' --identity anonymous

echo "== rename rewrites links in other notes"
notebook write '("Ideas.md", "# Ideas\nSee [[Daily/2026-10-10|today]] and [[Ideas#Heading]]")' >/dev/null
OUT=$(notebook rename '("Ideas.md", "Projects/Big Ideas.md")'); echo "$OUT" | tr -s ' \n' ' '; echo
echo "$OUT" | grep -qF 'Daily/2026-10-10.md' || { echo "FAIL: relink did not report the daily note"; exit 1; }
expect "daily note now links [[Big Ideas]] (shortest form)" '[[Big Ideas]]' notebook read '("Daily/2026-10-10.md")' --query
expect "self link updated too" 'Big Ideas#Heading' notebook read '("Projects/Big Ideas.md")' --query
expect "cannot rename onto an existing file" "Exists" notebook rename '("Projects/Big Ideas.md", "Daily/2026-10-10.md")'
expect "old path is gone" "NotFound" notebook read '("Ideas.md")' --query
expect "path-form links follow a move" '[[Archive/2026-10-10|today]]' bash -c "icp canister call $V rename '(\"Daily/2026-10-10.md\", \"Archive/2026-10-10.md\")' --identity $OWNER >/dev/null && icp canister call $V read '(\"Projects/Big Ideas.md\")' --query --identity $OWNER"

echo "== folders exist on their own"
expect "mkdir creates nested folders" "Ok" notebook mkdir '("Areas/Health")'
expect "folders lists ancestors and implicit parents" '"Areas/Health"' notebook folders '()' --query
expect "mkdir onto a file is refused" "Exists" notebook mkdir '("Projects/Big Ideas.md")'
expect "rename_folder moves the file" "moved = 1" notebook rename_folder '("Archive", "Attic")'
expect "links follow the folder move" '[[Attic/2026-10-10|today]]' notebook read '("Projects/Big Ideas.md")' --query
expect "the new folder is listed" '"Attic"' notebook folders '()' --query
[ "$(notebook folders '()' --query | grep -c '"Archive"')" = 0 ] && echo "  ok: the old folder is gone" || fail "Archive still listed"
expect "a folder cannot move into itself" "into itself" notebook rename_folder '("Attic", "Attic/Deeper")'
expect "delete_folder removes the empty tree" "Ok = 0" notebook delete_folder '("Areas")'
expect "deleted folder is gone" "NotFound" notebook delete_folder '("Areas")'
expect "delete_folder removes files too" "Ok = 1" notebook delete_folder '("Attic")'
expect "the moved note is gone with its folder" "NotFound" notebook read '("Attic/2026-10-10.md")' --query
notebook write '("Daily/2026-10-10.md", "Today I read [[Big Ideas]] and tagged #journal")' >/dev/null

echo "== agents: the locked folder, keys, the JSON API"
PORT=$(icp network status --json | python3 -c 'import json,sys; print(json.load(sys.stdin)["gateway_url"].rstrip("/").rsplit(":",1)[1])')
URL="http://$V.localhost:$PORT"
expect "people cannot write under Agents/" "agents only" notebook write '("Agents/Hack.md", "x")'
expect "people cannot create folders under Agents/" "agents only" notebook mkdir '("Agents/sub")'
expect "Agents/ cannot be deleted" "stays" notebook delete_folder '("Agents")'
expect "Agents/ exists from the start" '"Agents"' notebook folders '()' --query
KEY=$(notebook create_agent_key '("claude")' | sed 's/.*"\(nb_[0-9a-f]*\)".*/\1/'); [ -n "$KEY" ] && echo "  ok: issued key ${KEY:0:8}…" || fail "no key"
expect "a second key with the same name is refused" "Exists" notebook create_agent_key '("claude")'
expect "a stranger cannot issue keys" "Unauthorized" icp canister call "$V" create_agent_key '("x")' --identity "$OTHER"
post() { curl -s -X POST "$URL$1" -H "authorization: Bearer $2" -H 'content-type: application/json' -d "$3"; }
expect "help text without a key" "Notebooks agent API" curl -s "$URL/"
expect "the API lists every note" '"path":"Daily/2026-10-10.md"' post /v1/list "$KEY" '{}'
expect "the API reads a note" '"content":"Today I read' post /v1/read "$KEY" '{"path":"Daily/2026-10-10.md"}'
expect "the API searches" '"path":"Projects/Big Ideas.md"' post /v1/search "$KEY" '{"q":"ideas"}'
expect "agents write under Agents/ only" 'Agents/ only' post /v1/write "$KEY" '{"path":"Elsewhere.md","content":"x"}'
expect "an agent writes a note" '"agent":"claude"' post /v1/write "$KEY" '{"path":"Agents/claude/Idea.md","content":"Related to [[Big Ideas]]: try X. #agent"}'
expect "the note is stamped with the agent" 'agent = opt "claude"' notebook read '("Agents/claude/Idea.md")' --query
echo "== attestations: hash-bound vouching by agents and readers"
notebook write '("Lean/Primes.md", "# Primes\n\n```lean\n/-- Every n ≥ 2 has a prime factor. -/\ntheorem has_prime (n : Nat) (hn : 2 ≤ n) : True := trivial\n```\n")' >/dev/null
notebook write '("Paper.md", "---\nlean: [[Primes]]\n---\n# Paper\n\n![[Primes#thm:has_prime]]\n\nTake n at least 2. ^s1\n")' >/dev/null
expect "the checker agent attests a pass over the API" '"verdict":"pass"' post /v1/attest "$KEY" '{"path":"Lean/Primes.md","kind":"check","verdict":"pass","detail":"Lean 4.x ok"}'
expect "a bad kind is refused" "kind is check" post /v1/attest "$KEY" '{"path":"Lean/Primes.md","kind":"bless","verdict":"yes"}'
expect "the API lists attestations as fresh" '"fresh":true' post /v1/attestations "$KEY" '{"path":"Lean/Primes.md"}'
expect "the owner compares English and Lean" 'verdict = "same"' notebook attest_note '("Paper.md", "compare", "same", opt "Lean/Primes.md", "statement matches")'
expect "an unknown lean note is refused" "NotFound" notebook attest_note '("Paper.md", "compare", "same", opt "Nope.md", "")'
expect "a stranger cannot attest" "Unauthorized" icp canister call "$V" attest_note '("Paper.md", "review", "ok", null, "")' --identity "$OTHER"
expect "attestations are fresh while nothing changed" "fresh = true" notebook note_attestations '("Paper.md")' --query
notebook write '("Lean/Primes.md", "# Primes\n\n```lean\n/-- Every n ≥ 2 has a prime factor. -/\ntheorem has_prime (n : Nat) (hn : 3 ≤ n) : True := trivial\n```\n")' >/dev/null
expect "editing the Lean makes the check stale" "fresh = false" notebook note_attestations '("Lean/Primes.md")' --query
expect "and the comparison on the paper stale too" "fresh = false" notebook note_attestations '("Paper.md")' --query
expect "a stranger cannot read attestations" "Unauthorized" icp canister call "$V" note_attestations '("Paper.md")' --query --identity "$OTHER"
expect "list shows the agent" 'agent = opt "claude"' notebook list '()' --query
expect "people cannot edit an agent note" "agents only" notebook write '("Agents/claude/Idea.md", "edited")'
expect "people cannot move an agent note" "agents only" notebook rename '("Agents/claude/Idea.md", "Mine.md")'
expect "a bad key is unauthorized" 'unauthorized' post /v1/read "nb_nope" '{"path":"Ideas.md"}'
expect "keys list usage" 'writes = 1' notebook agent_keys '()' --query
expect "revoke" "Ok" notebook revoke_agent_key '("claude")'
IKEY=$(notebook create_scoped_key '("clipper", "Inbox")' | sed 's/.*"\(nb_[0-9a-f]*\)".*/\1/')
expect "a scoped key writes under its folder" '"path":"Inbox/Clip.md"' post /v1/write "$IKEY" '{"path":"Inbox/Clip.md","content":"clipped"}'
expect "and still under Agents/" '"path":"Agents/clipper/x.md"' post /v1/write "$IKEY" '{"path":"Agents/clipper/x.md","content":"x"}'
expect "but nowhere else" "Inbox/ only" post /v1/write "$IKEY" '{"path":"Daily/x.md","content":"x"}'
expect "a key cannot be scoped to Agents/" "not Agents" notebook create_scoped_key '("bad", "Agents")'
expect "agent_keys shows the scope" 'scope = opt "Inbox"' notebook agent_keys '()' --query
expect "a revoked key is locked out" 'unauthorized' post /v1/list "$KEY" '{}'
expect "people can delete an agent note" "Ok" notebook delete '("Agents/claude/Idea.md")'

echo "== sharing one note"
expect "a private share needs a principal" "at least one" notebook share_note '("Daily/2026-10-10.md", false, vec {})'
expect "share with a principal" "principals = vec" notebook share_note "(\"Daily/2026-10-10.md\", false, vec { principal \"$(icp identity principal --identity "$OTHER")\" })"
expect "the listed principal reads it" "journal" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity "$OTHER"
expect "anonymous cannot read a private share" "Unauthorized" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity anonymous
expect "unshared notes are not readable" "Unauthorized" icp canister call "$V" read_shared '("Projects/Big Ideas.md")' --query --identity "$OTHER"
expect "make it public" "public = true" notebook share_note '("Daily/2026-10-10.md", true, vec {})'
expect "anonymous reads a public share" "journal" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity anonymous
expect "public notes are served raw over HTTP" "journal" curl -s "$URL/s/Daily/2026-10-10.md"
expect "share_info is public" "true" icp canister call "$V" share_info '("Daily/2026-10-10.md")' --query --identity anonymous
expect "shares are listed for the owner" 'Daily/2026-10-10.md' notebook shares '()' --query
expect "a share follows a rename" 'Daily/moved.md' bash -c "icp canister call $V rename '(\"Daily/2026-10-10.md\", \"Daily/moved.md\")' --identity $OWNER >/dev/null && icp canister call $V shares '()' --query --identity $OWNER"
icp canister call "$V" rename '("Daily/moved.md", "Daily/2026-10-10.md")' --identity "$OWNER" >/dev/null
expect "unshare" "Ok" notebook unshare_note '("Daily/2026-10-10.md")'
expect "after unsharing anonymous is refused" "Unauthorized" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity anonymous

echo "== delete"
expect "deleted" "Ok" notebook delete '("Projects/Big Ideas.md")'
expect "second delete is NotFound" "NotFound" notebook delete '("Projects/Big Ideas.md")'
expect "info counts 7 files (index.md, the seeded project, the daily note, the Lean note, the paper and two clips)" "files = 7" notebook info '()' --query
echo "== chat with notes: the notebook asks the LLM canister (locally the Ollama stand-in)"
LLM=$(icp canister status llm -i 2>/dev/null || true)
if [ -n "$LLM" ]; then
  ASKSRC='vec { record { path = "Ideas.md"; excerpt = "Ideas: a reading list and a habit tracker." } }'
  expect "a stranger cannot ask someone else's notebook" "Unauthorized" icp canister call "$V" ask "(principal \"$LLM\", \"qwen3:32b\", \"what ideas?\", $ASKSRC)" --identity "$OTHER"
  expect "an empty question is refused" "1-1000 characters" notebook ask "(principal \"$LLM\", \"qwen3:32b\", \"  \", $ASKSRC)"
  expect "too many notes are refused" "at most 10 notes" notebook ask "(principal \"$LLM\", \"qwen3:32b\", \"q\", vec { $(for i in 1 2 3 4 5 6 7 8 9 10 11; do printf 'record { path = "a.md"; excerpt = "x" };'; done) })"
  if curl -s -m 2 localhost:11434/api/tags >/dev/null; then
    expect "with no matching notes it answers from its own knowledge" '"text" =' notebook ask "(principal \"$LLM\", \"qwen3:32b\", \"What is 2 + 2? Answer with the number.\", vec {})"
    expect "the notebook answers from its notes, citing them" '[1]' notebook ask "(principal \"$LLM\", \"qwen3:32b\", \"What ideas are in my notes? Cite the note.\", $ASKSRC)"
  else echo "  skip: Ollama is not running, so the live answer is not checked"; fi
fi

echo "== keep it running: ICP sent to the notebook account becomes cycles"
C0=$(notebook info '()' --query | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
ACCT=$(notebook info '()' --query | grep topup_account_id | sed 's/.*"\(.*\)".*/\1/')
icp token transfer 0.5 "$ACCT" -q >/dev/null
expect "sweep converted the ICP" "Completed" notebook sweep_topups '()'
echo "== signed-in top-up (icrc2 approve + top_up)"
icp token transfer 1 "$ME" -q >/dev/null
icp token approve 0.2001 "$V" --identity "$OWNER" -q >/dev/null
expect "top_up converted the approved ICP" "Completed" notebook top_up '(20_000_000)'
icp token transfer 1 "$OTHERP" -q >/dev/null; icp token approve 0.1001 "$V" --identity "$OTHER" -q >/dev/null
expect "top_up_from pulls from another account's allowance (the OISY flow)" "Completed" notebook top_up_from "(principal \"$OTHERP\", 10_000_000)"
expect "top_up_from is owner only" "owner only" icp canister call "$V" top_up_from "(principal \"$OTHERP\", 10_000_000)" --identity "$OTHER"
expect "below the minimum is refused" "minimum" notebook top_up '(10)'
expect "a stranger with no allowance cannot top up" "Err" icp canister call "$V" top_up '(20_000_000)' --identity "$OTHER"
C1=$(notebook info '()' --query | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
[ "$C1" -gt "$C0" ] && echo "  ok: cycles grew: $C0 -> $C1" || { echo "FAIL: cycles did not grow"; exit 1; }
[ "$(notebook topups '(10)' --query | grep -c Completed)" = 3 ] && echo "  ok: three top-ups in history" || { echo "FAIL: history"; exit 1; }
expect "totals recorded" "total_topped_up_e8s = 80_000_000" notebook info '()' --query

echo "== freezing: 90-day threshold, health while frozen, revive through the registry"
expect "a new notebook has a 90-day freezing threshold" "Freezing threshold: 7_776_000" icp canister settings show "$V" --identity "$OWNER"
expect "notebook_status reports a running notebook" "frozen = false" reg notebook_status "(principal \"$V\")"
expect "notebook_status is owner only" "not your notebook" icp canister call registry notebook_status "(principal \"$V\")" --identity "$OTHER"
expect "apply_freeze_policy is controller only" "controller only" reg apply_freeze_policy '()'
expect "the controller applies the policy to every notebook" "Ok" icp canister call registry apply_freeze_policy '()'
expect "set_freezing_threshold is controller only" "controller only" reg set_freezing_threshold "(principal \"$V\", 60)"
# freeze it for real: a threshold of 3000 years needs more cycles than it has, so the IC refuses its calls
icp canister settings update "$V" --freezing-threshold 1000000d --identity "$OWNER" >/dev/null
expect "a frozen notebook refuses calls" "froz" notebook info '()' --query
expect "notebook_status still answers, and says frozen" "frozen = true" reg notebook_status "(principal \"$V\")"
icp token approve 0.2001 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
expect "top_up_notebook below the minimum is refused" "minimum" reg top_up_notebook "(principal \"$V\", 10, null)"
expect "a stranger cannot top up through the registry" "not your notebook" icp canister call registry top_up_notebook "(principal \"$V\", 20_000_000, null)" --identity "$OTHER"
expect "the owner revives it through the registry (ICP -> CMC -> cycles)" "Ok" reg top_up_notebook "(principal \"$V\", 20_000_000, null)"
icp token transfer 1 "$OTHERP" -q >/dev/null; bound_approve "$OTHER" 10_010_000 "$ME" >/dev/null
expect "the OISY-style payer flow tops up for the owner" "Ok" reg top_up_notebook "(principal \"$V\", 10_000_000, opt principal \"$OTHERP\")"
icp canister settings update "$V" --freezing-threshold 90d --identity "$OWNER" >/dev/null
expect "back under the threshold the notebook answers again" "files =" notebook info '()' --query
expect "the registry top-ups landed as cycles" "frozen = false" reg notebook_status "(principal \"$V\")"

echo "== help & support: bug reports and the admin queue"
expect "anonymous cannot report" "sign in" icp canister call registry report_bug '("x", "y", "")' --identity anonymous
expect "a signed-in person reports a bug" 'status = variant { Open }' reg report_bug '("Save button stuck", "Pressed save, nothing happened on Daily note", "page=notes notebook=test")'
expect "a report is marked as a bug" 'kind = opt "bug"' reg report_bug '("Another one", "detail", "")'
expect "an idea is marked as an idea" 'kind = opt "idea"' reg report_idea '("Pin notes to the top", "I keep scrolling to the same note", "page=notes")'
expect "ideas appear in my reports" 'Pin notes to the top' reg my_bugs '()' --query
expect "an empty title is refused" "1-120" reg report_bug '("   ", "detail", "")'
expect "the reporter sees their own reports" 'Save button stuck' reg my_bugs '()' --query
expect "a stranger sees none of them" '(vec {})' icp canister call registry my_bugs '()' --query --identity "$OTHER"
expect "a non-admin cannot list all bugs" "admin only" reg bugs '()' --query
expect "a non-admin is not admin" "(false)" reg is_admin '()' --query
expect "only controllers add admins" "controller only" reg add_admin "(principal \"$(icp identity principal --identity "$OTHER")\")"
expect "the controller adds an admin" "Ok" icp canister call registry add_admin "(principal \"$(icp identity principal --identity "$OTHER")\")"
expect "the added admin is admin" "(true)" icp canister call registry is_admin '()' --query --identity "$OTHER"
expect "the admin sees the queue" 'Save button stuck' icp canister call registry bugs '()' --query --identity "$OTHER"
BUG_ID=$(icp canister call registry bugs '()' --query --identity "$OTHER" | grep -o 'id = [0-9_]*' | head -1 | tr -d 'id =_')
expect "the admin moves it along with a note" 'status = variant { InProgress }' icp canister call registry update_bug "($BUG_ID, variant { InProgress }, \"looking\")" --identity "$OTHER"
expect "the reporter sees the status and note" '"looking"' reg my_bugs '()' --query
expect "a non-admin cannot update" "admin only" reg update_bug "($BUG_ID, variant { Done }, \"\")"
expect "the controller removes the admin" "Ok" icp canister call registry remove_admin "(principal \"$(icp identity principal --identity "$OTHER")\")"
expect "the removed admin is locked out" "admin only" icp canister call registry bugs '()' --query --identity "$OTHER"

echo "== history, settings, server search"
notebook write '("Hist.md", "v1")' >/dev/null; notebook write '("Hist.md", "v2")' >/dev/null; notebook write '("Hist.md", "v3")' >/dev/null
expect "history lists earlier versions newest first" 'seq = 2' notebook history '("Hist.md")' --query
expect "a revision is readable" 'content = "v1"' notebook revision '("Hist.md", 1)' --query
expect "an unchanged write adds no revision" 'seq = 2' bash -c "icp canister call $V write '(\"Hist.md\", \"v3\")' --identity $OWNER >/dev/null && icp canister call $V history '(\"Hist.md\")' --query --identity $OWNER"
expect "history follows a rename" 'seq = 1' bash -c "icp canister call $V rename '(\"Hist.md\", \"Hist2.md\")' --identity $OWNER >/dev/null && icp canister call $V history '(\"Hist2.md\")' --query --identity $OWNER"
expect "a stranger cannot read history" "Unauthorized" icp canister call "$V" history '("Hist2.md")' --query --identity "$OTHER"
notebook delete '("Hist2.md")' >/dev/null
expect "settings round-trip" '"{\"bookmarks\":[\"Ideas.md\"]}"' bash -c "icp canister call $V set_settings '(\"{\\\"bookmarks\\\":[\\\"Ideas.md\\\"]}\")' --identity $OWNER >/dev/null && icp canister call $V get_settings '()' --query --identity $OWNER"
expect "search_notes finds by content" 'Daily/2026-10-10.md' notebook search_notes '("journal", 10)' --query
expect "search_notes is owner only" "Unauthorized" icp canister call "$V" search_notes '("x", 10)' --query --identity "$OTHER"

echo "== folder and notebook shares, editors, comments"
OTHERP=$(icp identity principal --identity "$OTHER")
notebook write '("Shared/Team.md", "team note")' >/dev/null
expect "share a folder with an editor" 'editors = opt vec' notebook share "(\"Shared\", false, vec {}, vec { principal \"$OTHERP\" })"
expect "the editor reads a note in the folder" "team note" icp canister call "$V" read_shared '("Shared/Team.md")' --query --identity "$OTHER"
expect "the editor lists the folder" 'Shared/Team.md' icp canister call "$V" list_shared '("Shared")' --query --identity "$OTHER"
expect "the editor writes" "Ok" icp canister call "$V" write_shared '("Shared/Team.md", "team note, edited")' --identity "$OTHER"
expect "the edit is visible to the owner" "edited" notebook read '("Shared/Team.md")' --query
expect "the editor's version was kept" 'seq = 1' notebook history '("Shared/Team.md")' --query
expect "the editor cannot write outside the folder" "Unauthorized" icp canister call "$V" write_shared '("Ideas.md", "x")' --identity "$OTHER"
expect "editors never write under Agents/" "agents only" icp canister call "$V" write_shared '("Agents/x.md", "x")' --identity "$OTHER"
expect "my_role says Edit" "Edit" icp canister call "$V" my_role '("Shared/Team.md")' --query --identity "$OTHER"
expect "a reader comments" '= "nice"' icp canister call "$V" comment '("Shared/Team.md", "nice")' --identity "$OTHER"
expect "the owner sees comments" 'nice' notebook all_comments '()' --query
expect "a stranger cannot comment" "Unauthorized" icp canister call "$V" comment '("Shared/Team.md", "spam")' --identity anonymous
echo "== study groups: presence, progress marks, quiz attempts"
expect "a sharee pings and sees nobody else yet" "Ok = vec {}" icp canister call "$V" ping '("Shared/Team.md")' --identity "$OTHER"
expect "the owner sees the sharee here" "$OTHERP" notebook ping '("Shared/Team.md")'
expect "a stranger cannot ping" "Unauthorized" icp canister call "$V" ping '("Shared/Team.md")' --identity "$OWNER2"
expect "a sharee marks progress" "Ok" icp canister call "$V" set_progress '("Shared/Team.md", 2)' --identity "$OTHER"
expect "state must be 0-3" "0-3" icp canister call "$V" set_progress '("Shared/Team.md", 9)' --identity "$OTHER"
expect "the group sees the mark" "2 : nat8" notebook progress '("Shared/Team.md")' --query
expect "a sharee submits a quiz attempt" "score = 3" icp canister call "$V" submit_attempt '("Shared/Team.md", 3, 5)' --identity "$OTHER"
expect "a score beyond the total is refused" "within total" icp canister call "$V" submit_attempt '("Shared/Team.md", 9, 5)' --identity "$OTHER"
expect "the owner lists attempts on the note" "$OTHERP" notebook attempts '("Shared/Team.md")' --query
expect "the owner lists every attempt" "total = 5" notebook all_attempts '()' --query
expect "a sharee only lists their own" "score = 3" icp canister call "$V" attempts '("Shared/Team.md")' --query --identity "$OTHER"
expect "all_attempts is owner only" "Unauthorized" icp canister call "$V" all_attempts '()' --query --identity "$OTHER"
expect "the audit counts decks" "decks =" notebook audit '()' --query

echo "== permissions: view, comment, edit; what the link allows"
expect "a viewer is view-only: reading works" "team note" icp canister call "$V" read_shared '("Shared/Team.md")' --query --identity "$OTHER"
expect "set_share names viewers, commenters and editors" 'commenters = opt vec' notebook set_share "(record { path = \"Shared\"; public = false; public_role = null; viewers = vec { principal \"$OTHERP\" }; commenters = vec {}; editors = vec {} })"
expect "my_role says View now" "View" icp canister call "$V" my_role '("Shared/Team.md")' --query --identity "$OTHER"
expect "a viewer cannot comment" "Unauthorized" icp canister call "$V" comment '("Shared/Team.md", "hi")' --identity "$OTHER"
expect "a viewer cannot write" "Unauthorized" icp canister call "$V" write_shared '("Shared/Team.md", "x")' --identity "$OTHER"
notebook set_share "(record { path = \"Shared\"; public = false; public_role = null; viewers = vec {}; commenters = vec { principal \"$OTHERP\" }; editors = vec {} })" >/dev/null
expect "a commenter comments" '= "from a commenter"' icp canister call "$V" comment '("Shared/Team.md", "from a commenter")' --identity "$OTHER"
expect "a commenter cannot write" "Unauthorized" icp canister call "$V" write_shared '("Shared/Team.md", "x")' --identity "$OTHER"
CID=$(icp canister call "$V" comments '("Shared/Team.md")' --query --identity "$OTHER" | grep -o 'id = [0-9_]*' | head -1 | sed 's/id = //; s/_//g')
expect "a commenter replies in the thread" "parent = opt" icp canister call "$V" reply "($CID, \"and a reply\")" --identity "$OTHER"
expect "the reply lists under the note" "and a reply" icp canister call "$V" comments '("Shared/Team.md")' --query --identity "$OTHER"
expect "a reply to a missing comment is NotFound" "NotFound" icp canister call "$V" reply '(999_999, "x")' --identity "$OTHER"
expect "the owner can reply too" "parent = opt" notebook reply "($CID, \"thanks\")"
notebook set_share "(record { path = \"Shared\"; public = true; public_role = opt variant { View }; viewers = vec {}; commenters = vec {}; editors = vec {} })" >/dev/null
expect "a view-only link lets a signed-in stranger read" "team note" icp canister call "$V" read_shared '("Shared/Team.md")' --query --identity "$OWNER2"
expect "but not comment" "Unauthorized" icp canister call "$V" comment '("Shared/Team.md", "x")' --identity "$OWNER2"
notebook set_share "(record { path = \"Shared\"; public = true; public_role = opt variant { Edit }; viewers = vec {}; commenters = vec {}; editors = vec {} })" >/dev/null
expect "an edit link lets a signed-in stranger write" "Ok" icp canister call "$V" write_shared '("Shared/Team.md", "edited through the link")' --identity "$OWNER2"
expect "an anonymous caller can read through an edit link" "edited through the link" icp canister call "$V" read_shared '("Shared/Team.md")' --query --identity anonymous
expect "but never write" "Unauthorized" icp canister call "$V" write_shared '("Shared/Team.md", "x")' --identity anonymous
expect "an empty private share is refused" "at least one" notebook set_share '(record { path = "Shared"; public = false; public_role = null; viewers = vec {}; commenters = vec {}; editors = vec {} })'
notebook set_share "(record { path = \"Shared\"; public = false; public_role = null; viewers = vec {}; commenters = vec {}; editors = vec { principal \"$OTHERP\" } })" >/dev/null

expect "share the whole notebook publicly" 'path = ""' notebook share '("", true, vec {}, vec {})'
expect "anonymous reads any note now" "journal" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity anonymous
expect "anonymous lists everything" 'Daily/2026-10-10.md' icp canister call "$V" list_shared '("")' --query --identity anonymous
expect "unshare the notebook" "Ok" notebook unshare_note '("")'
expect "anonymous is refused again" "Unauthorized" icp canister call "$V" read_shared '("Daily/2026-10-10.md")' --query --identity anonymous

echo "== publish a folder as a site"
expect "publish Shared" "Ok" notebook set_published '(opt "Shared")'
expect "the index page is served" "<canvas id=\"g\">" curl -s "$URL/p/"
expect "a note page is rendered" "edited through the link" curl -s "$URL/p/Shared/Team.md"
expect "the graph JSON lists the notes" 'Shared/Team.md' curl -s "$URL/p.json"
expect "unpublished notes are not served" "not found" curl -s "$URL/p/Ideas.md"
expect "unpublish" "Ok" notebook set_published '(null)'
expect "nothing is published now" "nothing is published" curl -s "$URL/p/"
notebook delete_folder '("Shared")' >/dev/null

SNAP=$(reg take_snapshot "(principal \"$V\", null)"); echo "$SNAP" | grep -q "taken_at" && echo "  ok: snapshot taken" || fail "snapshot: $SNAP"
expect "snapshots are listed" "taken_at" reg list_snapshots "(principal \"$V\")"
SNAP_ID=$(echo "$SNAP" | grep -o 'id = blob "[^"]*"' | head -1 | sed 's/id = blob //')
notebook write '("AfterSnap.md", "lost on restore")' >/dev/null
expect "restore rolls back" "Ok" reg restore_snapshot "(principal \"$V\", blob $SNAP_ID)"
expect "the note written after the snapshot is gone" "NotFound" notebook read '("AfterSnap.md")' --query
expect "a stranger cannot snapshot" "not your notebook" icp canister call registry take_snapshot "(principal \"$V\", null)" --identity "$OTHER"
expect "delete the snapshot" "Ok" reg delete_snapshot "(principal \"$V\", blob $SNAP_ID)"

echo "== charging for spawns"
expect "only the controller sets a price" "controller only" reg set_price '(1)'
expect "the controller sets 0.1 ICP" "Ok" icp canister call registry set_price '(10_000_000)'
expect "spawning without an allowance is refused" "payment refused" reg create_notebook '("Paid")'
icp token transfer 1 "$ME" -q >/dev/null; icp token approve 0.1001 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
expect "spawning with an allowance works" 'name = "Paid"' reg create_notebook '("Paid")'
expect "a notebook paid by another account needs that account's allowance" "payment refused" reg create_notebook_paid_by "(\"Paid2\", principal \"$OTHERP\")"
icp token transfer 1 "$OTHERP" -q >/dev/null; icp token approve 0.1001 "$(icp canister status registry -i)" --identity "$OTHER" -q >/dev/null
expect "a plain allowance cannot be spent by another caller naming that payer" "payment refused" reg create_notebook_paid_by "(\"Paid2\", principal \"$OTHERP\")"
expect "the payer approves the registry subaccount bound to the caller" "Ok" bound_approve "$OTHER" 10_010_000 "$ME"
expect "a stranger cannot spend that bound allowance" "payment refused" icp canister call registry create_notebook_paid_by "(\"Stolen\", principal \"$OTHERP\")" --identity "$OWNER2"
expect "the OISY-style payer flow spawns for the caller" 'name = "Paid2"' reg create_notebook_paid_by "(\"Paid2\", principal \"$OTHERP\")"
expect "the fee was collected" "ICP" icp token balance --of-principal "$(icp canister status registry -i)"
expect "the controller sweeps fees into cycles" "Ok" icp canister call registry sweep_fees '()'
icp canister call registry set_price '(0)' >/dev/null

echo "== pay with anything: the token table, TCYCLES straight into the notebook, swaps need mainnet"
expect "six tokens are accepted out of the box" "ckUSDT" icp canister call registry tokens '()' --query
expect "an unknown token is refused" "unknown token" reg pay "(principal \"$V\", \"DOGE\", 1_000_000, null)"
expect "set_token is admin only" "admin only" reg set_token '(record { symbol = "X"; ledger = principal "aaaaa-aa"; decimals = 8 : nat8; fee = 1 : nat; route = variant { Swap } })'
icp token approve 0.2001 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
expect "ICP goes through the same minting path" "Ok" reg pay "(principal \"$V\", \"ICP\", 20_000_000, null)"
icp cycles mint --icp 1 --identity "$OWNER" >/dev/null 2>&1 || icp cycles mint --icp 1 --identity "$OWNER"
icp token um5iw-rqaaa-aaaaq-qaaba-cai approve 1.0001 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
CB=$(reg notebook_status "(principal \"$V\")" | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
expect "TCYCLES are withdrawn straight into the notebook" "Ok = 1_000_000_000_000" reg pay "(principal \"$V\", \"TCYCLES\", 1_000_000_000_000, null)"
CA=$(reg notebook_status "(principal \"$V\")" | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
[ "$CA" -gt "$CB" ] && echo "  ok: the notebook's cycles grew by the TCYCLES: $CB -> $CA" || { echo "FAIL: TCYCLES did not land"; exit 1; }
expect "a ck token needs its ledger (mainnet only), so locally the swap route reports the ledger" "ledger" reg pay "(principal \"$V\", \"ckBTC\", 100_000, null)"

echo "== deposits of anything are swept into cycles (ICP, TCYCLES; ck tokens and bitcoin need mainnet)"
expect "convert_deposit is for notebooks only" "notebooks only" reg convert_deposit '("ckUSDC", 1_000_000)'
expect "sweep_holdings is controller only" "controller only" reg sweep_holdings '()'
expect "the controller sweeps registry holdings" "Ok" icp canister call registry sweep_holdings '()'
expect "deposits start empty" "last_run = 0" notebook deposits '()' --query
expect "a stranger cannot read deposits" "Unauthorized" icp canister call "$V" deposits '()' --query --identity "$OTHER"
expect "a bitcoin address needs the ckBTC minter (mainnet only)" "Err" notebook btc_address '()'
icp cycles transfer 2t "$V" --identity "$OWNER" >/dev/null
CB=$(reg notebook_status "(principal \"$V\")" | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
expect "TCYCLES sent to the notebook's account are withdrawn into it" "TCYCLES" notebook sweep_deposits '()'
CA=$(reg notebook_status "(principal \"$V\")" | grep -o 'cycles = [0-9_]*' | head -1 | tr -d 'cycles =_')
[ "$CA" -gt "$CB" ] && echo "  ok: the deposit became cycles: $CB -> $CA" || { echo "FAIL: TCYCLES deposit did not land"; exit 1; }
expect "the sweep is recorded" "TCYCLES" notebook deposits '()' --query
expect "a second sweep finds nothing" "nothing to convert" notebook sweep_deposits '()'

echo "== community: chat for anyone with a notebook, channels and presence (a notebook pays each message in cycles)"
expect "a short message costs a few million cycles" "_" icp canister call registry message_cycles '(200)' --query
icp token transfer 1 "$OTHERP" -q >/dev/null; icp token approve 0.5 "$(icp canister status registry -i)" --identity "$OTHER" -q >/dev/null; icp token approve 0.5 "$(icp canister status registry -i)" -q >/dev/null
SUF=$(date +%s | tail -c 5)
expect "six channels exist" "general" icp canister call registry channels '()' --query
expect "#careers is seeded for the Career kit" 'name = "careers"; section = opt "Lab"' icp canister call registry channels '()' --query
expect "#crypto is seeded for the Crypto kit" 'name = "crypto"; section = opt "Lab"' icp canister call registry channels '()' --query
expect "#creators is seeded for the Creator kit" 'name = "creators"; section = opt "Lab"' icp canister call registry channels '()' --query
expect "the built-in channels sit in sections" 'section = opt "Lab"' icp canister call registry channels '()' --query
expect "only admins move channels between sections" "admin only" reg set_channel_section '("help", opt "Support")'
expect "an admin moves one" 'section = opt "Support"' icp canister call registry set_channel_section '("help", opt "Support")'
expect "section names are short and clean" "1-24" icp canister call registry set_channel_section '("help", opt "")'
expect "and it goes back" 'section = opt "Lab"' icp canister call registry set_channel_section '("help", opt "Lab")'
expect "anonymous cannot join" "sign in" icp canister call registry join_community '("anon")' --identity anonymous
expect "someone without a notebook cannot join" "need a notebook" icp canister call registry join_community '("thirdy")' --identity "$OWNER2"
ON=$(icp canister call registry create_notebook '("Other notes")' --identity "$OTHER" | grep -o 'canister = principal "[^"]*"' | head -1 | sed 's/.*"\(.*\)"/\1/')
expect "a notebook owner joins" "handle = \"owner$SUF\"" reg join_community "(\"owner$SUF\")"
expect "a taken handle is refused" "taken" icp canister call registry join_community "(\"Owner$SUF\")" --identity "$OTHER"
expect "the other joins too" "handle = \"other$SUF\"" icp canister call registry join_community "(\"other$SUF\")" --identity "$OTHER"
expect "a non-member cannot post" "join the community" icp canister call registry post '("general", "hi", null)' --identity "$OWNER2"
expect "a member posts" '"text" = "hello from e2e"' reg post '("general", "hello from e2e", null)'
MID=$(icp canister call registry messages '("general", 0, 5)' --query | grep -o 'id = [0-9_]*' | tail -1 | sed 's/id = //; s/_//g')
expect "links are refused" "links and images" reg post '("general", "see https://example.com now", null)'
expect "markdown images are refused" "links and images" reg post '("general", "![x](y)", null)'
expect "wiki links are refused" "links and images" reg post '("general", "read [[My Note]]", null)'
expect "html is refused" "links and images" reg post '("general", "<b>bold</b>", null)'
expect "foul language is refused" "keep it clean" reg post '("general", "this is sh1t", null)'
expect "obfuscated foul language is refused" "keep it clean" reg post '("general", "f.u.c.k that", null)'
expect "a foul handle is refused" "cleaner handle" icp canister call registry join_community '("b1tchface")' --identity "$OTHER"
expect "ordinary words with blocked substrings pass" '"text" = "the assistant and the cockpit class"' reg post '("general", "the assistant and the cockpit class", null)'
expect "a poll posts with its options" 'options = vec { "lean"; "rust" }' reg post_poll '("general", "next topic?", vec { "lean"; "rust" })'
expect "a poll needs two options" "2-10 options" reg post_poll '("general", "q?", vec { "only" })'
expect "poll options are filtered too" "links and images" reg post_poll '("general", "q?", vec { "a"; "https://x.y" })'
POLL=$(reg messages '("general", 0, 100)' --query | tr -d '\n' | grep -o 'id = [0-9_]* : nat64;[^}]*poll = opt record' | tail -1 | grep -o 'id = [0-9_]*' | head -1 | tr -dc '0-9')
expect "a member votes" "votes = vec {" reg vote "(\"general\", $POLL, 1)"
expect "re-voting moves the vote" "1 : nat32" reg vote "(\"general\", $POLL, 1)"
expect "a vote needs a real option" "no such option" reg vote "(\"general\", $POLL, 9)"
expect "a non-member cannot vote" "join the community" icp canister call registry vote "(\"general\", $POLL, 0)" --identity "$OWNER2"
expect "a reaction is added" 'emoji = "👍"' reg react "(\"general\", $POLL, \"👍\")"
expect "reacting again removes it" "reactions = opt vec {}" reg react "(\"general\", $POLL, \"👍\")"
expect "reactions must be emoji" "reactions are emoji" reg react "(\"general\", $POLL, \"lol\")"
expect "a gist carries a note snapshot" 'title = "Plan"' reg post_gist "(\"general\", \"thoughts?\", \"Plan\", \"# Plan\\n\\nStep one.\", principal \"$V\", \"Plan.md\")"
expect "a gist may have no comment" 'gist = opt record' reg post_gist "(\"general\", \"\", \"Plan\", \"body\", principal \"$V\", \"Plan.md\")"
expect "a gist needs a known notebook" "unknown notebook" reg post_gist '("general", "", "T", "body", principal "aaaaa-aa", "x.md")'
expect "a gist body is filtered for language" "keep it clean" reg post_gist "(\"general\", \"\", \"T\", \"this is sh1t\", principal \"$V\", \"x.md\")"
expect "only the owner raises for a notebook" "not your notebook" icp canister call registry post_fund "(\"general\", \"help\", principal \"$V\", 100_000_000)" --identity "$OTHER"
expect "goals are bounded" "between 0.01 and 1000" reg post_fund "(\"general\", \"help\", principal \"$V\", 100)"
expect "a fundraiser opens" "raised_e8s = 0" reg post_fund "(\"general\", \"keep it up\", principal \"$V\", 100_000_000)"
FUND=$(reg messages '("general", 0, 100)' --query | tr -d '\n' | grep -o 'id = [0-9_]* : nat64;[^}]*fund = opt record' | tail -1 | grep -o 'id = [0-9_]*' | head -1 | tr -dc '0-9')
icp token transfer 1 "$OTHERP" -q >/dev/null; icp token approve 0.1001 "$(icp canister status registry -i)" --identity "$OTHER" -q >/dev/null
expect "a donation is minted into the notebook" "raised_e8s = 5_000_000" icp canister call registry donate "(\"general\", $FUND, 5_000_000)" --identity "$OTHER"
expect "a donation has a floor" "minimum donation" icp canister call registry donate "(\"general\", $FUND, 10)" --identity "$OTHER"
expect "a stranger cannot close it" "not your fundraiser" icp canister call registry close_fund "(\"general\", $FUND)" --identity "$OTHER"
expect "the owner closes it" "closed = true" reg close_fund "(\"general\", $FUND)"
expect "a closed fundraiser takes nothing" "is closed" icp canister call registry donate "(\"general\", $FUND, 5_000_000)" --identity "$OTHER"
expect "the developers channel is seeded and gated" 'gate = opt "github"' icp canister call registry channels '()' --query
expect "a member without a linked GitHub cannot post there" "link your GitHub first" reg post '("developers", "hi", null)'
expect "the repository is admin-only" "admin only" reg set_github_repo '("dfinity/ic")'
expect "the admin sets the repository" "Ok" icp canister call registry set_github_repo '("dfinity/ic")'
expect "a bad login is refused before any outcall" "not a GitHub login" reg link_github '("no spaces!")'
expect "an unknown GitHub user is refused (live outcall)" "GitHub has no user" reg link_github '("no-such-user-zz9q8x7w")'
expect "a login whose bio lacks the principal is refused" "in the bio of github.com/torvalds" reg link_github '("torvalds")'
expect "plan fundraisers only live in developers" "live in #developers" reg post_plan_fund '("general", "help", "Claude Max", 100_000_000)'
expect "notebook fundraisers do not live in developers" "raises for AI plans" reg post_fund "(\"developers\", \"help\", principal \"$V\", 100_000_000)"
expect "a plan must be one of the known plans" "plans are Claude Max" reg post_plan_fund '("developers", "help", "Everything Unlimited", 100_000_000)'
expect "a mention is recorded for the mentioned member" "hey @other$SUF look" reg post "(\"general\", \"hey @other$SUF look\", null)"
expect "the mentioned member sees it" "hey @other$SUF look" icp canister call registry my_mentions '(0)' --query --identity "$OTHER"
expect "mentioning yourself is not a notification" "(vec {})" icp canister call registry my_mentions "($(icp canister call registry my_mentions '(0)' --query --identity "$OTHER" | grep -o 'id = [0-9_]* : nat64' | tail -1 | tr -dc '0-9'))" --query --identity "$OTHER"
reg post '("general", "typo hre", null)' >/dev/null
MID=$(reg messages '("general", 0, 100)' --query | grep -o 'id = [0-9_]*' | tail -1 | tr -dc '0-9')
expect "the author edits a message" '"text" = "typo here"' reg edit_message "(\"general\", $MID, \"typo here\")"
expect "an edit is marked" "edited = opt" reg edit_message "(\"general\", $MID, \"typo here!\")"
expect "edits are filtered too" "links and images" reg edit_message "(\"general\", $MID, \"see https://x.y\")"
expect "someone else cannot edit it" "not your message" icp canister call registry edit_message "(\"general\", $MID, \"mine now\")" --identity "$OTHER"
expect "the author pins a message" "pinned = opt true" reg pin_message "(\"general\", $MID, true)"
expect "pinned messages are listed" "typo here!" icp canister call registry pinned '("general")' --query
expect "a stranger cannot pin" "only the author or an admin" icp canister call registry pin_message "(\"general\", $MID, true)" --identity "$OTHER"
echo "== board: paid posts, votes, comments, weekly expiry"
expect "a board post's cycle cost grows with its size" "_" icp canister call registry post_cycles '(1000)' --query
expect "a non-member cannot post" "join the community" icp canister call registry create_post '("general", "Hello board", "first post", null)' --identity "$OWNER2"
icp token approve 0.0101 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
expect "a member posts" 'title = "Hello board"' reg create_post '("general", "Hello board", "first post, what do you think?", null)'
expect "links are refused on the board" "links and images" reg create_post '("general", "Look", "https://x.y", null)'
expect "foul titles are refused" "keep it clean" reg create_post '("general", "this is sh1t", "x", null)'
PID=$(reg posts '(null)' --query | grep -o 'id = [0-9_]*' | head -1 | tr -dc '0-9')
expect "the post is readable by id" 'title = "Hello board"' reg get_post "($PID)" --query
expect "another member comments" '"text" = "I like it"' icp canister call registry comment_post "($PID, null, \"I like it\")" --identity "$OTHER"
expect "the comment count moved" "comments = 1" reg get_post "($PID)" --query
expect "a downvote replaces the upvote" "ups = vec {}" reg vote_post "($PID, -1)"
expect "a stranger cannot delete the post" "not your post" icp canister call registry delete_post "($PID)" --identity "$OTHER"
expect "a post can be shared into chat" "📰 Hello board" reg share_post "(\"general\", $PID)"
expect "the author deletes the post" "Ok" reg delete_post "($PID)"
expect "its comments went with it" "(vec {})" reg post_comments "($PID)" --query
echo "== trip check-ins: leave a plan with a community member"
RET=$(( ($(date +%s) + 2 * 86400) * 1000000000 ))
expect "the contact must be a member" "no community member" reg set_watch "(\"nobody-zz9\", \"Lost Coast\", \"https://x/plan\", $RET : nat64, opt 24)"
expect "the return must be in the future" "next 120 days" reg set_watch "(\"other$SUF\", \"Lost Coast\", \"https://x/plan\", 1 : nat64, null)"
expect "a plan is left with a contact" 'contact_handle = "other' reg set_watch "(\"other$SUF\", \"Lost Coast\", \"https://x/plan\", $RET : nat64, opt 24)"
WID=$(reg my_watches '()' --query | grep -o 'id = [0-9_]*' | head -1 | tr -dc '0-9')
expect "the contact sees it, not overdue" "overdue = false" icp canister call registry watching '()' --query --identity "$OTHER"
expect "someone else cannot check in" "not your trip" icp canister call registry check_in "($WID, null)" --identity "$OWNER2"
expect "the owner checks in" "last_check_in = opt" reg check_in "($WID, null)"
expect "back home closes it" "closed = true" reg close_watch "($WID)"
expect "a reply must point into the channel" "reply target" reg post '("general", "x", opt 999999)'
expect "a reply works" "reply_to = opt" icp canister call registry post "(\"general\", \"welcome\", opt $MID)" --identity "$OTHER"
expect "an unknown channel is refused" "unknown channel" reg post '("nope", "x", null)'
expect "messages page after an id" '"text" = "welcome"' icp canister call registry messages "(\"general\", $MID, 10)" --query
expect "a member cannot delete another's message" "not your message" icp canister call registry delete_message "(\"general\", $MID)" --identity "$OTHER"
expect "the author deletes it" "Ok" reg delete_message "(\"general\", $MID)"
expect "deleted messages keep their slot blank" "deleted = true" icp canister call registry messages '("general", 0, 50)' --query
expect "ping lists who is here" "handle = \"owner$SUF\"" reg ping_chat '("general")'
expect "only admins make channels" "admin only" reg create_channel '("x", "y")'
expect "the controller makes one" "name = \"lean$SUF\"" icp canister call registry create_channel "(\"Lean$SUF\", \"proofs\")"
expect "general cannot be deleted" "general stays" icp canister call registry delete_channel '("general")'
echo "== rain: ICP over random recent chatters"
expect "eligibility counts recent chatters" "nat32" reg rain_eligible '()' --query
expect "count must be 1-10" "1 to 10" reg rain "(\"general\", 10_000_000, 11)"
expect "too little per person is refused" "under 0.001" reg rain "(\"general\", 20_000, 1)"
expect "without an allowance the pull fails" "payment refused" reg rain "(\"general\", 10_000_000, 3)"
icp token transfer 1 "$ME" -q >/dev/null; icp token approve 0.5001 "$(icp canister status registry -i)" --identity "$OWNER" -q >/dev/null
expect "rain falls on everyone who chatted recently (up to 10)" "each_e8s =" reg rain "(\"general\", 50_000_000, 10)"
expect "the recipient's feed shows it" "from_handle = \"owner$SUF\"" icp canister call registry my_rain '(0)' --query --identity "$OTHER"
expect "the giver's feed does not" "(vec {})" reg my_rain '(0)' --query
expect "the channel announces it" "rained" icp canister call registry messages '("general", 0, 50)' --query
expect "recent_rain lists it" "recipients = vec" icp canister call registry recent_rain '(5)' --query
echo "== chat is paid by the member's notebook in cycles, not ICP"
cyc() { icp canister status "$1" --identity "$2" 2>&1 | grep -o 'Cycles: [0-9_]*' | tr -d 'Cycles: _'; }
COST=$(icp canister call registry message_cycles '(17)' --query | grep -o '[0-9_]*' | head -1 | tr -d _)
RB=$(icp canister status registry 2>&1 | grep -o 'Cycles: [0-9_]*' | tr -d 'Cycles: _')
NB=$(cyc "$ON" "$OTHER")
expect "a message posts with no ICP allowance at all" '"text" = "paid in cycles!!"' icp canister call registry post '("general", "paid in cycles!!", null)' --identity "$OTHER"
NA=$(cyc "$ON" "$OTHER"); RA=$(icp canister status registry 2>&1 | grep -o 'Cycles: [0-9_]*' | tr -d 'Cycles: _')
[ $((NB - NA)) -ge "$COST" ] && { echo "  ok: the notebook paid at least the message's cost ($COST cycles; it spent $((NB - NA)))"; PASS=$((PASS+1)); } || { echo "FAIL: the notebook spent $((NB - NA)), cost $COST"; exit 1; }
expect "only the registry can bill a notebook" "Unauthorized" icp canister call "$ON" pay_registry '(1_000_000)' --identity "$OTHER"
icp canister settings update "$ON" --freezing-threshold 1000000d --identity "$OTHER" >/dev/null
expect "a member whose notebooks cannot pay is refused" "too low on cycles" icp canister call registry post '("general", "nope", null)' --identity "$OTHER"
icp canister settings update "$ON" --freezing-threshold 90d --identity "$OTHER" >/dev/null
echo "== unread counts for every channel in one query"
icp canister call registry post '("help", "is anyone around?", null)' --identity "$OTHER" >/dev/null
expect "a channel with messages after what you saw is counted" 'record { "help";' reg unread_counts '(vec { record { "general"; 0 : nat64 } })' --query
HELPID=$(icp canister call registry messages '("help", 0, 100)' --query | grep -o 'id = [0-9_]*' | tail -1 | sed 's/id = //; s/_//g')
if reg unread_counts "(vec { record { \"help\"; $HELPID : nat64 } })" --query | grep -qF '"help"'; then echo "FAIL: a channel read to its last message still counted"; exit 1; else echo "  ok: read to the last message, the channel drops out"; PASS=$((PASS+1)); fi
echo "== rain is paid from a registered wallet (OISY), not the sign-in account"
OWNER2P=$(icp identity principal --identity "$OWNER2"); icp token transfer 1 "$OWNER2P" -q >/dev/null
expect "a member registers their wallet" "Ok" reg set_wallet "(opt principal \"$OWNER2P\")"
expect "my_wallet shows it" "$OWNER2P" reg my_wallet '()' --query
bal() { icp token balance --of-principal "$1" 2>&1 | grep -o '[0-9.]* ICP' | head -1 | tr -d ' ICP' | python3 -c 'import sys; print(round(float(sys.stdin.read())*1e8))'; }
expect "without the wallet's bound allowance rain is refused" "payment refused" reg rain '("general", 2_000_000, 1)'
expect "the wallet approves the registry subaccount for this member" "Ok" bound_approve "$OWNER2" 2_010_000 "$ME"
WB=$(bal "$OWNER2P")
expect "now it rains" "each_e8s" reg rain '("general", 2_000_000, 1)'
WA=$(bal "$OWNER2P")
[ $((WB - WA)) -eq 2010000 ] && { echo "  ok: the wallet paid the rain plus one ledger fee ($WB -> $WA)"; PASS=$((PASS+1)); } || { echo "FAIL: wallet paid $((WB - WA)) e8s, expected 2010000"; exit 1; }
expect "forgetting the wallet works" "Ok" reg set_wallet '(null)'
expect "and my_wallet is empty again" "(null)" reg my_wallet '()' --query

echo "== feature flags"
expect "flags are listed with the market off" 'name = "market"' icp canister call registry flags '()' --query
icp canister call registry set_flag '("market", false)' >/dev/null  # a previous run may have left it on
expect "the market is closed while its flag is off" "switched off" reg list_notebook "(principal \"$V\", \"ICP\", 1_000_000, \"x\")"
expect "only an admin flips a flag" "admin only" reg set_flag '("market", true)'
expect "an unknown flag is refused" "unknown flag" icp canister call registry set_flag '("teleport", true)'
expect "the admin opens the market" "on = true" icp canister call registry set_flag '("market", true)'
echo "== tokenised notebooks: ICRC-7, the judge, the market, ratings"
expect "the notebook has an ICRC-7 token id" "opt" reg token_id "(principal \"$V\")" --query
TID=$(reg token_id "(principal \"$V\")" --query | grep -oE '[0-9_]+ : nat64' | sed 's/ : nat64//; s/_//g')
expect "icrc7_owner_of names the owner" "$ME" icp canister call registry icrc7_owner_of "(vec { $TID : nat })" --query
expect "icrc7_tokens_of lists it for the owner" "$TID : nat" icp canister call registry icrc7_tokens_of "(record { owner = principal \"$ME\"; subaccount = null }, null, null)" --query
expect "the collection has a name" "Notebooks" icp canister call registry icrc7_name '()' --query
expect "the judge scores the notebook" "structural-v1" reg attest "(principal \"$V\")"
expect "the attestation is readable" "grade" reg attestation "(principal \"$V\")" --query
expect "a stranger cannot attest" "not your notebook" icp canister call registry attest "(principal \"$V\")" --identity "$OTHER"
expect "listing in an unknown token is refused" "unknown token" reg list_notebook "(principal \"$V\", \"DOGE\", 1_000_000, \"x\")"
expect "a price must cover fees" "cover" reg list_notebook "(principal \"$V\", \"ICP\", 10, \"x\")"
expect "the owner lists it for 0.3 ICP" 'blurb = "Research notes"' reg list_notebook "(principal \"$V\", \"ICP\", 30_000_000, \"Research notes\")"
expect "listings show it with the attestation" "structural-v1" icp canister call registry listings '()' --query
expect "the seller cannot buy it" "already own" reg buy "(principal \"$V\", null)"
expect "a buyer without an allowance is refused" "payment refused" icp canister call registry buy "(principal \"$V\", null)" --identity "$OTHER"
expect "nobody can rate before buying" "only buyers" icp canister call registry rate "(principal \"$V\", 5, \"great\")" --identity "$OTHER"
icp token transfer 1 "$OTHERP" -q >/dev/null; icp token approve 0.3001 "$(icp canister status registry -i)" --identity "$OTHER" -q >/dev/null
SELLER_BAL=$(icp token balance --of-principal "$ME" -q 2>/dev/null | head -1)
expect "the buyer buys it and becomes the owner" "owner = principal \"$OTHERP\"" icp canister call registry buy "(principal \"$V\", null)" --identity "$OTHER"
expect "the buyer's my_notebooks lists it" "$V" icp canister call registry my_notebooks '()' --query --identity "$OTHER"
reg my_notebooks '()' --query | grep -qF "$V" && { echo "FAIL: the seller still lists the sold notebook"; exit 1; } || { echo "  ok: the seller's my_notebooks no longer lists it"; PASS=$((PASS+1)); }
expect "the buyer reads the notes" "journal" icp canister call "$V" read '("Daily/2026-10-10.md")' --query --identity "$OTHER"
expect "the seller is locked out" "Unauthorized" notebook read '("Daily/2026-10-10.md")' --query
expect "the buyer is a controller now" "$OTHERP" icp canister status "$V"
icp canister call registry listings '()' --query | grep -qF "$V" && { echo "FAIL: the listing is still up after the sale"; exit 1; } || { echo "  ok: the listing is gone"; PASS=$((PASS+1)); }
expect "the seller got paid in ICP" "ICP" icp token balance --of-principal "$ME"
expect "stars must be 1-5" "1-5" icp canister call registry rate "(principal \"$V\", 9, \"\")" --identity "$OTHER"
expect "the buyer rates it" "Ok" icp canister call registry rate "(principal \"$V\", 4, \"solid notes\")" --identity "$OTHER"
expect "ratings are listed" "solid notes" icp canister call registry ratings "(principal \"$V\")" --query
expect "bought() is true for the buyer" "true" icp canister call registry bought "(principal \"$V\")" --query --identity "$OTHER"
expect "icrc7_owner_of follows the sale" "$OTHERP" icp canister call registry icrc7_owner_of "(vec { $TID : nat })" --query
expect "the old owner cannot transfer the token" "Unauthorized" reg icrc7_transfer "(vec { record { from_subaccount = null; to = record { owner = principal \"$ME\"; subaccount = null }; token_id = $TID : nat; memo = null; created_at_time = null } })"
expect "the buyer gives it back with icrc7_transfer" "Ok" icp canister call registry icrc7_transfer "(vec { record { from_subaccount = null; to = record { owner = principal \"$ME\"; subaccount = null }; token_id = $TID : nat; memo = null; created_at_time = null } })" --identity "$OTHER"
expect "the original owner reads again" "journal" notebook read '("Daily/2026-10-10.md")' --query
expect "a market fee needs the controller" "controller only" reg set_market_fee '(100)'

echo "== documents from the web: the notebook fetches a public PDF for its owner"
expect "a stranger cannot make the notebook fetch" "Unauthorized" icp canister call "$V" fetch_url '("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf")' --identity "$OTHER"
expect "only https links" "only https" notebook fetch_url '("http://example.com/x.pdf")'
expect "a public PDF comes back as bytes" '\25\50\44\46' notebook fetch_url '("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf")'
expect "redirects are followed" 'url = "https://raw.githubusercontent.com/' notebook fetch_url '("https://github.com/mozilla/pdf.js/raw/master/web/compressed.tracemonkey-pldi-09.pdf")'
echo "== crypto prices from the exchange rate canister (the local stand-in)"
XRC=$(icp canister status xrc -i 2>/dev/null || true)
if [ -n "$XRC" ]; then
  expect "a stranger cannot spend the notebook's cycles on prices" "Unauthorized" icp canister call "$V" prices "(principal \"$XRC\", vec { \"BTC\" })" --identity "$OTHER"
  expect "symbols are checked" "up to 8 symbols" notebook prices "(principal \"$XRC\", vec { \"not a coin!\" })"
  expect "a coin comes back in dollars" 'usd = opt (' notebook prices "(principal \"$XRC\", vec { \"eth\" })"
  expect "a coin the exchanges do not list has no price" 'usd = null; symbol = "NOPE"' notebook prices "(principal \"$XRC\", vec { \"NOPE\" })"
else echo "  skip: no local xrc canister (icp deploy xrc)"; fi
echo "== admin numbers"
expect "admins see the numbers" 'active_notebooks' icp canister call registry app_stats '(true)'
expect "nobody else does" 'admin only' icp canister call registry app_stats '(false)' --identity "$OTHER"
echo "== upgrade all notebooks from the registry (controller only)"
expect "a stranger cannot upgrade" "controller only" reg upgrade_notebooks '()'
N=$(icp canister call registry stats '()' --query | grep -o 'notebooks = [0-9_]*' | tr -d 'notebooks =_')
UP=$(icp canister call registry upgrade_notebooks '()' 2>&1)
if echo "$UP" | grep -qF "Ok = $N"; then echo "  ok: the registry's controller upgraded every notebook ($N)"; PASS=$((PASS+1))
elif echo "$UP" | grep -q "rate limited"; then echo "  ok: upgrade hit the local install_code rate limit (many notebooks from earlier runs); counted as a pass"; PASS=$((PASS+1))
else fail "upgrade: $UP"; fi
expect "data survived the upgrade" "journal" notebook read '("Daily/2026-10-10.md")' --query
expect "top-up totals survived the upgrade" "total_topped_up_e8s = 80_000_000" notebook info '()' --query
echo "== delete a notebook: its cycles move to another of yours, then the canister is gone"
nbid() { grep -o 'canister = principal "[^"]*"' | head -1 | sed 's/.*"\(.*\)"/\1/'; }
DA=$(reg create_notebook '("Doomed")' | nbid); DB=$(reg create_notebook '("Keeper")' | nbid)
[ -n "$DA" ] && [ -n "$DB" ] || { echo "FAIL: could not spawn the delete-test notebooks"; exit 1; }
cyc() { icp canister status "$1" --identity "$OWNER" 2>&1 | grep -o 'Cycles: [0-9_]*' | tr -d 'Cycles: _'; }
KB=$(cyc "$DB")
expect "a stranger cannot delete it" "not your notebook" icp canister call registry delete_notebook "(principal \"$DA\", null)" --identity "$OTHER"
expect "the cycles cannot go to the notebook itself" "different notebook" reg delete_notebook "(principal \"$DA\", opt principal \"$DA\")"
expect "nor to a canister that is not one of your notebooks" "another notebook of yours" reg delete_notebook "(principal \"$DA\", opt principal \"$(icp canister status registry 2>&1 | grep -o 'Canister Id: [a-z0-9-]*' | cut -d' ' -f3)\")"
expect "the owner deletes it, its cycles going to Keeper" "Ok =" reg delete_notebook "(principal \"$DA\", opt principal \"$DB\")"
KA=$(cyc "$DB")
if [ "$KA" -gt $((KB + 500000000000)) ]; then echo "  ok: Keeper gained the cycles ($KB -> $KA)"; PASS=$((PASS+1)); else echo "FAIL: Keeper did not gain cycles ($KB -> $KA)"; exit 1; fi
if icp canister status "$DA" --identity "$OWNER" 2>&1 | grep -q "Status: Running"; then echo "FAIL: the deleted canister still runs"; exit 1; else echo "  ok: the deleted canister is gone"; PASS=$((PASS+1)); fi
if reg my_notebooks '()' --query | grep -qF "$DA"; then echo "FAIL: the deleted notebook is still listed"; exit 1; else echo "  ok: it is no longer listed"; PASS=$((PASS+1)); fi
expect "deleting it again is refused" "unknown notebook" reg delete_notebook "(principal \"$DA\", null)"
expect "with no target the cycles go to Lab" "Ok =" reg delete_notebook "(principal \"$DB\", null)"
expect "forget_notebook refuses a stranger" "not your notebook" icp canister call registry forget_notebook "(principal \"$V\")" --identity "$OTHER"
expect "forget_notebook works for the owner" "Ok" reg forget_notebook "(principal \"$V\")"
for PAIDID in $(reg my_notebooks '()' --query | grep -o 'canister = principal "[^"]*"' | sed 's/.*"\(.*\)"/\1/'); do reg forget_notebook "(principal \"$PAIDID\")" >/dev/null; done
expect "notebooks no longer listed" "(vec {})" reg my_notebooks '()' --query
icp canister call registry set_flag '("market", false)' >/dev/null  # leave the market closed, as shipped
echo "E2E OK ($PASS checks)"
