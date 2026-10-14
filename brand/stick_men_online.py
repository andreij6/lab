#!/usr/bin/env python3
"""Illustration of little stick men walking across the bottom of Markdown Lab showing online users.
Drawn in VectorCraft using vectorcraft-cli's headless batch mode.

Usage:
  VECTORCRAFT_CLI=/path/to/vectorcraft-cli python3 brand/stick_men_online.py

Exports:
  brand/stick-men-online.vectorcraft  (editable VectorCraft project)
  brand/stick-men-online.svg          (vector SVG)
  brand/stick-men-online.png          (high-resolution raster)
"""
import json, math, os, subprocess, sys

CLI = os.environ.get("VECTORCRAFT_CLI", "/private/tmp/claude-501/-Users-andrejones-Desktop-workspace-projects-markdown-icp/8aed93d2-8cbb-4eec-991c-52a368dc7ac3/scratchpad/vectorcraft-cli/unzipped/vectorcraft-cli-0.11.0-macos-universal/vectorcraft-cli")
OUT = os.path.dirname(os.path.abspath(__file__))

W, H = 1440, 760
GROUND_Y = 630

# Colors matching Markdown Lab & VectorCraft design system
BG_DARK = "#0d101a"
APP_FRAME = "#141726"
APP_BORDER = "#252b44"
EDITOR_BG = "#161a2b"
BAR_BG = "#101322"
BAR_BORDER = "#2a3352"
BAR_ACCENT = "#6d7cff"
GREEN = "#34d399"
GOLD = "#f5c542"
CYAN = "#38bdf8"
PINK = "#f472b6"
PURPLE = "#c084fc"
TEXT_WHITE = "#f1f3fd"
TEXT_MUTED = "#8b94b8"
TEXT_FAINT = "#4d5675"
CODE_BLUE = "#60a5fa"
CODE_ORANGE = "#fb923c"
CODE_YELLOW = "#fde047"
CODE_PURPLE = "#c084fc"

steps = []

def fill_alpha(c_hex, a):
    return {"gradient": {"kind": "linear", "angle": 90, "stops": [{"offset": 0, "color": c_hex, "opacity": a}, {"offset": 1, "color": c_hex, "opacity": a}]}}

def rect(x, y, w, h, fill=None, stroke=None, stroke_w=1, radius=0):
    params = {"x": x, "y": y, "width": w, "height": h}
    if radius > 0:
        params["radius"] = radius
    steps.append(("shape.rectangle", params))
    if fill:
        steps.append(("paint.setFill", fill if isinstance(fill, dict) else {"color": fill}))
    else:
        steps.append(("paint.setFill", {"none": True}))
    if stroke:
        steps.append(("paint.setStroke", stroke if isinstance(stroke, dict) else {"color": stroke}))
        steps.append(("stroke.set", {"weight": stroke_w, "cap": "round", "join": "round"}))
    else:
        steps.append(("paint.setStroke", {"none": True}))

def ellipse(cx, cy, rx, ry, fill=None, stroke=None, stroke_w=1):
    steps.append(("shape.ellipse", {"x": cx - rx, "y": cy - ry, "width": 2 * rx, "height": 2 * ry}))
    if fill:
        steps.append(("paint.setFill", fill if isinstance(fill, dict) else {"color": fill}))
    else:
        steps.append(("paint.setFill", {"none": True}))
    if stroke:
        steps.append(("paint.setStroke", stroke if isinstance(stroke, dict) else {"color": stroke}))
        steps.append(("stroke.set", {"weight": stroke_w, "cap": "round", "join": "round"}))
    else:
        steps.append(("paint.setStroke", {"none": True}))

def glow(cx, cy, r, color_hex, opacity=0.3):
    steps.append(("shape.ellipse", {"x": cx - r, "y": cy - r, "width": 2 * r, "height": 2 * r}))
    steps.append(("paint.setFill", {"gradient": {"kind": "radial", "stops": [
        {"offset": 0, "color": color_hex, "opacity": opacity},
        {"offset": 1, "color": color_hex, "opacity": 0.0}
    ]}}))
    steps.append(("paint.setStroke", {"none": True}))

