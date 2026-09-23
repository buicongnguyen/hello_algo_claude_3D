"""Reusable, art-directed prop kits built from kit.py primitives.

Every prop that can reach the play space registers a collision footprint first and is skipped when
it would sit on an objective, a route or a spawn point. Decorative ground cover never collides.
"""
import math

from kit import (Material, Vector, at, between, bm_box, bm_cylinder, bm_lathe, bm_prism, bm_sphere,
                 bm_torus, bm_tube, bm_uv_sphere, displace, mix, scale, smoothstep, srgb)

GROUND_Y = 0.42


def materials():
    return {
        "ground": Material("Ground", 0xffffff, rough=.96, uv=1 / 2.7),
        "stone": Material("Stone", 0xffffff, rough=.9, uv=1 / 2.7),
        "plaster": Material("Plaster", 0xffffff, rough=.84, uv=.5),
        "paint": Material("Paint", 0xffffff, metal=.15, rough=.48, uv=.5),
        "metal": Material("Steel", 0xffffff, metal=.85, rough=.33, uv=.5),
        "dark": Material("Rubber", 0x2a2f36, rough=.72, uv=.5),
        "glass": Material("Glass", 0x1d2b3a, metal=.35, rough=.06, uv=.5),
        "wood": Material("Wood", 0xffffff, rough=.78, uv=.3),
        "bark": Material("Bark", 0xffffff, rough=.92, uv=.6),
        "leaf": Material("Foliage", 0xffffff, rough=.8, uv=.5, double=True),
        "cloth": Material("Fabric", 0xffffff, rough=.9, uv=.5, double=True),
        "water": Material("Water", 0x1f7fa6, metal=.05, rough=.08, uv=1 / 8),
        "cloud": Material("Cloud", 0xffffff, rough=1, uv=.2),
        "warm": Material("Glow warm", 0xffb45a, glow=3.2),
        "cyan": Material("Glow cyan", 0x49e6ff, glow=3.0),
        "pink": Material("Glow pink", 0xff5fae, glow=3.0),
        "violet": Material("Glow violet", 0xa779ff, glow=3.0),
        "white": Material("Glow white", 0xfff4e0, glow=2.6),
        "green": Material("Glow green", 0x63ffb4, glow=2.6),
        "red": Material("Glow red", 0xff4a3a, glow=2.8),
        "ember": Material("Glow ember", 0xff7a2a, glow=1.1),
        "biolume": Material("Glow biolume", 0x5ff0e0, glow=1.2),
        "foil": Material("Gold foil", 0xffffff, metal=.9, rough=.28, uv=.5),
    }


def c(hex_value):
    return srgb(hex_value)


# ---- nature ------------------------------------------------------------------------------

def rock(s, M, x, z, size=1.0, tone=0x8d8479, flat=.6, y=GROUND_Y, collide=True, mat="stone", sink=.25):
    if collide and not s.solid(x, z, size * .8):
        return False
    bm = displace(bm_sphere(1, 2), .3, 1.2, s.random.uniform(0, 50))
    yaw = s.random.uniform(0, math.tau)
    stretch = s.random.uniform(.8, 1.25)
    s.emit(bm, M[mat], at(x, y + size * flat * (1 - sink), z, yaw, size * stretch, size * flat, size), color=c(tone), base_y=y, ao=.5, ao_height=size * flat * 1.4, smooth=True)
    return True


def pebbles(s, M, x, z, count=6, spread=1.2, tone=0x8d8479, size=.16, y=GROUND_Y, mat="stone"):
    for _ in range(count):
        a, r = s.random.uniform(0, math.tau), s.random.uniform(0, spread)
        rock(s, M, x + math.cos(a) * r, z + math.sin(a) * r, size * s.random.uniform(.6, 1.4), tone, .55, y, False, mat)


def tree(s, M, x, z, height=5.0, canopy=0x4f8a3a, trunk=0x6b4a33, lobes=4, collide=True, y=GROUND_Y, shape="round"):
    if collide and not s.solid(x, z, .45 * height / 5):
        return False
    k = height / 5
    lean = Vector((s.random.uniform(-.3, .3), 0, s.random.uniform(-.3, .3)))
    points = [Vector((x, y - .1, z)), Vector((x, y + height * .35, z)) + lean * .4, Vector((x, y + height * .62, z)) + lean]
    s.emit(bm_tube(points, .3, 7, [.32 * k, .22 * k, .15 * k]), M["bark"], color=c(trunk), base_y=y, ao=.55, ao_height=1.2, smooth=True)
    top = points[-1]
    if shape == "pine":
        for i in range(4):
            radius = (1.9 - i * .38) * k
            layer = displace(bm_cylinder(radius, 1.6 * k, 9, top=.05), .12 * k, 1.6, s.random.uniform(0, 30))
            s.emit(layer, M["leaf"], at(top.x, y + height * (.42 + i * .16), top.z, s.random.uniform(0, 6)), color=scale(c(canopy), .85 + i * .06), base_y=y + height * .3, ao=.55, ao_height=height * .7, smooth=True)
        return True
    for i in range(lobes):
        a = i / lobes * math.tau + s.random.uniform(-.4, .4)
        spread = 1.05 * k if i else 0
        radius = (1.55 if i == 0 else 1.15) * k * s.random.uniform(.85, 1.1)
        cy = top.y + (.55 if i == 0 else s.random.uniform(-.25, .35)) * k
        blob = displace(bm_sphere(1, 2), .22, 1.4, s.random.uniform(0, 80))
        s.emit(blob, M["leaf"], at(top.x + math.cos(a) * spread, cy, top.z + math.sin(a) * spread, s.random.uniform(0, 6), radius, radius * .82, radius),
               color=c(canopy), base_y=top.y - radius * .9, ao=.5, ao_height=radius * 2.1, jitter=.1, smooth=True)
    return True


def bush(s, M, x, z, size=.9, tone=0x4a7f38, y=GROUND_Y, flowers=None, collide=False):
    if collide and not s.solid(x, z, size * .8):
        return False
    for i in range(3):
        a = i * 2.1 + s.random.uniform(0, 1)
        blob = displace(bm_sphere(1, 1), .18, 1.8, s.random.uniform(0, 40))
        r = size * s.random.uniform(.55, .8)
        s.emit(blob, M["leaf"], at(x + math.cos(a) * size * .45, y + r * .55, z + math.sin(a) * size * .45, 0, r, r * .75, r), color=c(tone), base_y=y, ao=.5, ao_height=size, jitter=.1, smooth=True)
    if flowers:
        for _ in range(5):
            a, r = s.random.uniform(0, math.tau), s.random.uniform(0, size * .7)
            s.emit(bm_sphere(.07, 0), M["paint"], at(x + math.cos(a) * r, y + size * .75 + s.random.uniform(0, .2), z + math.sin(a) * r), color=c(s.random.choice(flowers)), ao=1)
    return True


def grass(s, M, x, z, blades=7, height=.5, tone=0x6e9a45, y=GROUND_Y, spread=.35):
    import bmesh
    bm = bmesh.new()
    for i in range(blades):
        a = s.random.uniform(0, math.tau)
        ox, oz = math.cos(a) * s.random.uniform(0, spread), math.sin(a) * s.random.uniform(0, spread)
        h = height * s.random.uniform(.6, 1.2)
        lean = s.random.uniform(.1, .35)
        d = s.random.uniform(0, math.tau)
        w = .045
        v1 = bm.verts.new((ox - math.cos(d) * w, 0, oz - math.sin(d) * w))
        v2 = bm.verts.new((ox + math.cos(d) * w, 0, oz + math.sin(d) * w))
        v3 = bm.verts.new((ox + math.sin(d) * lean, h, oz - math.cos(d) * lean))
        bm.faces.new((v1, v2, v3))
    s.emit(bm, M["leaf"], at(x, y, z), color=c(tone), base_y=y, ao=.45, ao_height=height, jitter=.12)


