# Multiple-choice quizzes

A note with `quiz: choice` in its front matter opens in the app as a quiz: pick, Check, see what
was right and why, Next, and a score at the end. On a shared note the score reaches the owner
(Study → attempts). The file reads as an ordinary note elsewhere.

## Required

```markdown
---
quiz: choice
---
```

`quiz: multiple-choice` also works. Add `source: [[Note]]` when the quiz comes from a note.

## Questions

```markdown
# Cycles quiz

### What happens when a canister runs out of cycles?
- [ ] It is deleted at once
- [x] It freezes, then is deleted when the remaining cycles run out
- [ ] Nothing, calls are free
> A frozen canister keeps its data until its balance hits zero.

### Which of these are ICRC standards? (pick all)
- [x] ICRC-1
- [x] ICRC-2
- [ ] ERC-20
```

- A **heading** (`###`, any level) starts a question; its text is the question.
- **Task items** under it are the options: `- [ ]` wrong, `- [x]` right. Several `[x]` make a
  pick-all question; a question with no `[x]` is dropped, so mark at least one.
- An optional **quote line** (`> ...`) after the options is the explanation shown after Check.
  Several quote lines join into one explanation.
- Anything else under a heading (a line of prose) is ignored; put context in the question text.

Order is kept as written; the app can shuffle. Three to five options a question read best; keep
options parallel in form and the right one not always the longest.

## Writing a quiz from a note

Read the note; for each claim worth testing write one question whose wrong options are plausible
mistakes, not nonsense, and whose explanation cites the note (`see [[Note#Heading]]`). Name it
`<Note> (quiz).md` next to the note and link the source.

## Cost

A quiz is a note: the call plus the bytes stored.
