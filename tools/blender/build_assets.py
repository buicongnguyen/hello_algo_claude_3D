"""Generate detailed, batched Robot Beach source and browser-friendly GLB assets."""

import bpy
import json
import hashlib
import math
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "assets" / "blender"
OUT_DIR = ROOT / "public" / "models"
SOURCE_DIR.mkdir(parents=True, exist_ok=True)
OUT_DIR.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0.0, roughness=0.55, emission=None, coat=0.0, glow=1.4):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if coat:
        # A lacquered clear coat (KHR_materials_clearcoat) gives painted shells a premium toy finish.
        bsdf.inputs["Coat Weight"].default_value = coat
        bsdf.inputs["Coat Roughness"].default_value = 0.08
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        # Above 1.0 the exporter writes KHR_materials_emissive_strength, so indicator lights reach bloom.
        bsdf.inputs["Emission Strength"].default_value = glow
    return mat


WHITE = material("Ceramic White", (0.72, 0.79, 0.80), 0.18, 0.34, coat=0.7)
NAVY = material("Joint Navy", (0.018, 0.035, 0.045), 0.12, 0.64)
STEEL = material("Brushed Titanium", (0.32, 0.40, 0.45), 0.85, 0.29)
GLASS = material("Optical Glass", (0.012, 0.065, 0.10), 0.45, 0.13)
SHELL = material("Shell Porcelain", (0.73, 0.47, 0.38), 0.0, 0.48)
OCHRE = material("Starfish Ochre", (.86, .37, .075), 0.0, .68)
LEAF_TIP = material("Palm Leaf Tips", (0.16, 0.31, 0.065), 0.0, 0.83)
CYAN = material("Aurora Cyan", (0.02, 0.72, 0.86), 0.15, 0.18, (0.02, 0.8, 1.0))
CORAL = material("Rust Coral", (0.72, 0.16, 0.11), 0.45, 0.48, coat=0.35)
ORANGE = material("Warning Orange", (1.0, 0.38, 0.08), 0.1, 0.25, (1.0, 0.18, 0.02))
GOLD = material("Signal Gold", (0.85, 0.48, 0.07), 0.7, 0.3)
GREEN = material("Shelter Green", (0.08, 0.62, 0.34), 0.15, 0.45)
RED = material("Lighthouse Red", (0.82, 0.08, 0.06), 0.35, 0.36)
BROWN = material("Palm Trunk", (0.40, 0.18, 0.07), 0.0, 0.85)
LEAF = material("Palm Leaf", (0.05, 0.48, 0.22), 0.0, 0.72)
PINK = material("Reef Pink", (0.8, 0.18, 0.33), 0.0, 0.52)
PURPLE = material("Orchid Violet", (0.31, 0.12, 0.52), 0.0, 0.42)
MINT = material("Sea Mint", (0.12, 0.54, 0.38), 0.0, 0.48)
PEARL = material("Pearl Glow", (1.0, 0.78, 0.9), 0.45, 0.2, (0.4, 0.12, 0.32), coat=0.8, glow=0.6)


def set_mat(obj, mat):
    obj.data.materials.append(mat)
    return obj


# Triangle budgets follow on-screen size (lightweight-game-objects skill). On a 390x844 phone a
# robot is ~60-150 px tall (~50 px per metre), so a 2 cm chamfer is one pixel and a part under
# ~8 cm is a few pixels: those get no bevel, mid-size parts one bevel segment, and only chunky,
# silhouette-sized parts two. Hero parts seen in the workshop close-up keep a little more.
def bevel_segments(scale, bevel, hero=False):
    size, thin = max(scale), min(scale)
    if bevel < (0.015 if hero else 0.02) or size < (0.05 if hero else 0.08):
        return 0
    return 2 if size >= (0.2 if hero else 0.3) and thin >= 0.04 and bevel >= 0.04 else 1


def sphere_subdivisions(scale):
    """Icosphere level: 3 = 320 tris (bodies), 2 = 80 (eyes, bulbs), 1 = 20 (rivets, freckles)."""
    size = max(scale)
    return 3 if size >= 0.3 else 2 if size >= 0.1 else 1


def round_sides(radius):
    """Sides for cylinders and rods of a given radius (stems and pistons need 6)."""
    return 16 if radius >= 0.3 else 12 if radius >= 0.1 else 8 if radius >= 0.05 else 6


def cube_uvs(mesh, half):
    """Blender's default cube unwrap, evaluated per face from its dominant normal axis."""
    layer = mesh.uv_layers.new(name="UVMap")
    for poly in mesh.polygons:
        axis = max(range(3), key=lambda k: (abs(poly.normal[k]), -k))
        positive = poly.normal[axis] >= 0
        for index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[index].vertex_index].co
            x, y, z = (co[k] / half[k] for k in range(3))
            if axis == 0:
                uv = (.375 + (z + 1) * .125, .5 + (1 - y) * .125 if positive else (y + 1) * .125)
            elif axis == 1:
                uv = (.375 + (z + 1) * .125, .25 + (x + 1) * .125 if positive else .75 + (1 - x) * .125)
            else:
                uv = (.625 + (1 - x) * .125 if positive else .125 + (x + 1) * .125, .5 + (1 - y) * .125)
            layer.data[index].uv = uv


def cube(name, loc, scale, mat, bevel=0.12, parent=None, segments=None):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    segments = bevel_segments(scale, bevel) if segments is None else segments
    if bevel and segments:
        # Blender's bevel merges UVs in a run-dependent order (1-ULP differences between
        # processes), which made rebuilt GLBs differ. Bevel without UVs, then project the
        # primitive's own cube layout back on, so every rebuild is byte-identical.
        obj.data.uv_layers.remove(obj.data.uv_layers[0])
        mod = obj.modifiers.new("Soft bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.harden_normals = True
        for face in obj.data.polygons:
            face.use_smooth = True
        normals = obj.modifiers.new("Panel normals", "WEIGHTED_NORMAL")
        normals.keep_sharp = True
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        cube_uvs(obj.data, scale)
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def sphere(name, loc, scale, mat, parent=None, subdivisions=None):
    level = sphere_subdivisions(scale) if subdivisions is None else subdivisions
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=level, radius=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for face in obj.data.polygons:
        face.use_smooth = True
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def cylinder(name, loc, radius, depth, mat, parent=None, vertices=None, rotation=(0, 0, 0)):
    vertices = round_sides(radius) if vertices is None else vertices
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) == 4
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def cone(name, loc, radius1, radius2, depth, mat, parent=None, vertices=16):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius1, radius2=radius2, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    for face in obj.data.polygons:
        face.use_smooth = len(face.vertices) <= 4
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def root(name):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    return obj