def path(d_str, stroke="#ffffff", stroke_w=2.5, fill=None):
    steps.append(("path.create", {"d": d_str}))
    if fill:
        steps.append(("paint.setFill", fill if isinstance(fill, dict) else {"color": fill}))
    else:
        steps.append(("paint.setFill", {"none": True}))
    if stroke:
        steps.append(("paint.setStroke", stroke if isinstance(stroke, dict) else {"color": stroke}))
        steps.append(("stroke.set", {"weight": stroke_w, "cap": "round", "join": "round"}))
    else:
        steps.append(("paint.setStroke", {"none": True}))

def text(x, y, txt, size=14, color=TEXT_WHITE, weight="Regular"):
    steps.append(("text.create", {
        "x": x,
        "y": y,
        "text": txt,
        "size": size,
        "font": "Avenir Next",
        "style": weight,
        "color": color
    }))

def speech_bubble(x, y, txt, color=TEXT_WHITE, bg="#1c2138", border="#38436b"):
    w = max(72, len(txt) * 7.2 + 22)
    h = 24
    bx = x - w / 2
    by = y - h
    rect(bx, by, w, h, fill=bg, stroke=border, stroke_w=1.2, radius=7)
    # little pointer triangle
    path(f"M {x-4} {by+h} L {x} {by+h+5} L {x+4} {by+h} Z", stroke=border, stroke_w=1, fill=bg)
    text(bx + 11, by + 16, txt, size=11, color=color, weight="Medium")

def name_tag(x, y, name, accent_color, is_online=True):
    w = len(name) * 7.2 + 24
    h = 18
    bx = x - w / 2
    by = y
    rect(bx, by, w, h, fill="#131728", stroke=accent_color, stroke_w=1, radius=9)
    if is_online:
        ellipse(bx + 7.5, by + 9, 2.8, 2.8, fill=GREEN)
    text(bx + 15, by + 13, name, size=10, color=TEXT_WHITE, weight="Demi Bold")

# 1. Canvas Background
rect(0, 0, W, H, fill=BG_DARK)

# Subtle ambient light
glow(300, 220, 420, "#312e81", 0.16)
glow(1120, 300, 480, "#1e1b4b", 0.18)
glow(720, 620, 400, "#065f46", 0.14)

# 2. Markdown Lab Window Frame
rect(40, 30, W - 80, H - 60, fill=APP_FRAME, stroke=APP_BORDER, stroke_w=1.5, radius=16)

# Titlebar
rect(40, 30, W - 80, 44, fill="#111320", stroke=None, radius=0)
path(f"M 40 74 L {W-40} 74", stroke=APP_BORDER, stroke_w=1)
# Traffic lights
ellipse(68, 52, 6, 6, fill="#ef4444")
ellipse(88, 52, 6, 6, fill="#f59e0b")
ellipse(108, 52, 6, 6, fill="#10b981")
# Window title & active document
text(140, 56, "Markdown Lab", size=13, color=TEXT_WHITE, weight="Demi Bold")
text(245, 56, "•", size=12, color=TEXT_FAINT)
text(260, 56, "Research / Decentralized Knowledge Graph.md", size=13, color=TEXT_MUTED, weight="Regular")
# Top right network pill
rect(W - 230, 40, 170, 24, fill="#1d2238", stroke="#313a5e", stroke_w=1, radius=6)
ellipse(W - 218, 52, 4, 4, fill=GREEN)
text(W - 206, 56, "ICP Consensus  99.9%", size=11, color=TEXT_MUTED, weight="Medium")

# Left vertical icon ribbon
rect(40, 74, 56, H - 134, fill="#10121e", stroke=None)
path(f"M 96 74 L 96 {H-60}", stroke=APP_BORDER, stroke_w=1)
icons_y = [100, 144, 188, 232, 276]
for idx, iy in enumerate(icons_y):
    is_active = (idx == 1) # Community chat active
    if is_active:
        rect(46, iy - 6, 44, 36, fill="#232948", stroke=BAR_ACCENT, stroke_w=1, radius=8)
    ellipse(68, iy + 12, 8, 8, fill=BAR_ACCENT if is_active else None, stroke=BAR_ACCENT if is_active else TEXT_FAINT, stroke_w=1.5)

