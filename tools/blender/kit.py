"""Procedural environment kit for the Signalbreak journey scenes.

Geometry is authored in game space (x east, y up, z south) and accumulated per material, so a
whole destination exports as one mesh per material. Every corner carries a baked vertex color:
material tint x ambient occlusion x per-prop variation. The GLB therefore reads as lit, weathered
and varied without texture downloads, while draw calls stay bounded by the material count.
"""
import math
import random
from contextlib import contextmanager

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

AUTHORED_EDGE = 18.5    # Scenes are authored around this play radius...
PUSH_START, PUSH_END = 18.6, 20.0  # ...and rim dressing beyond it moves out to the real edge.
CAMERA_DIR = Vector((9.5, 0, 15)).normalized()  # Camera offset from KAI, in game XZ.


def srgb(hex_value):
    return ((hex_value >> 16 & 255) / 255, (hex_value >> 8 & 255) / 255, (hex_value & 255) / 255)


def mix(a, b, t):
    return tuple(x + (y - x) * t for x, y in zip(a, b))


def scale(color, amount):
    return tuple(max(0.0, min(1.0, c * amount)) for c in color)


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0 or 1e-6)))
    return t * t * (3 - 2 * t)


def fbm(x, z, octaves=4, seed=0.0):
    total, amplitude, frequency = 0.0, 1.0, 1.0
    for _ in range(octaves):
        total += amplitude * noise.noise(Vector((x * frequency, z * frequency, seed)))
        amplitude *= 0.5
        frequency *= 2.03
    return total


def to_blender(point):
    x, y, z = point
    return Vector((x, -z, y))


GAME_TO_BLENDER = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


class Material:
    """A PBR response shared by many props; the per-corner color supplies the actual paint."""

    def __init__(self, name, color=0xffffff, metal=0.0, rough=0.8, glow=0.0, uv=0.5, alpha=1.0, double=False):
        self.name = "Journey " + name
        self.tint = srgb(color)
        self.uv = uv
        mat = bpy.data.materials.get(self.name) or bpy.data.materials.new(self.name)
        mat.use_nodes = True
        tree = mat.node_tree
        for node in [n for n in tree.nodes if n.type not in {"BSDF_PRINCIPLED", "OUTPUT_MATERIAL"}]:
            tree.nodes.remove(node)
        bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Roughness"].default_value = rough
        bsdf.inputs["Metallic"].default_value = metal
        attribute = tree.nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Col"
        multiply = tree.nodes.new("ShaderNodeMix")
        multiply.data_type = "RGBA"
        multiply.blend_type = "MULTIPLY"
        multiply.inputs[0].default_value = 1.0
        multiply.inputs[6].default_value = (*self.linear(self.tint), 1)
        tree.links.new(attribute.outputs["Color"], multiply.inputs[7])
        tree.links.new(multiply.outputs[2], bsdf.inputs["Base Color"])
        if glow:
            bsdf.inputs["Emission Color"].default_value = (*self.linear(self.tint), 1)
            bsdf.inputs["Emission Strength"].default_value = glow
        if alpha < 1:
            bsdf.inputs["Alpha"].default_value = alpha
            mat.surface_render_method = "BLENDED"
        # Closed props cull back faces; only foliage, cloth and cards are double sided.
        mat.use_backface_culling = not double
        mat.diffuse_color = (*self.linear(self.tint), alpha)
        self.material = mat

    @staticmethod
    def linear(color):
        return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in color)


class Batch:
    def __init__(self, material):
        self.material = material
        self.verts, self.faces, self.colors, self.uvs = [], [], [], []


