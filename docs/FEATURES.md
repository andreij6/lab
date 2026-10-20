# Agent Space: every feature

Markdown notes on the Internet Computer, in canisters you own. Each entry is one feature in a
sentence or three. Keyboard shortcuts use ⌘ on a Mac and Ctrl elsewhere.

## Notebooks and ownership

- **Activity grid.** The notebooks page ends with a GitHub-style grid of the last 53 weeks: one square per day, shaded by how many notes you created that day across all your notebooks, with the year's total and your current streak. Desktop only.
- **Agent Space: the front door.** Four steps on one page with a stepper on top. 1 Second brain: what a space is (memory, wallet, agent) in three cards. 2 Identity: sign in with Internet Identity, or a link to id.ai to make one. 3 Fuel: $5, $10 or $20 by card through CyclePay; the space is made with those cycles the moment they land (locally the registry fronts them). 4 Agent: issue the agent its key, pick its client (Claude Code, Codex, Antigravity, Cursor, any other) and copy the MCP setup or the whole setup prompt, then open the space. A signed-in identity that already owns a space goes straight into it; the old reverse-CAPTCHA gate and the in-space setup dialog are gone.
- **Agent Space: the grid.** Home is a 4×4 grid of tiles; tile 1, **Create Agent M&M**, makes the agent's money and memory in one notebook canister (deposit dialog, then spawn), the other 15 slots wait for future tiles. Initialized, the tile takes the accent outline and a panel opens beside the grid (below it on a phone) with the wallet's addresses, each with a copy button: **BTC** from the ckBTC minter, **ETH** from the subnet's threshold ECDSA key (`eth_address`, EIP-55 cased, derived once and kept), **ICP** the canister's ledger account, and the principal; then **Memory** with an Open memory link into the notebook. One notebook per agent: there is no notebook picker.
- **The agent's treasury.** A space is its agent's wallet: ICP and ck tokens on its ledger accounts, a ckBTC deposit address and a threshold-ECDSA Ethereum address. An agent key with **Spend** switched on (Manage → Agent) can read what the space holds (`POST /v1/balances`) and send it to any principal (`POST /v1/transfer`, logged for the owner); the ten-minute sweep into cycles only runs when the space is under 3 TC, so holdings stay put otherwise.
- **Cycles by card.** On mainnet the space spawns with no ICP deposit; the panel beside the grid takes $5, $10 or $20 by card through CyclePay's gateway (the one `icp cycles buy` uses): the order's payment page opens as a link and a QR code, the status is polled, and the gateway tops the canister up itself.
- **One canister per notebook.** Creating a notebook spawns its own canister with you and the registry as controllers; only you can read or write it, not even the registry can. A frozen notebook is flagged.
- **Manage in sections.** The Manage page keeps the cycles, files, storage and top-up totals on top and splits the rest into tabs: Cycles & money (top up through OISY, history), Notebook (export, import, restore, snapshots, account), Sharing (shares, publishing) and Agents (keys and the skill).
- **Cycles, shown and topped up.** Manage shows cycles left with a runway bar, files and bytes stored. ICP sent to the canister's own account becomes cycles automatically; a top-up opens your OISY wallet to approve the amount and converts it in one step; controllers can also use the printed `icp canister top-up` command.
- **OISY wallet for all payments.** Top-ups and the spawn price are approved inside the OISY wallet popup (ICRC-25/27/29/49 signer standards); the canister pulls the approved ICP, so no key or balance ever sits in the app. The wallet account used is remembered for display.
- **Fund it as you create it.** The new-notebook card takes a name and a description; Create notebook opens a dialog for the deposit that becomes its cycles: 1, 3 (the default), 5 or 10 ICP, or any other amount at or above the minimum. The minimum is what starting a notebook costs Lab (0.5 TC to create the canister plus its 1 TC grant) at the cycles minting canister's live ICP rate, rounded up to the next half ICP and never under 1 ICP. One approval in OISY covers the spawn price, if any, and the deposit; the registry spawns the canister, then mints the deposit into it. If the deposit fails the notebook is still created, and Manage can top it up.
- **Delete a notebook.** Manage → Notebook → Delete: you pick another of your notebooks for its remaining cycles (or Lab, if it is your only one) and type its name; the registry moves the cycles out, then stops and deletes the canister and forgets it. Nothing can bring it back, so the card offers a zip first.
- **Low-cycles alerts.** A red bar across the workspace, a warning on the notebook card and a toast on open when a notebook is running low.
- **Freezing and the urgent pop-up.** Every notebook is spawned with a 90-day freezing threshold: when its cycles no longer cover 90 days of idle burn the network freezes it, and a frozen canister keeps its data for those 90 days before it is deleted. The registry reads a notebook's health even while it is frozen, so the app shows an urgent pop-up with the days left and a top-up box whenever a notebook is frozen or within 30 days of freezing; the top-up goes through the registry, which revives a frozen notebook on the spot. Admins can change one notebook's threshold.
- **Pay through OISY, in anything.** Every payment (top-ups, spawn fees) goes through the OISY wallet with one button, in ICP, ckBTC, ckETH, ckUSDC or ckUSDT; bitcoin, ether, USDC and USDT held natively in OISY are converted to their ck version inside the wallet first. The registry turns whatever arrives into cycles at once (ICP through the minting canister, ck tokens swapped for ICP on ICPSwap first) and neither it nor the notebook ever keeps a token; anything that still lands on a notebook account is swept into cycles every ten minutes.
- **Paid spawns.** The site owner can set a spawn price in ICP; creating a notebook then approves it in OISY and pays, and collected fees are swept into the registry's cycles hourly. Price 0 keeps spawning free.
- **Snapshots.** Take a full canister snapshot from Manage before anything risky, list it, restore it (stop, load, start) or delete it. One snapshot is kept; a new one replaces it.
- **Download the notebook.** A zip of every note, folder and attachment, built in the browser with no library.
- **Restore from zip.** Puts a zip back: notes in the zip overwrite yours, notes missing from the zip are deleted, agent notes are kept.
- **Import from Obsidian.** Pick the Obsidian folder or a zip, or drop it on the file list. From the notebooks screen, Import from Obsidian makes a new notebook from them: it counts what will come across, asks for a name (the folder's, to start with), takes the deposit like Create notebook does, and only then creates the canister and copies the notes in (replacing the starter index.md and Projects/First project.md, and leaving example notes unticked in the setup tour). Markdown and text become notes; images, audio and PDFs under 700 KB come along as attachments; `.obsidian` is skipped; existing notes are kept unless you choose overwrite. Big imports go up in batches and load back in pages.

## Writing

- **Editor with live styling.** CodeMirror with markdown: headings, emphasis, code and quotes are styled as you type, `[[links]]`, `#tags` and `==highlights==` are marked, ⌘-click follows a link, Enter continues lists and quotes, Tab indents. Undo, redo and find/replace included.
- **Autocomplete.** `[[` lists notes, `#` lists tags, `> [!` lists callout types, `{{` lists template tokens.
- **Obsidian-style ribbon.** A vertical icon bar on the far left switches between Notes, Graph and Manage, with admin, help, appearance and sign-out at the bottom; the top bar shows where you are. Phones keep the segmented control and bottom bar.
- **Comment threads.** The right pane has Links and Comments tabs; the comments button in the note header (with a count) opens the Comments tab, which lists every thread on the open note with replies, a reply box per thread and a box for a new thread. Readers with comment permission see the same threads on the shared page. Notes with comments you have not opened yet carry a badge with the count in the file tree, and the comments button in the note header lights up; new comments from readers are picked up every minute.
- **Phone top bars.** On phones every page keeps just the brand, the section tabs and one ⋯ menu that holds search, the way back to the open notebook, the notebook list, admin, help, appearance and sign out. The admin page also shows "Back to" and "Your notebooks" buttons on desktop.
- **Collapsible panes.** The file pane and the right pane each fold away with a toolbar button, ⌘⇧[ and ⌘⇧], or the command palette; the choice is remembered. Phones keep their bottom bar instead.
- **Edit, split and reading views.** ⌘E cycles them per pane. Reading view renders everything below; on phones notes open in reading view.
- **Lists like Obsidian.** Bullet, numbered and task lists continue on Enter with numbers incrementing, an empty item ends the list, and task checkboxes in reading view flip the `[ ]` in the source.
- **Properties editor.** Front matter as a form above the note: add, rename and remove keys; `tags:` and `aliases:` feed the index.
- **Daily notes.** The calendar button or ⌘⇧D opens today's note in `Daily/`, created from `Templates/Daily.md` when that exists.
- **Templates.** Notes in `Templates/` can be used for new notes; `{{date}}`, `{{time}}`, `{{title}}` and `{{date:dddd, MMMM DD}}` are filled in.
- **Attachments from the camera or clipboard.** Paste or drop an image into the editor, or on a phone tap the camera button; it is stored as an attachment and embedded at the cursor.
- **Version history.** Every content change keeps the previous version, up to 20 per note. The history dialog shows a line diff against the current text and restores any version with one click.
- **Autosave.** A second after you stop typing, or ⌘S. The status bar shows unsaved, saving and saved.

## Obsidian Flavored Markdown

- **Wiki links.** `[[Note]]`, `[[Note|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]`; resolution by path or by name, case-insensitive, with front-matter aliases. Clicking an unresolved link offers to create the note. Renames rewrite links everywhere.
- **Embeds.** `![[Note]]`, `![[Note#Section]]`, `![[image.png|300]]`, audio, video, PDFs and Excalidraw drawings as SVG.
- **Callouts.** `> [!tip] Title` with all of Obsidian's types, icons and colours; `-` folds it.
- **Highlights, comments, block ids.** `==text==` shows as a highlight in both the editor and reading view; ⌘⇧H wraps or unwraps the selection. `%%hidden%%` comments and `^id` anchors that links can scroll to.
- **Math.** `$inline$` and `$$block$$` through KaTeX.
- **Code.** Fenced blocks are syntax-highlighted; ```mermaid blocks render as diagrams, with the library loaded on first use.
- **Footnotes, tables, strikethrough, task lists.** GFM extras all render.
- **Markdown links to notes.** `[text](Note.md)` resolves like a wiki link; `[text](#Heading)` scrolls.
- **Properties table.** Front matter renders as a small table in reading view.

## Studying

- **Spaced repetition.** Flashcard decks schedule each card with SM-2: rate a card Again, Hard, Good or Easy and it comes back in a day, six days, then ever longer. A deck opens on what is due today, "Study the whole deck" ignores the schedule, and the deck reports your accuracy. Schedules live in the notebook's settings, so they follow it between devices; decks shared with you keep your progress on your own device.
- **Study tab.** A ribbon section with the cards due today per deck, a Review button each, your quizzes, attempts people made on quizzes you shared, goals, glossary, sources and the Anki export; the ribbon icon carries the due count.
- **Cards from notes.** "Make flashcards" in a note's menu turns every `==highlight==` into a cloze card of its sentence, every `Term:: definition` into a card and every heading into a "what is" card, written as a deck next to the note. `{{answer}}` in any deck line is a cloze card.
- **Summaries, plain explanations, questions.** "Summarise", "Explain simply" and "Three questions" in a note's menu write a note under `Study/` from the headings and definitions. They are extracts until a language model is connected.
- **Study mode and focus timer.** The book button in a note's header shows one section at a time with Previous and Next, ending with an offer to make flashcards. The status bar has a 25/5-minute focus timer.
- **Glossary.** Every `Term:: definition` line across the notebook, listed in Study; in reading view the first mention of each term is underlined with the definition on hover.
- **Sources and citations.** `source:` in a note's properties; the Study tab lists every source with the notes that cite it, and "Cite source" adds a footnote (asking for the source first if the note has none).
- **PDF import.** A dropped or chosen PDF becomes one note per page under a folder named after it, with the file as an attachment when it fits.
- **Study groups.** On a shared note, people who can read it see who else is there right now, mark their progress (read, reviewing, known) and see the group's marks; the owner sees the marks in the links pane.
- **Teacher view.** A quiz or deck finished on a shared note reports the score to the owner; the Study tab lists attempts with who and when.
- **Daily review.** The notebooks page shows cards due today per notebook with a Review link, a "Resume where you left off" button, and the activity grid counts reviews as well as notes.
- **Goals.** Notes a week and cards a day, set in Study; progress bars there and the activity grid shades days against the daily goal.
- **Export to Anki.** Any deck exports as a tab-separated file Anki imports directly, from the deck's end screen or the Study tab.

## Working

- **Work tab.** A ribbon section with every open task, projects, meetings, decisions, people and reminders; the icon carries the overdue count.
- **Task roll-up.** Every `- [ ]` across the notebook grouped by note, overdue first, with `📅 2026-10-14` dates, `@name` owners (filter chips) and ⏫/🔼 priority; ticking a task edits the note.
- **Meeting notes.** `type: meeting` with date, attendees, Agenda, Notes, Decisions and Actions sections. "Follow-up" copies the decisions and actions for chat or opens a mail to the attendees; "To board" puts the actions on a kanban board as cards. Import an `.ics` invite to create the note in advance with its agenda.
- **Weekly review.** One button writes `Reviews/Week to <date>.md`: what you wrote and touched, what you decided, open and overdue actions.
- **Projects.** A `type: project` note (status, goal, Milestones) marks its folder; the Work tab shows a progress bar from the tasks inside it, and the notebooks page counts active projects.
- **Decisions and people.** `Decision:: …` lines and meeting decisions make a dated log; every `@name` renders as a chip in the editor and in reading view; clicking it opens the person's note or offers to create one, and the person's page lists every mention and their open tasks in the links pane. A `type: person` note holds role, team, last 1:1 and open items.
- **Templates.** Meeting, 1:1, decision record, one-pager, post-mortem, proposal, person and project are built in, alongside your own `Templates/` notes; dates and titles are filled in.
- **Export.** A note or a whole folder as Word (.docx) with headings, lists, tasks, tables, quotes and code; print or save as PDF with a clean print layout.
- **Web clipper and mail in.** An Inbox-scoped key powers a bookmarklet that saves any page (title, link, selection) to `Inbox/`, and `scripts/mail_in.py` files an email under `Inbox/Mail`.
- **Quick capture.** ⌘⇧N or the app shortcut opens a blank note in `Inbox/`.
- **Reminders.** `remind: 2026-10-14 09:00` fires a notification while the app is open and badges Work.
- **Tables.** Paste a spreadsheet selection into the editor and it becomes a markdown table; in reading view click a header to sort and double-click a cell to edit.

## Formal mathematics (Lean)

- **Lean notes.** A note with ```lean blocks shows a Formal card above its text: each theorem with its English docstring beside the Lean signature, its hypotheses, danger flags (`sorry`, `axiom`, `native_decide`, raised heartbeats…) and the prose step it is tagged to.
- **One statement, two renderings.** Prose embeds a theorem with `![[Lean note#thm:name]]`; the English (the docstring) and the Lean signature render from the Lean note itself, so the paper cannot say one thing while the code says another.
- **Step-to-lemma alignment.** End a prose step with `^step-3` and tag the lemma with `-- step: ^step-3`; the links pane shows backed steps, "prose only" steps with no lemma, "formal only" lemmas no step cites, and a coverage percentage.
- **Hypothesis ledger.** For every embedded theorem, hypotheses whose names or numbers the prose never mentions are listed, which is how a formalisation usually proves less than the paper claims.
- **Attestations.** A checker agent posts `check` pass/fail through the agent API (`scripts/lean_check.py` compiles each note with Lean and does this); a reader or comparator agent posts `compare` same/weaker/stronger/different from the links pane. Every attestation is bound to the hash of the prose and of the Lean, so an edit to either turns the badge to "needs re-check" or "needs review" until someone attests again.
- **Claim badges.** Each theorem embed carries a badge: verified (checked and compared, both fresh), Lean checked but not compared, compared but unchecked, English ≠ Lean, Lean fails, stale, or unverified.

## Drawings and boards

- **Excalidraw.** New drawings open in the real Excalidraw editor, autosave in the Obsidian plugin's `.excalidraw.md` format (plain and compressed are read), and embed in notes as SVG. The editor and its fonts load only when needed.
- **Kanban boards.** A note with `kanban-plugin: board` in its front matter opens as a board: lanes are `## headings`, cards are task items, so the same file works in the Obsidian Kanban plugin. Drag cards between lanes, tick them done, double-click to edit, add lanes, and mark a lane as the done lane; ⌘E shows the markdown source.
- **Flashcard decks.** A note with `quiz: cards` in its front matter opens as a deck: `Front::Back` on a line, or the front, a `?` line, then the back, with blank lines between cards (the Obsidian Spaced Repetition plugin's syntax). Tap a card to flip it, mark it "Got it" or "Again", shuffle or restart; the deck reports how you did.
- **Multiple-choice quizzes.** A note with `quiz: choice` opens as a quiz: a heading per question, task items as options with `[x]` on the right ones (several allowed), an optional `>` quote as the explanation. Pick, Check, see what was right and why, then Next; the quiz scores you at the end. ⌘E shows the source for both.
- **Jupyter notebooks.** An `.ipynb` file opens as cells: markdown cells render (double-click to edit), code cells run Python in the browser through Pyodide, loaded in a worker on the first run (about 10 MB from the jsDelivr CDN, then cached). NumPy, pandas, matplotlib and the other Pyodide packages install on first import; printed text, results, errors, pandas tables and matplotlib figures are stored as outputs in the standard nbformat JSON, so the file still opens in JupyterLab. Shift+Enter runs a cell, Run all runs them in order, Restart clears the interpreter; ⌘E shows the JSON. Phones are read-only.
- **Canvas viewer.** Obsidian `.canvas` boards open read-only: text, file, link and group nodes with edges and labels, pan with drag, zoom with the wheel; a JSON view lets you edit the source.

## Finding things

- **Search.** Case-insensitive over names and content with `tag:`, `path:`, `file:`, `-not` and `"phrases"`. Notebooks over 1,500 notes search in the canister instead.
- **Quick switcher.** ⌘K, ⌘O or ⌘P: fuzzy open by name, create by typing a new name, recent notes when empty, ⌘↵ for a new tab.
- **Command palette.** ⌘⇧P, or `>` in the switcher: every action with its shortcut.
- **Tags.** A tag pane with counts; click to filter the file list; nested tags like `#a/b`.
- **Pinned and recent.** Pin up to 7 notes or folders to the top of the file pane (the editor bar, or right-click → Pin to top; kept in the canister and following renames). A pinned folder opens in the tree when clicked. Recent notes lead the switcher.
- **Backlinks with context.** The line that contains each backlink, outgoing links, unresolved links and an outline of the open note's headings in the links pane.
- **Knowledge graph.** Force-directed graph of every note and link: hover lights up a neighbourhood, drag pins, wheel zooms, click opens; colour by folder or first tag, hide attachments, show only orphans, search within the graph, show unresolved links as ghost nodes. A local graph of the open note (depth 1 to 3) sits in the links pane.

## Organising

- **Folders.** Real folders, empty ones included, with counts, icons and indent guides.
- **Right-click menus.** On files, folders and empty space: new note, new drawing, new folder, new from template, rename, move, copy link, pin to top, history, share, delete. Touch screens get a ⋯ button per row.
- **Drag and drop.** Drag notes or folders onto folders or onto the root; links are rewritten on the way.
- **Tabs and panes.** Several notes open as tabs; drag to reorder, drop on another pane's bar to move, drop on a pane's right edge to split; ⌘\ splits, ⌘W closes, ⌘-click opens in a new tab. Layout is remembered per notebook.
- **Mobile.** Under 760px the workspace shows one pane at a time with a bottom bar (Files, Note, Links, Find).
- **Offline.** The app installs as a PWA, the last opened notebook is cached in the browser, and edits made offline queue and sync when you are back online.

## Appearance

- **Themes on Obsidian's variables.** Velocity (default), Nord, Gruvbox (yellow and orange) and Red Graphite (red), each in dark and light; or paste the variable block of any Obsidian theme as custom CSS.

## Sharing, publishing and comments

- **Team notebooks.** Share the whole notebook with people as editors and it is a team's: on the shared page they get **New note**, edit in place, **Summarise the meeting with AI** on meeting notes, and anyone signed in can **Chip in cycles** (OISY → the registry mints the ICP into the notebook's cycles; the notebook tells the registry who may edit it, so team members can top it up without being the owner). The home page lists notebooks shared with you that you have opened, under Shared with you (kept in this browser). Agent keys are per notebook, so a team's agents work for the team.

- **Share a note with permissions.** Only me, anyone with the link, or specific people. A link allows viewing, viewing and commenting, or viewing, commenting and editing (the last two need a sign-in; the link alone never lets an anonymous visitor change anything). Named people are viewers (read only), commenters, or editors, each list by principal. Public notes are also served raw at `/s/<path>`.
- **Share a folder or the whole notebook.** The same choices for a folder or everything, plus editor principals who may change the covered notes (never under `Agents/`). Sharees browse a tree and open notes; editors get the editor with autosave.
- **Comments.** Signed-in readers of a shared note leave comments; the owner sees them in the links pane and can delete any.
- **Publish a site.** Publish a folder or the whole notebook as a public website served by the canister at `/p/`: a page per note with navigation, backlinks and a graph on the index page. Unpublish any time.

## Spreadsheets

A `.sheet` note is a workbook (New spreadsheet from the palette, a folder menu or the pane menu). Each note holds several sheets with tabs along the top (add, rename by double-click, delete). Cells take values or formulas starting with `=`: arithmetic, comparisons, `&`, ranges, cross-sheet references like `Sales!B2`, and SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, COUNTA, COUNTIF, SUMIF, AVERAGEIF (criteria like `">=10"`, `"<>x"`, `"a*"`), VLOOKUP, INDEX, MATCH, IFERROR, IF, AND, OR, NOT, ABS, ROUND, FLOOR, CEILING, SQRT, MOD, POWER, LN, LOG, EXP, the time-value-of-money functions FV, PV, PMT and NPER (Excel's signs: money paid out is negative), LEN, UPPER, LOWER, TRIM, CONCAT, PI, TODAY. Typed values like `4%` and `$1,200` count as numbers and keep showing as typed. Paste a block copied from Excel, Sheets or a CSV into a cell and it fills down and across from there. Errors show as `#DIV/0!`, `#REF!`, `#NAME?`, `#CYCLE!`. Enter moves down, Tab right, Escape cancels; everything recomputes as you type. Import a CSV into a new sheet with the CSV button, export the current sheet as CSV, and add bar, line, area or pie charts drawn from a label column and one or more value columns (row 1 is the header), or from ranges like `A15:A17` with the header just above: several columns make grouped bars or several lines, and the chart editor (with a live preview) sets the title, palette or custom colours, legend placement, value labels, stacking, smoothing and axis titles; charts live under the grid, update with the data, and can be edited or removed. Sheets are renamed by clicking the active tab; formulas that point at the old name follow. The JSON source is one keystroke away. In a Jupyter note, `sheet("Name")` or `sheet("Name", "Tab")` returns the computed values as a pandas DataFrame. Engine and tests: `frontend/src/sheet.ts`.

## Dashboards

A `.dash` note is a grid of tiles from other notes: a chart from a spreadsheet note, one cell's value as a big number, or the image or table output of a Python notebook cell. Add tiles with the Tile button, reorder them, make one full width, and remove them. Every tile shows its source note's name as a link that opens it. Tiles read their sources live, so a change in the sheet or a re-run cell shows up at once.

## Features and onboarding

- **Pick your tools.** Manage → Notebook → Features turns tabs on or off per notebook: Graph, Study, Work, Organize, Research, Writing, Care, Software and Trips. Notes and Manage are always there. Turning a tab off only hides it.
- **A five-step tour** the first time a notebook opens: notes and links, finding and connecting, choosing tools (with presets: Student, Researcher, Writer, Caregiver, Developer, Hiker, Everything), and a finish step that can add a starter note for each tool picked. Replay it from the Features card.
- **Example notes.** The last onboarding step can add examples for the tools picked: `Examples/Start here.md` links one working example of every note type (note, slides, kanban board, spreadsheet with a chart, dashboard, canvas, drawing, Python notebook, and with Study or Work a flashcard deck, quiz and meeting note), each opening with a How to make one box, plus what each tool's tab reads (an applications board, a source and a thesis, a scene, a care log, a decision record and a runbook, a trip with its gear list, …). Replaying the tour adds only the ones that are missing.

## Research

- **Sources** from a BibTeX file, pasted BibTeX, or a DOI looked up on Crossref, each a note in `Sources/` with its citation data and literature-matrix fields (method, sample, finding, limitation, strength).
- **Citations.** `[@key]` or `[@key, p. 4]` anywhere renders as (Smith & Lee, 2020) in APA 7 or (Smith and Lee 2020) in Chicago author-date, linked to the source. Keys with no source are flagged.
- **Literature matrix.** Every source in a table, editable in place.
- **Claim tracker.** Lines marked `Claim::` in a draft show as supported, weak (backed only by sources marked weak) or missing evidence.
- **Thesis compiler.** A `type: thesis` note lists chapters as `1. [[Chapter]]`. Compiling joins them in order, numbers figures, formats citations and appends the reference list, then opens, prints, or downloads it as Word or Markdown.

## Writing

- **Manuscript.** Scenes (`type: scene` with `chapter:` and `order:`) grouped by chapter with word counts. Drag a scene to reorder or move it between chapters, and track today's words against a daily goal.
- **Story bible.** Characters, places and objects with their facts.
- **Continuity checker.** Flags scenes that describe a character's eyes, hair or age differently from the bible.
- **Timeline.** Events from scene `date:` and `date::` lines; any calendar sorts by the numbers in it ("Year 1203, day 4").
- **Beta readers.** Share the manuscript folder with comment rights; their comments on scenes collect in one place.

## Care

Personal notes for keeping track and preparing conversations with clinicians, not medical records or advice.

- **Log.** Log a dose or a symptom in a few taps; the log sheet charts average severity by day.
- **Appointments and questions.** Write `Q::` in any note as questions come up. Prepare the summary builds one page with medicines taken, symptoms with average and worst severity, and the open questions since the last appointment.
- **Care team.** Share the Care folder read-only, 

## Career

For working professionals looking for a new job; turn it on in Manage → Notebook → Features or pick the Job seeker preset.

- **Applications board.** `Career/Applications.md` is a Kanban board with Saved, Applied, Screen, Interview, Offer and Closed lanes. Adding an application makes its card and a company dossier note; the card's follow-up date (ten days out) shows in Work like any task.
- **Waiting for a reply.** Applications 10+ days in Applied with no later follow-up are listed with Followed up (check again in a week) and Heard back (move to Screen).
- **Weekly review.** Sent this week and in all, how many heard back, how many reached an interview, offers, and a bar per week for the last eight.
- **Experience bank and résumés.** One note per role or accomplishment (`type: experience`, role, company, dates, skills, bullets). A résumé note lists the ones to include; compiling expands them into one document with a Skills line, to download as Word or Markdown or print to PDF.
- **Interview stories.** Each story is a flashcard: the question on the front, situation, task, action and result on the back, in `Career/Interview stories.md`; Study schedules them like any deck.
- **Networking follow-ups.** Person notes with `last_contacted`, `next_follow_up` and `referral_for`; someone comes due on their follow-up date or after a month of quiet, and Contacted today pushes the next follow-up two weeks out.

## Crypto

For people who hold or trade BTC, ETH, SOL, HYPE and the rest; turn it on in Manage → Notebook → Features or pick the Trader preset.

- **Live prices.** The notebook asks ICP's exchange rate canister (`uf6dk-hyaaa-aaaaq-qaaaq-cai`) for the last minute's dollar price of each coin on the watchlist, plus any coin with an open trade or a live thesis, up to eight. It pays up to 1B cycles a coin per refresh (a fraction of a cent) and prices are reused for five minutes. Coins the exchanges it reads do not list show as "not listed". Locally `canisters/xrc-dev` stands in with made-up prices.
- **Prices in notes.** A `prices` code block (`BTC ETH SOL`) shows a live price chip per coin in reading view.
- **Trade journal.** One note per trade in `Crypto/Trades/` with `type: trade`, coin, side, size, entry, stop, target, opened, exit, closed, fees and an optional thesis link as properties, and Why, What happened and Lesson in the body. Log a trade and Close fill in today's live price when the price is left empty.
- **Journal numbers.** Closed trades, win rate, realized profit and loss, unrealized on open trades at live prices, average win and loss, average R (profit over what the stop risked), a profit-and-loss bar per week for the last eight, and totals per coin.
- **Theses.** `type: crypto-thesis` notes (not `type: thesis`, which is Research's): what you believe, `Claim::` reasons that Research checks for sources, what would prove you wrong, and the price on the day it was written; the tab shows how far it has moved. Each has a review task that shows in Work; Still holds records the price and schedules the next review in 30 days, Broke marks it `status: broken`.

## Money

Turn it on in Manage → Notebook → Features, or pick the Trader or Household preset.

- **Budget.** `Money/Budget.sheet`: planned and spent per category, what is left, and a Total row the tab reads, with a progress bar. New month saves a copy to `Money/Budgets/` and clears the spending.
- **Subscriptions.** One `type: subscription` note each with cost, how often it renews and the next date; the tab adds them up per month and per year. A keep-or-cancel task shows in Work on the renewal date; Renewed moves the date and the task one period on, Cancelled closes both.
- **Budgets and FIRE.** Spreadsheet templates, made from the Money tab: a 50/30/20 budget (each line tagged Need, Want or Save against 50%, 30% and 20% of take-home pay), a zero-based budget (income assigned until Left to assign is 0), a FIRE calculator (FIRE number = spending ÷ withdrawal rate, years to reach it with `NPER`, FIRE age, the yearly saving that gets there in 10 years, a 50-year projection chart) and a Coast FIRE calculator (the amount that grows to the FIRE number by retirement with no more saving, whether you are there, and the age saving can stop). The tab shows the FIRE and Coast FIRE results.
- **Net worth.** `Money/Net worth.md` is a table of accounts: dollars, debts as negatives, or coin amounts like `0.05 BTC` priced live through the Crypto kit's prices. Record today adds the total to its `## History`, which the tab draws as a line.

## Creator

Turn it on in Features, or pick the Creator preset.

- **Calendar.** `Creator/Calendar.md` is a Kanban board with Ideas, Drafting, Scheduled and Posted lanes. Scheduling gives a card a 📅 date, so it shows in Work.
- **Drafts and threads.** A `type: post` note: everything above the first `##` heading is posted. A line with only `---` starts the next post; anything longer than 280 characters is split at sentences, then words, and numbered 1/3, 2/3, 3/3. Copy shows each post with its own copy button and count. Characters are counted as code points; X counts links as 23 and some emoji as 2.
- **Results.** Log impressions, likes, reposts and replies once a post is out; the tab shows reach, the average engagement rate and the best post.

## Fitness

Turn it on in Features, or pick the Athlete preset.

- **Workouts.** One `type: workout` note each, with date, kind, minutes and `distance_km`. Sets are lines like `- Squat: 100 x 5, 105 x 3` (each a set) or `- Squat: 3x5 @ 100`; bodyweight is `@ bw`.
- **Records and progress.** The best set per lift by estimated one-rep max (Epley), a PR badge on the workout that set it, and a line per lift over time.
- **Weekly totals.** Sessions, kilometres and weight lifted per week, with a bar for each of the last eight.
- **Runs from GPX.** Import a GPX file and the workout carries the route map from the Trips kit; its length is the distance, and minutes give the pace.

## Home

Turn it on in Features, or pick the Household preset.

- **Upkeep.** One `type: upkeep` note per job that comes back (every 3 months, 6 months, a year, ...) with how to do it. Its task shows in Work; Done records the day and moves the task to the next date. Add common jobs starts with smoke alarms, the furnace filter, gutters, the water heater and fridge coils.
- **Things in the house.** `type: item` notes with room, brand, model, bought, value and warranty end. The tab shows the inventory by room with values, for insurance, and warranties ending within 60 days; a task a month before the end shows in Work.
- **Manuals.** A PDF link inside `![[ ]]` in an item note shows the manual right there, fetched by the notebook.

## Documents from the web

- **PDF embeds.** `![[https://….pdf]]` or `![title](https://….pdf)` (arXiv `/pdf/` links too) shows the pages in the note. The browser fetches it when the site allows; otherwise the notebook does, over HTTPS, following up to three redirects, up to 1.9 MB, for about 0.02 TC of its cycles on mainnet (outcalls are priced by the 1.9 MB response cap, not the file size). Fetched PDFs stay on this device, so they open instantly and offline afterwards. The first three pages show; Show all draws the rest.
- **Save a copy.** Keeps a PDF of up to 700 KB in the notebook next to the note, with one searchable note per page, and points the embed at the copy. PDFs already in the notebook (`![[paper.pdf]]`) show the same way. In community snapshots an embed shows only as its title.

## Software

- **Decision records.** ADR-0001 onwards with status (proposed, accepted, superseded, deprecated, rejected), supersedes links that mark the old one superseded, and a small graph of what replaced what.
- **Runbooks** with Check, Fix, Verify and Escalate sections; post-mortems that link a runbook appear under it.
- **Changelog.** Notes tagged `#changelog` or `type: change` with version, date and kind build a Keep a Changelog page, published with a public link.
- **Code blocks.** Every code block in a note gets Copy; Python blocks also get Run, using the same in-browser Python as Jupyter notes.

## Organize

The Organize tab is for people with a system.

- **Saved searches as live views.** Queries such as `tag:#client status:open modified:<7d`, `folder:Projects -tag:done`, `priority:>2`, `has:due` or `"a phrase"` run as you type. Save them and they appear in the file pane with a live count, and can be pinned to a dashboard as a tile.
- **Typed properties.** Search results show as a table of every front matter property, each typed from its values (date, number, yes/no, people, choice, list, text). Sort by any column, edit cells in place, or select rows and set a property on all of them.
- **Inbox triage.** Notes in `Inbox/`, tagged `#inbox` or quick captures form a queue. One key per note: F files it into a folder, T tags it, L links it to a project (both ways), A archives it, N skips.
- **Periodic notes.** This week, month and quarter in `Periodic/`, each rolling up the notes created and changed, tasks done and still open, and `Decision::` lines in that period. Months link their weeks, quarters their months. Rebuild refreshes the rollup and keeps your reflection.
- **Rules.** "When a note gets #meeting, apply the Meeting template, move it to Meetings, and add it to this week's note." A rule acts once per note. Done kanban cards are stamped with the date and move to an Archive lane after a set number of days. Rules run when notes are saved in a browser, not on the canister.
- **Tidy up.** Broken links (create the note), orphans (link from the index or archive), duplicate titles (rename), empty folders (delete) and active projects untouched for 30 days (mark paused), each with a one-click fix.
- **Refactor.** Rename a tag or a property everywhere, split a note at its `##` headings into linked notes, or merge one note into another with its links pointed at the one you keep.
- **Resurface.** Old notes come back one at a time to be kept (shown again later, twice as late each time), edited, pinned or archived.
- **Decay.** Notes untouched for a set number of days (180 by default, 0 turns it off) fade in the file tree and can be hidden, unless pinned to the top or marked `pinned: true`. Everything in `Archive/` is faded.

## Trips

The Trips tab is for deep wilderness trips. A trip is a folder under `Trips/`.

- **Trip plan.** A printable plan: route, a day-by-day table of distance, ascent, camps and water, water sources, bail-out points, permits, and an emergency sheet.
- **Gear list.** A spreadsheet of items with weight, quantity, worn and consumable flags. A summary sheet gives weight by category with a pie chart, and total, worn, consumable and base weight in grams and pounds. New lists can copy an earlier one, and Compare builds a dashboard of every list's base weight.
- **Food planner.** Items per day with grams and calories, calories per ounce, daily totals against a target with LOW flags, and a chart.
- **Water and resupply ledger.** Sources by mile, the distance to the next one and the litres to carry at a rate you set.
- **Routes from GPX.** A GPX file becomes a route note: a map drawn without tiles (so it works offline), an elevation profile, distance and climbing, and a heading per waypoint, so `[[Route#Waypoint: Lower Falls]]` links work.
- **Field journal.** One tap makes a timestamped entry with your GPS position, which works without signal. Photos come from the camera button, and entries show as a timeline on the trip.
- **Post-trip review.** What to leave at home, what was missing and what broke. "Apply review to gear" adds and removes the items it lists in a gear list.
- **Skills decks.** Flashcard decks for knots, a wilderness first-aid refresher, navigation, Leave No Trace and plants to avoid, studied with the spaced repetition in Study. The first-aid deck is a refresher, not training.
- **Offline.** "Keep offline" on the notebooks page downloads every notebook to the device. Notes can be created and edited without signal and sync when back in range. If a note was also changed elsewhere, both versions are shown side by side to keep mine, theirs or both.

## Agents

- **Agent keys and the locked folder.** Issue a key per agent in Manage; agents read every note over a JSON API and write only under `Agents/`, where people can read, link and delete but not edit. Agent notes carry the agent's name and draw as green diamonds in the graph.
- **Skills and a setup prompt.** Manage → Agent (keys, the MCP server with a setup per client: Claude Code, Codex, Antigravity, Cursor or any other, and the prompt) shows a prompt with the space's URL and key filled in: pasted into Claude Code, Codex or any agent, it downloads the skill files from `/skill/` (an index plus one file each for notes, flashcards, quizzes, kanban boards, other note types, the community, the inbox, problems, money and icp-cli; each under 500 words) and proves the setup with a hello in chat, a first note and a board post. Manage → Agent issues, scopes and revokes keys.
- **An MCP server per space.** `POST /mcp` on the space canister speaks MCP over Streamable HTTP with plain JSON answers (no event stream), the agent key in the Authorization header: every `/v1` route is a tool of the same name with a JSON schema and its cost in the description, and the skill files are resources (`skill://flashcards`) with the space filled in. Manage → Agent shows the setup for each client; the setup prompt connects the server first, and installs the format files only for a client that does not read resources on its own.
- **Prompts.** Manage → Prompts is a library of prompts to paste into a connected agent (weekly report, flashcards from a note, a quiz from a folder, rewrite the index, tidy up, meeting notes to a board, fuel watch, standup), with the space filled in.

## Trying Lab before paying

- **The browser sandbox.** "Try in browser — free" on the landing page (and a card on the notebooks list) opens a notebook that lives in this browser only (`local-sandbox`, in localStorage): the example notes for every kit, the editor, graph, Python, sheets, flashcards, all working, nothing on-chain. A bar above it offers **Mint to on-chain canister**: sign in, spawn a notebook the usual way, and every sandbox note is copied in. The sandbox's canister calls that need a real canister answer "mint first".
- **Personas on the landing page.** Six tabs (Obsidian notes, AI agents, Python and sheets, research and formal maths, study, the kits) each with a line, a code sample and a "Try … in browser" button that opens the sandbox on that note. The sign-in button says "Sign in with Internet Identity" everywhere.
- **Clone from a shared note.** Every shared note (`#/shared/…`) carries a bar: **Clone to my Lab** copies it into one of your notebooks under `Cloned/` (or into the sandbox when signed out), and **Try Lab in browser**. A shared flashcard deck or quiz offers the clone at the end of a run. Published sites (`/p/`) link back to Lab in their footer.
- **Thesis card.** In Crypto, a thesis has a **Thesis card**: the asset, the claim, the price when written, the live price from the exchange-rate canister and the move, with Copy (markdown).

## Admin numbers

The admin page counts people, notebooks, notes and files, and how many people and notebooks were active in the last 30 days (a notebook changed). The registry asks every notebook for its counts (`usage`), 50 at a time, and keeps the answer for ten minutes; Count again refreshes it.

## Help

- **Working indicator.** Every call that changes something on a canister (paying, spawning a notebook, saving) shows a progress bar along the top and a labelled pill ("Saving…") until it finishes; reads stay silent unless they drag on past a second. The wrapper lives around the registry and notebook actors, so new features get it for free; `scripts/queries.py` regenerates the list of read-only methods from the Candid files.
- **On a phone.** The ⋯ button in the top bar opens a full-screen list of every route: your notebooks, the open notebook and its Graph, Study, Work and Manage views, and Admin, with the current one marked; search, help, appearance and sign-out sit below. The status bar stays pinned above the bottom tabs, and the graph fills the screen and centres itself.
- **Help and support.** The ? button opens a form with a switch between "Report a problem" and "Suggest an idea"; both take a title and detail, and where you were is attached. Reports and ideas share one queue: yours show their kind, status and the admin's answer, and the Admin page filters by bugs or ideas.
- **Admin queue.** Admins (registry controllers plus added principals) see every report, filter by status, read the detail and context, leave a note and set Open, In progress, Done or Won't fix.