# Editor Area Content (Above bottom bar)
editor_x = 120
rect(editor_x, 88, W - 180, 320, fill=EDITOR_BG, stroke=None, radius=8)

line_nums = [
    (118, "38", "# Autonomous Knowledge Graph Mesh", GOLD, "Bold", 18),
    (144, "39", "Every participant node broadcasts encrypted vector updates via ICP consensus.", TEXT_MUTED, "Regular", 13),
    (168, "40", "", TEXT_MUTED, "Regular", 13),
    (190, "41", "```typescript", CODE_PURPLE, "Regular", 13),
    (212, "42", "  // Real-time peer discovery and stick figures walking promenade", CODE_ORANGE, "Regular", 13),
    (234, "43", "  const onlineUsers = await registry.online_users();", CODE_BLUE, "Demi Bold", 13),
    (256, "44", "  const bottomBar = mountWalkingPromenade({ users: onlineUsers });", TEXT_WHITE, "Regular", 13),
    (278, "45", "  bottomBar.animateWalkCycles({ speed: '1.2x', interactive: true });", CODE_YELLOW, "Regular", 13),
    (300, "46", "```", CODE_PURPLE, "Regular", 13),
    (324, "47", "Interactive live peers stay connected across mobile and desktop clients.", TEXT_MUTED, "Regular", 13),
    (348, "48", "Tags: #knowledge-graph   #stickmen-walking   #community-chat   #icp-mesh", BAR_ACCENT, "Medium", 12),
]

for y_pos, num, txt, col, weight, sz in line_nums:
    text(editor_x + 14, y_pos, num, size=11.5, color=TEXT_FAINT, weight="Regular")
    if txt:
        text(editor_x + 48, y_pos, txt, size=sz, color=col, weight=weight)

# Soft gradient fade separating editor from bottom promenade
glow(W / 2, 420, 500, "#101322", 0.95)

# =========================================================================
# 3. THE WALKING PROMENADE / BOTTOM BAR (y = 425 to y = 700)
# =========================================================================
rect(96, 425, W - 136, H - 485, fill=BAR_BG, stroke=BAR_BORDER, stroke_w=1.5)

# Top edge highlight of bottom bar
path(f"M 96 425 L {W-40} 425", stroke="#3b466d", stroke_w=1.5)
# Accent runner glow line
steps.append(("shape.rectangle", {"x": 96, "y": 425, "width": W - 136, "height": 3}))
steps.append(("paint.setFill", {"gradient": {"kind": "linear", "angle": 0, "stops": [
    {"offset": 0, "color": BAR_ACCENT, "opacity": 0.15},
    {"offset": 0.25, "color": GREEN, "opacity": 0.85},
    {"offset": 0.75, "color": BAR_ACCENT, "opacity": 0.85},
    {"offset": 1, "color": CYAN, "opacity": 0.25}
]}}))
steps.append(("paint.setStroke", {"none": True}))

# Header banner in bottom bar (Top shelf: y = 438 to 468)
# Left: Prominent Online Badge
rect(120, 440, 240, 28, fill="#182038", stroke=GREEN, stroke_w=1.2, radius=14)
glow(136, 454, 16, GREEN, 0.45)
ellipse(136, 454, 4.5, 4.5, fill=GREEN)
text(148, 459, "7 USERS WALKING ONLINE", size=12, color=TEXT_WHITE, weight="Bold")
text(318, 459, "NOW", size=10, color=GREEN, weight="Bold")

# Center: descriptive subtitle
text(390, 458, "Live interactive presence walking across the bottom of Markdown Lab", size=12.5, color=TEXT_MUTED, weight="Medium")

# Right: latency & channel badge
rect(W - 280, 440, 220, 28, fill="#14192b", stroke="#2d3656", stroke_w=1, radius=6)
ellipse(W - 266, 454, 3.5, 3.5, fill=CYAN)
text(W - 254, 458, "Channel: #crypto • 24ms sync", size=11, color=TEXT_MUTED, weight="Medium")

