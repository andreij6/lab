# Other kinds of notes

The front matter `type:` decides how the app reads a note. Each shape below is what the app
parses; anything extra is kept as prose.

## Slides: `type: slides`

Slides are separated by lines holding only `---` (outside code fences). Present opens them full
screen.

```markdown
---
type: slides
---
# Title

A subtitle, the date

---

## One idea per slide

- A line
- Another
```

## Meeting: `type: meeting`

Properties `date: YYYY-MM-DD` and `attendees: [@ana, @ben]`; sections `## Agenda`, `## Notes`,
`## Decisions`, `## Actions`. Decisions become the decision log; Actions are `- [ ] @owner task
📅 date` lines the Work tab rolls up. "Follow-up" and "To board" read these sections by name.

## Project: `type: project`

Properties `status: active|paused|done` and `goal:`; a `## Milestones` section of `- [ ]` items.
The note marks its folder as a project: tasks in the folder count toward its progress bar.

## Person: `type: person`

Properties `role:` and `team:`; sections `## Context`, `## Last 1:1`, `## Open with them`. Every
`@name` in the space links to the person's note; the name is the file name.

## Decision records and proposals

No type. A `Decision:: text` line anywhere makes a dated entry in the decision log;
`status: proposed|accepted|superseded` in the front matter colours it; `supersedes: [[ADR 3]]`
draws the arrow. Proposals use `status: draft` and end with `Decision:: pending`.

## Properties the app reads anywhere

`source:` (a URL or `[[note]]`; listed under Study, cited by "Cite source"), `tags: [..]`,
`remind: YYYY-MM-DD HH:mm` (a notification), `aliases: [..]`, `date:`.

## Formats to leave to the app

These are JSON, not markdown; make them in the app (New menu) and read them with `/v1/read` if you
must, but do not write them by hand: `.sheet` (spreadsheets), `.dash` (dashboards), `.canvas`,
`.ipynb` (Jupyter), `.excalidraw.md` (drawings). To change a spreadsheet's figures, write a
markdown table in a note and ask the owner.

## Templates

`Templates/<name>.md` notes with `{{date}}`, `{{time}}`, `{{title}}` tokens are the owner's own
templates; read them before writing a note of that kind, and follow them.
