#!/usr/bin/env python3
"""Draw Lab's logo in VectorCraft (vectorcraft-cli's headless batch mode) and export it.

Usage: VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/build_logo.py
Writes brand/lab-icon.{vectorcraft,svg,png}, brand/lab-mark-mono.{svg,png} and the two
horizontal lockups, brand/lab-logo-{dark,light}.{vectorcraft,svg,png}.
"""
import json, os, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))
INDIGO, SKY, LIQ_TOP, LIQ_BOTTOM, GOLD, WHITE, INK = "#4338ca", "#0ea5e9", "#a5e3ff", "#38bdf8", "#fde68a", "#ffffff", "#141a2e"

def solid(c, a=1.0):
    """A flat colour with opacity, as a two-stop gradient of the same colour."""
    return {"gradient": {"kind": "linear", "angle": 90, "stops": [{"offset": 0, "color": c, "opacity": a}, {"offset": 1, "color": c, "opacity": a}]}} if a < 1 else {"color": c}

def mark(dx=0, dy=0, s=1.0, color=None):
    """The flask: outline, liquid, three linked note nodes, two bubbles, a sparkle. Drawn on a
    512 grid, moved by (dx, dy) and scaled by s. `color` draws it in one colour (nodes knocked out
    of the liquid) for the mono mark."""
    def d(path):  # scale and move an SVG path written on the 512 grid
        out, nums, num = [], [], ""
        toks = path.replace(",", " ").split()
        res, xy = [], 0
        for t in toks:
            if t[0].isalpha():
                res.append(t); xy = 0
            else:
                v = float(t) * s + (dx if xy % 2 == 0 else dy)
                res.append(f"{v:.2f}"); xy += 1
        return " ".join(res)
    P = lambda x, y: [x * s + dx, y * s + dy]
    steps = []
    fill = lambda f: steps.append(("paint.setFill", f))
    stroke = lambda f: steps.append(("paint.setStroke", f))
    no_stroke = lambda: stroke({"none": True})
    # the liquid first, so the outline sits on top of its edges
    steps.append(("path.create", {"d": d("M 163 300 C 210 286 252 314 296 298 C 318 290 336 292 349 300 L 380 356 Q 400 392 380 410 Q 370 420 350 420 L 162 420 Q 142 420 132 410 Q 112 392 132 356 Z")}))
    fill(solid(color) if color else {"gradient": {"kind": "linear", "angle": -90, "stops": [{"offset": 0, "color": LIQ_TOP}, {"offset": 1, "color": LIQ_BOTTOM}]}})
    no_stroke()
    nodes = [(200, 362, 12), (256, 336, 14), (314, 368, 11)]
    # links between the notes, then the notes: white on the liquid, or (one colour) cut out of it
    for path in ["M 200 362 L 256 336 L 314 368", "M 200 362 L 314 368"]:
        steps.append(("path.create", {"d": d(path)}))
        fill({"none": True}); stroke({"color": WHITE}); steps.append(("stroke.set", {"weight": (6 if not color else 8) * s, "cap": "round", "join": "round"}))
        if color:
            steps.append(("object.path.outlineStroke", {}))
    for x, y, r in nodes:
        steps.append(("shape.ellipse", {"x": (x - r) * s + dx, "y": (y - r) * s + dy, "width": 2 * r * s, "height": 2 * r * s}))
        fill({"color": WHITE}); no_stroke()
    if color:
        # only the liquid and the notes exist so far: the notes become holes in the liquid
        steps += [("select.all", {}), ("object.pathfinder.minusFront", {})]
    # the flask: lip and body as one outline
    steps.append(("path.create", {"d": d("M 196 100 L 316 100 M 220 112 L 220 198 L 132 356 Q 112 392 132 410 Q 142 420 162 420 L 350 420 Q 370 420 380 410 Q 400 392 380 356 L 292 198 L 292 112")}))
    fill({"none": True}); stroke({"color": color or WHITE}); steps.append(("stroke.set", {"weight": 22 * s, "cap": "round", "join": "round"}))
    # bubbles rising in the neck
    for x, y, r, a in [(248, 250, 9, .85), (270, 212, 6, .65)]:
        steps.append(("shape.ellipse", {"x": (x - r) * s + dx, "y": (y - r) * s + dy, "width": 2 * r * s, "height": 2 * r * s}))
        fill(solid(color or WHITE, a)); no_stroke()
    # the sparkle
    steps.append(("path.create", {"d": d("M 384 92 L 392 116 L 416 124 L 392 132 L 384 156 L 376 132 L 352 124 L 376 116 Z")}))
    fill(solid(color) if color else {"color": GOLD}); no_stroke()
    return steps

def background(x=0, y=0, size=512):
    return [("shape.rectangle", {"x": x, "y": y, "width": size, "height": size, "radius": size * 112 / 512}),
            ("paint.setFill", {"gradient": {"kind": "linear", "angle": -45, "stops": [{"offset": 0, "color": INDIGO}, {"offset": 1, "color": SKY}]}}),
            ("paint.setStroke", {"none": True})]

def wordmark(x, baseline, size, color):
    return [("text.create", {"x": x, "y": baseline, "text": "Lab", "size": size, "font": "Avenir Next", "style": "Bold", "color": color}),
            ("type.createOutlines", {})]

def build(name, width, height, steps, exports):
    args = [CLI, "run", "--cmd", "file.new", "--params", json.dumps({"width": width, "height": height, "units": "Pixels", "name": name})]
    for cmd, params in steps:
        args += ["--cmd", cmd, "--params", json.dumps(params)]
    for e in exports:
        args += ["--export", os.path.join(OUT, e)]
    r = subprocess.run(args, capture_output=True, text=True)
    bad = [l for l in r.stdout.splitlines() if '"error"' in l] + ([r.stderr.strip()] if r.returncode else [])
    if bad:
        sys.exit(f"{name}: " + "\n".join(bad))
    print(name, "→", ", ".join(exports))

build("Lab icon", 512, 512, background() + mark(), ["lab-icon.vectorcraft", "lab-icon.svg", "lab-icon.png"])
build("Lab mark, one colour", 512, 512, mark(color=INDIGO), ["lab-mark-mono.svg", "lab-mark-mono.png"])
for theme, ink in [("dark", INK), ("light", WHITE)]:
    build(f"Lab logo on {'light' if theme == 'dark' else 'dark'} backgrounds", 1180, 512, background() + mark() + wordmark(580, 372, 300, ink), [f"lab-logo-{theme}.vectorcraft", f"lab-logo-{theme}.svg", f"lab-logo-{theme}.png"])
