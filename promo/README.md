# Promo videos

Each folder is one scene: an HTML page whose `seek(t)` draws frame `t`. Open its `index.html` to watch it loop.

```bash
node promo/render.mjs ask-your-notes                      # PNG frames -> promo/out/ask-your-notes/frames
node promo/render.mjs ask-your-notes --stills 4,9,12      # a few frames to check
swift promo/encode.swift promo/out/ask-your-notes/frames promo/out/lab-ask-your-notes.mp4 30
```

Output is H.264, 1080x1080, 30 fps, ~10 Mbps: what Twitter/X takes as is. Rendering uses the Playwright
copy npx cached (`PLAYWRIGHT_DIR`) and a cached Chromium (`CHROME`); encoding uses AVFoundation, so no ffmpeg.