def ground_patch(s, M, x, z, radius, tone, y=GROUND_Y + .012, mat="ground", sides=14):
    """A soft-edged, walkable decal: dirt, moss, paving or sand."""
    points = []
    for i in range(sides):
        a = i / sides * math.tau
        r = radius * (1 + .18 * math.sin(a * 3 + x) + .1 * math.cos(a * 5 + z))
        points.append((math.cos(a) * r, math.sin(a) * r))
    s.emit(bm_prism(points, .01), M[mat], at(x, y, z), color=c(tone), ao=1, jitter=.05)


def flowers(s, M, x, z, count=10, spread=1.2, colors=(0xffd35a, 0xff7fa8, 0xffffff, 0xb58cff), y=GROUND_Y):
    for _ in range(count):
        a, r = s.random.uniform(0, math.tau), s.random.uniform(0, spread)
        px, pz = x + math.cos(a) * r, z + math.sin(a) * r
        h = s.random.uniform(.2, .38)
        s.emit(bm_cylinder(.018, h, 4), M["leaf"], at(px, y + h / 2, pz), color=c(0x4f8a3a), ao=.6, ao_height=h)
        s.emit(bm_sphere(.075, 0), M["paint"], at(px, y + h, pz), color=c(s.random.choice(colors)), ao=1)


# ---- architecture --------------------------------------------------------------------------

def solid_box(s, x, z, w, d, yaw=0.0):
    """Approximate a rotated footprint with overlapping circles."""
    long_, short = (w, d) if w >= d else (d, w)
    count = max(1, math.ceil(long_ / short))
    axis = (math.cos(-yaw), math.sin(-yaw)) if w >= d else (-math.sin(-yaw), math.cos(-yaw))
    placed = []
    for i in range(count):
        t = (i + .5) / count - .5
        cx, cz = x + axis[0] * t * long_, z + axis[1] * t * long_
        placed.append((cx, cz, math.hypot(long_ / count / 2, short / 2) * .95))
    for cx, cz, r in placed:
        if not s.clear_of_routes(cx, cz, r) and math.hypot(cx, cz) - r <= 20.2:
            s.skipped += 1
            return False
    for cx, cz, r in placed:
        s.solid(cx, cz, r, force=True)
    return True


def windows_on(s, M, x, z, yaw, w, h, depth, floors, columns, first=1.6, lit=.25, frame=0xefe9df, sill=True, glow="warm", facades=("front",)):
    story = (h - 1.2) / max(1, floors)
    for facade in facades:
        fw, off, fyaw = (w, depth / 2, 0) if facade in ("front", "back") else (depth, w / 2, math.pi / 2)
        sign = 1 if facade in ("front", "right") else -1
        spacing = fw / columns
        for row in range(floors):
            for col in range(columns):
                lx = -fw / 2 + spacing * (col + .5)
                ly = first + row * story
                if ly + 1.1 > h - .5:
                    continue
                lit_window = s.random.random() < lit
                local = Vector((lx, ly, sign * (off + .02))) if fyaw == 0 else Vector((sign * (off + .02), ly, lx))
                world = at(x, 0, z, yaw) @ local
                ww, wh = min(1.25, spacing * .56), min(1.55, story * .52)
                facing = yaw + (0 if facade == "front" else math.pi if facade == "back" else math.pi / 2 if facade == "right" else -math.pi / 2)
                s.emit(bm_box(ww + .18, wh + .18, .08), M["paint"], at(world.x, world.y, world.z, facing), color=c(frame), ao=1)
                s.emit(bm_box(ww, wh, .1), M[glow if lit_window else "glass"], at(world.x, world.y, world.z, facing), color=(1, 1, 1) if lit_window else c(0xb6c8d6), ao=1)
                s.emit(bm_box(.05, wh, .12), M["paint"], at(world.x, world.y, world.z, facing), color=c(frame), ao=1)
                if sill:
                    below = at(x, 0, z, yaw) @ (local + Vector((0, -wh / 2 - .1, 0)) + (Vector((0, 0, sign * .06)) if fyaw == 0 else Vector((sign * .06, 0, 0))))
                    s.emit(bm_box(ww + .3, .08, .2), M["stone"], at(below.x, below.y, below.z, facing), color=c(0xd9d2c6), ao=1)


def building(s, M, x, z, w, d, h, wall=0xd6cbbb, trim=0xf1ebe0, yaw=0.0, floors=None, columns=None, lit=.25,
             roof_kit=True, awning=None, sign=None, door=0x3b4452, facades=("front", "left", "right"), y=GROUND_Y, collide=True):
    if collide and not solid_box(s, x, z, w, d, yaw):
        return False
    floors = floors or max(1, int((h - 1) / 3.3))
    columns = columns or max(1, int(w / 2.4))
    base = at(x, y, z, yaw)
    s.emit(bm_box(w, h, d, .08), M["plaster"], base @ at(0, h / 2, 0), color=c(wall), base_y=y, ao=.62, ao_height=3.5)
    s.emit(bm_box(w + .12, .7, d + .12, .05), M["stone"], base @ at(0, .35, 0), color=scale(c(wall), .72), base_y=y, ao=.7)
    s.emit(bm_box(w + .35, .38, d + .35, .06), M["stone"], base @ at(0, h + .12, 0), color=c(trim), ao=1)
    for level in range(1, floors):
        s.emit(bm_box(w + .1, .14, d + .1, .03), M["stone"], base @ at(0, 1.2 + level * (h - 1.2) / floors - .3, 0), color=c(trim), ao=1)
    windows_on(s, M, x, z, yaw, w, h, d, floors, columns, 1.2 + (h - 1.2) / floors * .55, lit, trim, facades=facades)
    # Street-level door with a frame, recessed step and optional awning.
    front = base @ at(0, 0, d / 2)
    s.emit(bm_box(1.6, 2.7, .12), M["paint"], front @ at(0, 1.35, .04), color=c(trim), ao=.8)
    s.emit(bm_box(1.25, 2.45, .14), M["paint"], front @ at(0, 1.25, .06), color=c(door), ao=.7)
    s.emit(bm_box(2.1, .16, .7), M["stone"], front @ at(0, .08, .35), color=c(0xb9b2a6), ao=.8)
    if awning:
        s.emit(bm_box(w * .8, .1, 1.3, .04), M["cloth"], front @ at(0, 3.0, .6, 0, 1, 1, 1, .22), color=c(awning), ao=1)
        for sx in (-1, 1):
            s.emit(bm_cylinder(.03, 1, 5), M["metal"], front @ at(sx * w * .38, 2.75, 1.1, 0, 1, 1, 1, 0, .9), color=c(0x5c636b), ao=1)
    if sign:
        tone, glow = sign
        s.emit(bm_box(min(w * .7, 5), .7, .16, .04), M[glow], front @ at(0, h - .9, .14), color=(1, 1, 1), ao=1)
        s.emit(bm_box(min(w * .7, 5) + .2, .9, .1, .03), M["paint"], front @ at(0, h - .9, .06), color=c(tone), ao=1)
    if roof_kit:
        for i in range(s.random.randint(1, 3)):
            ox, oz = s.random.uniform(-w * .3, w * .3), s.random.uniform(-d * .3, d * .3)
            s.emit(bm_box(1.2, .8, 1.0, .06), M["metal"], base @ at(ox, h + .7, oz), color=c(0xa9b1b8), ao=.75)
            s.emit(bm_cylinder(.3, .06, 10), M["dark"], base @ at(ox, h + 1.13, oz), color=c(0x40464d))
        if s.random.random() < .5:
            tx, tz = s.random.uniform(-w * .25, w * .25), s.random.uniform(-d * .25, d * .25)
            s.emit(bm_cylinder(.9, 1.6, 12), M["wood"], base @ at(tx, h + 1.9, tz), color=c(0x7c5a3e), ao=.8, smooth=True)
            s.emit(bm_cylinder(1.0, .5, 12, top=.1), M["metal"], base @ at(tx, h + 2.95, tz), color=c(0x59616a), smooth=True)
            for lx, lz in ((-.6, -.6), (.6, -.6), (-.6, .6), (.6, .6)):
                s.emit(bm_cylinder(.05, .9, 5), M["metal"], base @ at(tx + lx, h + .75, tz + lz), color=c(0x59616a))
    return True


