#!/usr/bin/env python3
"""Draw Note's logo in VectorCraft (vectorcraft-cli's headless batch mode) and export it.

A page with a folded corner on the indigo-to-sky square, three lines of writing, and the gold
star from the notebooks' sky. Usage: VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/build_logo_note.py
Writes brand/note-icon.{vectorcraft,svg,png}, brand/note-mark-mono.{svg,png} and the lockups
brand/note-logo-{dark,light}.{vectorcraft,svg,png}.
"""
import json, os, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))
INDIGO, SKY, GOLD, WHITE, INK, FOLD = "#4338ca", "#0ea5e9", "#fde68a", "#ffffff", "#141a2e", "#dbeafe"

def d(path, dx, dy, s):
    res, xy = [], 0
    for t in path.replace(",", " ").split():
        if t[0].isalpha():
            res.append(t); xy = 0
        else:
            res.append(f"{float(t) * s + (dx if xy % 2 == 0 else dy):.2f}"); xy += 1
    return " ".join(res)

def mark(dx=0, dy=0, s=1.0, color=None):
    """The page: a sheet with its top-right corner folded, three lines, a star. On a 512 grid."""
    steps = []
    fill = lambda f: steps.append(("paint.setFill", f))
    stroke = lambda f: steps.append(("paint.setStroke", f))
    no_stroke = lambda: stroke({"none": True})
    ink = color or WHITE
    # the sheet, missing its folded corner
    steps.append(("path.create", {"d": d("M 150 96 Q 134 96 134 112 L 134 400 Q 134 416 150 416 L 362 416 Q 378 416 378 400 L 378 190 L 284 96 Z", dx, dy, s)}))
    fill({"color": ink}); no_stroke()
    if not color:
        # the fold, a shade of sky
        steps.append(("path.create", {"d": d("M 284 96 L 284 174 Q 284 190 300 190 L 378 190 Z", dx, dy, s)}))
        fill({"color": FOLD}); no_stroke()
        # three lines of writing in the gradient's indigo
        for y, w in [(236, 150), (284, 180), (332, 120)]:
            steps.append(("shape.rectangle", {"x": 178 * s + dx, "y": (y - 9) * s + dy, "width": w * s, "height": 18 * s, "radius": 9 * s}))
            fill({"color": INDIGO}); no_stroke()
    else:
        # one colour: the fold and the lines are cut out of the sheet
        steps.append(("path.create", {"d": d("M 284 96 L 284 174 Q 284 190 300 190 L 378 190 Z", dx, dy, s)}))
        fill({"color": ink}); no_stroke()
        for y, w in [(236, 150), (284, 180), (332, 120)]:
            steps.append(("shape.rectangle", {"x": 178 * s + dx, "y": (y - 9) * s + dy, "width": w * s, "height": 18 * s, "radius": 9 * s}))
            fill({"color": ink}); no_stroke()
        steps += [("select.all", {}), ("object.pathfinder.minusFront", {})]
    # the star, off the corner
    steps.append(("path.create", {"d": d("M 402 62 L 412 92 L 442 102 L 412 112 L 402 142 L 392 112 L 362 102 L 392 92 Z", dx, dy, s)}))
    fill({"color": color or GOLD}); no_stroke()
    return steps

def background(size=512):
    return [("shape.rectangle", {"x": 0, "y": 0, "width": size, "height": size, "radius": size * 112 / 512}),
            ("paint.setFill", {"gradient": {"kind": "linear", "angle": -45, "stops": [{"offset": 0, "color": INDIGO}, {"offset": 1, "color": SKY}]}}),
            ("paint.setStroke", {"none": True})]

def wordmark(x, baseline, size, color):
    return [("text.create", {"x": x, "y": baseline, "text": "Note", "size": size, "font": "Avenir Next", "style": "Bold", "color": color}), ("type.createOutlines", {})]

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

build("Note icon", 512, 512, background() + mark(), ["note-icon.vectorcraft", "note-icon.svg", "note-icon.png"])
build("Note mark, one colour", 512, 512, mark(color=INDIGO), ["note-mark-mono.svg", "note-mark-mono.png"])
for theme, ink in [("dark", INK), ("light", WHITE)]:
    build(f"Note logo on {'light' if theme == 'dark' else 'dark'} backgrounds", 1320, 512, background() + mark() + wordmark(580, 372, 300, ink), [f"note-logo-{theme}.vectorcraft", f"note-logo-{theme}.svg", f"note-logo-{theme}.png"])
