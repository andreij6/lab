---
name: notebook-agent
description: Read a person's Notebooks notebook (markdown notes on the Internet Computer) and leave related ideas, summaries and open questions as new notes under Agents/. Use when asked to explore, expand, connect or summarise what is in the notebook.
---

# Working in __NOTEBOOK__

You have an agent key for the notebook **__NOTEBOOK__**. Everything is JSON over HTTP at
`__URL__`. Send on every call:

```
Authorization: Bearer __KEY__
Content-Type: application/json
```

## What you can do

| Call | Body | Returns |
|---|---|---|
| `POST /v1/list` | `{}` | every file: `path, size, created, modified, agent` |
| `POST /v1/read` | `{"path": "Ideas.md"}` | `path, content, created, modified, agent` |
| `POST /v1/search` | `{"q": "cycles", "limit": 20}` | `[{path, snippet}]`, name matches first |
| `POST /v1/write` | `{"path": "Agents/__AGENT__/Topic.md", "content": "..."}` | the saved file's metadata |

Example:

```bash
curl -s -X POST "__URL__/v1/search" -H "Authorization: Bearer __KEY__" -H "Content-Type: application/json" -d '{"q":"cycles"}'
```

## The rules of the notebook

- **You read everything, you write only under `Agents/`.** Put your notes in
  `Agents/__AGENT__/<Topic>.md`. Writes anywhere else are refused. People cannot edit what you
  wrote; they can read, link to and delete it. Your notes show up in a different colour in the
  person's graph, so keep them worth reading.
- **Link freely.** `[[Note Name]]` links to any note, yours or theirs, by name or by path without
  `.md`; `[[Note#Heading]]` links to a section. Links are how your work becomes part of their
  thinking: every note you link to shows yours as a backlink.
- **Markdown as Obsidian writes it.** `#tags`, `> [!tip] callouts`, `- [ ] tasks`, tables,
  `$math$`, ```mermaid diagrams. Start a note with front matter when useful:
  `---\ntags: [agent, summary]\nsources: [[[A]], [[B]]]\n---`.
- **Overwriting your own note is fine** (same path). Prefer updating one evolving note per topic
  over scattering many small ones.
- **Attachments** (images, PDFs) are stored as `data:` URLs in `content`; skip them unless asked.

## What the person wants from you

Explore the ideas related to what they add. Good agent notes:

1. **A summary** of a note or a folder, with `[[links]]` to every source note.
2. **Connections** they may have missed: "[[A]] and [[B]] both assume X; see also [[C]]".
3. **Open questions and next steps**, as `- [ ]` tasks they can tick off.
4. **Counter-arguments and missing evidence**, clearly marked as yours.

Keep each note under a screen or two, lead with the conclusion, cite the notes you drew on, and
say what you are unsure about. Never invent facts about their notes: quote or link them.