# Walking ground line (y = GROUND_Y)
path(f"M 110 {GROUND_Y} L {W-60} {GROUND_Y}", stroke="#262e49", stroke_w=2)
path(f"M 120 {GROUND_Y} L {W-70} {GROUND_Y}", stroke=fill_alpha(GREEN, 0.35), stroke_w=1)

# Subtle dot-grid walkway beneath feet
for gx in range(120, W - 60, 36):
    ellipse(gx, GROUND_Y + 12, 1.5, 1.5, fill="#323b5c")
    ellipse(gx + 18, GROUND_Y + 24, 1.2, 1.2, fill="#232942")

# Status indicators on the bottom shelf (y = 672)
ellipse(126, 672, 4, 4, fill=GREEN)
text(138, 676, "Saved", size=12, color=TEXT_WHITE, weight="Demi Bold")
text(182, 676, "·", size=12, color=TEXT_FAINT)
text(194, 676, "2,418 words", size=12, color=TEXT_MUTED)
text(276, 676, "·", size=12, color=TEXT_FAINT)
text(288, 676, "14,890 characters", size=12, color=TEXT_MUTED)
text(404, 676, "·", size=12, color=TEXT_FAINT)
text(416, 676, "Pomodoro 18:24", size=12, color=GOLD, weight="Medium")

# Right status info
text(W - 270, 676, "UTF-8", size=11.5, color=TEXT_MUTED)
text(W - 220, 676, "Markdown", size=11.5, color=BAR_ACCENT, weight="Medium")
text(W - 145, 676, "main @ b91a4", size=11.5, color=TEXT_FAINT)

# =========================================================================
# 4. DRAWING THE STICK MEN (7 users walking across)
# =========================================================================

def draw_footstep_glow(x, ground_y, color_hex):
    glow(x, ground_y + 2, 22, color_hex, 0.22)
    ellipse(x, ground_y + 1, 14, 3, fill=fill_alpha(color_hex, 0.25))

def draw_head_halo(x, head_cy, color_hex):
    glow(x, head_cy, 24, color_hex, 0.35)

gy = GROUND_Y