def gable_house(s, M, x, z, w, d, h, wall=0xe7d8bf, roof=0x8a4b3a, yaw=0.0, y=GROUND_Y, chimney=True, lit=.15, trim=0xf4efe6):
    if not solid_box(s, x, z, w, d, yaw):
        return False
    base = at(x, y, z, yaw)
    s.emit(bm_box(w, h, d, .06), M["plaster"], base @ at(0, h / 2, 0), color=c(wall), base_y=y, ao=.6, ao_height=2.5)
    s.emit(bm_box(w + .1, .5, d + .1, .04), M["stone"], base @ at(0, .25, 0), color=scale(c(wall), .7), ao=.75)
    rise = w * .42
    roof_bm = bm_prism([(-w / 2 - .45, 0), (w / 2 + .45, 0), (0, rise)], d + .9)
    # bm_prism extrudes along Y; pitching by -90 degrees lays the ridge along Z with the apex up.
    s.emit(roof_bm, M["paint"], base @ at(0, h, d / 2 + .45, 0, 1, 1, 1, -math.pi / 2), color=c(roof), ao=.9, base_y=y + h)
    if chimney:
        s.emit(bm_box(.7, 1.8, .7, .04), M["stone"], base @ at(w * .22, h + rise * .7, -d * .2), color=c(0x9a6b55), ao=.9)
    windows_on(s, M, x, z, yaw, w, h, d, 1, max(1, int(w / 2.2)), 1.7, lit, trim, facades=("front", "left", "right"))
    front = base @ at(0, 0, d / 2)
    s.emit(bm_box(1.2, 2.3, .14), M["wood"], front @ at(-w * .25 if w > 4 else 0, 1.15, .05), color=c(0x6b4630), ao=.7)
    return True


def street_lamp(s, M, x, z, height=4.4, yaw=0.0, glow="warm", tone=0x2f3a44, y=GROUND_Y):
    # Tall, thin silhouettes between the camera and KAI read as clutter; keep that side open.
    if s.low_only(x, z, 30) or not s.solid(x, z, .22):
        return False
    s.emit(bm_cylinder(.2, .35, 10), M["metal"], at(x, y + .17, z), color=c(tone), smooth=True)
    s.emit(bm_cylinder(.08, height, 8, top=.06), M["metal"], at(x, y + height / 2, z), color=c(tone), smooth=True)
    arm = at(x, y + height, z, yaw)
    s.emit(bm_box(.9, .08, .08), M["metal"], arm @ at(.4, 0, 0), color=c(tone))
    s.emit(bm_cylinder(.28, .22, 10, top=.12), M["metal"], arm @ at(.82, -.05, 0), color=c(tone), smooth=True)
    s.emit(bm_sphere(.17, 1), M[glow], arm @ at(.82, -.2, 0), color=(1, 1, 1))
    return True


def bench(s, M, x, z, yaw=0.0, wood=0x8a6040, frame=0x3d4650, y=GROUND_Y):
    if not s.solid(x, z, .7):
        return False
    b = at(x, y, z, yaw)
    for i in range(3):
        s.emit(bm_box(1.8, .06, .14, .02), M["wood"], b @ at(0, .48, -.18 + i * .18), color=c(wood), ao=.8)
    for i in range(2):
        s.emit(bm_box(1.8, .14, .05, .02), M["wood"], b @ at(0, .72 + i * .18, -.3), color=c(wood), ao=.9)
    for sx in (-.75, .75):
        s.emit(bm_box(.07, .46, .5), M["metal"], b @ at(sx, .23, -.05), color=c(frame), ao=.6)
        s.emit(bm_box(.07, .5, .06), M["metal"], b @ at(sx, .68, -.32), color=c(frame))
    return True


def planter(s, M, x, z, size=1.2, tone=0x9aa3a8, plant=0x4f8a3a, y=GROUND_Y, tree_height=0):
    if not s.solid(x, z, size * .6):
        return False
    s.emit(bm_box(size, .55, size, .06), M["stone"], at(x, y + .27, z), color=c(tone), ao=.6)
    s.emit(bm_box(size - .18, .05, size - .18), M["ground"], at(x, y + .54, z), color=c(0x4a3a2c), ao=1)
    if tree_height:
        tree(s, M, x, z, tree_height, plant, collide=False, y=y + .5)
    else:
        bush(s, M, x, z, size * .55, plant, y=y + .55, flowers=(0xffd35a, 0xff7fa8))
    return True


def bollard(s, M, x, z, tone=0x39424c, y=GROUND_Y):
    if not s.solid(x, z, .15):
        return False
    s.emit(bm_cylinder(.12, .8, 8), M["metal"], at(x, y + .4, z), color=c(tone), smooth=True)
    s.emit(bm_cylinder(.13, .06, 8), M["paint"], at(x, y + .72, z), color=c(0xffc84a))


def car(s, M, x, z, yaw=0.0, body=0xd8574a, y=GROUND_Y):
    if not solid_box(s, x, z, 3.9, 1.8, yaw):
        return False
    b = at(x, y, z, yaw)
    s.emit(bm_box(3.8, .7, 1.7, .22, 2), M["paint"], b @ at(0, .62, 0), color=c(body), ao=.55, ao_height=1.2)
    s.emit(bm_box(2.1, .62, 1.52, .2, 2), M["paint"], b @ at(-.2, 1.25, 0), color=c(body), ao=.9)
    s.emit(bm_box(2.0, .5, 1.56, .12), M["glass"], b @ at(-.2, 1.27, 0), color=c(0xb6c8d6), ao=1)
    for wx in (-1.25, 1.25):
        for wz in (-.8, .8):
            s.emit(bm_cylinder(.36, .26, 12), M["dark"], b @ at(wx, .36, wz, 0, 1, 1, 1, math.pi / 2), color=c(0x262a30), smooth=True)
            s.emit(bm_cylinder(.2, .28, 10), M["metal"], b @ at(wx, .36, wz, 0, 1, 1, 1, math.pi / 2), color=c(0xc4ccd2), smooth=True)
    for lz in (-.55, .55):
        s.emit(bm_box(.06, .16, .34), M["white"], b @ at(1.9, .75, lz), color=(1, 1, 1))
        s.emit(bm_box(.06, .14, .3), M["red"], b @ at(-1.9, .75, lz), color=(1, 1, 1))
    return True


