# Promo videos

Each folder is one 15-second scene: an HTML page whose `seek(t)` draws frame `t`. Open its `index.html` to watch it loop.
Scenes share `shared/base.css` and `shared/base.js` (palette, title and end cards, logo, icons, cursor, timing helpers);
`ask-your-notes` predates them and is self-contained.

| Scene | Shows |
|---|---|
| `ask-your-notes` | a question, the notes it picks, an answer with [1] [2] citations, the source opening |
| `link-your-thinking` | `[[` completion, the graph drawing new links, backlinks, the whole notebook |
| `own-your-notebook` | a new notebook spawning its own canister, what that means, the zip download |
| `get-feedback` | a note shared in #general, replies, reactions |
| `learn-what-you-wrote` | highlights becoming flashcards, Again/Hard/Good/Easy reviews, the streak |
| `fits-how-you-work` | onboarding presets, the ribbon reshaping, Research, Trips and Study |

`promo/build.sh` renders and encodes every scene, or just the ones you name.

```bash
node promo/render.mjs ask-your-notes                      # PNG frames -> promo/out/ask-your-notes/frames
node promo/render.mjs ask-your-notes --stills 4,9,12      # a few frames to check
swift promo/encode.swift promo/out/ask-your-notes/frames promo/out/lab-ask-your-notes.mp4 30
```

Output is H.264, 1080x1080, 30 fps, ~10 Mbps: what Twitter/X takes as is. Rendering uses the Playwright
copy npx cached (`PLAYWRIGHT_DIR`) and a cached Chromium (`CHROME`); encoding uses AVFoundation, so no ffmpeg.