class Scene:
    """Collects geometry and gameplay metadata for one destination."""

    def __init__(self, key, seed, keep_clear=(), play_radius=AUTHORED_EDGE):
        self.key = key
        self.random = random.Random(seed)
        self.batches = {}
        self.colliders = []
        self.keep_clear = list(keep_clear)
        self.skipped = 0
        self.play_radius = play_radius
        self.delta = max(0.0, play_radius - AUTHORED_EDGE)
        self.reach = play_radius + 1.7  # Solid props whose footprint reaches inside this radius need a collider.
        self._anchor = None
        self._held = []

    # ---- authored -> real radius ---------------------------------------------------------
    def push(self, x, z):
        """Outward offset for an authored position: zero inside the old edge, full delta beyond it."""
        r = math.hypot(x, z)
        if r < 1e-6 or not self.delta:
            return 0.0, 0.0
        d = self.delta * smoothstep(PUSH_START, PUSH_END, r)
        return x / r * d, z / r * d

    def place(self, x, z):
        dx, dz = self._anchor if self._anchor is not None else self.push(x, z)
        return x + dx, z + dz

    def hold(self, x, z, fixed=False):
        """Everything emitted until release() moves rigidly by one offset; the outermost hold wins."""
        self._held.append(self._anchor)
        if self._anchor is None:
            self._anchor = (0.0, 0.0) if fixed else self.push(x, z)

    def release(self):
        self._anchor = self._held.pop()

    @contextmanager
    def anchor(self, x, z, fixed=False):
        self.hold(x, z, fixed)
        try:
            yield
        finally:
            self.release()

    def authored_radius(self, r):
        """Inverse of the outward push (bisection; the mapping is monotonic)."""
        if not self.delta:
            return r
        lo, hi = r - self.delta, r
        for _ in range(28):
            mid = (lo + hi) / 2
            if mid + self.delta * smoothstep(PUSH_START, PUSH_END, mid) < r:
                lo = mid
            else:
                hi = mid
        return (lo + hi) / 2

    # ---- placement rules -------------------------------------------------------------
    def clear_of_routes(self, x, z, radius):
        for kind, data in self.keep_clear:
            if kind == "point":
                (px, pz), margin = data
                if math.hypot(x - px, z - pz) < radius + margin:
                    return False
            else:
                (ax, az), (bx, bz), margin = data
                dx, dz = bx - ax, bz - az
                t = max(0.0, min(1.0, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz or 1)))
                if math.hypot(x - ax - t * dx, z - az - t * dz) < radius + margin:
                    return False
        return True

    def solid(self, x, z, radius, force=False):
        """Registers a collision footprint when it can touch the play space.

        Returns False (and the caller skips the prop) if it would block an objective or route.
        """
        x, z = self.place(x, z)
        if math.hypot(x, z) - radius > self.reach:
            return True
        if not force and not self.clear_of_routes(x, z, radius):
            self.skipped += 1
            return False
        self.colliders.append((round(x, 2), round(z, 2), round(radius, 2)))
        return True

    def low_only(self, x, z, distance=32):
        """Camera-side foreground must stay low or it hides KAI."""
        x, z = self.place(x, z)
        r = math.hypot(x, z)
        if r < 1e-3 or r > distance:
            return False
        return (x * CAMERA_DIR.x + z * CAMERA_DIR.z) / r > 0.35

    # ---- emission ----------------------------------------------------------------------
    def batch(self, material):
        if material.name not in self.batches:
            self.batches[material.name] = Batch(material)
        return self.batches[material.name]

    def emit(self, bm, material, matrix=None, color=None, base_y=None, jitter=0.06, ao=0.6, ao_height=1.4, smooth=False):
        """Append a temporary bmesh (game-space coordinates) to a material batch."""
        batch = self.batch(material)
        matrix = matrix or Matrix.Identity(4)
        normal_matrix = matrix.to_3x3().inverted_safe().transposed()
        tint = color if color is not None else (1.0, 1.0, 1.0)
        variation = 1 + self.random.uniform(-jitter, jitter)
        hue = (1 + self.random.uniform(-jitter, jitter) * .5, 1, 1 + self.random.uniform(-jitter, jitter) * .5)
        bm.verts.index_update()
        bm.verts.ensure_lookup_table()
        bm.normal_update()
        world = [matrix @ v.co for v in bm.verts]
        if world and self.delta:
            if self._anchor is not None:
                dx, dz = self._anchor
            else:
                dx, dz = self.push(sum(p.x for p in world) / len(world), sum(p.z for p in world) / len(world))
            if dx or dz:
                offset = Vector((dx, 0, dz))
                world = [p + offset for p in world]
        if base_y is None:
            base_y = min((p.y for p in world), default=0)
        start = len(batch.verts)
        batch.verts.extend(world)
        uv_scale = material.uv
        for face in bm.faces:
            n = (normal_matrix @ face.normal).normalized()
            batch.faces.append((tuple(start + v.index for v in face.verts), smooth))
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in face.loops:
                p = world[loop.vert.index]
                occlusion = ao + (1 - ao) * smoothstep(base_y, base_y + ao_height, p.y)
                # Smooth props shade from vertex normals, so baked light never reveals facets.
                ny = (normal_matrix @ loop.vert.normal).normalized().y if smooth else n.y
                facing = 1 + 0.06 * max(ny, 0) - 0.08 * max(-ny, 0)
                shade = occlusion * facing * variation
                batch.colors.append(tuple(max(0.0, min(1.0, t * shade * h)) for t, h in zip(tint, hue)))
                if ay >= ax and ay >= az:
                    batch.uvs.append((p.x * uv_scale, p.z * uv_scale))
                elif ax >= az:
                    batch.uvs.append((p.z * uv_scale, p.y * uv_scale))
                else:
                    batch.uvs.append((p.x * uv_scale, p.y * uv_scale))
        bm.free()

    def emit_raw(self, material, verts, faces, colors, smooth=True):
        """Append pre-colored geometry (terrain, water); colors are per vertex."""
        batch = self.batch(material)
        start = len(batch.verts)
        batch.verts.extend(Vector(v) for v in verts)
        uv_scale = material.uv
        for face in faces:
            batch.faces.append((tuple(start + i for i in face), smooth))
            for i in face:
                batch.colors.append(colors[i])
                batch.uvs.append((verts[i][0] * uv_scale, verts[i][2] * uv_scale))

    # ---- export ------------------------------------------------------------------------
    def build(self, root):
        objects = []
        for name, batch in self.batches.items():
            if not batch.faces:
                continue
            mesh = bpy.data.meshes.new("Scenery_" + name)
            verts = [to_blender(v) for v in batch.verts]
            mesh.from_pydata(verts, [], [face for face, _ in batch.faces])
            mesh.polygons.foreach_set("use_smooth", [smooth for _, smooth in batch.faces])
            if any(smooth for _, smooth in batch.faces):
                mesh.set_sharp_from_angle(angle=math.radians(60))
            attribute = mesh.color_attributes.new("Col", "BYTE_COLOR", "CORNER")
            flat = []
            for c in batch.colors:
                flat.extend((c[0], c[1], c[2], 1.0))
            attribute.data.foreach_set("color_srgb", flat)
            uv = mesh.uv_layers.new(name="UVMap")
            uv.data.foreach_set("uv", [value for pair in batch.uvs for value in pair])
            mesh.materials.append(batch.material.material)
            mesh.validate(clean_customdata=False)
            obj = bpy.data.objects.new("Scenery_" + name, mesh)
            bpy.context.collection.objects.link(obj)
            obj.parent = root
            objects.append(obj)
        return objects