def road(s, M, a, b, width=6.0, asphalt=0x3a3f46, line=0xf2eee2, curb=0xbdb7ad, sidewalk=0x9d9a94, dashes=True, y=GROUND_Y, gaps=()):
    """Asphalt with lane dashes; curbs and sidewalks stop at `gaps` (distance ranges from `a`)."""
    a, b = Vector((a[0], 0, a[1])), Vector((b[0], 0, b[1]))
    direction = b - a
    length = direction.length
    unit = direction / length
    yaw = math.atan2(direction.x, direction.z)
    mid = (a + b) / 2
    s.emit(bm_box(width, .03, length), M["ground"], at(mid.x, y + .012, mid.z, yaw), color=c(asphalt), ao=1, jitter=.03)
    spans, start = [], 0.0
    for g0, g1 in sorted(gaps):
        if g0 > start:
            spans.append((start, g0))
        start = max(start, g1)
    if start < length:
        spans.append((start, length))
    if dashes:
        for i in range(int(length / 3)):
            d = (i + .5) * 3
            if any(g0 - 1 < d < g1 + 1 for g0, g1 in gaps):
                continue
            p = a + unit * d
            s.emit(bm_box(.16, .03, 1.4), M["paint"], at(p.x, y + .03, p.z, yaw), color=c(line), ao=1)
    across = Vector((math.cos(yaw), 0, -math.sin(yaw)))
    for d0, d1 in spans:
        p = a + unit * ((d0 + d1) / 2)
        for side in (-1, 1):
            offset = across * side * (width / 2 + .15)
            s.emit(bm_box(.3, .16, d1 - d0), M["stone"], at(p.x + offset.x, y + .06, p.z + offset.z, yaw), color=c(curb), ao=.8)
            if sidewalk:
                walk = across * side * (width / 2 + 1.55)
                s.emit(bm_box(2.5, .1, d1 - d0), M["stone"], at(p.x + walk.x, y + .03, p.z + walk.z, yaw), color=c(sidewalk), ao=1, jitter=.03)
                for k in range(int((d1 - d0) / 1.25)):
                    q = a + unit * (d0 + (k + 1) * 1.25) + walk
                    s.emit(bm_box(2.5, .1, .04), M["stone"], at(q.x, y + .035, q.z, yaw), color=scale(c(sidewalk), .86), ao=1)


def crosswalk(s, M, x, z, yaw=0.0, width=6.0, stripes=6, y=GROUND_Y):
    for i in range(stripes):
        t = (i + .5) / stripes - .5
        p = at(x, y + .035, z, yaw) @ Vector((t * width, 0, 0))
        s.emit(bm_box(.5, .025, 2.2), M["paint"], at(p.x, p.y, p.z, yaw), color=c(0xf4f1e8), ao=1)


def fence(s, M, a, b, height=1.1, tone=0x8a6546, spacing=2.0, y=GROUND_Y, collide=False):
    a, b = Vector((a[0], y, a[1])), Vector((b[0], y, b[1]))
    length = (b - a).length
    posts = max(2, int(length / spacing) + 1)
    for i in range(posts):
        p = a.lerp(b, i / (posts - 1))
        if collide:
            s.solid(p.x, p.z, .2)
        s.emit(bm_box(.14, height, .14, .02), M["wood"], at(p.x, y + height / 2, p.z, s.random.uniform(-.05, .05)), color=c(tone), ao=.65)
    for level in (.45, .85):
        s.emit(bm_tube([a + Vector((0, height * level, 0)), b + Vector((0, height * level, 0))], .045, 5), M["wood"], color=scale(c(tone), 1.08), ao=1)


# ---- farm ------------------------------------------------------------------------------------

def barn(s, M, x, z, yaw=0.0, y=GROUND_Y):
    w, d, h = 9, 11, 5
    if not solid_box(s, x, z, w, d, yaw):
        return False
    base = at(x, y, z, yaw)
    s.emit(bm_box(w, h, d, .05), M["wood"], base @ at(0, h / 2, 0), color=c(0xa33a2c), base_y=y, ao=.6, ao_height=3)
    for i in range(int(w / .5)):
        s.emit(bm_box(.05, h - .2, .04), M["wood"], base @ at(-w / 2 + .25 + i * .5, h / 2, d / 2 + .02), color=c(0x8a2c22), ao=.7)
    s.emit(bm_prism([(-w / 2 - .5, 0), (-w * .3, h * .38), (0, h * .52), (w * .3, h * .38), (w / 2 + .5, 0)], d + 1), M["paint"], base @ at(0, h, d / 2 + .5, 0, 1, 1, 1, -math.pi / 2), color=c(0x51545c), ao=.95)
    front = base @ at(0, 0, d / 2)
    s.emit(bm_box(3.6, 3.4, .14), M["wood"], front @ at(0, 1.7, .05), color=c(0xf1ebdf), ao=.7)
    for diag in (-1, 1):
        s.emit(bm_box(.18, 4.6, .16), M["wood"], front @ at(0, 1.7, .1, 0, 1, 1, 1, 0, diag * .82), color=c(0xf1ebdf), ao=.8)
    s.emit(bm_box(1.4, 1.2, .14), M["wood"], front @ at(0, h + 1.2, .05), color=c(0xf1ebdf), ao=.9)
    return True


def silo(s, M, x, z, height=9.0, y=GROUND_Y):
    if not s.solid(x, z, 1.9):
        return False
    s.emit(bm_cylinder(1.8, height, 20), M["metal"], at(x, y + height / 2, z), color=c(0xc9cfd3), ao=.6, ao_height=3, smooth=True)
    for i in range(1, int(height / 1.6)):
        s.emit(bm_torus(1.82, .05, 24, 4), M["metal"], at(x, y + i * 1.6, z), color=c(0x9aa2a8))
    s.emit(bm_uv_sphere(1.85, 20, 8), M["metal"], at(x, y + height, z, 0, 1, .55, 1), color=c(0xb24a3a), smooth=True)
    return True


def windmill(s, M, x, z, height=10.0, yaw=0.0, y=GROUND_Y):
    if not s.solid(x, z, 2.0):
        return False
    s.emit(bm_cylinder(2.2, height, 12, top=1.3), M["plaster"], at(x, y + height / 2, z), color=c(0xf1ebdf), ao=.6, ao_height=4, smooth=True)
    s.emit(bm_cylinder(1.6, 2.2, 12, top=.2), M["paint"], at(x, y + height + 1.1, z), color=c(0x51545c), smooth=True)
    hub = at(x, y + height - .2, z, yaw) @ Vector((0, 0, 2.2))
    s.emit(bm_cylinder(.35, .6, 10), M["metal"], at(hub.x, hub.y, hub.z, yaw, 1, 1, 1, math.pi / 2), color=c(0x5c636b), smooth=True)
    for i in range(4):
        angle = i * math.pi / 2 + .3
        blade = at(hub.x, hub.y, hub.z, yaw) @ at(0, 0, .2, 0, 1, 1, 1, 0, angle)
        s.emit(bm_box(.18, 6.2, .1), M["wood"], blade @ at(0, 3.2, 0), color=c(0x7a5a3e))
        s.emit(bm_box(1.3, 5.0, .05), M["cloth"], blade @ at(.72, 3.6, 0), color=c(0xf4efe4), ao=1)
    s.emit(bm_box(1.0, 2.0, .14), M["wood"], at(x, y, z, yaw) @ at(0, 1.0, 2.2), color=c(0x6b4630), ao=.7)
    return True


def hay_bale(s, M, x, z, yaw=0.0, y=GROUND_Y):
    if not s.solid(x, z, .8):
        return False
    s.emit(bm_cylinder(.75, 1.2, 14), M["cloth"], at(x, y + .75, z, yaw, 1, 1, 1, math.pi / 2), color=c(0xd9b45a), ao=.6, ao_height=1.2, smooth=True)
    return True


def crop_rows(s, M, x, z, width, depth, rows=6, tone=0xc9a13f, y=GROUND_Y, plant_height=.7):
    ground_patch(s, M, x, z, max(width, depth) * .55, 0x6a4a30)
    for i in range(rows):
        rx = x - width / 2 + (i + .5) * width / rows
        s.emit(bm_box(.5, .16, depth), M["ground"], at(rx, y + .06, z), color=c(0x5c3f28), ao=.9)
        for j in range(int(depth / .55)):
            pz = z - depth / 2 + (j + .5) * .55
            h = plant_height * s.random.uniform(.75, 1.15)
            s.emit(bm_cylinder(.14, h, 5, top=.03), M["leaf"], at(rx + s.random.uniform(-.06, .06), y + .1 + h / 2, pz), color=c(tone), ao=.55, ao_height=h, jitter=.12)


# ---- coast -----------------------------------------------------------------------------------

