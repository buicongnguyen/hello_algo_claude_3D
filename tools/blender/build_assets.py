"""Generate Robot Beach 3D low-poly source and GLB assets with Blender 4.5+."""

import bpy
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "assets" / "blender"
OUT_DIR = ROOT / "public" / "models"
SOURCE_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.55, emission=None):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 3.5
    return mat


WHITE = material("Ceramic White", (0.78, 0.86, 0.89), 0.35, 0.28)
NAVY = material("Joint Navy", (0.025, 0.10, 0.16), 0.65, 0.3)
CYAN = material("Aurora Cyan", (0.02, 0.72, 0.86), 0.15, 0.18, (0.02, 0.8, 1.0))
CORAL = material("Rust Coral", (0.72, 0.16, 0.11), 0.45, 0.48)
ORANGE = material("Warning Orange", (1.0, 0.38, 0.08), 0.1, 0.25, (1.0, 0.18, 0.02))
GOLD = material("Signal Gold", (1.0, 0.63, 0.08), 0.4, 0.25, (1.0, 0.42, 0.02))
GREEN = material("Shelter Green", (0.08, 0.62, 0.34), 0.15, 0.45)
RED = material("Lighthouse Red", (0.82, 0.08, 0.06), 0.35, 0.36)
BROWN = material("Palm Trunk", (0.40, 0.18, 0.07), 0.0, 0.85)
LEAF = material("Palm Leaf", (0.05, 0.48, 0.22), 0.0, 0.72)


def set_mat(obj, mat):
    obj.data.materials.append(mat)
    return obj


