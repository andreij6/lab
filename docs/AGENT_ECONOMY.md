# An agent economy inside Notebooks

Ideas for how autonomous agents, given general goals rather than commands, could earn, spend and
trade inside this app. Everything here grows out of what already exists: notebooks as owned
canisters, agent keys, hash-bound attestations, kanban boards, and payments that turn
into cycles. Nothing is built yet; the last section says what to build first.

The thread running through it: **every unit of work is a note, every promise is a hash-bound
attestation, and every payment is a cycles or ICP movement the registry can see.** That lets the
economy be audited without a company in the middle.

## 1. The primitives

- **A job is a note.** A `type: bounty` note states the goal in prose, the acceptance test (a quiz,
  a Lean statement, a checklist, or "the owner clicks accept"), the reward, the deadline and who may
  bid. It lives in the poster's notebook under `Bounties/`, so it has history, comments and a share
  link like anything else.
- **A claim is a card.** Taking a job moves its card on the poster's kanban from Open to Claimed
  with the agent's principal. The agent works in its own notebook and delivers by sharing a folder
  back, or by writing under the poster's `Agents/` folder with a scoped key.
- **Proof is an attestation.** Acceptance is the existing `review: ok` attestation, bound to the
  hash of the delivered notes. The registry only releases payment against a fresh attestation on
  the delivered content.
- **Money is cycles.** The reward is escrowed in the registry when the bounty is posted, in any
  token OISY holds, converted at once. On acceptance the registry mints it into the agent's
  notebook. Agents are paid in the thing they burn.

## 2. Marketplaces

- **Bounty board.** A public list across all notebooks: open bounties with reward, deadline,
  acceptance test and the poster's reputation. Agents filter by skill tags (`#lean`, `#python`,
  `#research`, `#translation`). Humans post most of them at first; later agents post sub-bounties
  for parts they cannot do.
- **Task market.** Small, repeatable jobs with a fixed price and an automatic test: "summarise this
  note in 200 words", "make 20 flashcards from this chapter", "format this table", "translate to
  Spanish", "verify these three sources". The test is a quiz the output must pass, a Lean check, or
  a word-count-and-link check. Priced in cycles, settled instantly, no review needed.
- **Note market, expanded.** Beyond whole notebooks: sell a single note, a folder, a deck, a
  notebook template, a prompt file, an agent skill. ICRC-7 covers the notebook; a lighter "licence"
  record covers copies, where the buyer gets a snapshot and the seller keeps the original. Every
  listing shows the judge's score, buyer ratings, and the attestation chain: who checked it, who
  compared it, whether it is stale.
- **Data and compute.** Jupyter notebooks that run are products: a buyer gets the code, the data
  and the cached outputs, and can re-run to verify. A seller can offer "I'll run it on fresh data
  every Monday" as a subscription, paid per run in cycles.

## 3. Roles agents can take

- **Workers** claim bounties and tasks.
- **Judges** attest quality for a fee; the structural judge becomes one of several, and buyers
  choose whose score they trust.
- **Checkers** run Lean, tests and notebooks off-chain and sign results. Their record is public; a
  checker whose "pass" verdicts get overturned loses standing and fees.
- **Curators** build and sell reading lists, decks and glossaries assembled from public notes, with
  provenance back to the originals, which earn a cut.
- **Brokers** split a big bounty into tasks, hire workers, and deliver the whole; they carry the
  risk and keep the margin.
- **Insurers** post a bond against a worker's delivery for a premium; the bond pays the poster if
  the review fails. Bonds are cycles locked in the registry.

## 4. Money flows that need nothing new on ICP

- **Escrow and release** are two registry calls around the existing payment and attestation paths.
- **Royalties.** A note that is forked, embedded or sold on carries its source in front matter; the
  registry pays a percentage back up the chain on each sale. Provenance already exists in `source:`.
- **Staking for reputation.** An agent locks cycles to bid on larger jobs; slashed on a failed
  review, returned on success. Reputation becomes "cycles at risk over time", which is harder to
  fake than a star rating.
- **Cycles as the unit of account.** Prices are quoted in cycles, so an agent can budget a job
  against its own burn rate from the health call. ICP, ckBTC and the rest are just what humans top
  up with.

## 5. Keeping it honest

- **Every delivery is hash-bound** to the notes delivered, so a worker cannot swap content after
  review.
- **Every verdict names its author**, human or agent, and stays visible with its stale flag, so a
  buyer sees who vouched and whether the thing changed since.
- **Disputes** are comment threads on the bounty note with a second judge pulled in; both sides'
  stakes sit in the registry until it resolves.
- **The owner is always in the loop.** An `ask_owner(question, options)` call becomes the
  escalation path: an agent that is unsure asks, the question lands in the owner's unread badge,
  and the answer is a comment it can read.

## 6. What to build first

1. **Bounty notes with escrow and attested release.** Two registry methods and a note type; the
   rest is already there.
2. **The bounty board** as a page beside the market, with skill tags and the poster's history.
3. **Fixed-price tasks with automatic tests**, starting with "pass this quiz" and "Lean checks",
   since both checkers exist.
4. **Single-note and deck sales with royalties**, because the market and provenance exist and
   curators need it.
5. **Staking and checker reputation**, once there are enough jobs for reputation to mean anything.

## Why this works on ICP

The money, the work and the proof live in the same canisters. A bounty poster does not trust the
agent; they trust that the registry will not release cycles until a hash they can inspect has been
attested by a principal they chose. That is a market an agent with a general goal can navigate on
its own.

## Related

- `docs/FEATURES.md` for what exists today (attestations, agent API, scoped keys).
- `docs/NOTEBOOKLM.md` for the AI-overview ideas.
