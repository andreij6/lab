# What NotebookLM does, and how Notebooks could get there

Research note, 2026-10-11. Sources are third-party guides and video summaries from October 2026;
Google's own pages should be checked before promising any specific limit or price:
[12 powerful ways to use NotebookLM in 2026](https://nicolleweeks.substack.com/p/12-powerful-ways-to-use-notebooklm),
[What Is NotebookLM? Features and How to Use It in 2026](https://cyfuture.cloud/kb/ai/what-is-notebooklm-features-and-how-to-use-it-in-2026),
[NotebookLM guide](https://beginnersinai.org/notebooklm-guide/),
[NotebookLM Changed Completely (2026)](https://videohighlight.com/v/_uXnyhrqmsU),
[Every NotebookLM Feature Explained](https://www.chaindesk.ai/tools/youtube-summarizer/every-notebook-lm-feature-explained-in-one-video-uKPBIKF5FUI).

## What NotebookLM (Google's "notebook" product; "Gemini Notebook" is the same thing) is capable of

| Capability | What it does | Notes |
|---|---|---|
| **Sources** | Up to ~50 sources per notebook: PDFs, Google Docs/Slides/Sheets, websites, YouTube transcripts, audio files, pasted text. Everything the model says is grounded only in these. | Free tier ~50 sources, 500k words each (reported). |
| **Grounded chat with citations** | Ask questions; every answer cites the passages it came from, clickable back to the source. | The core feature; reviewers rate it above the audio/video outputs. |
| **Notebook Guide / AI overview** | On upload: a summary, suggested questions, FAQ, timeline, briefing doc, study guide. | Regenerated per notebook; one click each. |
| **Audio Overview** | Two AI hosts discuss the sources as a 10–20 min podcast ("Deep Dive"); "The Brief" is a one-voice 2-minute takeaway. Interactive mode lets you ask questions mid-episode on mobile. Focus can be customised. | ~3 per day free (reported). |
| **Video Overview** | Narrated explainer videos with visuals; "cinematic" 5–10 minute documentaries (March 2026, Ultra plan, reported). | |
| **Mind Maps** | A visual map of how the ideas and documents connect, generated from the sources. | Obsidian's graph is structural (links); this is semantic. |
| **Studio outputs** | Flashcards, quizzes, slide decks (PPTX / Google Slides), infographics in many styles, reports. | |
| **Save to notes** | Anything generated becomes a note in the notebook, linked back to its sources. | This is exactly our `Agents/` folder. |
| **Deep Research** | Web searches that supplement the sources, with citations for both. | |
| **Source discovery** | Suggests further sources for a topic. | |
| **Sharing** | Notebooks shared with viewers/editors; public notebooks with a link. | We share single notes; see README. |

## How that maps onto Notebooks

Notebooks already has the two halves NotebookLM's architecture rests on: a **source set the model
is grounded in** (the person's notes, with links and tags) and a **place for generated material
that stays distinguishable from the person's own writing** (`Agents/`, written only through agent
keys, drawn differently in the graph). Everything below is an agent task over the JSON API in
[`frontend/public/skill.md`](../frontend/public/skill.md), not a change to the canisters:

1. **AI overview per note or folder** → an agent writes `Agents/<name>/Overview of <X>.md` with a
   summary, `[[links]]` to each source and a `sources:` front-matter list. A "Summarise this"
   button in the note menu would hand the note path to a configured agent endpoint.
2. **Grounded Q&A with citations** → an agent answers in a note; citations are `[[Note#Heading]]`
   and `[[Note#^block]]` links, which already scroll to the passage.
3. **Study guide / FAQ / timeline / briefing** → templates for the agent, one note each.
4. **Mind map** → an agent writes a ```mermaid `mindmap` block, which already renders.
5. **Audio / video overviews** → outputs land as attachments (`data:` URLs, under 700 KB today;
   bigger files need chunked attachments, a canister change) or as links.
6. **Deep research** → the agent is the only part allowed to touch the web; it cites both.
7. **Distilling tools** on a selection → a right-click "Ask the agent about this" that posts the
   selection plus the note path to the agent and opens the resulting note.

Open questions before building: which model runs the agent (the user's own Claude Code / Codex
session via the skill today; a hosted worker later), where its key lives, and whether generated
notes should expire or be pinned.
