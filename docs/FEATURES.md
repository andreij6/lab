# Lab: every feature

Markdown notes on the Internet Computer, in canisters you own. Each entry is one feature in a
sentence or three. Keyboard shortcuts use ⌘ on a Mac and Ctrl elsewhere.

## Notebooks and ownership

- **Activity grid.** The notebooks page ends with a GitHub-style grid of the last 53 weeks: one square per day, shaded by how many notes you created that day across all your notebooks, with the year's total and your current streak. Desktop only.
- **One canister per notebook.** Creating a notebook spawns its own canister with you and the registry as controllers; only you can read or write it, not even the registry can. Each notebook's card shows an emoji icon, its name and a one-line description; the icon is picked from the name (and kept unique across your notebooks) until you set one in Manage → Notebook, and a frozen notebook is flagged on its card.
- **Internet Identity sign-in.** No email or password; your principal is your account. Locally a browser-held dev key stands in, with `?ii` to use the local Internet Identity.
- **Manage in sections.** The Manage page keeps the cycles, files, storage and top-up totals on top and splits the rest into tabs: Cycles & money (top up through OISY, history), Notebook (export, import, restore, snapshots, account), Sharing (shares, publishing), Agents (keys and the skill), and Market (attestation, listing).
- **Cycles, shown and topped up.** Manage shows cycles left with a runway bar, files and bytes stored. ICP sent to the canister's own account becomes cycles automatically; a top-up opens your OISY wallet to approve the amount and converts it in one step; controllers can also use the printed `icp canister top-up` command.
- **OISY wallet for all payments.** Top-ups and the spawn price are approved inside the OISY wallet popup (ICRC-25/27/29/49 signer standards); the canister pulls the approved ICP, so no key or balance ever sits in the app. The wallet account used is remembered for display.
- **Automatic top-up.** Set a threshold and an amount; when cycles fall under the threshold the canister pulls ICP from the OISY allowance you approved once and converts it. The paying account, last run and result are shown.
- **Low-cycles alerts.** A red bar across the workspace, a warning on the notebook card and a toast on open when a notebook is running low.
- **Freezing and the urgent pop-up.** Every notebook is spawned with a 90-day freezing threshold: when its cycles no longer cover 90 days of idle burn the network freezes it, and a frozen canister keeps its data for those 90 days before it is deleted. The registry reads a notebook's health even while it is frozen, so the app shows an urgent pop-up with the days left and a top-up box whenever a notebook is frozen or within 30 days of freezing; the top-up goes through the registry, which revives a frozen notebook on the spot. Admins can change one notebook's threshold.
- **Pay through OISY, in anything.** Every payment (top-ups, notebook purchases, spawn fees) goes through the OISY wallet with one button, in ICP, ckBTC, ckETH, ckUSDC or ckUSDT; bitcoin, ether, USDC and USDT held natively in OISY are converted to their ck version inside the wallet first. The registry turns whatever arrives into cycles at once (ICP through the minting canister, ck tokens swapped for ICP on ICPSwap first) and neither it nor the notebook ever keeps a token; anything that still lands on a notebook account is swept into cycles every ten minutes.
- **Paid spawns.** The site owner can set a spawn price in ICP; creating a notebook then approves it in OISY and pays, and collected fees are swept into the registry's cycles hourly. Price 0 keeps spawning free.
- **Snapshots.** Take a full canister snapshot from Manage before anything risky, list it, restore it (stop, load, start) or delete it. One snapshot is kept; a new one replaces it.
- **Download the notebook.** A zip of every note, folder and attachment, built in the browser with no library.
- **Restore from zip.** Puts a zip back: notes in the zip overwrite yours, notes missing from the zip are deleted, agent notes are kept.
- **Import an Obsidian vault.** Pick the vault folder or a zip, or drop it on the file list. Markdown and text become notes; images, audio and PDFs under 700 KB come along as attachments; `.obsidian` is skipped; existing notes are kept unless you choose overwrite. Big vaults import in batches and load back in pages.

## Writing

