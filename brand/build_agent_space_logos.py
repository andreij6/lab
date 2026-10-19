#!/usr/bin/env python3
"""Ten candidate logos for Agent Space, drawn in VectorCraft: the agent, its memory (notes, a graph) and
its wallet, on the app's dark ground with its violet accent. Each is exported at 512 px plus a contact
sheet with labels.
Usage: VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/build_agent_space_logos.py
Writes brand/agent-space-{A..J}.{png,svg} and brand/agent-space-candidates.{png,svg}
"""
import json, math, os, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))
GROUND, GROUND2, VIOLET, LILAC, DEEP, GOLD, WHITE, INK = "#161826", "#23264a", "#9184d9", "#b5abfc", "#4f4d8f", "#fde68a", "#ffffff", "#eceff4"

def d(p, dx, dy, s):
    res, xy = [], 0
    for t in p.replace(",", " ").split():
        if t[0].isalpha(): res.append(t); xy = 0
        else: res.append(f"{float(t) * s + (dx if xy % 2 == 0 else dy):.2f}"); xy += 1
    return " ".join(res)
def solid(c): return {"color": c}
def glass(c, a): return {"gradient": {"kind": "linear", "angle": 90, "stops": [{"offset": 0, "color": c, "opacity": a}, {"offset": 1, "color": c, "opacity": a}]}}
def lin(angle, a, b): return {"gradient": {"kind": "linear", "angle": angle, "stops": [{"offset": 0, "color": a}, {"offset": 1, "color": b}]}}
def rad(cx, cy, r, c, a0, a1, dx, dy, s): return {"gradient": {"kind": "radial", "cx": cx * s + dx, "cy": cy * s + dy, "r": r * s, "stops": [{"offset": 0, "color": c, "opacity": a0}, {"offset": 1, "color": c, "opacity": a1}]}}
def rect(x, y, w, h, r, fill, dx, dy, s):
    return [("shape.rectangle", {"x": x * s + dx, "y": y * s + dy, "width": w * s, "height": h * s, "radius": r * s}), ("paint.setFill", fill), ("paint.setStroke", {"none": True})]
def dot(x, y, r, fill, dx, dy, s):
    return [("shape.ellipse", {"x": (x - r) * s + dx, "y": (y - r) * s + dy, "width": 2 * r * s, "height": 2 * r * s}), ("paint.setFill", fill), ("paint.setStroke", {"none": True})]
def path(p, fill, dx, dy, s, stroke=None, weight=0):
    out = [("path.create", {"d": d(p, dx, dy, s)}), ("paint.setFill", fill)]
    if stroke: out += [("paint.setStroke", {"color": stroke}), ("stroke.set", {"weight": weight * s, "cap": "round", "join": "round"})]
    else: out.append(("paint.setStroke", {"none": True}))
    return out
def line(p, color, weight, dx, dy, s): return path(p, {"none": True}, dx, dy, s, stroke=color, weight=weight)
def ring(x, y, r, color, weight, dx, dy, s):
    return [("shape.ellipse", {"x": (x - r) * s + dx, "y": (y - r) * s + dy, "width": 2 * r * s, "height": 2 * r * s}), ("paint.setFill", {"none": True}), ("paint.setStroke", {"color": color}), ("stroke.set", {"weight": weight * s, "cap": "round", "join": "round"})]
def spark(cx, cy, r, dx, dy, s, color=GOLD):
    k = r * 0.3
    return path(f"M {cx} {cy-r} L {cx+k} {cy-k} L {cx+r} {cy} L {cx+k} {cy+k} L {cx} {cy+r} L {cx-k} {cy+k} L {cx-r} {cy} L {cx-k} {cy-k} Z", solid(color), dx, dy, s)
def background(dx, dy, s, glow=(256, 256)):
    return rect(0, 0, 512, 512, 112, lin(-45, GROUND2, GROUND), dx, dy, s) + rect(0, 0, 512, 512, 112, rad(glow[0], glow[1], 300, VIOLET, 0.28, 0, dx, dy, s), dx, dy, s)
def poly(cx, cy, r, n, rot=-90):
    pts = [(cx + r * math.cos(math.radians(rot + i * 360 / n)), cy + r * math.sin(math.radians(rot + i * 360 / n))) for i in range(n)]
    return "M " + " L ".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"

