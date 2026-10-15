#!/usr/bin/env python3
"""Five candidate logos for Note, drawn in VectorCraft and exported one by one plus a contact sheet.
Usage: VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/build_logo_variants.py
"""
import json, os, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))
INDIGO, SKY, GOLD, WHITE, INK, PALE = "#4338ca", "#0ea5e9", "#fde68a", "#ffffff", "#141a2e", "#dbeafe"

def d(path, dx, dy, s):
    res, xy = [], 0
    for t in path.replace(",", " ").split():
        if t[0].isalpha(): res.append(t); xy = 0
        else: res.append(f"{float(t) * s + (dx if xy % 2 == 0 else dy):.2f}"); xy += 1
    return " ".join(res)
def rect(x, y, w, h, r, fill, dx, dy, s):
    return [("shape.rectangle", {"x": x * s + dx, "y": y * s + dy, "width": w * s, "height": h * s, "radius": r * s}), ("paint.setFill", fill), ("paint.setStroke", {"none": True})]
def dot(x, y, r, fill, dx, dy, s):
    return [("shape.ellipse", {"x": (x - r) * s + dx, "y": (y - r) * s + dy, "width": 2 * r * s, "height": 2 * r * s}), ("paint.setFill", fill), ("paint.setStroke", {"none": True})]
def path(p, fill, dx, dy, s, stroke=None, weight=0):
    out = [("path.create", {"d": d(p, dx, dy, s)}), ("paint.setFill", fill)]
    if stroke: out += [("paint.setStroke", {"color": stroke}), ("stroke.set", {"weight": weight * s, "cap": "round", "join": "round"})]
    else: out.append(("paint.setStroke", {"none": True}))
    return out
def star(cx, cy, r, dx, dy, s, color=GOLD):
    k = r * 0.32
    return path(f"M {cx} {cy-r} L {cx+k} {cy-k} L {cx+r} {cy} L {cx+k} {cy+k} L {cx} {cy+r} L {cx-k} {cy+k} L {cx-r} {cy} L {cx-k} {cy-k} Z", {"color": color}, dx, dy, s)
def background(dx, dy, s):
    return [("shape.rectangle", {"x": dx, "y": dy, "width": 512 * s, "height": 512 * s, "radius": 112 * s}),
            ("paint.setFill", {"gradient": {"kind": "linear", "angle": -45, "stops": [{"offset": 0, "color": INDIGO}, {"offset": 1, "color": SKY}]}}), ("paint.setStroke", {"none": True})]
def glass(c, a):
    return {"gradient": {"kind": "linear", "angle": 90, "stops": [{"offset": 0, "color": c, "opacity": a}, {"offset": 1, "color": c, "opacity": a}]}}

# A: the monogram, a bold rounded N
def A(dx, dy, s):
    return background(dx, dy, s) + path("M 150 400 L 150 112 L 206 112 L 318 300 L 318 112 L 374 112 L 374 400 L 318 400 L 206 212 L 206 400 Z", {"color": WHITE}, dx, dy, s) + star(410, 102, 34, dx, dy, s)
# B: the notebook, a page with a ring binding and a gold ribbon
def B(dx, dy, s):
    out = background(dx, dy, s) + rect(140, 96, 240, 320, 26, {"color": WHITE}, dx, dy, s)
    for y in (150, 206, 262, 318, 374): out += dot(140, y, 14, {"color": INDIGO}, dx, dy, s) + dot(140, y, 7, glass(WHITE, .9), dx, dy, s)
    for y, w in ((200, 120), (248, 150), (296, 96)): out += rect(196, y - 8, w, 16, 8, {"color": PALE}, dx, dy, s)
    out += path("M 316 96 L 316 212 L 346 186 L 376 212 L 376 96 Z", {"color": GOLD}, dx, dy, s)
    return out