- **Editor with live styling.** CodeMirror with markdown: headings, emphasis, code and quotes are styled as you type, `[[links]]`, `#tags` and `==highlights==` are marked, ⌘-click follows a link, Enter continues lists and quotes, Tab indents. Undo, redo and find/replace included.
- **Autocomplete.** `[[` lists notes, `#` lists tags, `> [!` lists callout types, `{{` lists template tokens.
- **Obsidian-style ribbon.** A vertical icon bar on the far left switches between Notes, Chat, Graph and Manage, with the market, admin, help, appearance and sign-out at the bottom; the top bar shows where you are. Phones keep the segmented control and bottom bar.
- **Comment threads.** The right pane has Links and Comments tabs; the comments button in the note header (with a count) opens the Comments tab, which lists every thread on the open note with replies, a reply box per thread and a box for a new thread. Readers with comment permission see the same threads on the shared page. Notes with comments you have not opened yet carry a badge with the count in the file tree, and the comments button in the note header lights up; new comments from readers are picked up every minute.
- **Phone top bars.** On phones every page keeps just the brand, the section tabs and one ⋯ menu that holds search, the way back to the open notebook, the notebook list, the market, admin, help, appearance and sign out. The market and admin pages also show "Back to" and "Your notebooks" buttons on desktop.
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
- **Decks on the market.** Listings show how many decks and quizzes a notebook has and the market can be filtered to notebooks that contain some. A buyer's review schedule starts fresh.
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
- **Bookmarks and recent.** Star a note to pin it above the file tree (kept in the canister); recent notes lead the switcher.
- **Backlinks with context.** The line that contains each backlink, outgoing links, unresolved links and an outline of the open note's headings in the links pane.
- **Chat with your notes.** A Chat tab where you ask in plain language. Step 1, in your browser: a fast "System 1" pass scores every note in the ticked folders on title, tags and word overlap and keeps the best six. Step 2, on chain: their excerpts (cut to fit the LLM canister's 10 KiB limit) go to the notebook's `ask` method, which calls the Internet Computer's LLM canister (`w36hm-eqaaa-aaaal-qr76a-cai`) and asks it to answer from them first, citing each claim as [1], [2]; what the notes do not cover it answers from its own knowledge under a "Beyond your notes" label, and when no note matches it answers from its own knowledge alone. "Save as note" under any answer writes it to a folder you pick, citations turned into wiki links, a Sources list and front matter recording the question, model and date. Citations render as numbered chips that open the note. The chat uses Qwen3 32B, the strongest free model on the LLM canister, so questions cost no cycles; if the LLM canister is unreachable the chat lists what the notes say instead. (The canister method still accepts a paid model such as GLM 5.2, which would reserve 0.1T cycles per question from the notebook, but the app does not offer one.) Owner only. Locally a stand-in canister (`canisters/llm-dev`, deployed as `llm`) speaks the same interface and answers with your Ollama (`ollama serve`; `icp canister call llm set_model '("gemma4:12b")'` picks the model).
- **Knowledge graph.** Force-directed graph of every note and link: hover lights up a neighbourhood, drag pins, wheel zooms, click opens; colour by folder or first tag, hide attachments, show only orphans, search within the graph, show unresolved links as ghost nodes. A local graph of the open note (depth 1 to 3) sits in the links pane.

## Organising

- **Folders.** Real folders, empty ones included, with counts, icons and indent guides.
- **Right-click menus.** On files, folders and empty space: new note, new drawing, new folder, new from template, rename, move, copy link, bookmark, history, share, delete. Touch screens get a ⋯ button per row.
- **Drag and drop.** Drag notes or folders onto folders or onto the root; links are rewritten on the way.
- **Tabs and panes.** Several notes open as tabs; drag to reorder, drop on another pane's bar to move, drop on a pane's right edge to split; ⌘\ splits, ⌘W closes, ⌘-click opens in a new tab. Layout is remembered per notebook.
- **Mobile.** Under 760px the workspace shows one pane at a time with a bottom bar (Files, Note, Links, Find).
- **Offline.** The app installs as a PWA, the last opened notebook is cached in the browser, and edits made offline queue and sync when you are back online.

## Appearance

- **Themes on Obsidian's variables.** Velocity (default), Obsidian default and Nord, each in dark and light; or paste the variable block of any Obsidian theme as custom CSS.

## Tokenised notebooks and the market

- **Every notebook is an ICRC-7 token.** The registry is the `Notebooks` collection; holding token #n is owning that canister. `icrc7_transfer` gives a notebook away: controllers and the owner record move with it, the old owner's agent keys and auto top-up payer are cleared.
- **The quality judge.** "Run the judge" audits the notebook (note count, words, links, orphans, headings, tags, freshness) and attaches a 0 to 100 score, a grade and a one-line verdict. Listing runs it automatically. Today's judge is structural; the LLM judge drops into the same slot.
- **The market.** Manage → Sell lists a notebook for a price in any accepted token with a blurb. The market page shows every listing with its grade, verdict and buyer ratings. Buying approves the price in OISY; the registry pays the seller minus a small fee and hands over the canister with its notes, history, attachments and cycles.
- **Buyer ratings.** Only people who bought a notebook can rate it, 1 to 5 stars with a comment; the average and count show on the listing.

## Sharing, publishing and comments

- **Share a note with permissions.** Only me, anyone with the link, or specific people. A link allows viewing, viewing and commenting, or viewing, commenting and editing (the last two need a sign-in; the link alone never lets an anonymous visitor change anything). Named people are viewers (read only), commenters, or editors, each list by principal. Public notes are also served raw at `/s/<path>`.
- **Share a folder or the whole notebook.** The same choices for a folder or everything, plus editor principals who may change the covered notes (never under `Agents/`). Sharees browse a tree and open notes; editors get the editor with autosave.
- **Comments.** Signed-in readers of a shared note leave comments; the owner sees them in the links pane and can delete any.
- **Publish a site.** Publish a folder or the whole notebook as a public website served by the canister at `/p/`: a page per note with navigation, backlinks and a graph on the index page. Unpublish any time.

## Spreadsheets

A `.sheet` note is a workbook (New spreadsheet from the palette, a folder menu or the pane menu). Each note holds several sheets with tabs along the top (add, rename by double-click, delete). Cells take values or formulas starting with `=`: arithmetic, comparisons, `&`, ranges, cross-sheet references like `Sales!B2`, and SUM, AVERAGE, MEDIAN, STDEV, MIN, MAX, COUNT, COUNTA, COUNTIF, SUMIF, AVERAGEIF (criteria like `">=10"`, `"<>x"`, `"a*"`), VLOOKUP, INDEX, MATCH, IFERROR, IF, AND, OR, NOT, ABS, ROUND, FLOOR, CEILING, SQRT, MOD, POWER, LEN, UPPER, LOWER, TRIM, CONCAT, PI, TODAY. Paste a block copied from Excel, Sheets or a CSV into a cell and it fills down and across from there. Errors show as `#DIV/0!`, `#REF!`, `#NAME?`, `#CYCLE!`. Enter moves down, Tab right, Escape cancels; everything recomputes as you type. Import a CSV into a new sheet with the CSV button, export the current sheet as CSV, and add bar, line, area or pie charts drawn from a label column and one or more value columns (row 1 is the header): several columns make grouped bars or several lines, and the chart editor (with a live preview) sets the title, palette or custom colours, legend placement, value labels, stacking, smoothing and axis titles; charts live under the grid, update with the data, and can be edited or removed. Sheets are renamed by clicking the active tab; formulas that point at the old name follow. The JSON source is one keystroke away. In a Jupyter note, `sheet("Name")` or `sheet("Name", "Tab")` returns the computed values as a pandas DataFrame. Engine and tests: `frontend/src/sheet.ts`.

## Dashboards

A `.dash` note is a grid of tiles from other notes: a chart from a spreadsheet note, one cell's value as a big number, or the image or table output of a Python notebook cell. Add tiles with the Tile button, reorder them, make one full width, and remove them. Every tile shows its source note's name as a link that opens it. Tiles read their sources live, so a change in the sheet or a re-run cell shows up at once.

## Board

A reddit-style board beside the chat (ribbon and top bar). Topics are the community channels, so #developers stays contributors-only. A post has a title, text and optionally a note snapshot (gist) from one of your notebooks; posting costs double the ledger fee in ICP (0.0002 ICP, roughly what storing it for 60 days would cost in cycles, rounded up to the transfer minimum), paid from the in-app wallet and swept into the registry's cycles. Members upvote or downvote posts and comments (one changeable vote each), comment with nested replies, sort by hot, new or top, and delete their own posts and comments; admins can delete anything. The same rules as the chat apply: no links, no images, no foul language. A post is deleted for good one week after its last comment. "Discuss in chat" drops a card into a channel that opens the post. Anything can be pinned to the board: a chat message (the list icon on hover; the message becomes the post with its author and channel named, and a shared note comes along), or any note from its menu or share dialog (sheets arrive as CSV, Python notebooks as markdown and code, kanban boards as task lists). The topics and rules panes collapse with the pane buttons or ⌘⇧[ and ⌘⇧].

## Community

- **A Discord-style meeting place.** Community (ribbon, top bar, ⋯ menu) has channels on the left, the chat in the middle and who is online on the right. Admins make and delete channels; six come built in (general, notebooks, market, agents, study, help). Messages are plain text with bold, italics, code and @mentions; links, images, HTML and foul language (including leetspeak and dotted spellings) are refused by the registry, for posts, handles and channel topics alike. Every new message, poll, shared note, fundraiser or shared post costs 0.0002 ICP (twice the ledger fee), pulled from your wallet through an allowance the app approves once for about a hundred messages; edits, reactions, votes and comments on the board are free. Messages are deleted for good 90 days after they were sent, pinned messages excepted, by the registry's hourly sweep. You can edit your own messages (the pencil on hover, or press ↑ in an empty composer to fix your last one; edits are marked and filtered like new posts), pin messages (author or admin; the pin count in the channel header lists them and jumps to each), and type emoji shortcodes such as `:fire:` or `:+1:` that turn into emoji when sent. Polls (the + button; 2-10 options, one changeable vote per member) and emoji reactions (☺ on a message or the picker beside a reaction) are stored on the message. The composer is one box: + for a poll, an emoji picker, Enter sends, Shift+Enter breaks a line, no send button. Gists share a note in chat for opinions (the + menu, or "Ask the community" in a note's share dialog): a snapshot of the note travels with the message, links inside go dead and images are dropped, replies are the opinions, and Open jumps to the live note for those with access. Fundraisers ("Raise cycles for a notebook") let an owner ask the community to keep a notebook alive: a goal in ICP, a progress bar, and Chip in, which pulls ICP from the donor's wallet and mints it straight into that notebook's cycles in the same registry call, so nobody ever holds the money; the owner can close it. A `type: slides` note is a slide show: slides are separated by `---` lines, Present (or the note menu) opens it full screen with arrow keys, clicks and Escape; a gist of one shows as a flippable deck in chat with its own Present button. The #developers channel is gated: only contributors to the repository set on the Admin page may post, proving a GitHub login by putting their principal in their GitHub bio (the registry checks the profile and the contributor list with HTTP outcalls); there, and only there, fundraisers are for AI plans (Claude Max, ChatGPT Pro, Gemini Ultra) and donations go to the contributor's wallet. When someone @mentions your handle, you hear about it anywhere in the app: a toast that opens the channel, a count on the Community icon in the ribbon, and a browser notification when the tab is hidden (after you allow it); the switch lives in the Online pane under Notifications and is on by default. Messages that mention you are tinted in the chat. The chat opens at the first message you have not seen, with a "New messages" line, and a Jump to latest button appears above the composer whenever the newest message is out of view; nothing counts as seen until you reach the bottom. The channels and online panes collapse with the pane buttons or ⌘⇧[ and ⌘⇧]. Replies quote the message they answer, authors and admins can delete, and unread counts sit on the channel list. Phones switch between the three panes with a bottom bar.
- **ICP-gated posting.** Anyone signed in can read; to post you keep ICP in your in-app wallet (your sign-in principal's ledger account) and join with a handle. The registry checks the ledger balance against an admin-set minimum and remembers the check for a day. The wallet card shows the balance, adds ICP from OISY, and your principal for other wallets.
- **Rain.** The ☔ button sends ICP to 1 to 10 people picked at random from everyone who posted in the last 30 minutes: you choose how many and the total, approve it in OISY, and the registry splits it and transfers each share straight to their in-app wallet. The channel gets an announcement naming them, and each recipient sees a rain animation with a card saying who sent how much, wherever they are in the app, within half a minute. Messages sit at the bottom of the chat like a messenger.
- **Presence.** Readers ping every 30 seconds while the page is open; the online list shows handles grouped by the channel they are reading.

- **A fresh notebook** starts with an `index.md` front page and a `Projects/` folder holding a first project note, so the Work tab has something to show.

## Agents

- **Agent keys and the locked folder.** Issue a key per agent in Manage; agents read every note over a JSON API and write only under `Agents/`, where people can read, link and delete but not edit. Agent notes carry the agent's name and draw as green diamonds in the graph.
- **A skill to paste.** Manage fills a skill file with the notebook's URL and key for Claude Code, Codex or any agent, with the rules of the house.

## Help

- **Working indicator.** Every call that changes something on a canister (joining the community, posting, voting, paying, spawning a notebook, saving) shows a progress bar along the top and a labelled pill ("Joining the community…") until it finishes; reads stay silent unless they drag on past a second. The wrapper lives around the registry and notebook actors, so new features get it for free; `scripts/queries.py` regenerates the list of read-only methods from the Candid files.
- **Feature flags.** The Admin page lists the registry's flags (market, board, rain, fundraisers) with switches; a flag that is off hides the feature everywhere and the registry refuses its calls. The market ships off until it has been tried on mainnet.
- **On a phone.** The ⋯ button in the top bar opens a full-screen list of every route: your notebooks, the open notebook and its Chat, Graph, Study, Work and Manage views, Community, Board, Market and Admin, with the current one marked; search, help, appearance and sign-out sit below. The status bar stays pinned above the bottom tabs, and the graph fills the screen and centres itself.
- **Help and support.** The ? button opens a form with a switch between "Report a problem" and "Suggest an idea"; both take a title and detail, and where you were is attached. Reports and ideas share one queue: yours show their kind, status and the admin's answer, and the Admin page filters by bugs or ideas.
- **Admin queue.** Admins (registry controllers plus added principals) see every report, filter by status, read the detail and context, leave a note and set Open, In progress, Done or Won't fix.