def palm(s, M, x, z, height=6.0, lean=(.6, .3), y=GROUND_Y, collide=True, frond=0x3f9a4f):
    if collide and not s.solid(x, z, .35):
        return False
    points, radii = [], []
    for i in range(7):
        t = i / 6
        points.append(Vector((x + lean[0] * t * t * height * .25, y - .1 + t * height, z + lean[1] * t * t * height * .25)))
        radii.append(.26 - .1 * t)
    s.emit(bm_tube(points, .2, 7, radii), M["bark"], color=c(0x8a6844), base_y=y, ao=.6, ao_height=1.5, smooth=True)
    for i in range(1, 7):
        s.emit(bm_torus(radii[i] + .02, .035, 10, 4), M["bark"], at(points[i].x, points[i].y - .15, points[i].z), color=c(0x6a4c30))
    top = points[-1]
    for i in range(8):
        a = i / 8 * math.tau + s.random.uniform(-.2, .2)
        length = s.random.uniform(2.6, 3.4)
        droop = s.random.uniform(.9, 1.4)
        path = []
        for j in range(6):
            t = j / 5
            path.append(top + Vector((math.cos(a) * length * t, .35 * math.sin(t * math.pi) - droop * t * t, math.sin(a) * length * t)))
        import bmesh
        bm = bmesh.new()
        left, right = [], []
        for j, p in enumerate(path):
            width = .55 * math.sin(min(1, (j + .5) / 5) * math.pi) + .05
            side = Vector((-math.sin(a), 0, math.cos(a))) * width
            left.append(bm.verts.new(p + side + Vector((0, -.12 * width, 0))))
            right.append(bm.verts.new(p - side + Vector((0, -.12 * width, 0))))
        for j in range(5):
            bm.faces.new((left[j], right[j], right[j + 1], left[j + 1]))
        s.emit(bm, M["leaf"], color=c(frond), base_y=top.y - 2, ao=.55, ao_height=2.4, jitter=.1, smooth=True)
    for i in range(3):
        a = i * 2.1
        s.emit(bm_sphere(.16, 1), M["bark"], at(top.x + math.cos(a) * .22, top.y - .2, top.z + math.sin(a) * .22), color=c(0x5a4028))
    return True


def umbrella(s, M, x, z, tone=0xff6f61, stripe=0xfff3e0, y=GROUND_Y):
    if not s.solid(x, z, .25):
        return False
    s.emit(bm_cylinder(.05, 2.6, 6), M["metal"], at(x, y + 1.3, z, 0, 1, 1, 1, .08), color=c(0xe8e2d6))
    for i in range(8):
        a = i / 8 * math.tau
        import bmesh
        bm = bmesh.new()
        tip = bm.verts.new((0, .55, 0))
        p1 = bm.verts.new((math.cos(a) * 1.8, 0, math.sin(a) * 1.8))
        p2 = bm.verts.new((math.cos(a + math.tau / 8) * 1.8, 0, math.sin(a + math.tau / 8) * 1.8))
        bm.faces.new((tip, p2, p1))
        s.emit(bm, M["cloth"], at(x + .2, y + 2.5, z), color=c(tone if i % 2 else stripe), ao=1)
    return True


def deck_chair(s, M, x, z, yaw=0.0, tone=0x3fb8c9, y=GROUND_Y):
    if not s.solid(x, z, .6):
        return False
    b = at(x, y, z, yaw)
    s.emit(bm_box(.7, .06, 1.2), M["cloth"], b @ at(0, .38, .1, 0, 1, 1, 1, -.12), color=c(tone), ao=.9)
    s.emit(bm_box(.7, .06, .8), M["cloth"], b @ at(0, .72, -.62, 0, 1, 1, 1, .9), color=c(tone), ao=.9)
    for sx in (-.33, .33):
        s.emit(bm_box(.05, .05, 1.8), M["wood"], b @ at(sx, .4, -.1, 0, 1, 1, 1, -.25), color=c(0xd8c2a0))
    return True


def lifeguard_tower(s, M, x, z, yaw=0.0, y=GROUND_Y):
    if not s.solid(x, z, 1.6):
        return False
    b = at(x, y, z, yaw)
    for lx in (-1.1, 1.1):
        for lz in (-1.1, 1.1):
            s.emit(bm_box(.18, 3.2, .18), M["wood"], b @ at(lx, 1.6, lz), color=c(0xf1ebe0), ao=.6)
    s.emit(bm_box(2.8, .2, 2.8), M["wood"], b @ at(0, 3.2, 0), color=c(0xd8c9ae), ao=.9)
    s.emit(bm_box(2.4, 1.6, 2.2, .05), M["paint"], b @ at(0, 4.1, 0), color=c(0xe24b3b), ao=.9)
    s.emit(bm_box(2.0, .7, .1), M["glass"], b @ at(0, 4.3, 1.12), color=c(0xb6c8d6))
    s.emit(bm_prism([(-1.6, 0), (1.6, 0), (0, .9)], 3.0), M["paint"], b @ at(0, 4.9, 1.5, 0, 1, 1, 1, -math.pi / 2), color=c(0xf6f1e8), ao=1)
    for i in range(6):
        s.emit(bm_box(1.0, .06, .3), M["wood"], b @ at(0, .3 + i * .5, 1.6 + i * .28), color=c(0xd8c9ae), ao=.9)
    return True


def pier(s, M, x0, z0, x1, z1, width=3.0, y=GROUND_Y + .25, deck=0x9c7552):
    a, b = Vector((x0, 0, z0)), Vector((x1, 0, z1))
    length = (b - a).length
    yaw = math.atan2(b.x - a.x, b.z - a.z)
    count = int(length / .42)
    for i in range(count):
        p = a.lerp(b, (i + .5) / count)
        s.emit(bm_box(width, .1, .38, .02), M["wood"], at(p.x, y, p.z, yaw), color=scale(c(deck), s.random.uniform(.85, 1.1)), ao=1, jitter=.08)
    for i in range(int(length / 2.5) + 1):
        p = a.lerp(b, i / max(1, int(length / 2.5)))
        for side in (-1, 1):
            q = p + Vector((math.cos(yaw), 0, -math.sin(yaw))) * side * (width / 2 - .1)
            s.emit(bm_cylinder(.14, 3.0, 8), M["wood"], at(q.x, y - 1.4, q.z), color=c(0x5c4430), ao=.5, ao_height=2, smooth=True)


def shell_scatter(s, M, x, z, count=8, spread=2.0, y=GROUND_Y):
    for _ in range(count):
        a, r = s.random.uniform(0, math.tau), s.random.uniform(0, spread)
        tone = s.random.choice((0xf5e3cf, 0xf0b9a4, 0xe8d3b0, 0xffd7c2))
        s.emit(bm_uv_sphere(.12, 8, 4), M["paint"], at(x + math.cos(a) * r, y + .02, z + math.sin(a) * r, s.random.uniform(0, 6), 1, .35, 1.3), color=c(tone), ao=1, smooth=True)


def driftwood(s, M, x, z, length=2.4, y=GROUND_Y):
    a = s.random.uniform(0, math.tau)
    p0 = Vector((x - math.cos(a) * length / 2, y + .1, z - math.sin(a) * length / 2))
    p1 = Vector((x, y + .16, z))
    p2 = Vector((x + math.cos(a) * length / 2, y + .08, z + math.sin(a) * length / 2))
    s.emit(bm_tube([p0, p1, p2], .12, 6, [.1, .15, .07]), M["bark"], color=c(0xb9a891), ao=.8, smooth=True)


# ---- sea -------------------------------------------------------------------------------------