# --- STICK MAN 1: @andre (Lead architect, confident upright stride, holding tablet) ---
x1 = 175
draw_footstep_glow(x1, gy, BAR_ACCENT)
draw_head_halo(x1, gy - 62, BAR_ACCENT)
ellipse(x1, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
ellipse(x1 + 3, gy - 63, 1.2, 1.2, fill=TEXT_WHITE)
# Golden crown / sparkle
path(f"M {x1-4} {gy-74} L {x1} {gy-77} L {x1+4} {gy-74} L {x1+2} {gy-71} L {x1-2} {gy-71} Z", stroke=GOLD, stroke_w=1, fill=GOLD)
# Spine
path(f"M {x1} {gy-54} L {x1+2} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x1+2} {gy-28} L {x1+16} {gy-14} L {x1+24} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x1+2} {gy-28} L {x1-12} {gy-16} L {x1-20} {gy-3}", stroke=TEXT_WHITE, stroke_w=2.4)
# Arms holding tablet
path(f"M {x1+1} {gy-48} L {x1-10} {gy-38} L {x1-16} {gy-42}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x1+1} {gy-48} L {x1+12} {gy-38} L {x1+18} {gy-42}", stroke=TEXT_WHITE, stroke_w=2.2)
rect(x1 + 14, gy - 50, 16, 12, fill="#1e2544", stroke=BAR_ACCENT, stroke_w=1.2, radius=2)
ellipse(x1 + 22, gy - 44, 2, 2, fill=CYAN)
# Name & Speech bubble
name_tag(x1, gy - 85, "@andre", BAR_ACCENT)
speech_bubble(x1 + 15, gy - 110, "Welcome to Lab! 🚀", color=TEXT_WHITE, bg="#1a203a", border=BAR_ACCENT)

# --- STICK MAN 2: @ada (Cryptographer, brisk walk, carrying scroll/books, wearing glasses) ---
x2 = 345
draw_footstep_glow(x2, gy, PURPLE)
draw_head_halo(x2, gy - 62, PURPLE)
ellipse(x2, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
ellipse(x2 + 3, gy - 63, 2.5, 2.5, fill=None, stroke=CYAN, stroke_w=1) # glasses
path(f"M {x2} {gy-54} L {x2+4} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x2+4} {gy-28} L {x2-8} {gy-14} L {x2-12} {gy-1}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x2+4} {gy-28} L {x2+18} {gy-15} L {x2+24} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
# Arms & books
path(f"M {x2+2} {gy-48} L {x2+14} {gy-38} L {x2+12} {gy-32}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x2+2} {gy-48} L {x2-10} {gy-38} L {x2-4} {gy-30}", stroke=TEXT_WHITE, stroke_w=2.2)
rect(x2 + 8, gy - 36, 14, 5, fill=PURPLE, stroke=None, radius=1)
rect(x2 + 7, gy - 41, 16, 5, fill=CYAN, stroke=None, radius=1)
# Scarf
path(f"M {x2} {gy-52} Q {x2-12} {gy-56} {x2-20} {gy-50}", stroke=CYAN, stroke_w=2)
# Name & Speech bubble
name_tag(x2, gy - 85, "@ada", PURPLE)
speech_bubble(x2 + 10, gy - 110, "Verifying proof ⚡", color=TEXT_WHITE, bg="#201a38", border=PURPLE)

# --- STICK MAN 3: @sam (Casual stroll, coffee mug, headphones) ---
x3 = 515
draw_footstep_glow(x3, gy, GOLD)
draw_head_halo(x3, gy - 62, GOLD)
# Headphones
path(f"M {x3-8} {gy-63} A 8 8 0 0 1 {x3+8} {gy-63}", stroke=GOLD, stroke_w=1.8)
ellipse(x3 - 8, gy - 63, 2, 3, fill=GOLD)
ellipse(x3 + 8, gy - 63, 2, 3, fill=GOLD)
ellipse(x3, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x3} {gy-54} L {x3+1} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x3+1} {gy-28} L {x3+14} {gy-14} L {x3+20} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x3+1} {gy-28} L {x3-10} {gy-14} L {x3-16} {gy-2}", stroke=TEXT_WHITE, stroke_w=2.4)
# Arms
path(f"M {x3} {gy-48} L {x3-8} {gy-36} L {x3-4} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x3} {gy-48} L {x3+12} {gy-38} L {x3+18} {gy-38}", stroke=TEXT_WHITE, stroke_w=2.2)
rect(x3 + 17, gy - 44, 9, 10, fill=GOLD, stroke=None, radius=2)
path(f"M {x3+26} {gy-42} Q {x3+29} {gy-39} {x3+26} {gy-36}", stroke=GOLD, stroke_w=1.2)
path(f"M {x3+20} {gy-46} Q {x3+18} {gy-50} {x3+22} {gy-53}", stroke=TEXT_MUTED, stroke_w=1)
# Name & Speech bubble
name_tag(x3, gy - 85, "@sam", GOLD)
speech_bubble(x3 + 12, gy - 110, "BTC looking strong ☕", color=TEXT_WHITE, bg="#262218", border=GOLD)

# --- STICK MAN 4: @lee (Writer, carrying giant stylus/pencil over shoulder) ---
x4 = 685
draw_footstep_glow(x4, gy, PINK)
draw_head_halo(x4, gy - 62, PINK)
ellipse(x4, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x4} {gy-54} L {x4+2} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x4+2} {gy-28} L {x4+16} {gy-13} L {x4+25} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x4+2} {gy-28} L {x4-12} {gy-15} L {x4-22} {gy-4}", stroke=TEXT_WHITE, stroke_w=2.4)
# Giant pencil
path(f"M {x4-24} {gy-66} L {x4+24} {gy-34}", stroke=GOLD, stroke_w=4.5)
ellipse(x4 - 26, gy - 67, 3, 3, fill=PINK)
path(f"M {x4+24} {gy-34} L {x4+30} {gy-30}", stroke="#e2e8f0", stroke_w=2)
ellipse(x4 + 31, gy - 29, 1.5, 1.5, fill="#0f172a")
# Arms
path(f"M {x4+1} {gy-48} L {x4+8} {gy-40} L {x4+12} {gy-42}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x4+1} {gy-48} L {x4-8} {gy-44} L {x4-10} {gy-52}", stroke=TEXT_WHITE, stroke_w=2.2)
# Name & Speech bubble
name_tag(x4, gy - 85, "@lee", PINK)
speech_bubble(x4 + 10, gy - 110, "Drafting new docs ✍️", color=TEXT_WHITE, bg="#2b1a26", border=PINK)