# A: the cell. A hexagon, the canister the agent lives in, lit from within, with a spark at the door.
def A(dx, dy, s):
    out = background(dx, dy, s) + path(poly(256, 262, 170, 6, -90), glass(VIOLET, .16), dx, dy, s, stroke=LILAC, weight=22)
    out += path(poly(256, 262, 104, 6, -90), lin(-45, LILAC, VIOLET), dx, dy, s)
    return out + dot(256, 262, 30, solid(WHITE), dx, dy, s) + spark(392, 110, 34, dx, dy, s)
# B: the graph. An A drawn as four linked notes: memory with a letter in it.
def B(dx, dy, s):
    pts = {"l": (136, 400), "r": (376, 400), "top": (256, 118), "ml": (196, 262), "mr": (316, 262)}
    out = background(dx, dy, s)
    for a, b in (("l", "ml"), ("ml", "top"), ("top", "mr"), ("mr", "r"), ("ml", "mr")):
        out += line(f"M {pts[a][0]} {pts[a][1]} L {pts[b][0]} {pts[b][1]}", LILAC, 20, dx, dy, s)
    for k, (x, y) in pts.items(): out += dot(x, y, 30 if k == "top" else 24, solid(WHITE if k == "top" else LILAC), dx, dy, s)
    return out + dot(256, 118, 12, solid(VIOLET), dx, dy, s)
# C: the ledger. A note card with lines and a gold coin over its corner: memory and money in one.
def C(dx, dy, s):
    out = background(dx, dy, s) + rect(118, 96, 238, 310, 30, solid(INK), dx, dy, s)
    for y, w in ((166, 150), (218, 110), (270, 136)): out += rect(154, y - 9, w, 18, 9, solid(VIOLET), dx, dy, s)
    out += dot(350, 340, 84, lin(-45, "#ffe9a0", "#e4b85a"), dx, dy, s) + ring(350, 340, 60, "#b58a2e", 10, dx, dy, s)
    return out + path("M 324 340 C 324 322 338 310 352 310 C 364 310 372 318 372 328 C 372 344 332 346 332 362 C 332 372 342 378 354 378 C 368 378 376 370 376 356", {"none": True}, dx, dy, s, stroke="#8a6a1f", weight=12)
# D: the grid. Nine tiles, the wallet grid at the gate, one of them lit and awake.
def D(dx, dy, s):
    out = background(dx, dy, s, glow=(170, 170))
    for i in range(3):
        for j in range(3):
            lit = (i, j) == (0, 0)
            out += rect(112 + j * 104, 112 + i * 104, 84, 84, 20, lin(-45, LILAC, VIOLET) if lit else glass(WHITE, .14), dx, dy, s)
    return out + spark(154, 154, 26, dx, dy, s, WHITE)
# E: the orbit. The space as a core, the agent as the satellite going round it.
def E(dx, dy, s):
    out = background(dx, dy, s) + dot(256, 262, 74, lin(-45, LILAC, VIOLET), dx, dy, s) + dot(236, 240, 22, glass(WHITE, .5), dx, dy, s)
    out += [("shape.ellipse", {"x": 72 * s + dx, "y": 196 * s + dy, "width": 368 * s, "height": 132 * s}), ("paint.setFill", {"none": True}), ("paint.setStroke", {"color": LILAC}), ("stroke.set", {"weight": 16 * s, "cap": "round", "join": "round"})]
    return out + dot(404, 232, 30, solid(WHITE), dx, dy, s) + dot(404, 232, 12, solid(VIOLET), dx, dy, s)
# F: the voice. A speech bubble with a spark: the agent talking in the community.
def F(dx, dy, s):
    out = background(dx, dy, s) + path("M 136 104 Q 104 104 104 136 L 104 312 Q 104 344 136 344 L 196 344 L 176 420 L 272 344 L 376 344 Q 408 344 408 312 L 408 136 Q 408 104 376 104 Z", solid(INK), dx, dy, s)
    return out + spark(256, 224, 70, dx, dy, s, VIOLET) + spark(256, 224, 30, dx, dy, s, LILAC)
# G: the face. A note that looks back: two eyes and a smile on a page.
def G(dx, dy, s):
    out = background(dx, dy, s) + path("M 140 92 L 316 92 L 388 164 L 388 420 Q 388 448 360 448 L 140 448 Q 112 448 112 420 L 112 120 Q 112 92 140 92 Z", solid(INK), dx, dy, s)
    out += path("M 316 92 L 316 164 L 388 164 Z", solid(LILAC), dx, dy, s)
    out += dot(196, 252, 24, solid(VIOLET), dx, dy, s) + dot(300, 252, 24, solid(VIOLET), dx, dy, s)
    return out + line("M 184 332 Q 248 392 312 332", VIOLET, 22, dx, dy, s)