def coral_branch(s, M, x, z, size=1.0, tone=0xff6f8f, y=GROUND_Y, collide=True, glow=None):
    if collide and not s.solid(x, z, .7 * size):
        return False
    for i in range(6):
        a = i / 6 * math.tau + s.random.uniform(-.3, .3)
        tilt = s.random.uniform(.25, .7)
        length = size * s.random.uniform(1.0, 1.8)
        p0 = Vector((x, y, z))
        p1 = p0 + Vector((math.cos(a) * tilt * length * .5, length * .55, math.sin(a) * tilt * length * .5))
        p2 = p1 + Vector((math.cos(a) * tilt * length * .5, length * .45, math.sin(a) * tilt * length * .5))
        s.emit(bm_tube([p0, p1, p2], .1, 6, [.13 * size, .09 * size, .05 * size]), M["paint"], color=c(tone), base_y=y, ao=.45, ao_height=length, jitter=.1, smooth=True)
        s.emit(bm_sphere(.08 * size, 1), M[glow] if glow else M["paint"], at(p2.x, p2.y, p2.z), color=(1, 1, 1) if glow else scale(c(tone), 1.2))
        branch = p1 + Vector((math.sin(a) * .4 * size, .5 * size, -math.cos(a) * .4 * size))
        s.emit(bm_tube([p1, branch], .06, 5, [.07 * size, .04 * size]), M["paint"], color=c(tone), base_y=y, ao=.5, ao_height=length, smooth=True)
    return True


def brain_coral(s, M, x, z, size=1.0, tone=0xd9a15a, y=GROUND_Y, collide=True):
    if collide and not s.solid(x, z, size * .9):
        return False
    bm = displace(bm_sphere(1, 3), .07, 5.5, s.random.uniform(0, 30))
    s.emit(bm, M["paint"], at(x, y + size * .3, z, s.random.uniform(0, 6), size, size * .65, size), color=c(tone), base_y=y, ao=.45, ao_height=size, smooth=True)
    return True


def fan_coral(s, M, x, z, size=1.4, tone=0xb574ff, y=GROUND_Y, yaw=None):
    import bmesh
    bm = bmesh.new()
    rings = []
    for r_i in range(4):
        ring = []
        for a_i in range(9):
            a = math.pi * (a_i / 8)
            r = size * (r_i + 1) / 4
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r * 1.1 + noise_offset(a_i, r_i), .08 * math.sin(a_i + r_i))))
        rings.append(ring)
    center = bm.verts.new((0, 0, 0))
    for a_i in range(8):
        bm.faces.new((center, rings[0][a_i], rings[0][a_i + 1]))
    for r_i in range(3):
        for a_i in range(8):
            bm.faces.new((rings[r_i][a_i], rings[r_i + 1][a_i], rings[r_i + 1][a_i + 1], rings[r_i][a_i + 1]))
    s.emit(bm, M["leaf"], at(x, y, z, s.random.uniform(0, 6) if yaw is None else yaw), color=c(tone), base_y=y, ao=.5, ao_height=size, jitter=.1)


def noise_offset(a, b):
    return .06 * math.sin(a * 2.3 + b * 1.7)


def kelp(s, M, x, z, height=6.0, tone=0x5a8a2e, y=GROUND_Y, sway=.8):
    points = []
    phase = s.random.uniform(0, 6)
    for i in range(8):
        t = i / 7
        points.append(Vector((x + math.sin(t * 3 + phase) * sway * t, y + t * height, z + math.cos(t * 2.3 + phase) * sway * .5 * t)))
    s.emit(bm_tube(points, .08, 5, [.1 - .06 * i / 7 for i in range(8)]), M["leaf"], color=c(tone), base_y=y, ao=.45, ao_height=height * .6, smooth=True)
    for i in range(1, 7):
        p = points[i]
        s.emit(bm_uv_sphere(.25, 6, 3), M["leaf"], at(p.x + .15, p.y, p.z, s.random.uniform(0, 6), 1, .15, .6), color=scale(c(tone), 1.1), ao=.8)


def anemone(s, M, x, z, tone=0xff8a5c, tip=0xffd0e0, y=GROUND_Y, count=10):
    s.emit(bm_cylinder(.3, .3, 10, top=.34), M["paint"], at(x, y + .15, z), color=scale(c(tone), .8), ao=.6, smooth=True)
    for i in range(count):
        a = i / count * math.tau
        p0 = Vector((x + math.cos(a) * .22, y + .28, z + math.sin(a) * .22))
        p1 = p0 + Vector((math.cos(a) * .25, .5 + s.random.uniform(0, .2), math.sin(a) * .25))
        s.emit(bm_tube([p0, p1], .04, 4, [.05, .02]), M["paint"], color=c(tone), ao=.9)
        s.emit(bm_sphere(.045, 0), M["pink"], at(p1.x, p1.y, p1.z), color=(1, 1, 1))


def sponge_tubes(s, M, x, z, tone=0xf2b53a, y=GROUND_Y):
    for i in range(4):
        a = i * 1.7
        h = s.random.uniform(.6, 1.4)
        px, pz = x + math.cos(a) * .35, z + math.sin(a) * .35
        s.emit(bm_cylinder(.18, h, 10, top=.22), M["paint"], at(px, y + h / 2, pz), color=c(tone), base_y=y, ao=.45, ao_height=h, smooth=True)
        s.emit(bm_torus(.2, .04, 10, 4), M["paint"], at(px, y + h, pz), color=scale(c(tone), 1.15))
        s.emit(bm_cylinder(.16, .02, 10), M["dark"], at(px, y + h + .005, pz), color=c(0x3a2a18))


def seagrass(s, M, x, z, count=10, height=.9, tone=0x5fa33a, y=GROUND_Y, spread=.7):
    grass(s, M, x, z, count, height, tone, y, spread)


def barrel(s, M, x, z, tone=0x8a5a3a, y=GROUND_Y, tipped=False, collide=True):
    if collide and not s.solid(x, z, .5):
        return False
    profile = [(.0, 0), (.42, 0), (.5, .45), (.42, .9), (.0, .9)]
    matrix = at(x, y + (.45 if tipped else 0), z, s.random.uniform(0, 6), 1, 1, 1, math.pi / 2 if tipped else 0)
    if tipped:
        matrix = matrix @ at(0, -.45, 0)
    s.emit(bm_lathe(profile, 12), M["wood"], matrix, color=c(tone), base_y=y, ao=.6, smooth=True)
    for h in (.18, .72):
        s.emit(bm_torus(.47, .03, 12, 4), M["metal"], matrix @ at(0, h, 0), color=c(0x4d5359))
    return True


def crate(s, M, x, z, size=1.1, tone=0x9a7a52, y=GROUND_Y, yaw=None, collide=True):
    if collide and not s.solid(x, z, size * .7):
        return False
    yaw = s.random.uniform(0, 6) if yaw is None else yaw
    b = at(x, y + size / 2, z, yaw)
    s.emit(bm_box(size, size, size, .04), M["wood"], b, color=c(tone), base_y=y, ao=.6)
    for band in (-.3, .3):
        s.emit(bm_box(size + .03, size * .12, size + .03), M["wood"], b @ at(0, band * size, 0), color=scale(c(tone), .72), ao=1)
    return True


# ---- volcanic ----------------------------------------------------------------------------------

def basalt_columns(s, M, x, z, count=7, height=4.0, tone=0x2a2f3a, y=GROUND_Y, radius=.7, collide=True, cap_glow=None):
    if collide and not s.solid(x, z, radius * 2.2):
        return False
    for i in range(count):
        a = i * 2.4
        r = 0 if i == 0 else radius * 1.6 * math.sqrt(i / count)
        px, pz = x + math.cos(a) * r, z + math.sin(a) * r
        h = height * s.random.uniform(.45, 1.1) * (1.1 - r / (radius * 2.5))
        hexagon = [(math.cos(k / 6 * math.tau) * radius * .85, math.sin(k / 6 * math.tau) * radius * .85) for k in range(6)]
        s.emit(bm_prism(hexagon, h, .03), M["stone"], at(px, y - .2, pz, s.random.uniform(0, 1)), color=c(tone), base_y=y, ao=.55, ao_height=h * .8, jitter=.1)
        if cap_glow and s.random.random() < .35:
            s.emit(bm_prism(hexagon, .05), M[cap_glow], at(px, y - .2 + h + .005, pz), color=(1, 1, 1))
    return True


