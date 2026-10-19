import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { VitePWA } from "vite-plugin-pwa";

// The app shell is precached so it opens offline; notes come from IndexedDB (src/offline.ts).
const pwa = VitePWA({
  registerType: "autoUpdate",
  manifest: false,
  includeAssets: ["favicon.svg", "icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "manifest.webmanifest", "skill.md"],
  workbox: { globPatterns: ["**/*.{js,css,html,svg,woff2}"], globIgnores: ["**/excalidraw/**", "**/mermaid*", "**/katex*"], maximumFileSizeToCacheInBytes: 6_000_000, navigateFallback: "/index.html", runtimeCaching: [{ urlPattern: /\/api\//, handler: "NetworkOnly" }] },
});

// Build: the static-site canister sets the ic_env cookie itself.
// Dev server (`npm run dev`): mimic that cookie and proxy /api to the local network.
export default defineConfig(({ command }) => {
  if (command !== "serve") return { build: { target: "es2022" }, plugins: [pwa] };
  const env = process.env.ICP_ENVIRONMENT || "local";
  const status = JSON.parse(execSync(`icp network status -e ${env} --json`, { encoding: "utf-8" }));
  const id = execSync(`icp canister status registry -e ${env} -i`, { encoding: "utf-8" }).trim();
  const cookie = encodeURIComponent(`PUBLIC_CANISTER_ID:registry=${id}&ic_root_key=${status.root_key}`);
  return {
    plugins: [pwa], // main.ts imports virtual:pwa-register, so the plugin must run in dev too
    server: {
      headers: { "Set-Cookie": `ic_env=${cookie}; SameSite=Lax;` },
      proxy: { "/api": { target: status.api_url, changeOrigin: true } },
    },
  };
});
