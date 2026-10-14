#!/usr/bin/env python3
"""A still of the community chat's sky (frontend/src/chatsky.ts), drawn in VectorCraft: the #crypto
sky, a wave of light from a new message, people online as bright stars, a shooting star, and a few
messages on top for scale. VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/chat_sky_still.py"""
import json, math, os, random, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))
W, H, LINK = 1200, 760, 132
BG, INK, GOLD, GREEN, ACCENT = "#151826", (225, 230, 255), (245, 197, 66), (52, 211, 153), (109, 124, 255)
hexc = lambda c: "#%02x%02x%02x" % tuple(int(max(0, min(255, v))) for v in c)
mix = lambda a, b, t: tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
steps = []
def fill_alpha(c, a):  # flat colour at an opacity
    return {"gradient": {"kind": "linear", "angle": 90, "stops": [{"offset": 0, "color": hexc(c), "opacity": a}, {"offset": 1, "color": hexc(c), "opacity": a}]}}
def glow(x, y, r, c, a):  # a soft radial light
    steps.append(("shape.ellipse", {"x": x - r, "y": y - r, "width": 2 * r, "height": 2 * r}))
    steps.append(("paint.setFill", {"gradient": {"kind": "radial", "stops": [{"offset": 0, "color": hexc(c), "opacity": a}, {"offset": 1, "color": hexc(c), "opacity": 0}]}}))
    steps.append(("paint.setStroke", {"none": True}))
def line(x1, y1, x2, y2, c, a, w=1.2):
    steps.append(("path.create", {"d": f"M {x1:.1f} {y1:.1f} L {x2:.1f} {y2:.1f}"}))
    steps.append(("paint.setFill", {"none": True}))
    steps.append(("paint.setStroke", fill_alpha(c, a)))
    steps.append(("stroke.set", {"weight": w, "cap": "round"}))
def dot(x, y, r, c, a):
    steps.append(("shape.ellipse", {"x": x - r, "y": y - r, "width": 2 * r, "height": 2 * r}))
    steps.append(("paint.setFill", fill_alpha(c, a)))
    steps.append(("paint.setStroke", {"none": True}))

# the night
steps += [("shape.rectangle", {"x": 0, "y": 0, "width": W, "height": H}), ("paint.setFill", {"color": BG}), ("paint.setStroke", {"none": True})]
# the aurora
glow(330, 260, 520, GOLD, .20); glow(860, 470, 470, GREEN, .17); glow(620, 140, 380, mix(GOLD, ACCENT, .5), .12)
# the stars, on three depths
random.seed(7)
stars = [(random.random() * W, random.random() * H, random.choice([.35, .65, 1]), random.random()) for _ in range(78)]
for i, (x, y, z, _) in enumerate(stars):
    for j in range(i + 1, len(stars)):
        x2, y2, z2, _ = stars[j]
        d = math.hypot(x - x2, y - y2)
        if d < LINK and abs(z - z2) <= .35:
            line(x, y, x2, y2, mix(INK, GOLD, .35), (1 - d / LINK) * .26 * min(z, z2))
# a new message: the wave from its author's star, three hops out
near = lambda a: [b for b in range(len(stars)) if b != a and math.hypot(stars[a][0] - stars[b][0], stars[a][1] - stars[b][1]) < LINK * 1.15]
src = min(range(len(stars)), key=lambda i: math.hypot(stars[i][0] - 520, stars[i][1] - 420))
hop, ring, lit = {src: 0}, [src], {src: 1.0}
for h in range(1, 4):
    nxt = []
    for a in ring:
        for b in near(a):
            if b not in hop:
                hop[b] = h; nxt.append(b); lit[b] = 1 - h * .22
                line(stars[a][0], stars[a][1], stars[b][0], stars[b][1], mix(GREEN, (255, 255, 255), .35), .85 - h * .18, 1.8)
    ring = nxt
sx, sy = stars[src][0], stars[src][1]
for r, a in [(70, .35), (130, .18)]:
    steps.append(("shape.ellipse", {"x": sx - r, "y": sy - r, "width": 2 * r, "height": 2 * r}))
    steps += [("paint.setFill", {"none": True}), ("paint.setStroke", fill_alpha(GREEN, a)), ("stroke.set", {"weight": 1.6})]
# people online: the bright stars
people = [5, 23, 41, 60]
for i, (x, y, z, tw) in enumerate(stars):
    g, person = lit.get(i, 0), i in people
    r = (.6 + tw * 1.1) * (.6 + z * .6) * (2.1 if person else 1) + g * 2.4
    if person or g:
        glow(x, y, r * 7, ACCENT if person else GREEN, .35 + g * .4)
    dot(x, y, r, mix(INK, ACCENT, .25) if person else mix(INK, GOLD, .15), min(1, (.32 + .5 * z) * (.55 + .45 * tw) + g * .6 + (.3 if person else 0)))
# a shooting star
steps.append(("path.create", {"d": "M 1010 70 L 900 175"}))
steps += [("paint.setFill", {"none": True}), ("paint.setStroke", {"gradient": {"kind": "linear", "start": [1010, 70], "end": [900, 175], "stops": [{"offset": 0, "color": hexc(GREEN), "opacity": 0}, {"offset": 1, "color": "#ffffff", "opacity": .8}]}}), ("stroke.set", {"weight": 1.8, "cap": "round"})]
# a few messages on top, for scale
for y, who, text in [(470, "sam", "Thesis check: does the fixed-supply argument hold if ETF inflows slow?"), (560, "ada", "@sam The inflows are the weaker leg. Worth a board post?"), (650, "lee", "Here is mine, for comparison: BTC holds up better than the rest")]:
    dot(70, y + 6, 20, mix(ACCENT, (255, 255, 255), .1) if who != "sam" else GREEN, .9)
    steps.append(("text.create", {"x": 104, "y": y, "text": who, "size": 17, "font": "Avenir Next", "style": "Demi Bold", "color": "#e8eaf6"}))
    steps.append(("text.create", {"x": 104, "y": y + 26, "text": text, "size": 18, "font": "Avenir Next", "style": "Regular", "color": "#d7dbef"}))
steps.append(("text.create", {"x": 40, "y": 52, "text": "# crypto", "size": 22, "font": "Avenir Next", "style": "Demi Bold", "color": "#e8eaf6"}))
steps.append(("text.create", {"x": 150, "y": 52, "text": "Theses, trade reviews and what you are watching", "size": 16, "font": "Avenir Next", "style": "Regular", "color": "#9aa0bf"}))

args = [CLI, "run", "--cmd", "file.new", "--params", json.dumps({"width": W, "height": H, "units": "Pixels", "name": "Chat sky, #crypto"})]
for c, p in steps:
    args += ["--cmd", c, "--params", json.dumps(p)]
for e in ["chat-sky-still.vectorcraft", "chat-sky-still.png"]:
    args += ["--export", os.path.join(OUT, e)]
r = subprocess.run(args, capture_output=True, text=True)
if r.returncode:
    sys.exit(r.stderr[-2000:])
print(len(steps), "commands → chat-sky-still.vectorcraft, chat-sky-still.png")