def vent(s, M, x, z, height=3.0, tone=0x2b2830, y=GROUND_Y, glow="warm", collide=True):
    if collide and not s.solid(x, z, 1.4):
        return False
    bm = displace(bm_cylinder(1.5, height, 12, top=.55), .18, 1.4, s.random.uniform(0, 30))
    s.emit(bm, M["stone"], at(x, y + height / 2 - .1, z), color=c(tone), base_y=y, ao=.5, ao_height=height, smooth=True)
    s.emit(bm_torus(.5, .12, 14, 5), M[glow], at(x, y + height - .1, z), color=(1, 1, 1))
    s.emit(bm_cylinder(.42, .1, 12), M[glow], at(x, y + height - .15, z), color=(1, 1, 1))
    return True


def tube_worms(s, M, x, z, count=7, y=GROUND_Y):
    for i in range(count):
        a, r = s.random.uniform(0, math.tau), s.random.uniform(0, .5)
        h = s.random.uniform(.6, 1.5)
        px, pz = x + math.cos(a) * r, z + math.sin(a) * r
        s.emit(bm_cylinder(.06, h, 6), M["plaster"], at(px, y + h / 2, pz), color=c(0xe8e0d0), ao=.5, ao_height=h)
        s.emit(bm_sphere(.1, 1), M["red"], at(px, y + h + .05, pz), color=(1, 1, 1))


def glow_mushroom(s, M, x, z, size=.6, glow="cyan", y=GROUND_Y):
    s.emit(bm_cylinder(.06 * size / .6, size, 6), M["plaster"], at(x, y + size / 2, z), color=c(0xc9c1b6), ao=.6)
    s.emit(bm_uv_sphere(size * .45, 10, 5), M[glow], at(x, y + size, z, 0, 1, .45, 1), color=(1, 1, 1))


# ---- industrial / research -------------------------------------------------------------------

def railing(s, M, a, b, height=1.1, tone=0xd9a93a, y=GROUND_Y, spacing=1.6):
    a, b = Vector((a[0], y, a[1])), Vector((b[0], y, b[1]))
    posts = max(2, int((b - a).length / spacing) + 1)
    for i in range(posts):
        p = a.lerp(b, i / (posts - 1))
        s.emit(bm_cylinder(.04, height, 6), M["metal"], at(p.x, y + height / 2, p.z), color=c(tone))
    for h in (.5, 1.0):
        s.emit(bm_tube([a + Vector((0, height * h, 0)), b + Vector((0, height * h, 0))], .035, 5), M["metal"], color=c(tone))


def container(s, M, x, z, yaw=0.0, tone=0x2f7fb8, y=GROUND_Y, stacked=0):
    if not solid_box(s, x, z, 6.1, 2.5, yaw):
        return False
    for level in range(stacked + 1):
        b = at(x, y + level * 2.6, z, yaw + (level * .08))
        body = tone if level == 0 else s.random.choice((0xd8573f, 0xe0b340, 0x4a9a6a, 0x2f7fb8))
        s.emit(bm_box(6.0, 2.55, 2.45, .05), M["paint"], b @ at(0, 1.28, 0), color=c(body), base_y=y, ao=.6, ao_height=2.6)
        for i in range(14):
            s.emit(bm_box(.12, 2.3, 2.5), M["paint"], b @ at(-2.8 + i * .43, 1.28, 0), color=scale(c(body), .85), ao=1)
        s.emit(bm_box(.08, 2.4, 2.35), M["metal"], b @ at(3.02, 1.28, 0), color=c(0x7c848c))
    return True


def radar_dome(s, M, x, z, radius=2.2, y=GROUND_Y + 3):
    s.emit(bm_uv_sphere(radius, 20, 10), M["plaster"], at(x, y + radius * .7, z), color=c(0xf1efe8), ao=.8, smooth=True)
    s.emit(bm_cylinder(radius * .8, 1.4, 16), M["metal"], at(x, y, z), color=c(0x9aa2a8), smooth=True)


def dish(s, M, x, z, radius=3.0, height=4.0, yaw=0.0, pitch=.7, y=GROUND_Y, tone=0xf1efe8):
    if not s.solid(x, z, 1.2):
        return False
    s.emit(bm_cylinder(1.1, 1.0, 12), M["plaster"], at(x, y + .5, z), color=c(0xb9bec2), ao=.6, smooth=True)
    s.emit(bm_cylinder(.35, height, 10), M["metal"], at(x, y + height / 2, z), color=c(0x9aa2a8), smooth=True)
    # A closed shell: out along the back of the reflector, then back along its face.
    profile = [(0, 0), (radius * .35, radius * .04), (radius * .7, radius * .16), (radius, radius * .36), (radius * .97, radius * .41),
               (radius * .66, radius * .22), (radius * .32, radius * .1), (0, radius * .07)]
    head = at(x, y + height, z, yaw, 1, 1, 1, pitch)
    s.emit(bm_lathe(profile, 24), M["plaster"], head, color=c(tone), ao=.9, smooth=True)
    tip = head @ Vector((0, radius * .95, 0))
    for i in range(3):
        a = i / 3 * math.tau
        rim = head @ Vector((math.cos(a) * radius * .7, radius * .2, math.sin(a) * radius * .7))
        s.emit(bm_tube([rim, tip], .04, 4), M["metal"], color=c(0x9aa2a8))
    s.emit(bm_sphere(.22, 1), M["cyan"], at(tip.x, tip.y, tip.z), color=(1, 1, 1))
    return True


def mast(s, M, x, z, height=8.0, y=GROUND_Y, glow="red"):
    if not s.solid(x, z, .5):
        return False
    for i in range(3):
        a = i / 3 * math.tau
        s.emit(bm_tube([Vector((x + math.cos(a) * .6, y, z + math.sin(a) * .6)), Vector((x + math.cos(a) * .12, y + height, z + math.sin(a) * .12))], .05, 5), M["metal"], color=c(0xe8e4dc))
    for h in range(1, int(height / 1.2)):
        t = h * 1.2 / height
        r = .6 - .48 * t
        s.emit(bm_torus(r, .025, 3, 3), M["metal"], at(x, y + h * 1.2, z), color=c(0xe8e4dc))
    s.emit(bm_sphere(.16, 1), M[glow], at(x, y + height + .1, z), color=(1, 1, 1))


def truss(s, M, a, b, width=.8, tone=0xc9ced3):
    a, b = Vector(a), Vector(b)
    axis = (b - a).normalized()
    side = axis.cross(Vector((0, 1, 0)) if abs(axis.y) < .9 else Vector((1, 0, 0))).normalized() * width / 2
    up = axis.cross(side).normalized() * width / 2
    corners = [side + up, side - up, -side - up, -side + up]
    for corner in corners:
        s.emit(bm_tube([a + corner, b + corner], .045, 4), M["metal"], color=c(tone), ao=1)
    segments = max(1, int((b - a).length / width))
    for i in range(segments):
        p0, p1 = a.lerp(b, i / segments), a.lerp(b, (i + 1) / segments)
        for k in range(4):
            s.emit(bm_tube([p0 + corners[k], p1 + corners[(k + 1) % 4]], .025, 3), M["metal"], color=c(tone), ao=1)