def tube(name, points, radius, mat, parent):
    """A small smooth ridge/spiral, baked to a mesh before GLB batching."""
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 1
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for vertex, point in zip(spline.points, points):
        vertex.co = (*point, 1)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    set_mat(obj, mat)
    return obj


def mesh_object(name, verts, faces, mat, parent):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    set_mat(obj, mat)
    for face in mesh.polygons:
        face.use_smooth = len(face.vertices) <= 4
    return obj


def hull(name, sections, mat, parent, loc=(0, 0, 0), rotation=(0, 0, 0), power=0.55, count=24):
    """Loft rounded rectangular cross-sections, not a scaled primitive box."""
    verts, faces = [], []
    for z, width, depth in sections:
        for i in range(count):
            angle = i * math.tau / count
            c, s = math.cos(angle), math.sin(angle)
            verts.append((width * math.copysign(abs(c) ** power, c), depth * math.copysign(abs(s) ** power, s), z))
    for ring in range(len(sections) - 1):
        for i in range(count):
            a, b = ring * count + i, ring * count + (i + 1) % count
            faces.append((a, b, b + count, a + count))
    faces.extend([tuple(reversed(range(count))), tuple(range(len(verts) - count, len(verts)))])
    obj = mesh_object(name, verts, faces, mat, parent)
    obj.location, obj.rotation_euler = loc, rotation
    # Cylindrical UVs keep the shared micro-finish consistent on authored hulls.
    uv = obj.data.uv_layers.new(name="SurfaceUV")
    for face in obj.data.polygons:
        for loop in face.loop_indices:
            index = obj.data.loops[loop].vertex_index
            uv.data[loop].uv = ((index % count) / count, (index // count) / (len(sections) - 1))
    return obj


def rod(name, start, end, radius, mat, parent, vertices=None):
    a, b = Vector(start), Vector(end)
    obj = cylinder(name, (a + b) / 2, radius, (b - a).length, mat, parent, vertices)
    obj.rotation_euler = (b - a).to_track_quat("Z", "Y").to_euler()
    return obj


def tapered_tube(name, points, radii, mat, parent, sides=10, caps=True):
    """Continuous bent organic surface with a shrinking tip."""
    verts, faces = [], []
    for i, point in enumerate(points):
        tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(points[max(0, i - 1)])
        rotation = tangent.to_track_quat("Z", "Y")
        for j in range(sides):
            angle = j * math.tau / sides
            verts.append(Vector(point) + rotation @ Vector((math.cos(angle) * radii[i], math.sin(angle) * radii[i], 0)))
    for i in range(len(points) - 1):
        for j in range(sides):
            a, b = i * sides + j, i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    if caps:
        faces.extend([tuple(reversed(range(sides))), tuple(range(len(verts) - sides, len(verts)))])
    return mesh_object(name, verts, faces, mat, parent)


def robot(name="KAI_Robot", hostile=False):
    r = root(name)
    shell = CORAL if hostile else WHITE
    light = ORANGE if hostile else CYAN
    # KAI is also the workshop close-up (~300-400 px tall), so its larger panels keep a second
    # bevel segment and its limbs 16 sides; the scout is only ever seen in play (~60-150 px).
    hero = not hostile
    round16 = 16 if hero else 12

    def box(part, loc, scale, mat, bevel, parent):
        return cube(part, loc, scale, mat, bevel, parent, segments=bevel_segments(scale, bevel, hero))

    hull("Torso", [(0.85, .27, .20), (.91, .31, .24), (1.23, .34, .25), (1.62, .41, .25), (1.77, .37, .22), (1.86, .26, .17)], shell, r)
    box("ChestSocket", (0, -.265, 1.43), (.20, .025, .19), NAVY, .05, r)
    cylinder("ReactorRim", (0, -.30, 1.43), .145, .045, STEEL, r, round16, (math.pi / 2, 0, 0))
    cylinder("ReactorLens", (0, -.329, 1.43), .105, .02, light, r, round16, (math.pi / 2, 0, 0))
    for side in (-1, 1):
        box("ChestPlateSeam", (side * .26, -.251, 1.58), (.025, .016, .13), NAVY, .015, r)
        box("ChestID", (side * .29, -.269, 1.69), (.07, .012, .018), GOLD, .005, r)
    cylinder("Neck", (0, 0, 1.92), 0.14, 0.16, NAVY, r, round16)
    hull("Helmet", [(1.99, .25, .23), (2.04, .37, .30), (2.20, .40, .34), (2.40, .37, .30), (2.49, .29, .23)], shell, r)
    box("VisorFrame", (0, -0.32, 2.2), (0.34, 0.06, 0.155), NAVY, 0.06, r)
    box("VisorGlass", (0, -.373, 2.21), (.30, .02, .117), GLASS, .055, r)
    for side in (-1, 1):
        cylinder("HelmetAxle", (side * .398, 0, 2.21), .115, .055, STEEL, r, round16, (0, math.pi / 2, 0))
        box("TempleVent", (side * .376, .14, 2.32), (.022, .07, .028), NAVY, .01, r)
    box("HelmetCrest", (0, .015, 2.491), (.05, .18, .012), GOLD, .01, r)
    for x in (-0.15, 0.15):
        box("Optic", (x * 0.8, -0.397, 2.22), (0.06, 0.012, 0.045), light, 0.018, r)
    box("Smile", (0, -0.382, 2.12), (0.08, 0.016, 0.012), light, 0.01, r)
    box("BellyPanel", (0, -0.26, 1.04), (0.28, 0.02, 0.09), NAVY, 0.04, r)
    for x in (-0.2, 0, 0.2):
        box("PowerVent", (x * 0.8, -0.285, 1.04), (0.035, 0.012, 0.04), light, 0.012, r)
    box("BackPanel", (0, 0.258, 1.42), (0.27, 0.02, 0.29), NAVY, 0.05, r)
    for z in (1.25, 1.4, 1.55):
        box("CoolingVent", (0, 0.285, z), (0.19, 0.012, 0.02), light, 0.012, r)
    for x in (-0.32, 0.32):
        for z in (1.03, 1.7):
            sphere("PanelRivet", (x, -0.26, z), (0.025, 0.018, 0.025), GOLD, r)
    for side in (-1, 1):
        suffix = "L" if side == -1 else "R"
        sphere(f"Shoulder_{side}", (side * 0.52, 0, 1.66), (0.14, 0.14, 0.14), NAVY, r)
        arm = root(f"ShoulderPivot_{suffix}")
        arm.parent = r
        arm.location = (side * 0.52, 0, 1.66)
        cylinder("UpperArm", (side * .1, 0, -.22), .115, .33, shell, arm, round16)
        cylinder("ElbowAxle", (side * .1, 0, -.42), .105, .27, STEEL, arm, round16, (0, math.pi / 2, 0))
        hull("Forearm", [(-.74, .095, .1), (-.68, .14, .14), (-.48, .12, .12)], shell, arm, (side * .1, 0, 0), count=16)
        box("WristIndicator", (side * .1, -.14, -.6), (.05, .013, .045), light, .012, arm)
        box("PalmGrip", (side * .1, 0, -.82), (.12, .11, .09), NAVY, .04, arm)
        for finger in (-1, 0, 1):
            box("GripperDigit", (side * .1 + finger * .075, -.095, -.895), (.028, .06, .06), STEEL, .022, arm)
        hip = root(f"Hip_{suffix}")
        hip.parent = r
        hip.location = (side * 0.24, 0, 0.84)
        cylinder(f"Leg_{side}", (0, 0, -0.36), 0.15, 0.72, NAVY, hip, round16)
        box(f"Foot_{side}", (0, -0.10, -0.74), (0.23, 0.34, 0.10), shell, 0.08, hip)
        box("KneePad", (0, -0.145, -0.3), (0.14, 0.06, 0.13), shell, 0.04, hip)
        box("ShinPlate", (0, -.125, -.56), (.12, .055, .13), shell, .045, hip)
        rod("LegPiston", (side * .14, .04, -.16), (side * .14, .04, -.65), .032, STEEL, hip)
        box("BootSole", (0, -.10, -.81), (.22, .33, .035), NAVY, .03, hip)
        for z in (-.03, .12):
            box("ToeTread", (0, -.30 + z, -.845), (.18, .022, .012), STEEL, .005, hip)
        box("BootStripe", (0, -0.415, -0.72), (0.14, 0.02, 0.028), light, 0.015, hip)
    cylinder("Antenna", (0, 0, 2.65), 0.035, 0.32, NAVY, r)
    sphere("AntennaLight", (0, 0, 2.84), (0.09, 0.09, 0.09), light, r, subdivisions=2)
    return r


def dog(hostile=False):
    r = root("Zombie_Dog" if hostile else "BOLT_Dog")
    shell = CORAL if hostile else WHITE
    light = ORANGE if hostile else CYAN
    hull("Ribcage", [(-.68, .21, .19), (-.5, .31, .26), (-.1, .29, .24), (.3, .34, .30), (.56, .29, .30), (.65, .18, .23)], shell, r, (0, .02, 1.04), (math.pi / 2, 0, 0), .8)
    hull("BreastPlate", [(.74, .17, .12), (1.04, .28, .19), (1.28, .25, .18), (1.38, .13, .10)], shell, r, (0, -.5, 0), count=16)
    cylinder("Neck", (0, -0.62, 1.37), 0.21, 0.48, NAVY, r, rotation=(0.25, 0, 0))
    torus("Collar", (0, -0.64, 1.43), 0.23, 0.055, light, r)
    hull("DogHead", [(1.46, .17, .19), (1.55, .25, .29), (1.74, .26, .30), (1.87, .19, .22), (1.91, .10, .13)], shell, r, (0, -.78, 0), power=.8)
    hull("Muzzle", [(-.25, .13, .085), (-.20, .16, .11), (.15, .19, .13), (.25, .15, .11)], shell, r, (0, -1.12, 1.53), (-math.pi / 2, 0, 0), count=16)
    cube("Nose", (0, -1.37, 1.56), (0.13, 0.045, 0.08), NAVY, 0.04, r)
    cube("MouthSeam", (0, -1.31, 1.43), (0.14, 0.08, 0.018), NAVY, 0.015, r)
    for side in (-1, 1):
        sphere("EyeSocket", (side * 0.23, -0.98, 1.75), (0.075, 0.07, 0.08), NAVY, r)
        sphere("DogOptic", (side * 0.245, -1.03, 1.76), (0.042, 0.03, 0.045), light, r, subdivisions=2)
        if hostile:
            cone("PointyEar", (side * 0.22, -0.6, 2.03), 0.13, 0.025, 0.4, NAVY, r, 6)
        else:
            # The floppy ears carry BOLT's silhouette, so they keep the soft two-segment bevel.
            ear = cube("FloppyEar", (side * 0.31, -0.63, 1.73), (0.075, 0.14, 0.24), NAVY, 0.065, r, segments=2)
            ear.rotation_euler.y = side * 0.3
        cube("FlankPanel", (side * 0.323, 0.12, 1.05), (0.023, 0.37, 0.14), NAVY, 0.025, r)
        cube("FlankStripe", (side * 0.35, 0.12, 1.05), (0.012, 0.24, 0.033), light, 0.012, r)
        for y in (-.12, .12, .36):
            cube("FlankCoolingFin", (side * .342, y, 1.18), (.018, .015, .048), STEEL, .006, r)
        cylinder("JawHinge", (side * .245, -.74, 1.58), .075, .04, STEEL, r, rotation=(0, math.pi / 2, 0))
        rod("NeckActuator", (side * .17, -.48, 1.28), (side * .17, -.66, 1.55), .035, STEEL, r)
    cube("SpinePanel", (0, 0.08, 1.3), (0.20, 0.38, 0.025), NAVY, 0.04, r)
    for y in (-0.18, 0.08, 0.34):
        cube("SpineLight", (0, y, 1.33), (0.14, 0.035, 0.016), light, 0.012, r)
    for x in (-0.29, 0.29):
        for y in (-0.43, 0.48):
            hip = root(f"Hip_{'L' if x < 0 else 'R'}_{'F' if y < 0 else 'B'}")
            hip.parent = r
            hip.location = (x, y, 0.93)
            bend = -.14 if y < 0 else .18
            cylinder("HipAxle", (0, 0, 0), .135, .19, NAVY, hip, rotation=(0, math.pi / 2, 0))
            cylinder("HipBolt", ((-.11 if x < 0 else .11), 0, 0), .073, .035, STEEL, hip, rotation=(0, math.pi / 2, 0))
            rod("UpperLeg", (0, 0, -.05), (0, bend, -.38), .09, shell, hip)
            cylinder("KneeAxle", (0, bend, -.40), .093, .19, NAVY, hip, rotation=(0, math.pi / 2, 0))
            rod("LowerLeg", (0, bend, -.43), (0, -.045, -.77), .06, STEEL, hip)
            rod("HydraulicSleeve", (0, .055, -.09), (0, bend + .075, -.35), .043, NAVY, hip)
            rod("HydraulicRam", (0, bend + .075, -.35), (0, .025, -.67), .025, STEEL, hip)
            cube("Paw", (0, -0.085, -0.85), (0.115, 0.20, 0.075), shell, 0.04, hip)
            cube("PawPad", (0, -.085, -.91), (.11, .19, .025), NAVY, .025, hip, segments=0)
            for toe in (-1, 1):
                cube("PawToe", (toe * .057, -.26, -.845), (.04, .065, .04), STEEL, .02, hip)
    tail = root("TailPivot")
    tail.parent = r
    tail.location = (0, 0.64, 1.12)
    tube("Tail", [(0, 0, 0), (0, 0.22, 0.17), (0, 0.37, 0.44)], 0.065, NAVY, tail)
    sphere("TailLight", (0, 0.37, 0.44), (0.075, 0.075, 0.075), light, tail, subdivisions=2)
    return r


def drone():
    r = root("Rust_Drone")
    sphere("DroneCore", (0, 0, 0.38), (0.55, 0.42, 0.32), CORAL, r)
    cube("AngryVisor", (0, -0.4, 0.38), (0.3, 0.06, 0.09), ORANGE, 0.03, r)
    torus("CoreSeam", (0, 0, 0.38), 0.44, 0.032, NAVY, r)
    sphere("DroneLens", (0, -0.475, 0.38), (0.095, 0.04, 0.095), NAVY, r, subdivisions=2)
    for x in (-0.72, 0.72):
        for y in (-0.55, 0.55):
            rod("DiagonalArm", (x * .34, y * .34, .38), (x, y, .43), .065, STEEL, r)
            cylinder("Rotor", (x, y, 0.47), 0.36, 0.05, NAVY, r, 12)
            cube("RotorBlade", (x, y, 0.52), (0.40, 0.06, 0.025), ORANGE, 0.01, r)
            torus("PropGuard", (x, y, 0.49), 0.43, 0.03, CORAL, r)
            sphere("MotorCap", (x, y, 0.56), (0.07, 0.07, 0.05), GOLD, r)
    cube("BatteryHatch", (0, .04, .67), (.23, .17, .026), NAVY, .04, r)
    for x in (-.17, .17):
        for y in (-.07, .15):
            cylinder("HatchScrew", (x, y, .70), .025, .015, STEEL, r)
    cylinder("CameraHousing", (0, -.46, .33), .13, .1, STEEL, r, 12, (math.pi / 2, 0, 0))
    cylinder("CameraGlass", (0, -.52, .33), .09, .02, GLASS, r, 12, (math.pi / 2, 0, 0))
    return r


def lighthouse():
    r = root("LUMA_Lighthouse")
    cone("Tower", (0, 0, 3.1), 1.28, 0.78, 6.2, WHITE, r, 24)
    for z in (1.2, 2.6, 4.0):
        # 24 sides like the tower, so each band sits 1 cm proud of the matching tower faces.
        cone("RedBand", (0, 0, z), 1.29 - (z - .21) * .5 / 6.2, 1.29 - (z + .21) * .5 / 6.2, .42, RED, r, 24)
    cylinder("Gallery", (0, 0, 6.25), 1.08, 0.18, NAVY, r, 24)
    cylinder("LensRoom", (0, 0, 6.7), 0.68, 0.86, CYAN, r, 24)
    cone("Roof", (0, 0, 7.32), 0.90, 0.08, 0.65, RED, r, 24)
    sphere("BeamAnchor", (0, -0.60, 6.72), (0.10, 0.10, 0.10), CYAN, r)
    cube("Door", (0, -1.22, 0.58), (0.3, 0.07, 0.54), NAVY, 0.12, r)
    for z in (2.0, 3.4, 4.8):
        cylinder("PortholeFrame", (0, -(1.28 - z * 0.08), z), 0.18, 0.055, NAVY, r, 12, (math.pi / 2, 0, 0))
        cylinder("PortholeGlass", (0, -(1.32 - z * 0.08), z), 0.125, 0.03, CYAN, r, 12, (math.pi / 2, 0, 0))
    torus("GalleryRail", (0, 0, 6.53), 1.01, 0.035, NAVY, r)
    for i in range(12):
        angle = i * math.tau / 12
        cylinder("RailPost", (math.cos(angle), math.sin(angle), 6.4), 0.026, 0.28, NAVY, r, 6)
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
    for z in (1.8, 5.5):
        torus("HullSeam", (0, 0, z), 0.72, 0.035, NAVY, r, major_segments=20)
    torus("WindowRim", (0, -0.76, 4.1), 0.25, 0.045, NAVY, r, (math.pi / 2, 0, 0))
    cone("EngineBell", (0, 0, 0.45), 0.52, 0.36, 0.5, NAVY, r)
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


def pillow_normals(obj, strength=1.0):
    """Tilt a flat card's normals outward from its centre, so one sheet shades like a soft, thick
    blade (what the old solidified rim did to the smooth normals) at no triangle cost."""
    mesh = obj.data
    points = [v.co.copy() for v in mesh.vertices]
    centre = sum(points, Vector()) / len(points)
    up = sum((face.normal * face.area for face in mesh.polygons), Vector()).normalized()
    normals = []
    for point in points:
        out = point - centre
        out -= up * out.dot(up)
        normals.append((up + out.normalized() * strength).normalized() if out.length > 1e-6 else up)
    mesh.normals_split_custom_set_from_vertices(normals)
    return obj


def palm():
    r = root("Beach_Palm")
    # Budget ~2,000 tris for a 100-200 px tree (was 10,340): a 10-sided trunk, bark rings as open
    # 20-tri bands instead of 288-tri tori, and single-sheet leaflets. Every material exports
    # double-sided, so a leaflet needs no solidified back face (9 mm is far below a pixel).
    def trunk(z):
        return (.25 * (z / 3.8) ** 2, 0, z)
    tapered_tube("CurvedTrunk", [trunk(i * .38) for i in range(11)], [.23 - i * .009 for i in range(11)], BROWN, r, 10)
    for i in range(1, 19):
        z = i * .195
        # Same 10 sides and orientation as the trunk, standing 12 mm proud like the old ring tubes.
        tapered_tube("BarkScar", [trunk(z - .012), trunk(z + .012)], [.242 - z * .0237] * 2, SHELL, r, 10, caps=False)
    for index in range(9):
        angle = index * math.tau / 9
        frond = root("PalmFrond")
        frond.parent = r
        frond.location = (.25, 0, 3.8)
        frond.rotation_euler.z = angle
        length = 1.8 + (index % 3) * .14

        def arc(t):
            return (length * t, 0, .62 * math.sin(t * math.pi) - .48 * t ** 2)
        spine = [arc(i / 8) for i in range(9)]
        tapered_tube("FrondSpine", spine, [.036 * (1 - i / 8.67) + .005 for i in range(9)], LEAF_TIP, frond, 4)
        for i in range(1, 12):
            t = i / 12
            x, _, z = arc(t)
            width = .42 * math.sin(t * math.pi) + .07
            for side in (-1, 1):
                verts = [(x - .1, 0, z), (x + .11, 0, z), (x + .22, side * width * .65, z - .08), (x + .32, side * width, z - .25), (x + .06, side * width * .7, z - .10)]
                faces = [(0, 1, 2), (0, 2, 4), (2, 3, 4)] if side > 0 else [(0, 2, 1), (0, 4, 2), (2, 4, 3)]
                pillow_normals(mesh_object("PalmLeaflet", verts, faces, LEAF if i % 3 else LEAF_TIP, frond))
    for x, y in [(.15, .13), (.35, -.11), (.05, -.17)]:
        sphere("Coconut", (x, y, 3.65), (.14, .14, .19), BROWN, r)
    bpy.context.view_layer.update()
    for frond in list(r.children):
        if not frond.name.startswith("PalmFrond"):
            continue
        for child in list(frond.children):
            transform = child.matrix_world.copy()
            child.parent = r
            child.matrix_world = transform
        bpy.data.objects.remove(frond, do_unlink=True)
    return r


def torus(name, loc, major, minor, mat, parent, rotation=(0, 0, 0), major_segments=None, minor_segments=None):
    # Thin seams and rails read as lines on a phone: 3-4 sides around the tube are enough.
    major_segments = major_segments or (24 if major >= 0.6 else 16 if major >= 0.2 else 12)
    minor_segments = minor_segments or (6 if minor >= 0.08 else 4 if minor >= 0.02 else 3)
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_segments, minor_segments=minor_segments, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    for face in obj.data.polygons:
        face.use_smooth = True
    set_mat(obj, mat)
    obj.parent = parent
    return obj


def octopus():
    r = root("Octopus_Friend")
    sphere("Mantle", (0, 0, 0.72), (0.62, 0.56, 0.7), PURPLE, r)
    for x in (-0.22, 0.22):
        sphere("EyeWhite", (x, -0.5, 0.83), (0.14, 0.1, 0.18), WHITE, r)
        sphere("Eye", (x, -0.59, 0.84), (0.07, 0.045, 0.09), NAVY, r, subdivisions=2)
        sphere("EyeGlint", (x - 0.02, -0.631, 0.875), (0.024, 0.012, 0.028), PEARL, r)
        sphere("Cheek", (x * 1.5, -0.47, 0.64), (0.09, 0.035, 0.05), PINK, r)
    tube("OctoSmile", [(-0.075, -0.55, 0.65), (0, -0.57, 0.61), (0.075, -0.55, 0.65)], 0.018, NAVY, r)
    for x, y in [(-0.2, 0.15), (0.16, 0.3), (0, -0.16)]:
        z = .72 + .7 * math.sqrt(1 - (x / .62) ** 2 - (y / .56) ** 2) - .025
        sphere("MantleSpot", (x, y, z), (0.065, 0.07, 0.035), PINK, r)
    for i in range(8):
        angle = i * math.tau / 8
        arm = root(f"Tentacle_{i}")
        arm.parent = r
        arm.rotation_euler.z = angle
        def curl(t):
            return (.27 + .89 * t, .16 * math.sin(t * math.pi * 1.5), .24 - .13 * math.sin(t * math.pi) + .12 * t ** 4)
        # Eight sides and ten rings keep the curl; the old 10 x 13 arm cost 256 tris each.
        tapered_tube("TaperedArm", [curl(j / 9) for j in range(10)], [.18 * (1 - j / 9.75) + .012 for j in range(10)], PURPLE, arm, 8)
        # Four 20-tri suckers per arm (the fifth, near the tip, was under a pixel).
        for j in range(2, 10, 2):
            x, y, z = curl(j / 12)
            sphere("Sucker", (x, y - .1 * (1 - j / 13), z + .04), (.055 * (1 - j / 16), .032, .026), PEARL, arm)
    return r


def starfish():
    r = root("Starfish_Friend")
    verts = [(0, 0, 0.34), (0, 0, 0.05)]
    for i in range(10):
        angle = i * math.pi / 5 + math.pi / 2
        radius = 1.0 if i % 2 == 0 else 0.38
        verts.append((math.cos(angle) * radius, math.sin(angle) * radius, 0.1))
    faces = []
    for i in range(10):
        a, b = 2 + i, 2 + (i + 1) % 10
        faces.extend([(0, a, b), (1, b, a)])
    mesh = bpy.data.meshes.new("FivePointStar")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("StarBody", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = r
    set_mat(obj, OCHRE)
    # Subdivision rounds the pinched arms into a domed living silhouette.
    sub = obj.modifiers.new("Soft star silhouette", "SUBSURF")
    sub.levels = 2
    obj.scale.z = 1.5
    for face in mesh.polygons:
        face.use_smooth = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=sub.name)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    floor = min(vertex.co.z for vertex in obj.data.vertices)
    for vertex in obj.data.vertices:
        vertex.co.z -= floor
    obj.data.update()
    def on_shell(x, y, lift=0):
        hit, point, _, _ = obj.ray_cast(Vector((x, y, 2)), Vector((0, 0, -1)))
        if not hit:
            raise ValueError("Starfish detail outside the sculpted shell")
        return (x, y, point.z + lift)
    for x in (-0.16, 0.16):
        sphere("StarEye", on_shell(x, -.12, .027), (.055, .055, .045), NAVY, r, subdivisions=2)
    tube("StarSmile", [on_shell(-.07, -.25, .012), on_shell(0, -.29, .012), on_shell(.07, -.25, .012)], .017, NAVY, r)
    for i in range(5):
        angle = i * math.tau / 5 + math.pi / 2
        for radius in (0.38, 0.52):
            sphere("StarFreckle", on_shell(math.cos(angle) * radius, math.sin(angle) * radius, .008), (.034, .034, .022), PINK, r)
    return r


def snail():
    r = root("NORI_Snail")
    sphere("SoftBody", (0, -0.1, 0.25), (0.44, 0.95, 0.22), MINT, r)
    sphere("Shell", (0, 0.13, 0.76), (0.66, 0.62, 0.69), PINK, r)
    for side in (-1, 1):
        points = []
        for i in range(29):
            t = i / 28
            radius = 0.04 + t * 0.4
            angle = t * math.tau * 1.6
            points.append((side * (0.665 - radius * radius * 0.8), 0.13 + math.cos(angle) * radius, 0.79 + math.sin(angle) * radius))
        tube("ShellSpiral", points, 0.04, GOLD, r)
        cylinder("EyeStalk", (side * 0.22, -0.73, 0.62), 0.055, 0.64, MINT, r, 8)
        sphere("SnailEye", (side * 0.22, -0.73, 0.99), (0.13, 0.13, 0.13), WHITE, r)
        sphere("Pupil", (side * 0.22, -0.85, 1.0), (0.065, 0.04, 0.07), NAVY, r, subdivisions=2)
    tube("SnailSmile", [(-0.12, -0.99, 0.33), (0, -1.035, 0.29), (0.12, -0.99, 0.33)], 0.018, NAVY, r)
    for y in (-0.3, 0, 0.3, 0.6):
        for side in (-1, 1):
            sphere("FootFreckle", (side * 0.37, y, 0.31), (0.04, 0.08, 0.03), GOLD, r)
    return r


def clam():
    r = root("Clam_Repair_Station")
    def valve(name, parent, center, upper):
        # 18 ridges x 4 samples keep the scalloped rim; 5 rings (was 8) hold the dome. One
        # double-sided sheet plus the solidified rim only: every material exports double-sided,
        # so the old full inner wall doubled the cost for a surface the sheet already shows.
        verts, faces = [(0, 0, .24 if upper else -.14)], []
        rings, steps = 5, 72
        for j in range(1, rings + 1):
            radius = j / rings
            for i in range(steps):
                angle = i * math.tau / steps
                ridge = .5 + .5 * math.cos(angle * 18)
                edge = radius * (1 + .035 * ridge * radius)
                height = (.24 if upper else -.14) * (1 - radius * radius) + .025 * ridge * radius
                verts.append((.84 * math.cos(angle) * edge, .62 * math.sin(angle) * edge, height))
        for i in range(steps):
            faces.append((0, 1 + i, 1 + (i + 1) % steps))
        for j in range(rings - 1):
            for i in range(steps):
                a, b = 1 + j * steps + i, 1 + j * steps + (i + 1) % steps
                faces.append((a, a + steps, b + steps, b))
        obj = mesh_object(name, verts, faces, SHELL, parent)
        obj.location = center
        solid = obj.modifiers.new("Shell lip", "SOLIDIFY")
        solid.thickness = .025
        solid.use_rim_only = True
        return obj
    valve("LowerShell", r, (0, 0, .25), False)
    lid = root("ClamLid")
    lid.parent = r
    lid.location = (0, 0.45, 0.22)
    lid.rotation_euler.x = math.radians(-38)
    valve("UpperShell", lid, (0, -.42, .1), True)
    torus("PearlSeat", (0, -0.12, 0.32), 0.31, 0.045, GOLD, r)
    sphere("RepairPearl", (0, -0.12, 0.43), (0.3, 0.3, 0.3), PEARL, r)
    for x in (-0.16, 0.16):
        sphere("PearlEye", (x, -0.38, 0.48), (0.055, 0.045, 0.06), NAVY, r, subdivisions=2)
    return r


def coral_cluster():
    r = root("Coral_Cluster")
    sphere("CoralRock", (0, 0, 0.13), (1.05, 0.7, 0.28), PURPLE, r)
    for i, (x, y, h) in enumerate([(-0.55, 0, 1.4), (0, 0.2, 2.0), (0.55, -0.1, 1.1)]):
        tapered_tube("CoralStem", [(x, y, 0), (x - .08, y, h * .4), (x + .05, y, h * .8), (x, y, h)], [.17, .13, .09, .025], PINK, r, 8)
        for side in (-1, 1):
            tapered_tube("CoralBranch", [(x, y, h * .45), (x + side * .22, y, h * .6), (x + side * .36, y, h * .88), (x + side * .33, y, h * 1.02)], [.1, .09, .055, .015], PINK, r, 8)
    return r


def reef_arch():
    r = root("Reef_Arch")
    for x in (-1.4, 1.4):
        cylinder("ArchColumn", (x, 0, 1.15), 0.32, 2.3, MINT, r, 8)
        sphere("PearlCap", (x, 0, 2.4), (0.4, 0.4, 0.36), PEARL, r)
    cube("ArchBridge", (0, 0, 2.7), (1.7, 0.28, 0.24), PURPLE, 0.2, r)
    torus("ArchHalo", (0, -0.04, 2.7), 0.52, 0.12, GOLD, r, (math.pi / 2, 0, 0))
    return r


def salvage_tower():
    r = root("Neon_Salvage_Tower")
    for i in range(3):
        cube("SalvageCrate", (i % 2 * 0.15, 0, 0.4 + i * 0.68), (0.7 - i * 0.12, 0.55, 0.32), PURPLE if i % 2 else NAVY, 0.08, r)
        cube("NeonStrip", (0, -0.57, 0.4 + i * 0.68), (0.52 - i * 0.08, 0.045, 0.055), CYAN if i % 2 else PINK, 0.02, r)
        for side in (-1, 1):
            cube("CrateLatch", (side * (0.5 - i * 0.1), -0.565, 0.55 + i * 0.68), (0.06, 0.03, 0.07), GOLD, 0.02, r)
    torus("ScrapWheel", (0.9, 0, 0.5), 0.44, 0.16, GOLD, r, (math.pi / 2, 0, 0))
    return r


def moon_mushroom():
    r = root("Moon_Mushrooms")
    for x, y, h in [(-0.45, 0, 1.4), (0.48, 0.2, 2.2), (0.12, -0.45, 0.75)]:
        cylinder("GlowStem", (x, y, h / 2), 0.13, h, PEARL, r, 8)
        sphere("GlowCap", (x, y, h), (0.68, 0.6, 0.28), MINT if h > 1 else PINK, r)
        sphere("CapDot", (x, y, h + 0.25), (0.18, 0.16, 0.045), GOLD, r)
        for angle in (0, 2.094, 4.188):
            sphere("CapFreckle", (x + math.cos(angle) * 0.38, y + math.sin(angle) * 0.33, h + 0.21), (0.08, 0.07, 0.028), PEARL, r)
    return r


def software_disc():
    r = root("Software_CD")
    # A thin optical disc with a real center hole and iridescent data sectors.
    verts, faces = [], []
    segments = 36  # six data sectors of six faces each (was 48 = 6 x 8)
    for depth, radius in [(-0.035, 0.14), (-0.035, 0.63), (0.035, 0.63), (0.035, 0.14)]:
        for i in range(segments):
            angle = i * math.tau / segments
            verts.append((math.cos(angle) * radius, depth, 0.65 + math.sin(angle) * radius))
    for ring in range(4):
        for i in range(segments):
            n = (i + 1) % segments
            faces.append(((ring + 1) % 4 * segments + i, (ring + 1) % 4 * segments + n, ring * segments + n, ring * segments + i))
    mesh = bpy.data.meshes.new("OpticalDisc")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("Disc", mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = r
    for mat in [PEARL, PINK, CYAN, GOLD, MINT, PURPLE]:
        mesh.materials.append(mat)
    for face in mesh.polygons:
        face.material_index = 1 + face.index // 6 % 5 if face.index < segments else 0
    for depth in (-0.042, 0.042):
        torus("DiscHub", (0, depth, 0.65), 0.155, 0.015, NAVY, r, (math.pi / 2, 0, 0), major_segments=18)
        # The data track is a hairline: a flat 72-tri ring 7 mm above the face reads like the old
        # 288-tri tube and stays as round as the disc's 36 sides.
        track = [(math.cos(i * math.tau / 36) * radius, depth, 0.65 + math.sin(i * math.tau / 36) * radius) for radius in (0.472, 0.488) for i in range(36)]
        mesh_object("DataTrack", track, [(i, (i + 1) % 36, 36 + (i + 1) % 36, 36 + i) for i in range(36)], PEARL, r)
    return r


def prism_armor():
    r = root("Prism_Armor")
    cube("ChestPlate", (0, -0.3, 1.34), (0.43, 0.065, 0.34), PURPLE, 0.1, r)
    sphere("ChestGem", (0, -0.39, 1.43), (0.18, 0.07, 0.19), GOLD, r)
    for side in (-1, 1):
        sphere("PrismShoulder", (side * 0.52, 0, 1.75), (0.20, 0.24, 0.15), PINK, r)
        cube("ArmorInset", (side * 0.32, -0.37, 1.33), (0.025, 0.015, 0.16), PEARL, 0.012, r)
    for z in (1.13, 1.28):
        cube("ArmorVent", (0, -0.37, z), (0.16, 0.015, 0.015), NAVY, 0.01, r)
    return r


def twin_thrusters():
    r = root("Twin_Thrusters")
    cube("Backpack", (0, 0.34, 1.4), (0.37, 0.17, 0.34), NAVY, 0.07, r)
    for side in (-1, 1):
        cylinder("ThrusterTank", (side * 0.35, 0.55, 1.42), 0.2, 0.95, GOLD, r, 12)
        for z in (1.12, 1.7):
            torus("TankCollar", (side * 0.35, 0.55, z), 0.2, 0.032, NAVY, r, major_segments=12)
        cube("FuelGauge", (side * 0.35, 0.765, 1.43), (0.06, 0.015, 0.17), CYAN, 0.015, r)
        cone("ThrusterGlow", (side * 0.35, 0.55, 0.79), 0.03, 0.16, 0.4, CYAN, r, 8)
    return r


def halo_antenna():
    r = root("Halo_Antenna")
    torus("Halo", (0, 0, 2.96), 0.54, 0.095, PINK, r, major_segments=20)
    for side in (-1, 1):
        cylinder("HaloSupport", (side * 0.35, 0, 2.68), 0.045, 0.5, GOLD, r, 8)
    sphere("HaloStar", (0, 0, 3.05), (0.14, 0.14, 0.14), CYAN, r)
    return r


def starship():
    r = root("AURORA_Starship")
    hull("FlightHull", [(-1.32, .24, .25), (-1.1, .51, .39), (-.5, .67, .48), (.35, .56, .47), (.95, .33, .29), (1.38, .07, .10)], WHITE, r, (0, 0, 1.03), (math.pi / 2, 0, 0), .8)
    sphere("Cockpit", (0, -0.63, 1.3), (0.43, 0.62, 0.28), NAVY, r)
    sphere("Canopy", (0, -0.68, 1.47), (0.35, 0.49, 0.25), GLASS, r)
    tube("CanopyFrame", [(-.34, -.43, 1.5), (-.27, -.43, 1.68), (0, -.43, 1.73), (.27, -.43, 1.68), (.34, -.43, 1.5)], .023, STEEL, r)
    for side in (-1, 1):
        tube("HullPanelSeam", [(side * .22, -1.15, 1.21), (side * .52, -.3, 1.4), (side * .59, .4, 1.34), (side * .4, 1.04, 1.31)], .018, NAVY, r)
    for side in (-1, 1):
        outline = [(.39, -.4), (1.62, .48), (1.55, .91), (.43, .77)]
        verts = [(side * x, y, z) for z in (.88, 1.0) for x, y in outline]
        faces = [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        if side < 0:
            faces = [tuple(reversed(face)) for face in faces]
        wing = mesh_object("SweptWing", verts, faces, WHITE, r)
        bevel = wing.modifiers.new("Wing edge", "BEVEL")
        bevel.width, bevel.segments = .035, 2
        tube("AileronSeam", [(side * .68, .65, 1.012), (side * 1.46, .8, 1.012)], .016, NAVY, r)
        cube("WingTipLight", (side * 1.55, .66, 1.015), (.03, .12, .018), ORANGE if side < 0 else CYAN, .015, r)
        cylinder("EnginePod", (side * 0.86, 0.57, 0.83), 0.23, 0.75, NAVY, r, 16)
        torus("EngineRim", (side * 0.86, 0.57, 0.47), 0.23, 0.045, GOLD, r)
        for z in (.62, .76, .9, 1.04):
            torus("EngineCoolingRing", (side * .86, .57, z), .235, .018, STEEL, r)
        cylinder("TurbineIntake", (side * .86, .57, 1.22), .2, .035, GLASS, r, 16)
        for i in range(8):
            angle = i * math.tau / 8
            blade = cube("IntakeBlade", (side * .86 + math.cos(angle) * .12, .57 + math.sin(angle) * .12, 1.245), (.065, .015, .009), STEEL, .006, r)
            blade.rotation_euler.z = angle + .4
        flame = root(f"Exhaust_{side}")
        flame.parent = r
        flame.location = (side * 0.86, 0.57, 0.42)
        cone("ExhaustGlow", (0, 0, -0.37), 0.015, 0.19, 0.74, CYAN, flame)
        cylinder("LandingLeg", (side * 0.51, -0.4, 0.41), 0.055, 0.62, NAVY, r)
        cube("LandingFoot", (side * 0.51, -0.4, 0.09), (0.16, 0.26, 0.06), NAVY, 0.04, r)
    fin = cube("TailFin", (0, 0.94, 1.5), (0.07, 0.42, 0.43), CORAL, 0.1, r)
    fin.rotation_euler.x = -0.25
    for y in (-0.12, 0.13, 0.38):
        cube("HullVent", (0, y, 1.54), (0.17, 0.04, 0.018), NAVY, 0.014, r)
    return r


builders = {
    "kai": lambda: robot(),
    "bolt": dog,
    "zombie_dog": lambda: dog(True),
    "rust_drone": drone,
    "rust_scout": lambda: robot("Rust_Scout", True),
    "lighthouse": lighthouse,
    "energy_cell": energy_cell,
    "turret": turret,
    "rocket": rocket,
    "crab": crab,
    "beacon": beacon,
    "palm": palm,
    "octopus": octopus,
    "starfish": starfish,
    "snail": snail,
    "clam": clam,
    "coral_cluster": coral_cluster,
    "reef_arch": reef_arch,
    "salvage_tower": salvage_tower,
    "moon_mushroom": moon_mushroom,
    "software_disc": software_disc,
    "prism_armor": prism_armor,
    "twin_thrusters": twin_thrusters,
    "halo_antenna": halo_antenna,
    "starship": starship,
}

def descendants(obj):
    result = [obj]
    for child in obj.children:
        result.extend(descendants(child))
    return result


def batch_rigid_parts(asset_root):
    """Join by parent + material, preserving all animation pivots and rotor meshes."""
    bpy.context.view_layer.update()
    for obj in descendants(asset_root):
        if obj.type not in {"MESH", "CURVE"}:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        if obj.type == "CURVE":
            bpy.ops.object.convert(target="MESH")
        else:
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
    buckets = {}
    for obj in descendants(asset_root):
        if obj.type != "MESH" or obj.name.startswith("Rotor") or len(obj.data.materials) != 1:
            continue
        key = (obj.parent, obj.data.materials[0])
        buckets.setdefault(key, []).append(obj)
    for siblings in buckets.values():
        if len(siblings) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in siblings:
            obj.select_set(True)
        # Torso remains addressable for paint inspection and browser regression tests.
        bpy.context.view_layer.objects.active = next((obj for obj in siblings if obj.name.startswith("Torso")), siblings[0])
        bpy.ops.object.join()


roots = {}
spacing = 5.0
for index, (asset_name, builder) in enumerate(builders.items()):
    asset_root = builder()
    batch_rigid_parts(asset_root)
    asset_root.location.x = (index % 5) * spacing
    asset_root.location.y = (index // 5) * spacing
    roots[asset_name] = asset_root

# The engine only affects how the saved .blend opens; its identifier changed across Blender versions.
for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        bpy.context.scene.render.engine = engine
        break
    except TypeError:
        continue
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "robot_beach_assets.blend"))


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
    meshes = [obj for obj in selected if obj.type == "MESH"]
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    report.append({"name": asset_name, "file": path.name, "bytes": path.stat().st_size,
                   "sha256": hashlib.sha256(path.read_bytes()).hexdigest()[:16],
                   "meshFaces": sum(len(obj.data.polygons) for obj in meshes),
                   "triangles": triangles, "meshes": len(meshes)})
    asset_root.location = original_location

# newline="\n": the repo stores text with LF, and Python on Windows would otherwise write CRLF.
(OUT_DIR / "manifest.json").write_text(json.dumps({
    "generator": f"Blender {bpy.app.version_string} / tools/blender/build_assets.py",
    "source": "assets/blender/robot_beach_assets.blend",
    "assets": report,
}, indent=2), encoding="utf-8", newline="\n")

print(json.dumps(report, indent=2))