# H: the key. An agent key whose bow is a node of the graph, with two more nodes hanging off it.
def H(dx, dy, s):
    out = background(dx, dy, s) + ring(176, 236, 70, LILAC, 26, dx, dy, s)
    out += line("M 246 236 L 428 236 M 372 236 L 372 296 M 420 236 L 420 284", LILAC, 26, dx, dy, s)
    out += line("M 128 290 L 96 376 M 224 290 L 256 376", VIOLET, 14, dx, dy, s) + dot(96, 376, 22, solid(WHITE), dx, dy, s) + dot(256, 376, 22, solid(WHITE), dx, dy, s)
    return out + dot(176, 236, 20, solid(WHITE), dx, dy, s)
# I: the beacon. A canister standing up, lit, with its light reaching out.
def I(dx, dy, s):
    out = background(dx, dy, s, glow=(256, 180))
    for r, a in ((150, .10), (112, .14)): out += dot(256, 190, r, glass(LILAC, a), dx, dy, s)
    out += rect(196, 150, 120, 250, 44, lin(0, LILAC, VIOLET), dx, dy, s) + rect(220, 174, 72, 50, 18, glass(WHITE, .75), dx, dy, s)
    out += rect(232, 400, 48, 24, 8, solid(DEEP), dx, dy, s) + rect(176, 420, 160, 20, 10, solid(DEEP), dx, dy, s)
    return out + spark(256, 110, 30, dx, dy, s)
# J: the open folder. Notes held open, a spark above: memory the agent keeps alight.
def J(dx, dy, s):
    out = background(dx, dy, s) + path("M 96 160 Q 96 136 120 136 L 206 136 L 240 170 L 392 170 Q 416 170 416 194 L 416 222 L 96 222 Z", solid(VIOLET), dx, dy, s)
    out += path("M 118 222 L 446 222 L 406 390 Q 400 414 376 414 L 118 414 Q 96 414 96 392 Z", solid(LILAC), dx, dy, s)
    return out + spark(392, 118, 34, dx, dy, s)

def build(name, width, height, steps, exports):
    args = [CLI, "run", "--cmd", "file.new", "--params", json.dumps({"width": width, "height": height, "units": "Pixels", "name": name})]
    for cmd, params in steps: args += ["--cmd", cmd, "--params", json.dumps(params)]
    for e in exports: args += ["--export", os.path.join(OUT, e)]
    r = subprocess.run(args, capture_output=True, text=True)
    bad = [l for l in r.stdout.splitlines() if '"error"' in l] + ([r.stderr.strip()] if r.returncode else [])
    if bad: sys.exit(f"{name}: " + "\n".join(bad))
    print(name, "→", ", ".join(exports))

VARIANTS = [("A", "Cell", A), ("B", "Graph", B), ("C", "Ledger", C), ("D", "Grid", D), ("E", "Orbit", E), ("F", "Voice", F), ("G", "Face", G), ("H", "Key", H), ("I", "Beacon", I), ("J", "Folder", J)]
if __name__ == "__main__":
  for key, title, fn in VARIANTS:
    build(f"Agent Space {key}", 512, 512, fn(0, 0, 1.0), [f"agent-space-{key}.png", f"agent-space-{key}.svg"])
  COLS, TILE, GAP = 5, 300, 56
  SW, SH = GAP + COLS * (TILE + GAP), GAP + 2 * (TILE + 130 + GAP)
  sheet = [("shape.rectangle", {"x": 0, "y": 0, "width": SW, "height": SH, "radius": 0}), ("paint.setFill", solid("#0f1020")), ("paint.setStroke", {"none": True})]
  for i, (key, title, fn) in enumerate(VARIANTS):
      x, y = GAP + (i % COLS) * (TILE + GAP), GAP + (i // COLS) * (TILE + 130 + GAP)
      sheet += fn(x, y, TILE / 512)
      sheet += [("text.create", {"x": x + 6, "y": y + TILE + 66, "text": f"{key} · {title}", "size": 44, "font": "Avenir Next", "style": "Bold", "color": INK}), ("type.createOutlines", {})]
  build("Agent Space logo candidates", SW, SH, sheet, ["agent-space-candidates.png", "agent-space-candidates.svg"])