def solar_panel(s, M, x, y, z, w=6.0, d=3.0, yaw=0.0, pitch=0.0, frame=0xc9ced3):
    b = at(x, y, z, yaw, 1, 1, 1, pitch)
    s.emit(bm_box(w, .08, d), M["glass"], b, color=c(0x3b5cc4), ao=1)
    s.emit(bm_box(w + .12, .05, d + .12), M["metal"], b @ at(0, -.05, 0), color=c(frame), ao=1)
    for i in range(1, int(w / .75)):
        s.emit(bm_box(.03, .1, d), M["metal"], b @ at(-w / 2 + i * .75, 0, 0), color=c(frame), ao=1)
    for i in range(1, int(d / .75)):
        s.emit(bm_box(w, .1, .03), M["metal"], b @ at(0, 0, -d / 2 + i * .75), color=c(frame), ao=1)


def module(s, M, x, y, z, length=6.0, radius=1.4, yaw=0.0, pitch=0.0, tone=0xeceae4, band=0xd9a93a, windows=True):
    b = at(x, y, z, yaw, 1, 1, 1, pitch)
    s.emit(bm_cylinder(radius, length, 18), M["plaster"], b, color=c(tone), ao=.85, smooth=True)
    for h in (-length / 2 + .2, length / 2 - .2):
        s.emit(bm_cylinder(radius + .06, .25, 18), M["metal"], b @ at(0, h, 0), color=c(band), smooth=True)
    if windows:
        for i in range(int(length / 1.6)):
            s.emit(bm_cylinder(.22, .12, 10), M["cyan"], b @ at(radius, -length / 2 + .9 + i * 1.6, 0, 0, 1, 1, 1, 0, math.pi / 2), color=(1, 1, 1))


# ---- sky -----------------------------------------------------------------------------------

def cloud(s, M, x, y, z, size=4.0, tone=0xffffff, puffs=6, flat=.55, mat="cloud", shade=.62, detail=2):
    for i in range(puffs):
        a = i / puffs * math.tau + s.random.uniform(-.4, .4)
        r = size * s.random.uniform(.35, .7)
        d = size * s.random.uniform(.2, .75) if i else 0
        py = y + s.random.uniform(0, size * .25) + (size * .15 if i == 0 else 0)
        bm = displace(bm_sphere(1, detail), .1, 1.1, s.random.uniform(0, 90))
        s.emit(bm, M[mat], at(x + math.cos(a) * d, py, z + math.sin(a) * d, 0, r * 1.25, r * flat * 1.4, r), color=c(tone), base_y=y - size * .3, ao=shade, ao_height=size * .9, jitter=.04, smooth=True)


# ---- festival -------------------------------------------------------------------------------

def string_lights(s, M, a, b, sag=.8, bulbs=12, colors=("warm", "pink", "cyan", "white"), cable=0x2c2f36):
    a, b = Vector(a), Vector(b)
    points = []
    for i in range(9):
        t = i / 8
        p = a.lerp(b, t)
        p.y -= sag * 4 * t * (1 - t)
        points.append(p)
    s.emit(bm_tube(points, .02, 3), M["dark"], color=c(cable), ao=1)
    for i in range(bulbs):
        t = (i + .5) / bulbs
        p = a.lerp(b, t)
        p.y -= sag * 4 * t * (1 - t) + .12
        s.emit(bm_sphere(.09, 1), M[colors[i % len(colors)]], at(p.x, p.y, p.z), color=(1, 1, 1))


def stall(s, M, x, z, yaw=0.0, canopy=0xff7a8a, stripe=0xfff3e0, y=GROUND_Y, glow="warm"):
    if not solid_box(s, x, z, 3.0, 2.0, yaw):
        return False
    b = at(x, y, z, yaw)
    s.emit(bm_box(2.8, 1.0, 1.4, .04), M["wood"], b @ at(0, .5, 0), color=c(0x8a6040), ao=.6)
    s.emit(bm_box(3.0, .08, 1.6), M["wood"], b @ at(0, 1.04, 0), color=c(0xd8c2a0), ao=1)
    for sx in (-1.4, 1.4):
        for sz in (-.75, .75):
            s.emit(bm_box(.08, 2.4, .08), M["wood"], b @ at(sx, 1.2, sz), color=c(0x6b4630))
    for i in range(6):
        s.emit(bm_box(.5, .08, 2.0), M["cloth"], b @ at(-1.25 + i * .5, 2.5, 0, 0, 1, 1, 1, .12), color=c(canopy if i % 2 else stripe), ao=1)
    for i in range(3):
        s.emit(bm_sphere(.14, 1), M[glow], b @ at(-.9 + i * .9, 2.2, .82), color=(1, 1, 1))
    for i in range(5):
        s.emit(bm_box(.3, .25, .3), M["paint"], b @ at(-1.1 + i * .55, 1.2, 0), color=c(s.random.choice((0xffd35a, 0x7fd0ff, 0xff8fb0, 0x9be27a))), ao=.9)
    return True


def lantern_post(s, M, x, z, height=2.4, glow="warm", y=GROUND_Y):
    if not s.solid(x, z, .2):
        return False
    s.emit(bm_cylinder(.06, height, 6), M["wood"], at(x, y + height / 2, z), color=c(0x5c4430))
    s.emit(bm_box(.5, .08, .08), M["wood"], at(x, y + height, z), color=c(0x5c4430))
    s.emit(bm_lathe([(0, 0), (.2, .05), (.24, .3), (.18, .55), (0, .6)], 10), M[glow], at(x + .2, y + height - .75, z), color=(1, 1, 1))
    return True


def fountain(s, M, x, z, radius=2.4, y=GROUND_Y):
    if not s.solid(x, z, radius + .1):
        return False
    s.emit(bm_lathe([(radius - .3, 0), (radius, 0), (radius, .6), (radius - .3, .6), (radius - .3, .3)], 28), M["stone"], at(x, y, z), color=c(0xd8d2c6), ao=.7, smooth=True)
    s.emit(bm_cylinder(radius - .3, .05, 28), M["water"], at(x, y + .45, z), color=(1, 1, 1))
    s.emit(bm_lathe([(0, 0), (.3, 0), (.2, 1.2), (.9, 1.35), (.9, 1.5), (0, 1.55)], 16), M["stone"], at(x, y + .4, z), color=c(0xe4ded3), ao=.8, smooth=True)
    s.emit(bm_cylinder(.8, .04, 16), M["water"], at(x, y + 1.9, z), color=(1, 1, 1))
    return True


def banner(s, M, x, z, height=4.5, tone=0x5b7cff, y=GROUND_Y):
    if not s.solid(x, z, .2):
        return False
    s.emit(bm_cylinder(.07, height, 6), M["metal"], at(x, y + height / 2, z), color=c(0xd6c07a))
    s.emit(bm_box(1.0, .06, .06), M["metal"], at(x + .45, y + height - .1, z), color=c(0xd6c07a))
    s.emit(bm_box(.9, 2.0, .04), M["cloth"], at(x + .5, y + height - 1.15, z), color=c(tone), ao=1)
    return True


def columns_portico(s, M, x, z, width=14.0, height=6.0, count=6, y=GROUND_Y + .9, tone=0xece6da):
    for i in range(count):
        px = x - width / 2 + (i + .5) * width / count
        s.emit(bm_cylinder(.42, height, 16, top=.36), M["stone"], at(px, y + height / 2, z), color=c(tone), ao=.7, ao_height=2, smooth=True)
        s.emit(bm_box(1.1, .3, 1.1), M["stone"], at(px, y + .15, z), color=c(tone), ao=.8)
        s.emit(bm_box(1.0, .3, 1.0), M["stone"], at(px, y + height, z), color=c(tone), ao=1)


def steps(s, M, x, z, width=14.0, count=3, depth=.6, rise=.3, y=GROUND_Y, tone=0xd8d2c6, yaw=0.0):
    for i in range(count):
        s.emit(bm_box(width, rise * (i + 1), depth), M["stone"], at(x, y, z, yaw) @ at(0, rise * (i + 1) / 2, -i * depth), color=c(tone), ao=.85)
