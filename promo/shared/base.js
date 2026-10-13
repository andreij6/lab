// Shared timing and chrome for promo scenes. A scene page includes base.css and this file, writes its
// window markup inside #stage, then calls Promo.run(duration, scene) where scene(t) draws the middle
// of the video. Title card: 0-2.3 s. End card: the last 1.8 s. The cursor and ripple are shared.
(() => {
  const LOGO = `<symbol id="logo" viewBox="0 0 512 512"><linearGradient id="lbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4338ca"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient><linearGradient id="lliq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#38bdf8"/></linearGradient><rect width="512" height="512" rx="112" fill="url(#lbg)"/><path d="M208 120h96v22h-18v86l92 150c14 23-3 52-30 52H164c-27 0-44-29-30-52l92-150v-86h-18z" fill="#fff" fill-opacity=".14" stroke="#fff" stroke-width="22" stroke-linejoin="round"/><path d="M190 286h132l56 92c9 15-2 32-19 32H153c-17 0-28-17-19-32z" fill="url(#lliq)"/><circle cx="232" cy="352" r="12" fill="#fff" fill-opacity=".85"/><circle cx="282" cy="332" r="8" fill="#fff" fill-opacity=".7"/><circle cx="262" cy="386" r="6" fill="#fff" fill-opacity=".7"/><path d="M360 128l8 22 22 8-22 8-8 22-8-22-22-8 22-8z" fill="#fde68a"/><path d="M150 170l5 13 13 5-13 5-5 13-5-13-13-5 13-5z" fill="#fde68a" fill-opacity=".9"/></symbol>`;
  // the app's own icon paths, so scenes look like Lab
  const ICONS = {
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><path d="M8 12h8M8 9h5"/>',
    graph: '<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="8" r="2.5"/><circle cx="10" cy="18" r="2.5"/><path d="M8.3 6.6l7.2 1M7.2 8.3l2 7.3M16.3 10.1l-4.8 6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    cap: '<path d="M2 9.5L12 5l10 4.5L12 14z"/><path d="M6 11.5V16c3 2.5 9 2.5 12 0v-4.5M22 9.5V15"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    heart: '<path d="M12 20s-7.5-4.6-9.2-9.3A4.8 4.8 0 0 1 12 6.6a4.8 4.8 0 0 1 9.2 4.1C19.5 15.4 12 20 12 20z"/>',
    terminal: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/>',
    mountain: '<path d="M3 20l6-10 4 6 3-4 5 8z"/><path d="M8.2 11.4l1.8 1.6 1.4-1.2"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
    sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    links: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.4c-.5-.9-1.5-1.4-2.8-1.4-1.6 0-2.7.8-2.7 2s1.1 1.6 2.7 2 2.7.8 2.7 2-1.1 2-2.7 2c-1.3 0-2.4-.5-2.9-1.4M12 6.5v11"/>',
    wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3"/><path d="M3 5a2 2 0 0 0 2 2h15a1 1 0 0 1 1 1v3h-4a2 2 0 0 0 0 4h4"/>',
    megaphone: '<path d="M3 11l16-6v14L3 13z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    pin: '<path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8"/>',
    award: '<circle cx="12" cy="9" r="6"/><path d="M8.5 13.9 7 22l5-3 5 3-1.5-8.1"/><path d="M12 6.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
    list: '<path d="M4 6h2M9 6h11M4 12h2M9 12h11M4 18h2M9 18h11"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
  };
  const defs = document.createElement("div");
  defs.innerHTML = `<svg width="0" height="0" style="position:absolute"><defs>${LOGO}${Object.entries(ICONS).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24">${v}</symbol>`).join("")}</defs></svg>`;
  document.body.prepend(defs.firstChild);

  const $ = (id) => document.getElementById(id);
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const inout = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const pop = (x) => { const c = 1.7; return x <= 0 ? 0 : 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
  const show = (el, o, dy = 0, s = 1) => { el.style.opacity = o; el.style.transform = `translateY(${dy}px) scale(${s})`; el.style.visibility = o <= 0.001 ? "hidden" : "visible"; };
  const icon = (k) => `<svg class="i"><use href="#i-${k}"/></svg>`;
  /** Text typed out over [a, b]; a blinking caret while typing. */
  const typed = (text, t, a, b, caret = true) => { const n = Math.round(text.length * seg(t, a, b)); return text.slice(0, n) + (caret && t >= a - .4 && t < b + .5 && (t < a || t > b ? Math.floor(t * 2.4) % 2 === 0 : true) ? '<span class="caret"></span>' : ""); };
  /** Move the shared cursor along keyframes [[t, x, y], ...]; clicks: times to ripple at the cursor. */
  function cursor(t, keys, clicks = []) {
    const c = $("cursor"), r = $("ripple");
    if (!keys.length || t < keys[0][0] - .25 || t > keys[keys.length - 1][0] + .5) { c.style.opacity = 0; r.style.opacity = 0; return; }
    let x = keys[0][1], y = keys[0][2];
    for (let i = 1; i < keys.length; i++) {
      const [t0, x0, y0] = keys[i - 1], [t1, x1, y1] = keys[i];
      if (t >= t0) { const m = inout(seg(t, t0, t1)); x = x0 + (x1 - x0) * m; y = y0 + (y1 - y0) * m; }
    }
    c.style.opacity = ease(seg(t, keys[0][0] - .25, keys[0][0])) * (1 - ease(seg(t, keys[keys.length - 1][0] + .2, keys[keys.length - 1][0] + .5)));
    c.style.left = `${x}px`; c.style.top = `${y}px`;
    const k = clicks.find((ct) => t >= ct && t < ct + .45);
    if (k === undefined) { r.style.opacity = 0; return; }
    const p = seg(t, k, k + .45);
    r.style.left = `${x - 26}px`; r.style.top = `${y - 26}px`; r.style.opacity = 1 - p; r.style.transform = `scale(${.3 + p})`;
  }
  /** Where an element's centre sits on the 1080 stage (for aiming the cursor). */
  const at = (sel, dx = 0, dy = 0) => { const el = typeof sel === "string" ? document.querySelector(sel) : sel; if (!el) return [0, 0]; const r = el.getBoundingClientRect(); return [r.left + r.width / 2 + dx, r.top + r.height / 2 + dy]; };

  function run(duration, scene) {
    const endAt = duration - 1.8;
    const frame = (t) => {
      const tin = ease(seg(t, 0, .7)), tout = ease(seg(t, 1.7, 2.3));
      show($("title"), tin * (1 - tout), (1 - tin) * 30 - tout * 60, 1 - tout * .06);
      const w = ease(seg(t, 1.9, 2.8));
      document.querySelectorAll(".win").forEach((el) => show(el, w, (1 - w) * 80, .96 + w * .04));
      const h = ease(seg(t, 2.1, 2.9));
      show($("head"), h, (1 - h) * -20);
      scene(t);
      const e = ease(seg(t, endAt, endAt + .6));
      show($("end"), e, 0, .98 + e * .02);
    };
    window.seek = frame;
    window.DURATION = duration;
    if (!location.search.includes("render")) {
      const t0 = performance.now();
      const loop = (now) => { frame(((now - t0) / 1000) % (duration + 1)); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    } else frame(0);
  }
  /** The title and end cards every scene shares. */
  function cards({ title, subtitle, heading }) {
    document.getElementById("stage").insertAdjacentHTML("beforeend", `
      <div id="head" class="abs"><svg class="logo"><use href="#logo"/></svg><h2>${heading}</h2><span>Lab</span></div>
      <svg id="cursor" class="abs" viewBox="0 0 24 24"><path d="M4 2l16 10.5-7 1.6-3.7 6.9z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><div id="ripple" class="abs"></div>
      <div id="title" class="abs"><svg class="logo"><use href="#logo"/></svg><h1>${title}</h1><p>${subtitle}</p></div>
      <div id="end" class="abs"><svg class="logo"><use href="#logo"/></svg><h1>Lab</h1><p>Organize your thoughts, get feedback, build a knowledge base. Every notebook is its own canister on the Internet Computer.</p><div class="url">cmbgr-zqaaa-aaaae-ahakq-cai.icp0.io</div></div>`);
  }
  window.Promo = { $, clamp, seg, ease, inout, pop, show, icon, typed, cursor, at, run, cards };
})();
