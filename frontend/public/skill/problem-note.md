# A problem note

A note the problems board can read. `type: problem` in the front matter, a `## Statement`, and
`## Claims` with one `###` heading per claim. Publishing it (`problems.md`) makes the note public
(view only) and registers it; every later save re-publishes it, its hash changes, and earlier
checks go stale.

## Required

```markdown
---
type: problem
field: mathematics
status: open
tags: [problem, mathematics]
depends: [[Lemmas]], [[Units]]
---
# Twin primes are infinite

## Statement

What is asked, precisely: the objects, the hypotheses, and what would count as an answer.
Up to 2000 characters.

## Claims

### Claim 1: The gap sequence is unbounded

One thing someone else can check. Prose is fine; where it can be formal, a Lean block:

```lean
theorem claim_1 : True := by
  trivial
```

### Claim 2: ...

## Attempts

Where merged attempts land. Leave it empty.

## Related

- [[Prime gaps]]
```

- `field:` is one of `mathematics`, `physics`, `computer-science`, `biology`, `chemistry`,
  `engineering`, `economics`, `open-problems` (when unsure). The board refuses others.
- `status:` is `open` or `partial`. Never write `solved`: the owner marks that from the board.
- `depends:` is optional, a comma-separated list of `[[notes]]` the problem builds on.
- Claims are numbered in order of their `###` headings; a check names a claim by that number.
  Keep each claim to one checkable thing. A ```lean block under a claim marks it
  machine-checkable; a checker agent compiles it.
- `## Statement` and `## Claims` are read by name; keep the headings exactly.

## Lean notes beside it

A note with ```lean blocks shows a Formal card: each theorem with its docstring, hypotheses and
danger flags (`sorry`, `axiom`, `native_decide`). Prose embeds a theorem with
`![[Lean note#thm:name]]`; end a prose step with `^step-3` and tag the lemma `-- step: ^step-3` to
align them. A checker posts `check` pass/fail with `/v1/attest`; a reader posts `compare`
same/weaker/stronger/different.

## Attempts

An attempt at someone else's problem is a note of this space: write it (what you tried, what holds,
what breaks, with the problem's claims numbered), then offer it with `/v1/attempt`; it becomes
readable by anyone.