# --- STICK MAN 5: @maya (UI Designer, waving hand high, wearing backpack) ---
x5 = 855
draw_footstep_glow(x5, gy, CYAN)
draw_head_halo(x5, gy - 62, CYAN)
rect(x5 - 12, gy - 50, 8, 14, fill=CYAN, stroke=None, radius=3)
ellipse(x5, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x5} {gy-54} L {x5+1} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x5+1} {gy-28} L {x5+14} {gy-14} L {x5+22} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x5+1} {gy-28} L {x5-10} {gy-15} L {x5-18} {gy-2}", stroke=TEXT_WHITE, stroke_w=2.4)
# Waving arm
path(f"M {x5} {gy-48} L {x5-12} {gy-36} L {x5-18} {gy-26}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x5} {gy-48} L {x5+12} {gy-62} L {x5+20} {gy-74}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x5+24} {gy-78} Q {x5+28} {gy-74} {x5+24} {gy-70}", stroke=CYAN, stroke_w=1.2)
path(f"M {x5+27} {gy-82} Q {x5+33} {gy-74} {x5+27} {gy-66}", stroke=CYAN, stroke_w=1)
# Name & Speech bubble
name_tag(x5, gy - 85, "@maya", CYAN)
speech_bubble(x5 + 20, gy - 110, "Love the new theme! 👋", color=TEXT_WHITE, bg="#162534", border=CYAN)

# --- STICK MAN 6: @kai (Walking with stick dog companion) ---
x6 = 1030
draw_footstep_glow(x6, gy, GREEN)
draw_head_halo(x6, gy - 62, GREEN)
ellipse(x6, gy - 62, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x6} {gy-54} L {x6+2} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Legs
path(f"M {x6+2} {gy-28} L {x6+14} {gy-14} L {x6+20} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x6+2} {gy-28} L {x6-10} {gy-15} L {x6-16} {gy-3}", stroke=TEXT_WHITE, stroke_w=2.4)
# Leash arm
path(f"M {x6+1} {gy-48} L {x6-8} {gy-36} L {x6-14} {gy-30}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x6+1} {gy-48} L {x6+14} {gy-40} L {x6+22} {gy-38}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x6+22} {gy-38} Q {x6+36} {gy-28} {x6+48} {gy-14}", stroke=GREEN, stroke_w=1.2)

# Tiny stick puppy!
dx = x6 + 50
draw_footstep_glow(dx + 6, gy, GREEN)
path(f"M {dx} {gy-10} L {dx+16} {gy-10}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {dx+2} {gy-10} L {dx} {gy}", stroke=TEXT_WHITE, stroke_w=1.8)
path(f"M {dx+5} {gy-10} L {dx+7} {gy}", stroke=TEXT_WHITE, stroke_w=1.8)
path(f"M {dx+12} {gy-10} L {dx+10} {gy}", stroke=TEXT_WHITE, stroke_w=1.8)
path(f"M {dx+15} {gy-10} L {dx+17} {gy}", stroke=TEXT_WHITE, stroke_w=1.8)
path(f"M {dx+16} {gy-10} L {dx+20} {gy-16}", stroke=TEXT_WHITE, stroke_w=2.2)
ellipse(dx + 22, gy - 16, 3.5, 3, fill=TEXT_WHITE)
path(f"M {dx+20} {gy-18} L {dx+19} {gy-22}", stroke=TEXT_WHITE, stroke_w=1.5)
path(f"M {dx} {gy-10} Q {dx-6} {gy-18} {dx-3} {gy-20}", stroke=TEXT_WHITE, stroke_w=1.8)
# Name & Speech bubble
name_tag(x6, gy - 85, "@kai", GREEN)
speech_bubble(x6 + 18, gy - 110, "Agent + dog synced 🐕", color=TEXT_WHITE, bg="#162c23", border=GREEN)

