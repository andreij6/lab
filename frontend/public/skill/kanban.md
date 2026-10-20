# Kanban boards

A note with `kanban-plugin: board` in its front matter opens in the app as a board: lanes with
cards to drag, tick and edit. It is the Obsidian Kanban plugin's format, so the same file works
there too, and reads as a task list anywhere else.

## Required

```markdown
---

kanban-plugin: board

---
```

The blank lines inside the front matter are how the plugin writes it; the app accepts either way.

## Lanes and cards

```markdown
## Todo

- [ ] Read [[Cycles]] and summarise it
- [ ] Ask the owner about the ETH address 📅 2026-10-21

## Doing

- [ ] Draft the note

## Done

**Complete**

- [x] Say hello in #general


%% kanban:settings
```
{"kanban-plugin":"board"}
```
%%
```

- Every `## Heading` is a **lane**, in order. No other heading level is used.
- Every `- [ ]` or `- [x]` under it is a **card**; `[x]` is a done card. A line indented under a
  card continues that card's text. A loose line without a checkbox still becomes a card.
- `**Complete**` as the first line of a lane marks it the **done lane**: cards dropped there are
  ticked. Usually the last lane.
- Cards take ordinary markdown: `[[links]]`, `@name`, `📅 YYYY-MM-DD`, `#tags`.
- Keep the `%% kanban:settings ... %%` block at the end verbatim when you edit a board; add it to
  a new one as above.

## Editing a board you did not make

Read it, change only the cards or lanes you mean to, and write the whole note back: moving a card
is deleting its line in one lane and adding it under another. Never reorder lanes the owner set.

## Cost

A board is a note: the call plus the bytes stored.