# C: a constellation that spells N, the notebooks' sky
def C(dx, dy, s):
    pts = [(150, 380), (150, 132), (362, 380), (362, 132)]
    out = background(dx, dy, s)
    for a, b in ((0, 1), (1, 2), (2, 3)):
        out += path(f"M {pts[a][0]} {pts[a][1]} L {pts[b][0]} {pts[b][1]}", {"none": True}, dx, dy, s, stroke=WHITE, weight=10)
    for i, (x, y) in enumerate(pts): out += dot(x, y, 22 if i in (1, 3) else 18, {"color": WHITE}, dx, dy, s)
    for x, y, r in ((256, 256, 11), (300, 96, 8), (104, 300, 7), (410, 300, 9)): out += dot(x, y, r, glass(WHITE, .7), dx, dy, s)
    return out + star(420, 110, 26, dx, dy, s)
# D: a page that speaks, notes shared with people
def D(dx, dy, s):
    out = background(dx, dy, s) + path("M 140 100 Q 118 100 118 122 L 118 318 Q 118 340 140 340 L 196 340 L 196 410 L 268 340 L 372 340 Q 394 340 394 318 L 394 122 Q 394 100 372 100 Z", {"color": WHITE}, dx, dy, s)
    for y, w in ((166, 170), (220, 204), (274, 132)): out += rect(154, y - 9, w, 18, 9, {"color": INDIGO}, dx, dy, s)
    return out + star(412, 96, 30, dx, dy, s)
# E: three cards in a stack, every notebook its own canister
def E(dx, dy, s):
    out = background(dx, dy, s)
    out += rect(176, 96, 208, 272, 24, glass(WHITE, .35), dx, dy, s) + rect(152, 128, 208, 272, 24, glass(WHITE, .6), dx, dy, s) + rect(128, 160, 208, 272, 24, {"color": WHITE}, dx, dy, s)
    for y, w in ((228, 120), (276, 150), (324, 90)): out += rect(160, y - 8, w, 16, 8, {"color": INDIGO}, dx, dy, s)
    return out + star(410, 112, 30, dx, dy, s)

def build(name, width, height, steps, exports):
    args = [CLI, "run", "--cmd", "file.new", "--params", json.dumps({"width": width, "height": height, "units": "Pixels", "name": name})]
    for cmd, params in steps: args += ["--cmd", cmd, "--params", json.dumps(params)]
    for e in exports: args += ["--export", os.path.join(OUT, e)]
    r = subprocess.run(args, capture_output=True, text=True)
    bad = [l for l in r.stdout.splitlines() if '"error"' in l] + ([r.stderr.strip()] if r.returncode else [])
    if bad: sys.exit(f"{name}: " + "\n".join(bad))
    print(name, "→", ", ".join(exports))

VARIANTS = [("A", "Monogram", A), ("B", "Notebook", B), ("C", "Constellation", C), ("D", "Speaking page", D), ("E", "Stack", E)]
for key, title, fn in VARIANTS:
    build(f"Note {key}", 512, 512, fn(0, 0, 1.0), [f"note-{key}.png", f"note-{key}.svg"])
sheet = [("shape.rectangle", {"x": 0, "y": 0, "width": 2840, "height": 760, "radius": 0}), ("paint.setFill", {"color": "#f4f5f7"}), ("paint.setStroke", {"none": True})]
for i, (key, title, fn) in enumerate(VARIANTS):
    x = 60 + i * 550
    sheet += fn(x, 60, 0.86)
    sheet += [("text.create", {"x": x + 40, "y": 606, "text": "Note", "size": 92, "font": "Avenir Next", "style": "Bold", "color": INK}), ("type.createOutlines", {})]
    sheet += [("text.create", {"x": x + 40, "y": 690, "text": f"{key} · {title}", "size": 40, "font": "Avenir Next", "style": "Medium", "color": "#5a6276"}), ("type.createOutlines", {})]
build("Note logo variants", 2840, 760, sheet, ["note-variants.png", "note-variants.svg"])
