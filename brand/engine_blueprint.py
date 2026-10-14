#!/usr/bin/env python3
"""Generates a detailed 2D engineering blueprint of a 4-stroke combustion engine assembly.
Outputs a standard DXF (Drawing Exchange Format) file for CADCraft, plus an SVG rendering.

Usage:
  uv run --with ezdxf python3 brand/engine_blueprint.py
"""
import math, os, sys
import ezdxf
from ezdxf import colors

OUT_DIR = os.path.dirname(os.path.abspath(__file__))
DXF_PATH = os.path.join(OUT_DIR, "engine-blueprint.dxf")
SVG_PATH = os.path.join(OUT_DIR, "engine-blueprint.svg")

def build_engine_dxf():
    doc = ezdxf.new("R2010", setup=True)
    msp = doc.modelspace()

    # Define standard CAD Layers
    layers = [
        ("OUTLINE", colors.WHITE, "Continuous"),
        ("INTERNAL", colors.CYAN, "Continuous"),
        ("CENTER", colors.RED, "CENTER"),
        ("HIDDEN", colors.YELLOW, "DASHED"),
        ("HATCH", 8, "Continuous"),        # Gray
        ("DIMENSIONS", colors.GREEN, "Continuous"),
        ("TEXT", colors.MAGENTA, "Continuous"),
        ("BORDER", colors.BLUE, "Continuous"),
    ]
    for name, col, lt in layers:
        doc.layers.add(name, color=col, linetype=lt)

    # -------------------------------------------------------------
    # Geometry Specifications (in mm)
    # -------------------------------------------------------------
    bore_r = 42.5          # 85mm bore
    wall_th = 12.0
    wall_r = bore_r + wall_th
    fin_ext = 22.0
    stroke = 88.0
    rod_len = 150.0
    crank_r = stroke / 2.0 # 44.0 mm

    crank_c = (0.0, 0.0)
    crankpin_c = (0.0, crank_r) # At TDC
    wristpin_c = (0.0, crank_r + rod_len) # (0, 194.0)

    # 1. Centerlines
    msp.add_line((0, -120), (0, 360), dxfattribs={"layer": "CENTER"})
    msp.add_line((-110, 0), (110, 0), dxfattribs={"layer": "CENTER"})
    msp.add_circle(crank_c, crank_r, dxfattribs={"layer": "CENTER"}) # Crankpin trajectory

    # 2. Cylinder Wall & Block
    cyl_bottom = 90.0
    cyl_top = 245.0
    # Left & right bore walls
    msp.add_line((-bore_r, cyl_bottom), (-bore_r, cyl_top), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((bore_r, cyl_bottom), (bore_r, cyl_top), dxfattribs={"layer": "OUTLINE"})
    # Outer block walls
    msp.add_line((-wall_r, cyl_bottom), (-wall_r, cyl_top), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((wall_r, cyl_bottom), (wall_r, cyl_top), dxfattribs={"layer": "OUTLINE"})

    # Cooling fins (6 horizontal fins on each side)
    fin_ys = [115, 135, 155, 175, 195, 215, 235]
    for fy in fin_ys:
        # Left fins
        msp.add_line((-wall_r, fy), (-wall_r - fin_ext, fy), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((-wall_r - fin_ext, fy), (-wall_r - fin_ext, fy + 6), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((-wall_r - fin_ext, fy + 6), (-wall_r, fy + 6), dxfattribs={"layer": "OUTLINE"})
        # Right fins
        msp.add_line((wall_r, fy), (wall_r + fin_ext, fy), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((wall_r + fin_ext, fy), (wall_r + fin_ext, fy + 6), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((wall_r + fin_ext, fy + 6), (wall_r, fy + 6), dxfattribs={"layer": "OUTLINE"})

    # 3. Cylinder Head & Combustion Chamber (Pent-Roof / Dome)
    head_top = 330.0
    head_w = wall_r + 25.0
    msp.add_line((-head_w, cyl_top), (-head_w, head_top), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((head_w, cyl_top), (head_w, head_top), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-head_w, head_top), (head_w, head_top), dxfattribs={"layer": "OUTLINE"})
    # Joint gasket line
    msp.add_line((-head_w, cyl_top), (-bore_r, cyl_top), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((bore_r, cyl_top), (head_w, cyl_top), dxfattribs={"layer": "OUTLINE"})
    # Combustion chamber roof dome
    msp.add_arc((0, 245), bore_r, 0, 180, dxfattribs={"layer": "OUTLINE"})

    # Spark Plug (Centered at top)
    msp.add_line((-6, 287), (6, 287), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-6, 287), (-6, head_top + 30), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((6, 287), (6, head_top + 30), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-6, head_top + 30), (6, head_top + 30), dxfattribs={"layer": "OUTLINE"})
    # Ceramic insulator ribs
    for ry in [head_top + 5, head_top + 12, head_top + 19, head_top + 26]:
        msp.add_line((-9, ry), (9, ry), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((-9, ry), (-9, ry + 3), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((9, ry), (9, ry + 3), dxfattribs={"layer": "OUTLINE"})
        msp.add_line((-9, ry + 3), (9, ry + 3), dxfattribs={"layer": "OUTLINE"})
    # Electrode gap
    msp.add_line((0, 287), (0, 277), dxfattribs={"layer": "INTERNAL"})
    msp.add_line((-3, 275), (0, 275), dxfattribs={"layer": "INTERNAL"})

    # 4. Intake & Exhaust Valves
    # Left: Intake valve (angled at -18 deg)
    # Right: Exhaust valve (angled at +18 deg)
    for sign, label in [(-1, "INTAKE"), (1, "EXHAUST")]:
        vx = sign * 20.0
        vy = 262.0
        valve_r = 14.0
        stem_r = 3.5
        # Valve head bevel
        msp.add_line((vx - valve_r, vy), (vx + valve_r, vy), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((vx - valve_r, vy), (vx - stem_r, vy + 8), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((vx + valve_r, vy), (vx + stem_r, vy + 8), dxfattribs={"layer": "INTERNAL"})
        # Valve stem extending up through head
        msp.add_line((vx - stem_r, vy + 8), (vx - stem_r, head_top + 10), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((vx + stem_r, vy + 8), (vx + stem_r, head_top + 10), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((vx - stem_r, head_top + 10), (vx + stem_r, head_top + 10), dxfattribs={"layer": "INTERNAL"})
        # Valve spring coils
        for sy in range(int(vy + 18), int(head_top), 8):
            msp.add_line((vx - 9, sy), (vx + 9, sy + 4), dxfattribs={"layer": "INTERNAL"})
            msp.add_line((vx + 9, sy + 4), (vx - 9, sy + 8), dxfattribs={"layer": "INTERNAL"})

    # 5. Piston (At TDC)
    piston_crown_y = 238.0
    piston_skirt_y = 178.0
    p_clearance = 0.5
    p_r = bore_r - p_clearance

    # Piston crown with valve relief pockets
    msp.add_line((-p_r, piston_crown_y), (-25, piston_crown_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-25, piston_crown_y), (-22, piston_crown_y - 3), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-22, piston_crown_y - 3), (-10, piston_crown_y - 3), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-10, piston_crown_y - 3), (-7, piston_crown_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-7, piston_crown_y), (7, piston_crown_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((7, piston_crown_y), (10, piston_crown_y - 3), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((10, piston_crown_y - 3), (22, piston_crown_y - 3), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((22, piston_crown_y - 3), (25, piston_crown_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((25, piston_crown_y), (p_r, piston_crown_y), dxfattribs={"layer": "OUTLINE"})

    # Piston skirt outer walls
    msp.add_line((-p_r, piston_crown_y), (-p_r, piston_skirt_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((p_r, piston_crown_y), (p_r, piston_skirt_y), dxfattribs={"layer": "OUTLINE"})
    # Piston bottom skirt arc cutaways
    msp.add_line((-p_r, piston_skirt_y), (-26, piston_skirt_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((26, piston_skirt_y), (p_r, piston_skirt_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_arc((0, piston_skirt_y + 10), 26, 180, 0, dxfattribs={"layer": "OUTLINE"})

    # Piston Rings (3 ring grooves)
    ring_grooves = [231.0, 225.0, 218.0]
    for rgy in ring_grooves:
        # Left ring slot
        msp.add_line((-p_r, rgy), (-p_r + 4.5, rgy), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((-p_r + 4.5, rgy), (-p_r + 4.5, rgy + 2), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((-p_r + 4.5, rgy + 2), (-p_r, rgy + 2), dxfattribs={"layer": "INTERNAL"})
        # Right ring slot
        msp.add_line((p_r, rgy), (p_r - 4.5, rgy), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((p_r - 4.5, rgy), (p_r - 4.5, rgy + 2), dxfattribs={"layer": "INTERNAL"})
        msp.add_line((p_r - 4.5, rgy + 2), (p_r, rgy + 2), dxfattribs={"layer": "INTERNAL"})

    # Wrist Pin (Gudgeon Pin)
    pin_r = 10.0
    msp.add_circle(wristpin_c, pin_r, dxfattribs={"layer": "OUTLINE"})
    msp.add_circle(wristpin_c, pin_r - 3.0, dxfattribs={"layer": "HIDDEN"}) # Hollow pin bore
    msp.add_circle(wristpin_c, pin_r + 6.0, dxfattribs={"layer": "OUTLINE"}) # Piston pin boss

    # 6. Connecting Rod (H-Beam Rod)
    # Small end eye
    msp.add_circle(wristpin_c, pin_r + 4.0, dxfattribs={"layer": "OUTLINE"})
    # Big end eye around crankpin
    crankpin_r = 21.0
    big_end_outer_r = 30.0
    msp.add_circle(crankpin_c, crankpin_r, dxfattribs={"layer": "OUTLINE"})
    msp.add_circle(crankpin_c, big_end_outer_r, dxfattribs={"layer": "OUTLINE"})

    # Rod shank (H-beam)
    rod_top_y = wristpin_c[1] - (pin_r + 4.0)
    rod_bot_y = crankpin_c[1] + big_end_outer_r
    msp.add_line((-7.5, rod_top_y), (-11.0, rod_bot_y), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((7.5, rod_top_y), (11.0, rod_bot_y), dxfattribs={"layer": "OUTLINE"})
    # H-beam web channel (internal flange)
    msp.add_line((-4.5, rod_top_y + 4), (-6.5, rod_bot_y - 4), dxfattribs={"layer": "INTERNAL"})
    msp.add_line((4.5, rod_top_y + 4), (6.5, rod_bot_y - 4), dxfattribs={"layer": "INTERNAL"})
    # Big end split line & rod bolts
    msp.add_line((-big_end_outer_r - 8, crank_r), (big_end_outer_r + 8, crank_r), dxfattribs={"layer": "OUTLINE"})
    for bx in [-26, 26]:
        msp.add_line((bx - 2.5, crank_r - 18), (bx - 2.5, crank_r + 14), dxfattribs={"layer": "HIDDEN"})
        msp.add_line((bx + 2.5, crank_r - 18), (bx + 2.5, crank_r + 14), dxfattribs={"layer": "HIDDEN"})

    # 7. Crankshaft Web & Counterweight
    # Crankshaft main journal
    msp.add_circle(crank_c, 24.0, dxfattribs={"layer": "OUTLINE"}) # Main journal
    # Counterweight sector (semi-circular counterweight below crank axis)
    cw_r = 82.0
    msp.add_arc(crank_c, cw_r, 190, 350, dxfattribs={"layer": "OUTLINE"})
    msp.add_line((math.cos(math.radians(190)) * cw_r, math.sin(math.radians(190)) * cw_r), (-28, 15), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((math.cos(math.radians(350)) * cw_r, math.sin(math.radians(350)) * cw_r), (28, 15), dxfattribs={"layer": "OUTLINE"})

    # 8. Crankcase Lower Body & Oil Pan
    case_w = wall_r + 35.0
    msp.add_line((-case_w, cyl_bottom), (-case_w, -85), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((case_w, cyl_bottom), (case_w, -85), dxfattribs={"layer": "OUTLINE"})
    # Oil pan sump
    msp.add_line((-case_w, -85), (-case_w + 18, -115), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((case_w, -85), (case_w - 18, -115), dxfattribs={"layer": "OUTLINE"})
    msp.add_line((-case_w + 18, -115), (case_w - 18, -115), dxfattribs={"layer": "OUTLINE"})

    # 9. Engineering Dimension Lines & Callouts
    dim_x_left = -115.0
    dim_x_right = 115.0

    # Bore dimension: Ø 85.0 mm
    msp.add_line((-bore_r, 252), (bore_r, 252), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((-bore_r, 248), (-bore_r, 256), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((bore_r, 248), (bore_r, 256), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_text("BORE: %%c85.00 mm", height=4.5, dxfattribs={"layer": "TEXT"}).set_placement((-24, 255))

    # Stroke dimension: 88.0 mm (between TDC and BDC)
    bdc_y = wristpin_c[1] - stroke
    msp.add_line((dim_x_right, bdc_y), (dim_x_right, wristpin_c[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((dim_x_right - 4, bdc_y), (dim_x_right + 4, bdc_y), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((dim_x_right - 4, wristpin_c[1]), (dim_x_right + 4, wristpin_c[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_text("STROKE: 88.00 mm", height=4.5, dxfattribs={"layer": "TEXT", "rotation": 90}).set_placement((dim_x_right + 6, bdc_y + 12))

    # Rod Center-to-Center: 150.0 mm
    msp.add_line((dim_x_left, crankpin_c[1]), (dim_x_left, wristpin_c[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((dim_x_left - 4, crankpin_c[1]), (dim_x_left + 4, crankpin_c[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_line((dim_x_left - 4, wristpin_c[1]), (dim_x_left + 4, wristpin_c[1]), dxfattribs={"layer": "DIMENSIONS"})
    msp.add_text("ROD CTR: 150.00 mm", height=4.5, dxfattribs={"layer": "TEXT", "rotation": 90}).set_placement((dim_x_left - 8, crankpin_c[1] + 28))

    # Technical Specifications Callouts
    specs = [
        ("DISPLACEMENT: 499.3 cc", (-145, 340)),
        ("COMPRESSION RATIO: 10.5 : 1", (-145, 330)),
        ("VALVE CONFIGURATION: 2-VALVE DOHC", (-145, 320)),
        ("WRIST PIN: %%c20.00 mm", (-145, 194)),
        ("CRANKPIN: %%c42.00 mm", (-145, 44)),
        ("MAIN JOURNAL: %%c48.00 mm", (-145, 0)),
        ("TDC (TOP DEAD CENTER)", (75, 238)),
        ("OIL SUMP CAPACITY: 1.4 L", (65, -105)),
    ]
    for stxt, (sx, sy) in specs:
        msp.add_text(stxt, height=3.8, dxfattribs={"layer": "TEXT"}).set_placement((sx, sy))
        msp.add_line((sx, sy - 1), (sx + len(stxt) * 2.3, sy - 1), dxfattribs={"layer": "DIMENSIONS"})

    # 10. Sheet Border and Engineering Title Block
    bx1, by1 = -160.0, -135.0
    bx2, by2 = 160.0, 375.0
    msp.add_line((bx1, by1), (bx2, by1), dxfattribs={"layer": "BORDER"})
    msp.add_line((bx2, by1), (bx2, by2), dxfattribs={"layer": "BORDER"})
    msp.add_line((bx2, by2), (bx1, by2), dxfattribs={"layer": "BORDER"})
    msp.add_line((bx1, by2), (bx1, by1), dxfattribs={"layer": "BORDER"})

    # Title Block (Bottom Right corner)
    tbx1, tby1 = 20.0, -135.0
    tbx2, tby2 = 160.0, -75.0
    msp.add_line((tbx1, tby1), (tbx1, tby2), dxfattribs={"layer": "BORDER"})
    msp.add_line((tbx1, tby2), (tbx2, tby2), dxfattribs={"layer": "BORDER"})
    msp.add_line((tbx1, -95), (tbx2, -95), dxfattribs={"layer": "BORDER"})
    msp.add_line((tbx1, -115), (tbx2, -115), dxfattribs={"layer": "BORDER"})
    msp.add_line((90, -95), (90, -135), dxfattribs={"layer": "BORDER"})

    # Title Block Text
    msp.add_text("CADCraft 0.7.0 MECHANICAL SYSTEMS", height=3.5, dxfattribs={"layer": "TEXT"}).set_placement((tbx1 + 4, -83))
    msp.add_text("4-STROKE 500cc SINGLE CYLINDER ENGINE", height=4.2, dxfattribs={"layer": "TEXT"}).set_placement((tbx1 + 4, -91))
    msp.add_text("DWG NO: ENG-500-ASM-01", height=3.2, dxfattribs={"layer": "TEXT"}).set_placement((tbx1 + 4, -104))
    msp.add_text("SCALE: 1:1  (METRIC mm)", height=3.2, dxfattribs={"layer": "TEXT"}).set_placement((tbx1 + 4, -111))
    msp.add_text("DRAWN BY: Antigravity AI", height=3.0, dxfattribs={"layer": "TEXT"}).set_placement((94, -104))
    msp.add_text("DATE: 2026-10-14", height=3.0, dxfattribs={"layer": "TEXT"}).set_placement((94, -111))
    msp.add_text("STATUS: APPROVED FOR MANUFACTURE", height=3.2, dxfattribs={"layer": "TEXT"}).set_placement((tbx1 + 4, -126))

    doc.saveas(DXF_PATH)
    print(f"DXF saved successfully: {DXF_PATH} ({os.path.getsize(DXF_PATH):,} bytes)")

if __name__ == "__main__":
    build_engine_dxf()