# ---- primitive generators (return a bmesh in local space) -------------------------------

def bm_box(sx, sy, sz, bevel=0.0, segments=1):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(sx, sy, sz) * 0.45), segments=segments, affect="EDGES", profile=0.5)
    return bm


def bm_cylinder(radius, height, sides=12, top=None, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=sides, radius1=radius, radius2=radius if top is None else top, depth=height)
    # create_cone builds along Z; convert to game Y-up.
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
    return bm


def bm_sphere(radius=1.0, subdivisions=2):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    return bm


def bm_uv_sphere(radius=1.0, segments=16, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=radius)
    return bm


def bm_torus(major, minor, major_segments=24, minor_segments=8):
    bm = bmesh.new()
    rings = []
    for i in range(major_segments):
        a = i / major_segments * math.tau
        ring = []
        for j in range(minor_segments):
            b = j / minor_segments * math.tau
            r = major + minor * math.cos(b)
            ring.append(bm.verts.new((r * math.cos(a), minor * math.sin(b), r * math.sin(a))))
        rings.append(ring)
    for i in range(major_segments):
        for j in range(minor_segments):
            a, b = rings[i], rings[(i + 1) % major_segments]
            bm.faces.new((a[j], b[j], b[(j + 1) % minor_segments], a[(j + 1) % minor_segments]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_prism(points, height, bevel=0.0):
    """Extrude a convex/concave XZ outline upward (game space)."""
    bm = bmesh.new()
    bottom = [bm.verts.new((x, 0, z)) for x, z in points]
    top = [bm.verts.new((x, height, z)) for x, z in points]
    bm.faces.new(list(reversed(bottom)))
    bm.faces.new(top)
    n = len(points)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom[i], bottom[j], top[j], top[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=1, affect="EDGES", profile=0.5)
    return bm


def bm_lathe(profile, sides=16):
    """Revolve (radius, y) pairs around the Y axis; zero radii collapse to a single pole."""
    bm = bmesh.new()
    rings = []
    for r, y in profile:
        if r < 1e-4:
            rings.append([bm.verts.new((0, y, 0))])
        else:
            rings.append([bm.verts.new((r * math.cos(i / sides * math.tau), y, r * math.sin(i / sides * math.tau))) for i in range(sides)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for i in range(sides):
            if len(a) == 1:
                bm.faces.new((a[0], b[(i + 1) % sides], b[i]))
            elif len(b) == 1:
                bm.faces.new((a[i], a[(i + 1) % sides], b[0]))
            else:
                bm.faces.new((a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]))
    if len(rings[0]) > 1:
        bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1]) > 1:
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def bm_tube(points, radius, sides=6, radii=None):
    """A bent tube through game-space points; used for trunks, kelp, cables and ribs."""
    bm = bmesh.new()
    points = [Vector(p) for p in points]
    rings = []
    up = Vector((0, 1, 0))
    for index, p in enumerate(points):
        if index == 0:
            tangent = (points[1] - p).normalized()
        elif index == len(points) - 1:
            tangent = (p - points[index - 1]).normalized()
        else:
            tangent = (points[index + 1] - points[index - 1]).normalized()
        side = tangent.cross(up if abs(tangent.dot(up)) < 0.95 else Vector((1, 0, 0))).normalized()
        other = tangent.cross(side).normalized()
        r = radii[index] if radii else radius
        rings.append([bm.verts.new(p + (side * math.cos(i / sides * math.tau) + other * math.sin(i / sides * math.tau)) * r) for i in range(sides)])
    for a, b in zip(rings, rings[1:]):
        for i in range(sides):
            bm.faces.new((a[i], a[(i + 1) % sides], b[(i + 1) % sides], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def displace(bm, amount, frequency=1.0, seed=0.0, flatten_bottom=None):
    """Organic noise along vertex normals: rocks, canopies, coral and clouds."""
    bm.normal_update()
    for v in bm.verts:
        n = noise.noise(v.co * frequency + Vector((seed, seed * 1.7, seed * .3)))
        v.co += v.normal * n * amount
        if flatten_bottom is not None and v.co.y < flatten_bottom:
            v.co.y = flatten_bottom + (v.co.y - flatten_bottom) * 0.15
    bm.normal_update()
    return bm


def at(x, y, z, yaw=0.0, sx=1.0, sy=None, sz=None, pitch=0.0, roll=0.0):
    sy = sx if sy is None else sy
    sz = sx if sz is None else sz
    return (Matrix.Translation((x, y, z)) @ Matrix.Rotation(yaw, 4, "Y") @ Matrix.Rotation(pitch, 4, "X")
            @ Matrix.Rotation(roll, 4, "Z") @ Matrix.Diagonal((sx, sy, sz, 1)))


def between(a, b):
    """Matrix placing a unit-length +Y element from a to b."""
    a, b = Vector(a), Vector(b)
    direction = b - a
    quat = Vector((0, 1, 0)).rotation_difference(direction.normalized())
    return Matrix.Translation(a) @ quat.to_matrix().to_4x4() @ Matrix.Diagonal((1, direction.length, 1, 1))


# ---- terrain ------------------------------------------------------------------------------

def camera_clearance(x, z, r):
    """Terrain between the camera and KAI stays low, so a wider play space never hides the hero."""
    side = (x * CAMERA_DIR.x + z * CAMERA_DIR.z) / max(r, 1e-6)
    return 1 - .82 * smoothstep(.15, .6, side) * (1 - smoothstep(46, 60, r))


def terrain(scene, material, height_fn, color_fn, half=60.0, step=1.5, flat_radius=20.5, flat_height=0.42):
    """A square grid that is perfectly flat inside the play space and rises beyond it.

    height_fn and color_fn are authored around the old edge; each vertex samples them at its
    authored radius, so hills, shores and craters move out together with the rim dressing.
    """
    count = int(half * 2 / step) + 1
    verts, colors, faces = [], [], []
    for iz in range(count):
        z = -half + iz * step
        for ix in range(count):
            x = -half + ix * step
            r = math.hypot(x, z)
            ra = scene.authored_radius(r)
            k = ra / r if r > 1e-6 else 1.0
            ax, az = x * k, z * k
            if ra <= flat_radius:
                y = flat_height
            else:
                h = height_fn(ax, az, ra)
                y = flat_height + (h * camera_clearance(x, z, r) if h > 0 else h)
            verts.append((x, y, z))
            colors.append(color_fn(ax, y, az, ra))
    for iz in range(count - 1):
        for ix in range(count - 1):
            a = iz * count + ix
            faces.append((a, a + count, a + count + 1, a + 1))
    scene.emit_raw(material, verts, faces, colors, smooth=True)


def ring_ramp(r, start=21.0, end=34.0):
    return smoothstep(start, end, r)
