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
.theme-light{--background-primary:oklch(99% 0.0005 281);--background-primary-alt:oklch(100% 0.0005 281);--background-secondary:oklch(96.2% 0.0025 281);--background-secondary-alt:oklch(92% 0.0025 281);--background-modifier-border:oklch(0% 0 0 / 0.0625);--background-modifier-border-hover:oklch(0% 0 0 / 0.1125);--background-modifier-hover:oklch(0% 0 0 / 0.0625);--background-modifier-active-hover:oklch(0% 0 0 / 0.092);--text-normal:oklch(30% 0.0005 281);--text-muted:oklch(46.5% 0.0105 281);--text-faint:oklch(58% 0.0105 281);--text-on-accent:#ffffff;--interactive-accent:hsl(214 90% 50%);--interactive-accent-hover:hsl(214 90% 44%);--text-accent:hsl(214 90% 42%);--text-accent-hover:hsl(214 90% 34%);--h1-color:oklch(24% 0.0005 281);--h2-color:oklch(26% 0.0005 281);--code-background:oklch(5% 0 0 / 0.055);--tag-background:oklch(5% 0 0 / 0.055);--tag-color:var(--text-muted);--blockquote-border-color:var(--text-faint);--graph-line:oklch(85.75% 0.0025 281);--graph-node:oklch(46.5% 0.0105 281);--graph-node-unresolved:oklch(82.5% 0.0025 281);--shadow:0 12px 40px rgba(20,20,40,.14);--radius-s:8px;--radius-m:12px;--radius-l:18px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15.5px;--line-height-normal:1.6}`,
  },
  nord: {
    // The Nord palette (nordtheme.com, MIT): polar night / snow storm / frost.
    name: "Nord",
    css: `
.theme-dark{--background-primary:#2e3440;--background-primary-alt:#3b4252;--background-secondary:#272c36;--background-secondary-alt:#434c5e;--background-modifier-border:#434c5e;--background-modifier-border-hover:#4c566a;--background-modifier-hover:rgba(236,239,244,.06);--background-modifier-active-hover:rgba(236,239,244,.1);--text-normal:#eceff4;--text-muted:#aab2c2;--text-faint:#6b7589;--text-on-accent:#2e3440;--interactive-accent:#88c0d0;--interactive-accent-hover:#8fbcbb;--text-accent:#88c0d0;--text-accent-hover:#a3d4e2;--h1-color:#eceff4;--h2-color:#e5e9f0;--code-background:#3b4252;--tag-background:rgba(136,192,208,.15);--tag-color:#88c0d0;--blockquote-border-color:#81a1c1;--graph-line:#4c566a;--graph-node:#d8dee9;--graph-node-unresolved:#4c566a;--shadow:0 10px 40px rgba(0,0,0,.45);--radius-s:6px;--radius-m:10px;--radius-l:14px}
.theme-light{--background-primary:#eceff4;--background-primary-alt:#ffffff;--background-secondary:#e5e9f0;--background-secondary-alt:#d8dee9;--background-modifier-border:#d8dee9;--background-modifier-border-hover:#c3cad6;--background-modifier-hover:rgba(46,52,64,.06);--background-modifier-active-hover:rgba(46,52,64,.1);--text-normal:#2e3440;--text-muted:#4c566a;--text-faint:#69748a;--text-on-accent:#ffffff;--interactive-accent:#5e81ac;--interactive-accent-hover:#4f6f96;--text-accent:#5e81ac;--text-accent-hover:#4f6f96;--h1-color:#2e3440;--h2-color:#3b4252;--code-background:#e5e9f0;--tag-background:rgba(94,129,172,.12);--tag-color:#5e81ac;--blockquote-border-color:#81a1c1;--graph-line:#c8d0dc;--graph-node:#5e6a80;--graph-node-unresolved:#b8c0cc;--shadow:0 10px 40px rgba(46,52,64,.14);--radius-s:6px;--radius-m:10px;--radius-l:14px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15px;--line-height-normal:1.6}`,
  },
  gruvbox: {
    // The Gruvbox palette (github.com/morhetz/gruvbox, MIT): retro warm browns and creams;
    // yellow accent, orange on hover and for links.
    name: "Gruvbox",
    css: `
.theme-dark{--background-primary:#282828;--background-primary-alt:#32302f;--background-secondary:#1d2021;--background-secondary-alt:#3c3836;--background-modifier-border:#3c3836;--background-modifier-border-hover:#504945;--background-modifier-hover:rgba(235,219,178,.06);--background-modifier-active-hover:rgba(235,219,178,.1);--text-normal:#ebdbb2;--text-muted:#bdae93;--text-faint:#7c6f64;--text-on-accent:#282828;--interactive-accent:#d79921;--interactive-accent-hover:#fabd2f;--text-accent:#fe8019;--text-accent-hover:#fabd2f;--h1-color:#fbf1c7;--h2-color:#ebdbb2;--code-background:#32302f;--tag-background:rgba(250,189,47,.14);--tag-color:#fabd2f;--blockquote-border-color:#d65d0e;--graph-line:#504945;--graph-node:#d5c4a1;--graph-node-unresolved:#665c54;--shadow:0 10px 40px rgba(0,0,0,.5);--radius-s:6px;--radius-m:9px;--radius-l:13px}
.theme-light{--background-primary:#fbf1c7;--background-primary-alt:#f9f5d7;--background-secondary:#f2e5bc;--background-secondary-alt:#ebdbb2;--background-modifier-border:#e0d1a6;--background-modifier-border-hover:#d5c4a1;--background-modifier-hover:rgba(60,56,54,.07);--background-modifier-active-hover:rgba(60,56,54,.11);--text-normal:#3c3836;--text-muted:#665c54;--text-faint:#857565;--text-on-accent:#fbf1c7;--interactive-accent:#b57614;--interactive-accent-hover:#af3a03;--text-accent:#af3a03;--text-accent-hover:#9d0006;--h1-color:#282828;--h2-color:#3c3836;--code-background:#f2e5bc;--tag-background:rgba(181,118,20,.13);--tag-color:#b57614;--blockquote-border-color:#d65d0e;--graph-line:#d5c4a1;--graph-node:#7c6f64;--graph-node-unresolved:#d5c4a1;--shadow:0 10px 40px rgba(60,56,54,.16);--radius-s:6px;--radius-m:9px;--radius-l:13px}
body{--font-interface:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-text:"Inter Variable",Inter,ui-sans-serif,system-ui,sans-serif;--font-monospace:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,Menlo,monospace;--font-text-size:15px;--line-height-normal:1.6}`,
  },
  "red-graphite": {
    // After the Red Graphite community theme: flat graphite greys with a single red accent.
    // Our own values, not the theme's file.
    name: "Red Graphite",
    css: `
.theme-dark{--background-primary:#1f1f21;--background-primary-alt:#242427;--background-secondary:#19191b;--background-secondary-alt:#2b2b2f;--background-modifier-border:#2f2f33;--background-modifier-border-hover:#404046;--background-modifier-hover:rgba(255,255,255,.055);--background-modifier-active-hover:rgba(255,255,255,.09);--text-normal:#e3e3e6;--text-muted:#a6a6ad;--text-faint:#66666d;--text-on-accent:#ffffff;--interactive-accent:#d63c3c;--interactive-accent-hover:#e45454;--text-accent:#ff6b66;--text-accent-hover:#ff8a85;--h1-color:#f2f2f4;--h2-color:#e8e8eb;--code-background:#28282c;--tag-background:rgba(214,60,60,.15);--tag-color:#ff7a75;--blockquote-border-color:#d63c3c;--graph-line:#38383d;--graph-node:#b4b4bb;--graph-node-unresolved:#4a4a50;--shadow:0 10px 40px rgba(0,0,0,.55);--radius-s:5px;--radius-m:8px;--radius-l:12px}
.theme-light{--background-primary:#fbfbfb;--background-primary-alt:#ffffff;--background-secondary:#f1f1f2;--background-secondary-alt:#e4e4e7;--background-modifier-border:#e2e2e5;--background-modifier-border-hover:#cdcdd2;--background-modifier-hover:rgba(0,0,0,.055);--background-modifier-active-hover:rgba(0,0,0,.09);--text-normal:#232326;--text-muted:#5b5b62;--text-faint:#76767e;--text-on-accent:#ffffff;--interactive-accent:#c62828;--interactive-accent-hover:#ad1f1f;--text-accent:#b71c1c;--text-accent-hover:#8e1414;--h1-color:#18181a;--h2-color:#232326;--code-background:#f0f0f2;--tag-background:rgba(198,40,40,.1);--tag-color:#b71c1c;--blockquote-border-color:#c62828;--graph-line:#d9d9de;--graph-node:#6a6a72;--graph-node-unresolved:#c4c4ca;--shadow:0 10px 40px rgba(0,0,0,.13);--radius-s:5px;--radius-m:8px;--radius-l:12px}
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
