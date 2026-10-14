#!/usr/bin/env python3
"""Builds a realistic 3D mechanical engine model and renders it using Blender.
Features an engineering cutaway section to reveal internal pistons, connecting rod,
wrist pin, valves, and crankshaft assembly.

Creates:
  - brand/engine-3d.blend       (Blender 3D scene)
  - brand/engine-3d-render.png  (High-resolution 3D render)
"""
import bpy
import math

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, color, metallic=0.0, roughness=0.3):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Metallic"].default_value = metallic
        bsdf.inputs["Roughness"].default_value = roughness
    return mat

def smooth_object(obj):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth()

def apply_cutaway(obj, cutter):
    mod = obj.modifiers.new(name="Cutaway", type="BOOLEAN")
    mod.object = cutter
    mod.operation = "DIFFERENCE"
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="Cutaway")

def build_engine():
    clear_scene()

    # Materials
    mat_aluminum = create_material("CastAluminum", (0.85, 0.88, 0.92, 1.0), metallic=0.92, roughness=0.3)
    mat_piston = create_material("PistonAlloy", (0.92, 0.94, 0.97, 1.0), metallic=0.95, roughness=0.2)
    mat_steel = create_material("MachinedSteel", (0.92, 0.94, 0.98, 1.0), metallic=0.98, roughness=0.15)
    mat_iron = create_material("CastIron", (0.35, 0.38, 0.44, 1.0), metallic=0.88, roughness=0.45)
    mat_chrome = create_material("ChromeRod", (0.98, 0.98, 1.0, 1.0), metallic=1.0, roughness=0.08)
    mat_gold_brass = create_material("BrassBushings", (0.95, 0.76, 0.32, 1.0), metallic=0.9, roughness=0.22)
    mat_ceramic = create_material("CeramicWhite", (0.98, 0.98, 0.98, 1.0), metallic=0.0, roughness=0.12)
    mat_copper = create_material("CopperGasket", (0.92, 0.52, 0.32, 1.0), metallic=0.92, roughness=0.22)
    mat_dark_stand = create_material("DarkStand", (0.12, 0.14, 0.18, 1.0), metallic=0.7, roughness=0.5)

    # 1. Crankshaft & Counterweight (at origin z = 0)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.42, depth=3.2, location=(0, 0, 0))
    crank_main = bpy.context.active_object
    crank_main.name = "Crankshaft_MainJournal"
    crank_main.rotation_euler = (math.pi / 2, 0, 0)
    crank_main.data.materials.append(mat_steel)
    smooth_object(crank_main)

    # Counterweight lobes (pear / wedge shaped sector)
    for y_offset in [-0.85, 0.85]:
        bpy.ops.mesh.primitive_cylinder_add(radius=1.35, depth=0.35, location=(0, y_offset, -0.4))
        web = bpy.context.active_object
        web.name = f"Crank_Counterweight_{y_offset}"
        web.scale = (1.1, 1.0, 0.85)
        web.rotation_euler = (math.pi / 2, 0, 0)
        web.data.materials.append(mat_iron)
        smooth_object(web)

    # Crankpin (positioned at 35 degrees off TDC to show dynamic motion angle)
    crank_angle = math.radians(28)
    crank_throw = 0.85
    pin_x = math.sin(crank_angle) * crank_throw
    pin_z = math.cos(crank_angle) * crank_throw

    bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=1.3, location=(pin_x, 0, pin_z))
    crankpin = bpy.context.active_object
    crankpin.name = "Crankpin"
    crankpin.rotation_euler = (math.pi / 2, 0, 0)
    crankpin.data.materials.append(mat_steel)
    smooth_object(crankpin)

    # 2. Connecting Rod & Piston Kinematics
    rod_len = 2.85
    # Wrist pin moves purely on vertical Z axis at x = 0
    # pin_x^2 + (wristpin_z - pin_z)^2 = rod_len^2
    wristpin_z = pin_z + math.sqrt(rod_len**2 - pin_x**2)
    rod_angle = math.atan2(-pin_x, wristpin_z - pin_z)

    # Big-end journal & cap
    bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.55, location=(pin_x, 0, pin_z))
    rod_big = bpy.context.active_object
    rod_big.rotation_euler = (math.pi / 2, 0, 0)
    rod_big.data.materials.append(mat_chrome)
    smooth_object(rod_big)

    # Small-end eye (at wrist pin)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.28, depth=0.5, location=(0, 0, wristpin_z))
    rod_small = bpy.context.active_object
    rod_small.rotation_euler = (math.pi / 2, 0, 0)
    rod_small.data.materials.append(mat_chrome)
    smooth_object(rod_small)

    # H-beam rod shank
    shank_mid_x = pin_x / 2.0
    shank_mid_z = (pin_z + wristpin_z) / 2.0
    shank_len = rod_len - 0.72
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(shank_mid_x, 0, shank_mid_z))
    shank = bpy.context.active_object
    shank.name = "Rod_Shank"
    shank.scale = (0.24, 0.36, shank_len)
    shank.rotation_euler = (0, rod_angle, 0)
    shank.data.materials.append(mat_chrome)
    smooth_object(shank)

    # Rod bolts
    for bx in [-0.42, 0.42]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.8, location=(pin_x + bx, 0, pin_z - 0.2))
        bolt = bpy.context.active_object
        bolt.data.materials.append(mat_steel)
        smooth_object(bolt)

    # 3. Piston (at wristpin_z)
    piston_h = 1.35
    piston_r = 1.05
    piston_z = wristpin_z + 0.15
    bpy.ops.mesh.primitive_cylinder_add(radius=piston_r, depth=piston_h, location=(0, 0, piston_z))
    piston = bpy.context.active_object
    piston.name = "Piston"
    piston.data.materials.append(mat_piston)
    smooth_object(piston)

    # Crown dome & valve recesses
    bpy.ops.mesh.primitive_cylinder_add(radius=piston_r * 0.94, depth=0.08, location=(0, 0, piston_z + piston_h / 2.0 + 0.04))
    crown = bpy.context.active_object
    crown.data.materials.append(mat_steel)
    smooth_object(crown)

    # 3 Piston Rings
    for i, rz_off in enumerate([0.38, 0.22, 0.06]):
        bpy.ops.mesh.primitive_torus_add(major_radius=piston_r + 0.015, minor_radius=0.025, location=(0, 0, piston_z + rz_off))
        ring = bpy.context.active_object
        ring.name = f"PistonRing_{i}"
        ring.data.materials.append(mat_steel)
        smooth_object(ring)

    # Wrist Pin
    bpy.ops.mesh.primitive_cylinder_add(radius=0.2, depth=1.9, location=(0, 0, wristpin_z))
    wristpin = bpy.context.active_object
    wristpin.name = "WristPin"
    wristpin.rotation_euler = (math.pi / 2, 0, 0)
    wristpin.data.materials.append(mat_steel)
    smooth_object(wristpin)

    # 4. Cylinder Block & Cooling Fins with Cutaway Box
    block_h = 3.6
    block_z = 2.45

    # Create master cutter box: removes front half (y < 0.05 and x > -0.2)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.8, -1.2, 2.5))
    cutter = bpy.context.active_object
    cutter.name = "MasterCutawayBox"
    cutter.scale = (2.8, 2.6, 4.4)

    # Block
    bpy.ops.mesh.primitive_cylinder_add(radius=1.38, depth=block_h, location=(0, 0, block_z))
    block = bpy.context.active_object
    block.name = "CylinderBlock"
    block.data.materials.append(mat_iron)
    smooth_object(block)
    apply_cutaway(block, cutter)

    # Cooling Fins
    fin_objs = []
    for fz in [1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0]:
        bpy.ops.mesh.primitive_cylinder_add(radius=1.75, depth=0.07, location=(0, 0, fz))
        fin = bpy.context.active_object
        fin.data.materials.append(mat_aluminum)
        smooth_object(fin)
        apply_cutaway(fin, cutter)
        fin_objs.append(fin)

    # 5. Cylinder Head & Valves
    head_z = block_z + block_h / 2.0 + 0.55
    bpy.ops.mesh.primitive_cylinder_add(radius=1.75, depth=0.85, location=(0, 0, head_z))
    head = bpy.context.active_object
    head.name = "CylinderHead"
    head.data.materials.append(mat_aluminum)
    smooth_object(head)
    apply_cutaway(head, cutter)

    # Delete cutter after cutaways applied
    bpy.data.objects.remove(cutter, do_unlink=True)

    # Head Gasket
    bpy.ops.mesh.primitive_cylinder_add(radius=1.45, depth=0.05, location=(0, 0, block_z + block_h / 2.0 + 0.05))
    gasket = bpy.context.active_object
    gasket.name = "HeadGasket"
    gasket.data.materials.append(mat_copper)

    # Overhead Valves & Springs
    for vx, v_angle in [(-0.48, -0.25), (0.48, 0.25)]:
        # Valve head
        bpy.ops.mesh.primitive_cone_add(radius1=0.34, radius2=0.08, depth=0.18, location=(vx, 0, head_z - 0.35))
        vhead = bpy.context.active_object
        vhead.rotation_euler = (0, v_angle, 0)
        vhead.data.materials.append(mat_steel)
        smooth_object(vhead)

        # Valve stem
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=1.5, location=(vx * 1.3, 0, head_z + 0.3))
        vstem = bpy.context.active_object
        vstem.rotation_euler = (0, v_angle, 0)
        vstem.data.materials.append(mat_steel)
        smooth_object(vstem)

        # Valve spring coils
        for spz in [head_z + 0.12, head_z + 0.28, head_z + 0.44, head_z + 0.6]:
            bpy.ops.mesh.primitive_torus_add(major_radius=0.2, minor_radius=0.035, location=(vx * 1.3, 0, spz))
            coil = bpy.context.active_object
            coil.rotation_euler = (0, v_angle, 0)
            coil.data.materials.append(mat_steel)
            smooth_object(coil)

    # 6. Spark Plug (Center of cylinder head)
    plug_z = head_z + 0.65
    bpy.ops.mesh.primitive_cylinder_add(radius=0.16, depth=0.4, location=(0, 0, plug_z - 0.25))
    plug_base = bpy.context.active_object
    plug_base.data.materials.append(mat_steel)
    smooth_object(plug_base)

    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.22, depth=0.2, location=(0, 0, plug_z))
    plug_hex = bpy.context.active_object
    plug_hex.data.materials.append(mat_steel)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.14, depth=0.6, location=(0, 0, plug_z + 0.35))
    plug_ceramic = bpy.context.active_object
    plug_ceramic.data.materials.append(mat_ceramic)
    smooth_object(plug_ceramic)

    for rib_z in [plug_z + 0.2, plug_z + 0.32, plug_z + 0.44]:
        bpy.ops.mesh.primitive_torus_add(major_radius=0.16, minor_radius=0.025, location=(0, 0, rib_z))
        rib = bpy.context.active_object
        rib.data.materials.append(mat_ceramic)
        smooth_object(rib)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.08, depth=0.18, location=(0, 0, plug_z + 0.72))
    plug_top = bpy.context.active_object
    plug_top.data.materials.append(mat_gold_brass)
    smooth_object(plug_top)

    # 7. Display Stand Pedestal
    bpy.ops.mesh.primitive_cylinder_add(radius=2.6, depth=0.25, location=(0, 0, -1.2))
    stand = bpy.context.active_object
    stand.name = "DisplayStand"
    stand.data.materials.append(mat_dark_stand)
    smooth_object(stand)

    # 8. Target Empty for Camera Tracking
    target_empty = bpy.data.objects.new("TargetEmpty", None)
    target_empty.location = (0, 0, 2.6)
    bpy.context.scene.collection.objects.link(target_empty)

    # Camera with Track To constraint
    cam_data = bpy.data.cameras.new(name="Camera")
    cam_obj = bpy.data.objects.new("Camera", cam_data)
    bpy.context.scene.collection.objects.link(cam_obj)
    bpy.context.scene.camera = cam_obj
    cam_obj.location = (8.0, -8.8, 4.6)
    cam_data.lens = 35.0

    track_mod = cam_obj.constraints.new(type="TRACK_TO")
    track_mod.target = target_empty
    track_mod.track_axis = "TRACK_NEGATIVE_Z"
    track_mod.up_axis = "UP_Y"

    # 9. 3-Point Studio Lighting
    # Key Light (warm main light)
    light_key_data = bpy.data.lights.new(name="KeyLight", type="SUN")
    light_key_data.energy = 5.5
    light_key_data.color = (1.0, 0.98, 0.95)
    light_key = bpy.data.objects.new("KeyLight", light_key_data)
    light_key.location = (5.0, -6.0, 8.0)
    light_key.rotation_euler = (math.radians(45), math.radians(15), math.radians(35))
    bpy.context.scene.collection.objects.link(light_key)

    # Fill Light (soft cool blue area light from left)
    light_fill_data = bpy.data.lights.new(name="FillLight", type="AREA")
    light_fill_data.energy = 260.0
    light_fill_data.size = 6.0
    light_fill_data.color = (0.75, 0.88, 1.0)
    light_fill = bpy.data.objects.new("FillLight", light_fill_data)
    light_fill.location = (-6.5, -6.0, 3.5)
    light_fill.rotation_euler = (math.radians(50), 0, math.radians(-50))
    bpy.context.scene.collection.objects.link(light_fill)

    # Rim Light (back edge highlights on chrome rod & piston rings)
    light_rim_data = bpy.data.lights.new(name="RimLight", type="AREA")
    light_rim_data.energy = 380.0
    light_rim_data.size = 5.0
    light_rim_data.color = (0.45, 0.75, 1.0)
    light_rim = bpy.data.objects.new("RimLight", light_rim_data)
    light_rim.location = (1.5, 6.5, 5.5)
    light_rim.rotation_euler = (math.radians(-35), 0, math.radians(180))
    bpy.context.scene.collection.objects.link(light_rim)

    # Internal cavity glow light
    light_cavity_data = bpy.data.lights.new(name="CavityLight", type="POINT")
    light_cavity_data.energy = 45.0
    light_cavity_data.color = (1.0, 0.95, 0.85)
    light_cavity = bpy.data.objects.new("CavityLight", light_cavity_data)
    light_cavity.location = (0.8, -1.0, 2.5)
    bpy.context.scene.collection.objects.link(light_cavity)

    # World background (sleek dark studio slate)
    world = bpy.data.worlds.new("StudioWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.07, 0.08, 0.12, 1.0)
        bg.inputs["Strength"].default_value = 0.9
    bpy.context.scene.world = world

    # Render settings
    scene = bpy.context.scene
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = "/Users/andrejones/Desktop/workspace/projects/markdown-icp/brand/engine-3d-render.png"

    # Save Blend file
    blend_path = "/Users/andrejones/Desktop/workspace/projects/markdown-icp/brand/engine-3d.blend"
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"Saved 3D model to {blend_path}")

    # Export standard GLTF format
    gltf_path = "/Users/andrejones/Desktop/workspace/projects/markdown-icp/brand/engine-3d.gltf"
    bpy.ops.export_scene.gltf(filepath=gltf_path, export_format='GLTF_SEPARATE')
    print(f"Exported GLTF to {gltf_path}")

    # Render image
    print("Rendering 3D engine image...")
    bpy.ops.render.render(write_still=True)
    print(f"Render completed: {scene.render.filepath}")

if __name__ == "__main__":
    build_engine()