# --- STICK MAN 7: @guest_42 (Latecomer running / sprinting to join the parade) ---
x7 = 1220
draw_footstep_glow(x7, gy, GOLD)
draw_head_halo(x7, gy - 62, GOLD)
path(f"M {x7-8} {gy-66} L {x7+6} {gy-66}", stroke=GOLD, stroke_w=2.5) # cap visor
ellipse(x7, gy - 63, 7.5, 7.5, fill=BAR_BG, stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x7} {gy-54} L {x7+8} {gy-28}", stroke=TEXT_WHITE, stroke_w=2.4)
# Running legs
path(f"M {x7+8} {gy-28} L {x7+26} {gy-18} L {x7+18} {gy}", stroke=TEXT_WHITE, stroke_w=2.4)
path(f"M {x7+8} {gy-28} L {x7-14} {gy-16} L {x7-26} {gy-8}", stroke=TEXT_WHITE, stroke_w=2.4)
# Running arms
path(f"M {x7+4} {gy-48} L {x7+18} {gy-44} L {x7+24} {gy-54}", stroke=TEXT_WHITE, stroke_w=2.2)
path(f"M {x7+4} {gy-48} L {x7-12} {gy-40} L {x7-18} {gy-32}", stroke=TEXT_WHITE, stroke_w=2.2)
# Sprint motion lines
path(f"M {x7-32} {gy-34} L {x7-20} {gy-34}", stroke=TEXT_FAINT, stroke_w=1.5)
path(f"M {x7-38} {gy-24} L {x7-24} {gy-24}", stroke=TEXT_FAINT, stroke_w=1.5)
path(f"M {x7-34} {gy-14} L {x7-22} {gy-14}", stroke=TEXT_FAINT, stroke_w=1.5)
ellipse(x7 + 10, gy - 70, 1.8, 2.5, fill=CYAN)
# Name & Speech bubble
name_tag(x7, gy - 85, "@guest_42", GOLD)
speech_bubble(x7 + 10, gy - 110, "Wait up! Just logged on! 🏃", color=TEXT_WHITE, bg="#282218", border=GOLD)

# Constellation links between adjacent walking users
walkers_coords = [
    (x1, gy - 62),
    (x2, gy - 62),
    (x3, gy - 62),
    (x4, gy - 62),
    (x5, gy - 62),
    (x6, gy - 62),
    (x7, gy - 62)
]
for i in range(len(walkers_coords) - 1):
    wx1, wy1 = walkers_coords[i]
    wx2, wy2 = walkers_coords[i+1]
    cx = (wx1 + wx2) / 2
    cy = wy1 - 18
    path(f"M {wx1} {wy1} Q {cx} {cy} {wx2} {wy2}", stroke=fill_alpha(BAR_ACCENT, 0.22), stroke_w=1.2)

# Build and export with VectorCraft CLI
args = [CLI, "run", "--cmd", "file.new", "--params", json.dumps({"width": W, "height": H, "units": "Pixels", "name": "Online Stick Men Walking"})]
for c, p in steps:
    args += ["--cmd", c, "--params", json.dumps(p)]

exports = ["stick-men-online.vectorcraft", "stick-men-online.svg", "stick-men-online.png"]
for e in exports:
    args += ["--export", os.path.join(OUT, e)]

print(f"Running vectorcraft-cli with {len(steps)} drawing steps...")
r = subprocess.run(args, capture_output=True, text=True)

if r.returncode != 0:
    print("VectorCraft CLI failed:", r.stderr[-2000:], file=sys.stderr)
    sys.exit(r.returncode)

print(f"Successfully exported {len(steps)} vector commands to:")
for e in exports:
    target_path = os.path.join(OUT, e)
    size = os.path.getsize(target_path) if os.path.exists(target_path) else 0
    print(f"  • {e} ({size:,} bytes)")
