// Themes use Obsidian's CSS variable names (--background-primary, --text-normal,
// --interactive-accent, …) on .theme-dark / .theme-light, so the variable section of an Obsidian
// theme can be pasted in as custom CSS. The built-in themes below are our own CSS written to
// match the published palettes; nothing is copied from the theme files.

export type ThemeState = { theme: string; mode: "dark" | "light"; custom: string };
export type Theme = { name: string; css: string };

export const THEMES: Record<string, Theme> = {
  velocity: {
    // After Velocity by gonzalo-d-sales (community.obsidian.md/themes/velocity): cool, austere,
    // near-neutral greys; blue accent (hue 212 dark / 214 light); generous radii.
    name: "Velocity",
    css: `
.theme-dark{--background-primary:oklch(23.5% 0.00125 281);--background-primary-alt:oklch(25% 0.00125 281);--background-secondary:oklch(27.5% 0.00375 281);--background-secondary-alt:oklch(26.25% 0.00375 281);--background-modifier-border:oklch(100% 0.05 281 / 0.0625);--background-modifier-border-hover:oklch(100% 0.05 281 / 0.125);--background-modifier-hover:oklch(100% 0.05 281 / 0.05);--background-modifier-active-hover:oklch(100% 0.05 281 / 0.09);--text-normal:oklch(85% 0.00375 281);--text-muted:oklch(71.25% 0.00375 281);--text-faint:oklch(52.5% 0.0075 281);--text-on-accent:#ffffff;--interactive-accent:hsl(212 86% 52%);--interactive-accent-hover:hsl(212 86% 60%);--text-accent:hsl(212 86% 68%);--text-accent-hover:hsl(212 86% 76%);--h1-color:oklch(89.5% 0 281);--h2-color:oklch(88.25% 0 281);--code-background:oklch(100% 0.05 281 / 0.05);--tag-background:oklch(100% 0.05 281 / 0.05);--tag-color:var(--text-muted);--blockquote-border-color:var(--text-faint);--graph-line:oklch(36% 0.00375 281);--graph-node:oklch(77.5% 0.00375 281);--graph-node-unresolved:oklch(43.75% 0.0075 281);--shadow:0 12px 40px rgba(0,0,0,.55);--radius-s:8px;--radius-m:12px;--radius-l:18px}
.theme-light{--background-primary:oklch(99% 0.0005 281);--background-primary-alt:oklch(100% 0.0005 281);--background-secondary:oklch(96.2% 0.0025 281);--background-secondary-alt:oklch(92% 0.0025 281);--background-modifier-border:oklch(0% 0 0 / 0.0625);--background-modifier-border-hover:oklch(0% 0 0 / 0.1125);--background-modifier-hover:oklch(0% 0 0 / 0.0625);--background-modifier-active-hover:oklch(0% 0 0 / 0.092);--text-normal:oklch(30% 0.0005 281);--text-muted:oklch(46.5% 0.0105 281);--text-faint:oklch(71.5% 0.0105 281);--text-on-accent:#ffffff;--interactive-accent:hsl(214 90% 50%);--interactive-accent-hover:hsl(214 90% 44%);--text-accent:hsl(214 90% 42%);--text-accent-hover:hsl(214 90% 34%);--h1-color:oklch(24% 0.0005 281);--h2-color:oklch(26% 0.0005 281);--code-background:oklch(5% 0 0 / 0.055);--tag-background:oklch(5% 0 0 / 0.055);--tag-color:var(--text-muted);--blockquote-border-color:var(--text-faint);--graph-line:oklch(85.75% 0.0025 281);--graph-node:oklch(46.5% 0.0105 281);--graph-node-unresolved:oklch(82.5% 0.0025 281);--shadow:0 12px 40px rgba(20,20,40,.14);--radius-s:8px;--radius-m:12px;--radius-l:18px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15.5px;--line-height-normal:1.6}`,
  },
  "default": {
    // Obsidian's own default look: warm-neutral darks, violet accent.
    name: "Obsidian default",
    css: `
.theme-dark{--background-primary:#1e1e1e;--background-primary-alt:#1a1a1a;--background-secondary:#262626;--background-secondary-alt:#1a1a1a;--background-modifier-border:#363636;--background-modifier-border-hover:#4a4a4a;--background-modifier-hover:rgba(255,255,255,.075);--background-modifier-active-hover:rgba(255,255,255,.12);--text-normal:#dadada;--text-muted:#b3b3b3;--text-faint:#666666;--text-on-accent:#ffffff;--interactive-accent:#7f6df2;--interactive-accent-hover:#8875ff;--text-accent:#a88bfa;--text-accent-hover:#b9a3ff;--h1-color:#dadada;--h2-color:#dadada;--code-background:#2a2a2a;--tag-background:rgba(127,109,242,.15);--tag-color:#a88bfa;--blockquote-border-color:#7f6df2;--graph-line:#3f3f3f;--graph-node:#a0a0a0;--graph-node-unresolved:#555555;--shadow:0 10px 40px rgba(0,0,0,.5);--radius-s:6px;--radius-m:8px;--radius-l:12px}
.theme-light{--background-primary:#ffffff;--background-primary-alt:#fafafa;--background-secondary:#f6f6f6;--background-secondary-alt:#e3e3e3;--background-modifier-border:#e0e0e0;--background-modifier-border-hover:#c9c9c9;--background-modifier-hover:rgba(0,0,0,.06);--background-modifier-active-hover:rgba(0,0,0,.1);--text-normal:#222222;--text-muted:#5c5c5c;--text-faint:#999999;--text-on-accent:#ffffff;--interactive-accent:#7f6df2;--interactive-accent-hover:#6d5ae0;--text-accent:#5e48d8;--text-accent-hover:#4b38c2;--h1-color:#222222;--h2-color:#222222;--code-background:#f2f2f2;--tag-background:rgba(127,109,242,.12);--tag-color:#5e48d8;--blockquote-border-color:#7f6df2;--graph-line:#d9d9d9;--graph-node:#777777;--graph-node-unresolved:#bbbbbb;--shadow:0 10px 40px rgba(0,0,0,.14);--radius-s:6px;--radius-m:8px;--radius-l:12px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15px;--line-height-normal:1.6}`,
  },
  nord: {
    // The Nord palette (nordtheme.com, MIT): polar night / snow storm / frost.
    name: "Nord",
    css: `
.theme-dark{--background-primary:#2e3440;--background-primary-alt:#3b4252;--background-secondary:#272c36;--background-secondary-alt:#434c5e;--background-modifier-border:#434c5e;--background-modifier-border-hover:#4c566a;--background-modifier-hover:rgba(236,239,244,.06);--background-modifier-active-hover:rgba(236,239,244,.1);--text-normal:#eceff4;--text-muted:#aab2c2;--text-faint:#6b7589;--text-on-accent:#2e3440;--interactive-accent:#88c0d0;--interactive-accent-hover:#8fbcbb;--text-accent:#88c0d0;--text-accent-hover:#a3d4e2;--h1-color:#eceff4;--h2-color:#e5e9f0;--code-background:#3b4252;--tag-background:rgba(136,192,208,.15);--tag-color:#88c0d0;--blockquote-border-color:#81a1c1;--graph-line:#4c566a;--graph-node:#d8dee9;--graph-node-unresolved:#4c566a;--shadow:0 10px 40px rgba(0,0,0,.45);--radius-s:6px;--radius-m:10px;--radius-l:14px}
.theme-light{--background-primary:#eceff4;--background-primary-alt:#ffffff;--background-secondary:#e5e9f0;--background-secondary-alt:#d8dee9;--background-modifier-border:#d8dee9;--background-modifier-border-hover:#c3cad6;--background-modifier-hover:rgba(46,52,64,.06);--background-modifier-active-hover:rgba(46,52,64,.1);--text-normal:#2e3440;--text-muted:#4c566a;--text-faint:#8a94a8;--text-on-accent:#ffffff;--interactive-accent:#5e81ac;--interactive-accent-hover:#4f6f96;--text-accent:#5e81ac;--text-accent-hover:#4f6f96;--h1-color:#2e3440;--h2-color:#3b4252;--code-background:#e5e9f0;--tag-background:rgba(94,129,172,.12);--tag-color:#5e81ac;--blockquote-border-color:#81a1c1;--graph-line:#c8d0dc;--graph-node:#5e6a80;--graph-node-unresolved:#b8c0cc;--shadow:0 10px 40px rgba(46,52,64,.14);--radius-s:6px;--radius-m:10px;--radius-l:14px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15px;--line-height-normal:1.6}`,
  },
};

const KEY = "nb-theme";
export function loadThemeState(): ThemeState {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ThemeState>;
    return { theme: j.theme && THEMES[j.theme] ? j.theme : "velocity", mode: j.mode === "light" ? "light" : "dark", custom: typeof j.custom === "string" ? j.custom : "" };
  } catch {
    return { theme: "velocity", mode: "dark", custom: "" };
  }
}
export function saveThemeState(s: ThemeState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}

/** Set body classes the way Obsidian does and install the theme CSS plus any pasted custom CSS. */
export function applyTheme(s: ThemeState) {
  const b = document.body;
  b.classList.toggle("theme-dark", s.mode === "dark");
  b.classList.toggle("theme-light", s.mode === "light");
  document.documentElement.dataset.theme = s.mode;
  document.documentElement.style.colorScheme = s.mode;
  let el = document.getElementById("theme-css") as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement("style");
    el.id = "theme-css";
    document.head.append(el);
  }
  el.textContent = `${(THEMES[s.theme] ?? THEMES.velocity).css}\n/* custom */\n${s.custom}`;
}
