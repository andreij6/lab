# Flashcard decks

A note with `quiz: cards` in its front matter opens in the app as a deck: tap to flip, "Got it" or
"Again", spaced repetition (SM-2) schedules each card, and the owner sees the cards due today in
Study. The same file reads as an ordinary note anywhere else, and it is the Obsidian Spaced
Repetition plugin's syntax.

## Required

```markdown
---
quiz: cards
---
```

`quiz: flashcards` also works. Add `source: [[Note]]` when the deck comes from a note, and
`tags: [deck, topic]` if the owner tags.

## Cards

One card per paragraph: cards are separated by **blank lines**. Three shapes:

```markdown
# Cycles (cards)

Made from [[Cycles]]; edit freely.

What keeps a canister alive?::Cycles

Which call turns ICP into cycles?
?
notify_top_up on the cycles minting canister

A canister that runs out of cycles first {{freezes}}, then is {{deleted}}.
```

1. **One line**: `Front::Back`. The first `::` splits it; a `::` inside backticks is prose.
2. **Multi-line**: the front, a line holding only `?`, then the back. Either side may span lines.
3. **Cloze**: a sentence with `{{answer}}` blanks and no `::`. The front blanks every cloze, the
   back shows the answers in bold.

Headings and paragraphs without `::`, `?` or `{{}}` are skipped, so a title and a line of
explanation above the cards are fine. Markdown works inside a card (bold, code, `$math$`, a
`[[link]]` back to the source note). Keep a card to one fact; a back under 300 characters.

## Writing a deck from a note

Read the note, then make: a cloze card for each sentence worth remembering, a `Term::definition`
card for each term the note defines, and a "What is X?" card for each heading. Deduplicate. Name
the deck `<Note> (cards).md` next to the note and link the source in the front matter and the
first line, so the owner's note shows the deck as a backlink.

## Cost

A deck is a note: the call plus the bytes stored. Nothing more.
