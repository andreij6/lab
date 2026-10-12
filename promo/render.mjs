// Render a promo scene to PNG frames with a headless Chromium, frame-exact: each frame calls the
// page's seek(t), then screenshots. `node promo/render.mjs ask-your-notes` writes
// promo/out/<name>/frames/*.png; `--stills 1.2,7.3` writes just those times for a quick look.
// encode.swift turns the frames into an H.264 MP4.
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Playwright is not a project dependency; use the copy npx already cached, or PLAYWRIGHT_DIR.
const require = createRequire(import.meta.url);
const pwDir = process.env.PLAYWRIGHT_DIR ?? `${process.env.HOME}/.npm/_npx/e41f203b7505f1fb/node_modules/playwright`;
const { chromium } = require(pwDir);

const here = dirname(fileURLToPath(import.meta.url));
const name = process.argv[2] ?? "ask-your-notes";
const stillsArg = process.argv.indexOf("--stills");
const stills = stillsArg > 0 ? process.argv[stillsArg + 1].split(",").map(Number) : null;
const FPS = 30;
const out = join(here, "out", name, stills ? "stills" : "frames");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// any cached Chromium will do; CHROME overrides
const chrome = process.env.CHROME ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const browser = await chromium.launch({ executablePath: chrome });
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`file://${join(here, name, "index.html")}?render`);
await page.waitForFunction(() => typeof window.seek === "function");
const duration = await page.evaluate(() => window.DURATION);
const times = stills ?? Array.from({ length: Math.round(duration * FPS) }, (_, i) => i / FPS);
for (const [i, t] of times.entries()) {
  await page.evaluate((t) => window.seek(t), t);
  await page.screenshot({ path: join(out, stills ? `t${t}.png` : `${String(i).padStart(5, "0")}.png`) });
  if (!stills && i % 60 === 0) process.stdout.write(`\r${i}/${times.length}`);
}
await browser.close();
console.log(`\n${times.length} frame(s) -> ${out}`);
