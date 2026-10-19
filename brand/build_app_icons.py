#!/usr/bin/env python3
"""The app's raster icons from candidate A (the cell) in the default theme's colours (Velocity, dark).
Usage: VECTORCRAFT_CLI=... python3 brand/build_app_icons.py  → frontend/public/icon-512.png, icon-192.png, apple-touch-icon.png
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_agent_space_logos as L
L.GROUND, L.GROUND2, L.VIOLET, L.LILAC = "#1f2024", "#2a2b33", "#1b7eee", "#67a9f4"
L.OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public")
for name, size in (("icon-512.png", 512), ("icon-192.png", 192), ("apple-touch-icon.png", 180)):
    L.build(f"Agent Space icon {size}", size, size, L.A(0, 0, size / 512), [name])