def cube(name, loc, scale, mat, bevel=0.12, parent=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new("Soft bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 2
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def sphere(name, loc, scale, mat, parent=None):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=16, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def cone(name, loc, radius1, radius2, depth, mat, parent=None, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def robot(name="KAI_Robot", hostile=False):
    r = root(name)
    shell = CORAL if hostile else WHITE
    light = ORANGE if hostile else CYAN
    cube("Torso", (0, 0, 1.35), (0.48, 0.30, 0.58), shell, 0.18, r)
    cube("ChestEmitter", (0, -0.32, 1.42), (0.20, 0.045, 0.17), light, 0.06, r)
    sphere("Head", (0, 0, 2.15), (0.48, 0.42, 0.42), shell, r)
    cube("Visor", (0, -0.40, 2.14), (0.31, 0.055, 0.10), light, 0.06, r)
    for side in (-1, 1):
        sphere(f"Shoulder_{side}", (side * 0.62, 0, 1.66), (0.16, 0.16, 0.16), NAVY, r)
        cylinder(f"Arm_{side}", (side * 0.72, 0, 1.25), 0.12, 0.72, shell, r)
        sphere(f"Hand_{side}", (side * 0.72, 0, 0.84), (0.16, 0.16, 0.16), light, r)
        cylinder(f"Leg_{side}", (side * 0.24, 0, 0.48), 0.15, 0.72, NAVY, r)
        cube(f"Foot_{side}", (side * 0.24, -0.10, 0.10), (0.23, 0.34, 0.10), shell, 0.08, r)
    cylinder("Antenna", (0, 0, 2.65), 0.035, 0.32, NAVY, r)
    sphere("AntennaLight", (0, 0, 2.84), (0.09, 0.09, 0.09), light, r)
    return r


def dog():
    r = root("BOLT_Dog")
    cube("Body", (0, 0, 0.72), (0.72, 0.33, 0.35), WHITE, 0.16, r)
    cube("Head", (0, -0.62, 0.92), (0.38, 0.35, 0.34), WHITE, 0.14, r)
    cube("Visor", (0, -0.97, 0.95), (0.25, 0.04, 0.08), CYAN, 0.04, r)
    for x in (-0.48, 0.48):
        for y in (-0.20, 0.22):
            cylinder("Leg", (x, y, 0.30), 0.08, 0.52, NAVY, r)
    tail = cylinder("Tail", (0, 0.48, 1.02), 0.06, 0.7, CYAN, r, rotation=(math.radians(48), 0, 0))
    return r


def lighthouse():
    r = root("LUMA_Lighthouse")
    cone("Tower", (0, 0, 3.1), 1.28, 0.78, 6.2, WHITE, r, 24)
    for z in (1.2, 2.6, 4.0):
        cylinder("RedBand", (0, 0, z), 1.10 - z * 0.07, 0.42, RED, r, 24)
    cylinder("Gallery", (0, 0, 6.25), 1.08, 0.18, NAVY, r, 24)
    cylinder("LensRoom", (0, 0, 6.7), 0.68, 0.86, CYAN, r, 24)
    cone("Roof", (0, 0, 7.32), 0.90, 0.08, 0.65, RED, r, 24)
    sphere("BeamAnchor", (0, -0.60, 6.72), (0.10, 0.10, 0.10), CYAN, r)
    return r


def energy_cell():
    r = root("Aurora_Cell")
    cylinder("Core", (0, 0, 0.48), 0.22, 0.74, CYAN, r, 12)
    cylinder("Top", (0, 0, 0.89), 0.30, 0.12, GOLD, r, 12)
    cylinder("Base", (0, 0, 0.07), 0.30, 0.12, GOLD, r, 12)
    for angle in (0, math.pi / 2):
        bar = cube("Frame", (0, 0, 0.48), (0.38, 0.05, 0.05), NAVY, 0.03, r)
        bar.rotation_euler.z = angle
    return r


def turret():
    r = root("Solar_Turret")
    cylinder("Base", (0, 0, 0.18), 0.55, 0.36, NAVY, r, 16)
    cylinder("Column", (0, 0, 0.73), 0.20, 0.76, WHITE, r, 12)
    sphere("Head", (0, 0, 1.18), (0.42, 0.34, 0.30), WHITE, r)
    cylinder("PulseBarrel", (0, -0.48, 1.18), 0.10, 0.72, CYAN, r, 12, (math.pi / 2, 0, 0))
    return r


def rocket():
    r = root("Festival_Rocket")
    cylinder("Body", (0, 0, 3.1), 0.72, 5.2, WHITE, r, 20)
    cone("Nose", (0, 0, 6.15), 0.72, 0.02, 1.0, RED, r, 20)
    for angle in (0, 2.094, 4.188):
        fin = cube("Fin", (math.sin(angle) * 0.68, math.cos(angle) * 0.68, 1.0), (0.12, 0.48, 0.72), RED, 0.08, r)
        fin.rotation_euler.z = -angle
    cylinder("Window", (0, -0.70, 4.1), 0.24, 0.08, CYAN, r, 16, (math.pi / 2, 0, 0))
    return r


def crab():
    r = root("Rescue_Crab")
    sphere("Shell", (0, 0, 0.28), (0.55, 0.35, 0.25), CORAL, r)
    for side in (-1, 1):
        sphere("Eye", (side * 0.22, -0.23, 0.57), (0.08, 0.08, 0.12), NAVY, r)
        for y in (-0.18, 0.04, 0.24):
            leg = cylinder("Leg", (side * 0.55, y, 0.18), 0.035, 0.52, CORAL, r, 8, (0, math.radians(70), 0))
        sphere("Claw", (side * 0.76, -0.27, 0.37), (0.20, 0.16, 0.15), CORAL, r)
    return r


def beacon():
    r = root("Signal_Beacon")
    cylinder("Foot", (0, 0, 0.08), 0.52, 0.16, NAVY, r, 16)
    cylinder("Post", (0, 0, 0.85), 0.12, 1.45, WHITE, r, 12)
    sphere("Signal", (0, 0, 1.68), (0.34, 0.34, 0.34), GOLD, r)
    return r


def palm():
    r = root("Beach_Palm")
    cylinder("Trunk", (0, 0, 1.9), 0.22, 3.8, BROWN, r, 10)
    for index in range(7):
        angle = index * math.tau / 7
        leaf = cube("Frond", (math.sin(angle) * 0.9, math.cos(angle) * 0.9, 3.9), (0.18, 1.0, 0.06), LEAF, 0.1, r)
        leaf.rotation_euler.z = -angle
        leaf.rotation_euler.x = math.radians(12)
    return r


builders = {
    "kai": lambda: robot(),
    "bolt": dog,
    "rust_scout": lambda: robot("Rust_Scout", True),
    "lighthouse": lighthouse,
    "energy_cell": energy_cell,
    "turret": turret,
    "rocket": rocket,
    "crab": crab,
    "beacon": beacon,
    "palm": palm,
}

roots = {}
spacing = 5.0
for index, (asset_name, builder) in enumerate(builders.items()):
    asset_root = builder()
    asset_root.location.x = (index % 5) * spacing
    asset_root.location.y = (index // 5) * spacing
    roots[asset_name] = asset_root

bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "robot_beach_assets.blend"))


def descendants(obj):
    result = [obj]
    for child in obj.children:
        result.extend(descendants(child))
    return result


report = []
for asset_name, asset_root in roots.items():
    original_location = asset_root.location.copy()
    asset_root.location = (0, 0, 0)
    bpy.ops.object.select_all(action="DESELECT")
    selected = descendants(asset_root)
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = asset_root
    path = OUT_DIR / f"{asset_name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
    )
    triangles = sum(len(obj.data.polygons) for obj in selected if obj.type == "MESH")
    report.append({"name": asset_name, "file": path.name, "bytes": path.stat().st_size, "meshFaces": triangles})
    asset_root.location = original_location

(OUT_DIR / "manifest.json").write_text(json.dumps({
    "generator": "Blender 4.5.3 LTS / tools/blender/build_assets.py",
    "source": "assets/blender/robot_beach_assets.blend",
    "assets": report,
}, indent=2), encoding="utf-8")

print(json.dumps(report, indent=2))
