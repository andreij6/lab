# Memory: the notes

Every call: `POST __URL__/v1/<route>`, `Authorization: Bearer __KEY__`, JSON body.

| Route | Body | Returns |
| --- | --- | --- |
| `/v1/list` | `{}` | every file: `path, size, created, modified, agent` |
| `/v1/read` | `{"path": "Ideas.md"}` | `path, content, created, modified, agent` |
| `/v1/search` | `{"q": "cycles", "limit": 20}` | `[{path, snippet}]`, name matches first |
| `/v1/write` | `{"path": "Topic.md", "content": "..."}` | the saved file's metadata; folders in the path are made on the way |
| `/v1/delete` | `{"path": "Topic.md"}` | `{deleted}`: a note, or a folder with everything in it |
| `/v1/attest` | `{"path", "kind": "check", "verdict": "pass", "detail"?}` | an attestation on a note (check pass/fail, compare same/weaker/stronger/different, review ok/issue) |
| `/v1/attestations` | `{"path"}` | the attestations on a note, with whether each is still fresh |

## Costs

Reading is a sliver of cycles per call (every POST is an update call). Writing costs the call plus
the bytes stored, for as long as they are stored. Deleting is free and frees the bytes.

## Rules

- You read and write everything; the owner can too. Write at the top level, or in a folder that
  fits the subject. Your notes are stamped with your name (`agent`), so they need no folder of
  their own. A key the owner **scoped** to one folder writes only under that folder.
- Overwriting your own note (same path) is fine; prefer one evolving note per topic over many
  dated ones. Read before you overwrite someone else's note, and keep what they wrote.
- Paths end in `.md`. Names may not contain `# ^ [ ] | \ / :`.

## Markdown, as Obsidian writes it

- `[[Note Name]]` links any note by name, or by path without `.md`; `[[Note#Heading]]` a section;
  `[[Note|shown text]]` an alias; `![[Note]]` embeds it. Links are how your work joins the owner's:
  every linked note shows yours as a backlink, and the graph draws the edge.
- `#tags` anywhere, or `tags: [a, b]` in the front matter.
- Front matter is YAML between `---` lines at the very top; `type:` is what turns a note into a
  special kind (see `notes-types.md`, `flashcards.md`, `quiz.md`, `kanban.md`, `problem-note.md`).
- `- [ ]` tasks, with `📅 2026-10-14` for a due date, `@name` for an owner, `⏫`/`🔼` for priority.
  `Term:: definition` lines make the glossary; `Decision:: text` lines make the decision log.
- `> [!tip]`, `> [!note]`, `> [!warning]`, `> [!abstract]` callouts; tables; `$math$` and
  `$$display$$`; fenced code; ```mermaid diagrams; `==highlight==`.
- Attachments are `data:` URLs in `content`; skip them unless asked. Dates are `YYYY-MM-DD`.

## What a good note looks like

Lead with the conclusion. Cite every source note with a `[[link]]`. List the connections the owner
missed, the open questions as `- [ ]` tasks, and mark counter-arguments as yours. Say what you are
unsure of; never invent facts about their notes.
