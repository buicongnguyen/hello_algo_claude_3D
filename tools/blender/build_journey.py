"""Author fifteen distinct discovery environments (plus two geology samples) in Blender.

Run through `npm run assets:journey`, or rebuild selected scenes while iterating:
    blender --background --python tools/blender/build_journey.py -- city reef

Coordinates are game space (x east, y up, z south). The play space (radius 18.5) stays flat and
walkable; terrain, architecture and set dressing rise beyond it. Objective points and routes are
read from src/journey-data.js, so no solid prop can ever cover a target, and every solid prop that
reaches the play space exports a collision footprint in journey-manifest.json.
"""
import functools
import hashlib
import inspect
import json
import math
import re
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import props as P  # noqa: E402
from kit import Scene, Vector, at, bm_box, bm_cylinder, bm_prism, bm_sphere, bm_torus, bm_tube, bm_uv_sphere, displace, fbm, mix, scale, smoothstep, srgb, terrain  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models"
SOURCE = ROOT / "assets" / "blender"
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
G = P.GROUND_Y
c = srgb
# The runtime owns the play radius; scenery is authored around the old 18.5 m edge and moved out to it.
PLAY_RADIUS = float(re.search(r"export const PLAY_RADIUS = ([\d.]+);", (ROOT / "src" / "presentation.js").read_text(encoding="utf8")).group(1))


def anchored(fn):
    """Each prop moves as one rigid piece, anchored at its own position (or midpoint for line props)."""
    names = list(inspect.signature(fn).parameters)[2:6]

    def wrapper(s, M, *args, **kwargs):
        if fn.__name__ == "road":
            # Streets run through the centre and must stay continuous with it.
            with s.anchor(0, 0, fixed=True):
                return fn(s, M, *args, **kwargs)
        if names[:2] == ["x", "z"]:
            x, z = args[0], args[1]
        elif names[:3] == ["x", "y", "z"]:
            x, z = args[0], args[2]
        elif names[:2] == ["a", "b"]:
            a, b = args[0], args[1]
            k = 2 if len(a) == 3 else 1
            x, z = (a[0] + b[0]) / 2, (a[k] + b[k]) / 2
        elif names[:4] == ["x0", "z0", "x1", "z1"]:
            x, z = args[0], args[1]
        else:
            return fn(s, M, *args, **kwargs)
        with s.anchor(x, z):
            return fn(s, M, *args, **kwargs)
    return functools.wraps(fn)(wrapper)


for _name, _fn in inspect.getmembers(P, inspect.isfunction):
    if _fn.__module__ == P.__name__ and _name not in ("materials", "c", "noise_offset", "solid_box"):
        setattr(P, _name, anchored(_fn))

# ---- gameplay keep-clear data --------------------------------------------------------------------

JOURNEY = (ROOT / "src" / "journey-data.js").read_text(encoding="utf8")
POINT = r"p\((-?[\d.]+),\s*(-?[\d.]+)\)"


def stage_line(scene_key):
    for line in JOURNEY.splitlines():
        if f'scene: "{scene_key}"' in line and "type:" in line:
            return line
    return ""


def keep_clear(scene_key):
    line = stage_line(scene_key)
    clear = [("point", ((0, 13), 3.4)), ("point", ((-3, 7), 1.8))]
    # Weapon crates and power-ups spawn at fixed spots whenever combat is enabled.
    clear += [("point", (p, 1.8)) for p in [(-2, 10), (3, 8), (-5, 6), (6, 5)]]
    if not line:
        return clear

    def many(field):
        m = re.search(field + r": \[([^\]]*)\]", line)
        return [(float(a), float(b)) for a, b in re.findall(POINT, m.group(1))] if m else []

    def one(field):
        m = re.search(field + r": " + POINT, line)
        return (float(m.group(1)), float(m.group(2))) if m else None

    kind = re.search(r'type: "([\w-]+)"', line).group(1)
    points = many("positions") + many("shelters") + many("gatePositions") + many("route")
    points += [p for p in (one("goal"), one("source"), one("receiver")) if p]
    clear += [("point", (p, 3.2)) for p in points]
    chains = []
    if kind == "race":
        chains.append([(0, 13)] + many("gatePositions"))
    if kind == "escort":
        chains.append([(-2, 12)] + many("route"))
    if kind == "relay":
        chains.append([one("source")] + many("positions") + [one("receiver")])
    if kind == "homecoming":
        chains.append([(0, 13), one("goal")])
    if kind == "defense":
        clear += [("point", (p, 3.0)) for p in [(0, -11), (-6, -3), (6, -3), (0, -3), (-7, -3), (7, -3)]]
        chains += [[(x, 14), (0, -11)] for x in (-7, -6, 0, 6, 7)]
    if kind == "boss":
        clear.append(("point", ((0, 0), PLAY_RADIUS)))
    for chain in chains:
        for a, b in zip(chain, chain[1:]):
            clear.append(("segment", (a, b, 2.2)))
    return clear


# ---- palettes and shared helpers ------------------------------------------------------------------

def ground_colors(base, alt, dark, scale_=.06, seed=0.0, rim=None, rim_start=22.0):
    base, alt, dark = c(base), c(alt), c(dark)
    rim = c(rim) if rim else None

    def color(x, y, z, r):
        n = fbm(x * scale_, z * scale_, 3, seed)
        m = fbm(x * scale_ * 3.1, z * scale_ * 3.1, 2, seed + 7)
        col = mix(base, alt, smoothstep(-.25, .45, n))
        col = mix(col, dark, smoothstep(.25, .75, m) * .55)
        if rim:
            col = mix(col, rim, smoothstep(rim_start, rim_start + 12, r) * .8)
        return col
    return color


def hills(amplitude=6.0, start=21.5, end=36.0, frequency=.045, seed=0.0, base=0.0):
    def height(x, z, r):
        ramp = smoothstep(start, end, r)
        return ramp * (base + amplitude * (.55 + .45 * fbm(x * frequency, z * frequency, 4, seed)))
    return height


def ring_positions(count, radius_range, seed_rng, arc=(0, math.tau), avoid_camera=True, s=None):
    out = []
    for i in range(count):
        a = arc[0] + (arc[1] - arc[0]) * (i + seed_rng.uniform(.1, .9)) / count
        r = seed_rng.uniform(*radius_range)
        x, z = math.cos(a) * r, math.sin(a) * r
        if avoid_camera and s and s.low_only(x, z, 40):
            continue
        out.append((x, z))
    return out


def scatter(s, radius_range, count, fn, arc=(0, math.tau), low_ok=True):
    rng = s.random
    for _ in range(count):
        a = rng.uniform(*arc)
        r = rng.uniform(*radius_range)
        x, z = math.cos(a) * r, math.sin(a) * r
        if not low_ok and s.low_only(x, z, 40):
            continue
        if r < 19.5 and not s.clear_of_routes(x, z, .6):
            continue
        fn(x, z)


def water_plane(s, M, y=0.12, size=240, material="water", center=(0, 0)):
    s.emit(bm_box(size, .02, size), M[material], at(center[0], y, center[1]), color=(1, 1, 1), ao=1, jitter=0)


# ---- 1 city of first light -------------------------------------------------------------------------

def city(s, M, home=False):
    paving = ground_colors(0x9d9b96, 0xb4b0a8, 0x86847f, .09, 3) if not home else ground_colors(0x6f6a78, 0x847d8c, 0x5c5866, .09, 5)
    terrain(s, M["ground"], lambda x, z, r: 0.0, paving)
    # Plaza tiling rings and a compass inlay keep the open centre readable.
    for radius, tone in ((7.2, 0xc9c2b5), (6.9, 0x9b958c), (4.2, 0xc9c2b5), (3.9, 0x8d877f)):
        s.emit(bm_cylinder(radius, .02, 40), M["stone"], at(-11 if not home else 0, G + .015 + radius * .0005, -8 if not home else 5), color=c(tone), ao=1, jitter=.02)
    P.road(s, M, (0, -60), (0, 60), 7.0, gaps=((58, 64),))
    P.road(s, M, (-60, 1), (-3.5, 1), 6.0, dashes=True)
    P.road(s, M, (3.5, 1), (60, 1), 6.0, dashes=True)
    s.emit(bm_box(7.0, .03, 6.0), M["ground"], at(0, G + .012, 1), color=c(0x3a3f46), ao=1)
    for x, z, yaw in ((0, 6.2, 0), (0, -4.2, 0), (-5.6, 1, math.pi / 2), (5.6, 1, math.pi / 2)):
        P.crosswalk(s, M, x, z, yaw, 6.4 if yaw == 0 else 5.6, 7)
    # North skyline: layered blocks give depth behind the repair shop.
    north = [(-30, -26, 9, 8, 16, 0xd8cdbd), (-20, -25, 8, 8, 12, 0xc7b6a3), (18, -25, 9, 8, 14, 0xb9c4c9), (28, -27, 8, 9, 19, 0xd6c4ae),
             (-38, -36, 10, 10, 24, 0xa9b6c0), (-14, -40, 12, 10, 28, 0xc0b2a4), (12, -42, 12, 10, 30, 0xb7c1c9), (36, -38, 10, 10, 22, 0xcbb9a5)]
    for x, z, w, d, h, tone in north:
        P.building(s, M, x, z, w, d, h, wall=tone, lit=.35 if home else .22, awning=None if h > 15 else 0x3f7fa8, facades=("front", "left", "right"))
    if not home:
        P.building(s, M, 0, -26, 12, 8, 9, wall=0x4f6f86, trim=0xe8e2d6, lit=.5, awning=0xe8a33a, sign=(0x16324a, "cyan"), floors=2, columns=4)
    for side in (-1, 1):
        for i, (z, w, h, tone) in enumerate(((-12, 8, 11, 0xd9c7b0), (-2 if side < 0 else 12, 8, 8, 0xc4d0d4), (10 if side < 0 else -2, 9, 13, 0xd2bfb0))):
            x = side * 27
            if s.low_only(x, z, 36) and h > 4:
                continue
            P.building(s, M, x, z, w, 9, h, wall=tone, yaw=-side * math.pi / 2, lit=.3 if home else .2, awning=(0xd8574a, 0x3fa56b, 0xe0b340)[i % 3])
    for x in (-5.4, 5.4):
        for z in (-17, -8, 10, 17):
            P.street_lamp(s, M, x, z, 4.6, math.pi if x > 0 else 0, "warm")
    for x in (-16, 16):
        for z in (-3.5, 5.5):
            P.street_lamp(s, M, x, z, 4.6, math.pi / 2 if z < 0 else -math.pi / 2, "warm")
    for x, z in ((-14, -14), (14, -14), (-14, 13), (13, 14), (-19, 8), (19, -8)):
        P.planter(s, M, x, z, 1.6, 0x9aa3a8, 0x4f8a3a, tree_height=3.6 if not s.low_only(x, z, 40) else 0)
    for x, z, yaw in ((-10.5, -13.5, 0), (10.5, -13.5, 0), (-17.5, -9, math.pi / 2), (17.5, 9, -math.pi / 2)):
        P.bench(s, M, x, z, yaw)
    for x in (-9, -7, 7, 9):
        P.bollard(s, M, x, -3.6)
        P.bollard(s, M, x, 5.6)
    cars = ((-24, -2.6, math.pi / 2, 0xd8574a), (-33, 4.6, -math.pi / 2, 0x3f7fa8), (24, 4.6, -math.pi / 2, 0xe0b340), (33, -2.6, math.pi / 2, 0x55a36b), (-2.1, -32, 0, 0xf1efe8), (2.1, -40, math.pi, 0x9a6bd8))
    for x, z, yaw, tone in cars:
        P.car(s, M, x, z, yaw, tone)
    scatter(s, (6, 18), 26, lambda x, z: P.pebbles(s, M, x, z, 2, .4, 0x8f8a82, .08))
    # A bus shelter and kiosk frame the west street.
    shelter = at(-11, G, 5.6, 0)
    if s.solid(-11, 5.9, 1.3):
        s.emit(bm_box(3.2, .12, 1.4), M["paint"], shelter @ at(0, 2.6, 0), color=c(0x2f5f7a))
        s.emit(bm_box(3.0, 1.9, .06), M["glass"], shelter @ at(0, 1.4, -.62), color=c(0xb6c8d6))
        for sx in (-1.5, 1.5):
            s.emit(bm_box(.08, 2.6, .08), M["metal"], shelter @ at(sx, 1.3, -.62), color=c(0x3d4650))
        s.emit(bm_box(2.4, .08, .5), M["wood"], shelter @ at(0, .5, -.35), color=c(0x8a6040))
    if home:
        festival(s, M)


def festival(s, M):
    # Meridian Museum: a classical facade, lanterns and stalls for the homecoming at dusk.
    s.hold(0, -24)
    P.steps(s, M, 0, -19.5, 18, 3, .7, .3)
    s.emit(bm_box(18, 7.2, 8, .1), M["plaster"], at(0, G + 3.6 + .9, -26), color=c(0xe9e1d2), ao=.7, ao_height=4)
    s.emit(bm_box(19, .6, 9, .05), M["stone"], at(0, G + .3, -26), color=c(0xcfc6b6), ao=.8)
    P.columns_portico(s, M, 0, -21.2, 16, 6.2, 7)
    s.emit(bm_box(17.5, .8, 2.4), M["stone"], at(0, G + 7.5, -21.6), color=c(0xece6da), ao=1)
    s.emit(bm_prism([(-9.2, 0), (9.2, 0), (0, 2.6)], 2.6), M["stone"], at(0, G + 7.9, -20.4, 0, 1, 1, 1, -math.pi / 2), color=c(0xf1ebdf), ao=1)
    s.emit(bm_box(3.2, 4.2, .2), M["warm"], at(0, G + 3.0, -21.9), color=(1, 1, 1))
    s.emit(bm_box(8, .9, .16), M["cyan"], at(0, G + 8.4, -20.1), color=(1, 1, 1))
    s.solid(0, -26, 9.5, force=True)
    for x in (-8, -4, 4, 8):
        P.banner(s, M, x, -18.6, 5.2, (0x5b7cff, 0xff5f8a, 0x3fc7a0, 0xffb347)[int(x + 8) % 4])
    for i in range(7):
        x = -15 + i * 5
        P.string_lights(s, M, (x, G + 5.2, -17), (x + 5, G + 5.2, -17), .7)
    s.release()
    for x in (-16, -12, 12, 16):
        P.stall(s, M, x, -11 if abs(x) < 14 else -4, math.pi / 2 if x < 0 else -math.pi / 2, (0xff7a8a, 0x7fb6ff, 0xffc75f, 0x8fe3a8)[int(x + 16) % 4])
    for z in (-14, -6, 2):
        P.string_lights(s, M, (-17, G + 4.6, z), (-9, G + 4.2, z + 3), .6, 8)
        P.string_lights(s, M, (9, G + 4.2, z + 3), (17, G + 4.6, z), .6, 8)
    for x, z in ((-7, -14), (7, -14), (-12, 2), (12, 2), (-9, 10), (9, 10)):
        P.lantern_post(s, M, x, z, 2.6, "warm")
    P.fountain(s, M, -8, 4, 2.2)
    for x, z in ((-22, -16), (22, -16), (-23, 15), (23, 12)):
        P.tree(s, M, x, z, 5.5, 0x3f6f4a)


# ---- 2 countryside ---------------------------------------------------------------------------------

def countryside(s, M):
    meadow = ground_colors(0x7aa24a, 0x93b457, 0x5f8a3c, .05, 11, rim=0x6f9a40)
    terrain(s, M["ground"], hills(7, 22, 40, .04, 2), meadow)
    # Dirt lanes follow the beam network instead of crossing it.
    for i in range(22):
        t = i / 21
        x = -8 + math.sin(t * 3.1) * 3 + t * 6
        z = 20 - t * 46
        P.ground_patch(s, M, x, z, 1.5 + (i % 3) * .2, 0x8a6b48)
    for i in range(12):
        P.ground_patch(s, M, -12 + i * 2.4, -16 - math.sin(i * .6) * 1.2, 1.3, 0x8a6b48)
    P.barn(s, M, -15, -27, .15)
    P.silo(s, M, -24, -24, 10)
    P.silo(s, M, -26.5, -29, 8)
    P.windmill(s, M, 16, -26, 11, -.4)
    P.gable_house(s, M, -30, -6, 8, 7, 4.4, yaw=math.pi / 2)
    P.gable_house(s, M, 29, -13, 7, 6, 4, wall=0xf1e6cf, roof=0x4d5f7a, yaw=-math.pi / 2)
    # Tidy crop fields and fences on both flanks.
    P.crop_rows(s, M, -32, 8, 8, 12, 8, 0xd9b34a)
    P.crop_rows(s, M, 32, 4, 8, 12, 8, 0x8fbf4a, plant_height=.55)
    P.crop_rows(s, M, 30, -30, 10, 8, 9, 0xd9b34a)
    P.fence(s, M, (-22, -18), (-22, 22), 1.1)
    P.fence(s, M, (22, -20), (22, 20), 1.1)
    P.fence(s, M, (-22, -18), (-6, -21), 1.1)
    for x, z in ((-34, 18), (-26, 24), (30, 20), (38, 10), (40, -18), (-38, -18), (8, -38), (-4, -42), (26, -38), (-30, -38)):
        P.tree(s, M, x, z, s.random.uniform(4.5, 7), s.random.choice((0x4f8a3a, 0x5a9a44, 0x3f7a36)))
    for x, z in ((-40, 0), (44, -4), (0, -48), (18, -46)):
        P.tree(s, M, x, z, 6, 0x3f6f32, shape="pine")
    for x, z, yaw in ((-18, 14, .3), (-19, 10, 1.2), (18, -16, .5), (24, 16, 2)):
        P.hay_bale(s, M, x, z, yaw)
    # A small wind-powered transmitter mast is the destination the beam is feeding.
    s.hold(21, -8)
    P.mast(s, M, 21, -8, 9, glow="cyan")
    s.emit(bm_box(2.2, 1.6, 1.6, .05), M["paint"], at(21, G + .8, -5.8), color=c(0xe8e2d6), ao=.6)
    s.release()
    P.windmill(s, M, 24, -4, 4.5, -math.pi / 2)
    scatter(s, (4, 19), 70, lambda x, z: P.grass(s, M, x, z, 6, .45, 0x6f9a40))
    scatter(s, (19, 34), 90, lambda x, z: P.grass(s, M, x, z, 7, .6, 0x5f8a3c))
    scatter(s, (6, 18), 10, lambda x, z: P.flowers(s, M, x, z, 7, .9))
    scatter(s, (20, 32), 16, lambda x, z: P.bush(s, M, x, z, s.random.uniform(.8, 1.3), 0x4a7f38, flowers=(0xffd35a, 0xffffff)))
    scatter(s, (8, 18), 8, lambda x, z: P.rock(s, M, x, z, s.random.uniform(.25, .45), 0x9a9186, collide=False))
    P.rock(s, M, -14, 3, .9, 0x958b7f)
    P.rock(s, M, 12, 11, .8, 0x958b7f)


# ---- 3 coast ------------------------------------------------------------------------------------------

def coast(s, M):
    sand = ground_colors(0xe2c08a, 0xecd0a0, 0xc9a672, .06, 21)

    def shore_height(x, z, r):
        dune = smoothstep(22, 36, r) * (1.2 + 1.8 * (fbm(x * .05, z * .05, 3, 4) * .5 + .5)) * smoothstep(-24, -8, z)
        sea = -smoothstep(-18, -34, z) * 2.2 if z < -18 else 0
        return dune + sea

    def sand_color(x, y, z, r):
        col = sand(x, y, z, r)
        wet = smoothstep(.5, -.05, y) if z < -12 else 0
        col = mix(col, c(0x9c7d55), wet * .75)
        ripple = .04 * math.sin(x * .9 + math.sin(z * .3) * 2)
        return scale(col, 1 + ripple)
    terrain(s, M["ground"], shore_height, sand_color)
    water_plane(s, M, .08, 260, "water", (0, -130))
    # Foam line where the sea meets the sand.
    for i in range(40):
        x = -60 + i * 3
        s.emit(bm_box(3.2, .02, .6), M["white"] if i % 7 == 0 else M["cloth"], at(x, .11, -21.6 + math.sin(i * 1.3) * .5), color=c(0xf4fbff), ao=1)
    P.pier(s, M, 12, -19, 12, -48, 3.2, .75)
    for x, z, h, lean in ((-22, -6, 6.2, (.7, .2)), (-24, 4, 7, (.5, -.4)), (-21, 14, 5.8, (.8, .1)), (23, 10, 6.5, (-.6, .2)), (26, -4, 7.2, (-.7, -.3)),
                          (-30, -14, 7.5, (.4, .4)), (32, -16, 6.8, (-.5, .5)), (-34, 12, 6, (.6, 0)), (36, 6, 6.6, (-.5, 0))):
        P.palm(s, M, x, z, h, lean)
    for x, z, tone in ((19, -9, 0xff6f61), (22, 1, 0x3fb8c9), (19, 12, 0xffc84a)):
        P.umbrella(s, M, x, z, tone)
        P.deck_chair(s, M, x + 1.4, z + 1.2, .4, tone)
    P.lifeguard_tower(s, M, 28, -10, -.4)
    # Survey station: the building whose dive log the patrol protects.
    P.building(s, M, -20, -27, 9, 7, 6, wall=0xf1ebe0, trim=0x2f6f8f, lit=.4, sign=(0x2f6f8f, "cyan"), floors=2, awning=0x2f8fb8)
    P.dish(s, M, -28, -24, 2.4, 3.2, .6, .6)
    P.mast(s, M, -13, -25, 7, glow="red")
    for x, z, w, tone in ((-30, 0, 4, 0xff8a7a), (-31, 7, 4, 0x7fc8e8), (-29, -7, 4, 0xffd36a)):
        P.gable_house(s, M, x, z, w, 3.6, 2.8, wall=tone, roof=0xf4efe6, yaw=math.pi / 2, chimney=False)
    for x, z, size in ((-17, -20, 1.4), (-10, -22, 1.1), (6, -22, 1.6), (18, -21, 1.2), (30, -22, 2.0), (-36, -20, 2.4), (40, -18, 1.8)):
        P.rock(s, M, x, z, size, 0x8f7a64)
    for x, z in ((-32, -40), (30, -44), (-4, -60)):
        s.emit(bm_prism([(-2.2, 0), (2.2, 0), (1.4, 1.1), (-1.4, 1.1)], .9), M["paint"], at(x, -.2, z, .4, 1, 1, 1, -math.pi / 2), color=c(0xe8e2d6), ao=.8)
        s.emit(bm_cylinder(.06, 5, 5), M["wood"], at(x, 2.6, z - .4), color=c(0x8a6040))
        s.emit(bm_prism([(0, 0), (2.2, 0), (0, 3.8)], .03), M["cloth"], at(x + .05, .6, z - .4, 0, 1, 1, 1, -math.pi / 2), color=c(0xfff3e0), ao=1)
    for x, z, size in ((-13, 1, 1.0), (15, -12, .8), (-6, 16, .7)):
        if not s.solid(x, z, 1.1 * size):
            continue
        s.hold(x, z)
        s.emit(bm_cylinder(1.1 * size, .5 * size, 10, top=.95 * size), M["ground"], at(x, G + .25 * size, z), color=c(0xd9b478), ao=.7)
        for k in range(4):
            a = k / 4 * math.tau + .4
            s.emit(bm_cylinder(.28 * size, .9 * size, 8, top=.22 * size), M["ground"], at(x + math.cos(a) * .7 * size, G + .95 * size, z + math.sin(a) * .7 * size), color=c(0xe0bd84), ao=.8)
            s.emit(bm_cylinder(.25 * size, .35 * size, 8, top=0), M["ground"], at(x + math.cos(a) * .7 * size, G + 1.55 * size, z + math.sin(a) * .7 * size), color=c(0xe8c690), ao=1)
        s.emit(bm_cylinder(.45 * size, 1.2 * size, 8, top=.35 * size), M["ground"], at(x, G + 1.1 * size, z), color=c(0xe8c690), ao=.85)
        s.emit(bm_box(.02, .5 * size, .3 * size), M["cloth"], at(x, G + 2.0 * size, z + .15), color=c(0xff5f5f), ao=1)
        s.emit(bm_cylinder(.02, .8 * size, 4), M["wood"], at(x, G + 1.9 * size, z), color=c(0x8a6040))
        s.release()
    for i in range(34):
        t = i / 33
        px, pz = -17 + t * 30 + math.sin(t * 5) * 2, 12 - t * 26
        side = .22 if i % 2 else -.22
        heading = math.atan2(30, -26)
        s.emit(bm_uv_sphere(.16, 8, 3), M["ground"], at(px + math.cos(heading) * side, G + .004, pz - math.sin(heading) * side, heading, 1, .08, 1.6), color=c(0xb9955f), ao=1)
    for x, z, yaw, tone in ((17, 6, .3, 0xff6f91), (21, -6, -.2, 0x3fb8c9)):
        s.emit(bm_box(1.2, .02, 2.2), M["cloth"], at(x, G + .015, z, yaw), color=c(tone), ao=1)
        s.emit(bm_box(1.2, .025, .3), M["cloth"], at(x, G + .02, z, yaw), color=c(0xfff3e0), ao=1)
    scatter(s, (6, 19), 22, lambda x, z: P.shell_scatter(s, M, x, z, 3, .8))
    scatter(s, (8, 19), 8, lambda x, z: P.driftwood(s, M, x, z, s.random.uniform(1.4, 2.6)))
    scatter(s, (19, 34), 60, lambda x, z: P.grass(s, M, x, z, 8, .7, 0x9aa55a), arc=(-.3, math.pi + .3))
    scatter(s, (10, 18), 10, lambda x, z: P.grass(s, M, x, z, 5, .5, 0xa8aa62))


# ---- 4 reef -----------------------------------------------------------------------------------------

def reef(s, M):
    sand = ground_colors(0xd9d2b0, 0xe6dfc0, 0xb8b08a, .07, 31, rim=0x7f9a8a)

    def ripple_sand(x, y, z, r):
        col = sand(x, y, z, r)
        return scale(col, 1 + .05 * math.sin(x * 1.3 + math.sin(z * .4) * 3))
    terrain(s, M["ground"], hills(5, 21, 34, .06, 8), ripple_sand)
    palette = (0xff6f8f, 0xff9a5c, 0xb574ff, 0xffd35a, 0x5fd3c9, 0xff7fc8)
    # A living wall of coral around the garden; the south edge stays low so KAI remains visible.
    for i in range(46):
        a = i / 46 * math.tau
        r = s.random.uniform(20.5, 30)
        x, z = math.cos(a) * r, math.sin(a) * r
        low = s.low_only(x, z, 40)
        pick = s.random.random()
        y = G + max(0, (r - 21) * .3)
        if pick < .3 and not low:
            P.coral_branch(s, M, x, z, s.random.uniform(1.2, 1.9), s.random.choice(palette), y=y)
        elif pick < .5:
            P.brain_coral(s, M, x, z, s.random.uniform(.9, 1.6), s.random.choice((0xd9a15a, 0xc98ad8, 0x8fc98a)), y=y)
        elif pick < .65 and not low:
            P.fan_coral(s, M, x, z, s.random.uniform(1.4, 2.2), s.random.choice(palette), y=y)
        elif pick < .8:
            P.sponge_tubes(s, M, x, z, s.random.choice((0xf2b53a, 0xff7a5c, 0xb58cff)), y=y)
        else:
            P.rock(s, M, x, z, s.random.uniform(.7, 1.1) if low else s.random.uniform(1.2, 2.4), 0x6f8a86, y=y)
    for x in (-24, -27, -30, 25, 28, 31, -18, 20):
        for k in range(4):
            if s.low_only(x, -10 + k * 3, 40):
                continue
            P.kelp(s, M, x + s.random.uniform(-1, 1), -14 + k * 4 + s.random.uniform(-1, 1), s.random.uniform(6, 10), 0x6f9a3a, y=G + 1)
    # Natural stone arch framing the northern horizon.
    arch = [Vector((-6, G, -27)), Vector((-4, G + 5, -28)), Vector((0, G + 7, -28.5)), Vector((4, G + 5, -28)), Vector((6, G, -27))]
    s.emit(bm_tube(arch, 1.3, 9, [1.8, 1.4, 1.2, 1.4, 1.8]), M["stone"], color=c(0x7f948c), ao=.55, ao_height=5, smooth=True)
    # Horseshoe coral rings frame both green refuges without blocking the approach.
    for cx, cz in ((-11, -7), (11, -7)):
        for k in range(7):
            a = math.pi * (1.15 + k / 6 * .7) if cx < 0 else math.pi * (1.15 + k / 6 * .7)
            x, z = cx + math.cos(a) * 4.2, cz + math.sin(a) * 4.2
            P.brain_coral(s, M, x, z, .55, s.random.choice((0xff9a5c, 0xc98ad8, 0x8fc98a)), collide=False)
            P.anemone(s, M, x + .6, z - .3, s.random.choice((0xff8a5c, 0xb574ff)))
    scatter(s, (5, 19), 50, lambda x, z: P.seagrass(s, M, x, z, 7, s.random.uniform(.6, 1.1), 0x6fb04a))
    scatter(s, (6, 19), 16, lambda x, z: P.anemone(s, M, x, z, s.random.choice((0xff8a5c, 0xff6fb0, 0xb574ff))))
    scatter(s, (6, 19), 14, lambda x, z: P.shell_scatter(s, M, x, z, 3, .6))
    scatter(s, (8, 19), 10, lambda x, z: P.brain_coral(s, M, x, z, s.random.uniform(.35, .6), s.random.choice((0xd9a15a, 0x8fc98a)), collide=False))
    for x, z in ((-15, 1), (14, 12), (4, -14), (-5, -15)):
        P.coral_branch(s, M, x, z, 1.1, s.random.choice(palette))


# ---- 5 wreck -------------------------------------------------------------------------------------

def wreck(s, M):
    silt = ground_colors(0x8a9a78, 0x9aa886, 0x6f7f62, .06, 41, rim=0x5f705c)
    terrain(s, M["ground"], hills(4, 21, 34, .05, 9), silt)
    wood, dark = 0x6b5038, 0x4a3828
    # The Pelican rests on its side across the north: ribs, keel, planking and a broken bow.
    s.hold(0, -24)
    keel = [Vector((-26, G + .6, -22.5)), Vector((-8, G + .4, -24.5)), Vector((10, G + .5, -25)), Vector((24, G + 1.2, -23))]
    s.emit(bm_tube(keel, .5, 6), M["wood"], color=c(dark), ao=.6, smooth=True)
    for i in range(12):
        t = i / 11
        p = Vector(keel[0]).lerp(keel[-1], t)
        height = 6.5 * math.sin(.15 + t * 2.9)
        for side in (-1, 1):
            rib = [p, p + Vector((0, height * .45, side * 2.4)), p + Vector((0, height * .9, side * 3.2)), p + Vector((0, height, side * 2.6))]
            if side > 0 and t > .6:
                rib = rib[:3]
            s.emit(bm_tube(rib, .22, 5, [.28, .22, .2, .16][:len(rib)]), M["wood"], color=c(wood), ao=.55, ao_height=4, smooth=True)
    for k, h in enumerate((1.2, 2.2, 3.2, 4.2)):
        planks = [Vector((-24 + j * 4, G + h + math.sin(j) * .2, -24.2 - .15 * k)) for j in range(0 if k < 2 else 2, 11 if k < 3 else 7)]
        if len(planks) > 1:
            s.emit(bm_tube(planks, .3, 4), M["wood"], color=scale(c(wood), .9 + k * .04), ao=.7, smooth=True)
    s.emit(bm_tube([Vector((-9, G + .5, -22)), Vector((-4, G + 5, -20.5)), Vector((1, G + 9.5, -19))], .35, 7), M["wood"], color=c(dark), ao=.7, smooth=True)
    s.emit(bm_box(5, .15, .15), M["wood"], at(-1, G + 7.6, -19.5, .4), color=c(dark))
    for i in range(5):
        s.emit(bm_torus(.45, .08, 12, 5), M["metal"], at(-18 + i * 7, G + 3.2, -22.1, 0, 1, 1, 1, math.pi / 2), color=c(0x9a8a5a))
        s.emit(bm_cylinder(.38, .08, 12), M["cyan" if i % 2 else "glass"], at(-18 + i * 7, G + 3.2, -22.0, 0, 1, 1, 1, math.pi / 2), color=(1, 1, 1))
    s.release()
    # A snapped-off section of deck and a toppled crane lie in the survey field.
    for x, z, yaw in ((-15, -4, .5), (14, 9, -.7)):
        if P.solid_box(s, x, z, 4.5, 2.4, yaw):
            deck = at(x, G, z, yaw, 1, 1, 1, 0, .12)
            for k in range(9):
                s.emit(bm_box(.46, .14, 2.4, .02), M["wood"], deck @ at(-2 + k * .5, .25 + (k % 3) * .02, 0), color=scale(c(wood), s.random.uniform(.8, 1.1)), ao=.8)
            s.emit(bm_box(4.6, .2, .2), M["wood"], deck @ at(0, .1, -1.1), color=c(dark), ao=.7)
            s.emit(bm_box(4.6, .2, .2), M["wood"], deck @ at(0, .1, 1.1), color=c(dark), ao=.7)
            P.coral_branch(s, M, x + 1.2, z - .4, .6, 0xd8a16a, collide=False)
            P.seagrass(s, M, x - 1, z + .8, 6, .7, 0x6f8a3a)
    for x, z in ((-6, -12), (7, 13), (-17, 9)):
        P.barrel(s, M, x, z, 0x6a5a3a, tipped=True)
    # Scattered research cargo and the ship's anchor.
    for x, z in ((-22, -12), (-24, -8), (22, -10), (24, -2), (-20, 12), (21, 14)):
        P.crate(s, M, x, z, s.random.uniform(.9, 1.4), 0x7a6a4a)
    for x, z in ((-19, -15), (18, -16), (-23, 4), (23, 6)):
        P.barrel(s, M, x, z, 0x6a5a3a, tipped=s.random.random() < .5)
    s.hold(27, -13)
    s.emit(bm_torus(1.4, .22, 20, 6), M["metal"], at(27, G + 1.2, -13, .6, 1, 1, 1, math.pi / 2), color=c(0x5c5a52), ao=.7)
    s.emit(bm_box(.35, 3.2, .35), M["metal"], at(27, G + 1.8, -13, .6), color=c(0x5c5a52), ao=.7)
    chain = [Vector((27, G + .2, -13)) + Vector((-i * .9, .1 * math.sin(i), i * .5)) for i in range(12)]
    s.emit(bm_tube(chain, .1, 4), M["metal"], color=c(0x4f4d46), ao=.8)
    s.release()
    for i in range(18):
        a = s.random.uniform(0, math.tau)
        r = s.random.uniform(21, 32)
        x, z = math.cos(a) * r, math.sin(a) * r
        if s.low_only(x, z, 40):
            P.brain_coral(s, M, x, z, s.random.uniform(.6, 1.1), 0xb89a6a, collide=False, y=G + max(0, (r - 21) * .25))
        else:
            P.coral_branch(s, M, x, z, s.random.uniform(.9, 1.4), s.random.choice((0xd8a16a, 0x9fc9a0, 0xc98ad8)), y=G + max(0, (r - 21) * .25))
    for x, z in ((-28, 2), (-30, 8), (28, -6), (30, 2), (26, 18), (-26, 18)):
        P.kelp(s, M, x, z, s.random.uniform(5, 8), 0x5a7a2e, y=G + 1)
    scatter(s, (5, 19), 40, lambda x, z: P.seagrass(s, M, x, z, 6, s.random.uniform(.5, .9), 0x6f8a3a))
    scatter(s, (6, 19), 10, lambda x, z: P.rock(s, M, x, z, s.random.uniform(.3, .6), 0x6f7a6a, collide=False))
    scatter(s, (6, 19), 8, lambda x, z: P.shell_scatter(s, M, x, z, 3, .6))


# ---- 6 abyss ------------------------------------------------------------------------------------

def abyss(s, M):
    basalt = ground_colors(0x2c2f3c, 0x363a4a, 0x1d2029, .07, 51, rim=0x252834)

    def trench(x, z, r):
        return smoothstep(21, 30, r) * (6 + 6 * (fbm(x * .06, z * .06, 3, 3) * .5 + .5)) + smoothstep(30, 50, r) * 8
    terrain(s, M["ground"], trench, basalt)
    # Glowing fissures run between the lantern gates.
    for i in range(8):
        a = s.random.uniform(0, math.tau)
        r = s.random.uniform(20, 30)
        x, z = math.cos(a) * r, math.sin(a) * r
        if s.low_only(x, z, 40):
            continue
        points = [Vector((x, G + .02 + max(0, (r - 21) * .8), z))]
        heading = s.random.uniform(0, math.tau)
        for k in range(5):
            heading += s.random.uniform(-.7, .7)
            points.append(points[-1] + Vector((math.cos(heading) * .9, 0, math.sin(heading) * .9)))
        s.emit(bm_tube(points, .045, 3), M["ember"], color=(1, 1, 1))
    for i in range(24):
        a = i / 24 * math.tau + s.random.uniform(-.1, .1)
        r = s.random.uniform(20.5, 27)
        x, z = math.cos(a) * r, math.sin(a) * r
        low = s.low_only(x, z, 40)
        y = G + max(0, (r - 21) * .8)
        if i % 3 == 0 and not low:
            P.vent(s, M, x, z, s.random.uniform(3, 5.5), 0x2a2630, y=y, glow="warm")
        else:
            P.basalt_columns(s, M, x, z, s.random.randint(5, 9), 1.6 if low else s.random.uniform(3, 7), 0x2c3040, y=y, cap_glow="cyan" if i % 2 else None)
    for x, z in ((-15, -3), (14, 11), (-2, -16), (16, -13)):
        P.basalt_columns(s, M, x, z, 5, 1.8, 0x30344a, cap_glow="violet")
    scatter(s, (5, 19), 18, lambda x, z: P.tube_worms(s, M, x, z, s.random.randint(4, 8)))
    scatter(s, (5, 19), 14, lambda x, z: P.glow_mushroom(s, M, x, z, s.random.uniform(.25, .45), "biolume"), low_ok=False)
    scatter(s, (19, 30), 24, lambda x, z: P.glow_mushroom(s, M, x, z, s.random.uniform(.5, 1.0), s.random.choice(("biolume", "violet"))), low_ok=False)
    scatter(s, (6, 19), 16, lambda x, z: P.rock(s, M, x, z, s.random.uniform(.3, .7), 0x22252f, collide=False))


# ---- 7 floating observatory (research platform) ---------------------------------------------------

def platform(s, M):
    seabed = ground_colors(0x1f4a5c, 0x28566a, 0x173a48, .05, 61)
    terrain(s, M["ground"], lambda x, z, r: 0.0, seabed, flat_height=-6)
    water_plane(s, M, .02, 260)
    edge = s.play_radius
    s.hold(0, 0, fixed=True)
    deck = [(math.cos(i / 32 * math.tau) * (edge + 4.2), math.sin(i / 32 * math.tau) * (edge + 4.2)) for i in range(32)]
    s.emit(bm_prism(deck, 1.2, .1), M["metal"], at(0, G - 1.2, 0), color=c(0x7d8a92), ao=.9)
    # Deck plating, seams and hazard stripes.
    for i in range(-28, 29, 4):
        half = math.sqrt(max(0.0, (edge + 3.8) ** 2 - i * i))
        if half < 1:
            continue
        s.emit(bm_box(.06, .03, half * 2), M["dark"], at(i, G + .01, 0), color=c(0x3a4148), ao=1)
        s.emit(bm_box(half * 2, .03, .06), M["dark"], at(0, G + .01, i), color=c(0x3a4148), ao=1)
    for k in range(28):
        a = k / 28 * math.tau
        s.emit(bm_box(1.2, .03, .5), M["paint"], at(math.cos(a) * (edge + 1.2), G + .02, math.sin(a) * (edge + 1.2), -a), color=c(0xffc84a if k % 2 else 0x2a2f36), ao=1)
    s.emit(bm_torus(5.5, .12, 40, 4), M["paint"], at(0, G + .02, 3, 0, 1, .1, 1), color=c(0xf4efe6), ao=1)
    for dx, dz, w, d in ((-1.3, 0, .6, 4.5), (1.3, 0, .6, 4.5), (0, 0, 2.0, .6)):
        s.emit(bm_box(w, .03, d), M["paint"], at(dx, G + .025, 3 + dz), color=c(0xf4efe6), ao=1)
    for i in range(24):
        a0, a1 = i / 24 * math.tau, (i + 1) / 24 * math.tau
        rail = edge + 3.7
        P.railing(s, M, (math.cos(a0) * rail, math.sin(a0) * rail), (math.cos(a1) * rail, math.sin(a1) * rail), 1.1, 0xe0b340)
    s.release()
    for i in range(8):
        a = i / 8 * math.tau + math.pi / 8
        x, z = math.cos(a) * 19, math.sin(a) * 19
        s.emit(bm_cylinder(1.3, 8, 14), M["paint"], at(x, G - 5, z), color=c(0xd8573f), ao=.9, smooth=True)
    # Weather lab, radar dome, dish, containers and a crane beyond the defended lanes.
    P.building(s, M, -12, -26, 12, 7, 6, wall=0xf1efe8, trim=0x2f6f8f, lit=.5, sign=(0x16324a, "cyan"), floors=2, awning=0x2f8fb8)
    s.emit(bm_box(14, .8, 9), M["metal"], at(-12, G - .4, -26), color=c(0x6d7880), ao=.9)
    P.radar_dome(s, M, -12, -26, 2.4, G + 6.4)
    s.emit(bm_box(9, .8, 9), M["metal"], at(13, G - .4, -26), color=c(0x6d7880), ao=.9)
    P.dish(s, M, 13, -26, 3.2, 3.8, -.5, .7)
    P.mast(s, M, 0, -27, 11, glow="red")
    s.emit(bm_box(5, .8, 5), M["metal"], at(0, G - .4, -27), color=c(0x6d7880), ao=.9)
    # Cargo sits outside the fence, tangent to it, and never on the camera side of the deck.
    with s.anchor(0, 0, fixed=True):
        for angle, tone, stack in ((165, 0x2f7fb8, 1), (200, 0x4a9a6a, 0), (295, 0xe0b340, 1), (325, 0xd8573f, 0)):
            a = math.radians(angle)
            x, z = math.cos(a) * (s.play_radius + 2.1), math.sin(a) * (s.play_radius + 2.1)
            P.container(s, M, x, z, math.atan2(-math.cos(a), -math.sin(a)), tone, stacked=stack)
    for x, z in ((-8, -18), (8, -18), (-19, -1), (19, 1)):
        P.barrel(s, M, x, z, 0x2f7fb8)
    for x, z in ((-15, -15), (15, -15)):
        P.crate(s, M, x, z, 1.2, 0x8a7a5a, yaw=.3)
    for x in (-4, 4):
        s.emit(bm_tube([Vector((x, G + .25, -20)), Vector((x, G + .25, -30))], .18, 8), M["metal"], color=c(0xb24a3a), ao=.8)


# ---- 8 atolls -------------------------------------------------------------------------------------

def atolls(s, M):
    def seabed(x, z, r):
        islands = 0.0
        for ix, iz, radius in ((-30, -14, 9), (26, -28, 11), (33, 14, 7), (-28, 22, 6), (6, -40, 8)):
            d = math.hypot(x - ix, z - iz)
            islands = max(islands, (1 - smoothstep(radius * .45, radius, d)) * 2.9)
        deep = -smoothstep(21, 44, r) * 4.5
        return max(deep, -1.1 + islands) if r > 20.5 else 0

    def color(x, y, z, r):
        shallow, deep, sand = c(0x7fd3c2), c(0x2a7fa0), c(0xf0dcaa)
        col = mix(deep, shallow, smoothstep(-5.5, -1.0, y))
        col = mix(col, sand, smoothstep(-.2, .45, y))
        return scale(col, 1 + .05 * math.sin(x * 1.1 + math.sin(z * .5) * 2))
    terrain(s, M["ground"], seabed, color, flat_height=-1.2)
    s.emit(bm_box(260, .02, 260), M["shallow"], at(0, .22, 0), color=(1, 1, 1), ao=1, jitter=0)
    for ix, iz, radius in ((-30, -14, 9), (26, -28, 11), (33, 14, 7), (-28, 22, 6), (6, -40, 8)):
        for k in range(max(2, int(radius / 3))):
            a = s.random.uniform(0, math.tau)
            rr = s.random.uniform(0, radius * .35)
            P.palm(s, M, ix + math.cos(a) * rr, iz + math.sin(a) * rr, s.random.uniform(5, 7.5), (s.random.uniform(-.6, .6), s.random.uniform(-.6, .6)), y=1.6)
        for k in range(4):
            a = s.random.uniform(0, math.tau)
            P.bush(s, M, ix + math.cos(a) * radius * .3, iz + math.sin(a) * radius * .3, 1.2, 0x5a9a44, y=1.6)
        for k in range(5):
            a = s.random.uniform(0, math.tau)
            P.rock(s, M, ix + math.cos(a) * radius * .62, iz + math.sin(a) * radius * .62, s.random.uniform(.6, 1.2), 0x9a8a72, y=.3)
    # A stilted research hut and navigation lighthouse on the larger islands.
    s.hold(-30, -14)
    hut = at(-30, 1.6, -14, .5)
    for lx in (-1.4, 1.4):
        for lz in (-1.2, 1.2):
            s.emit(bm_box(.2, 2.4, .2), M["wood"], hut @ at(lx, 0, lz), color=c(0x6b4630))
    s.emit(bm_box(3.4, 2.0, 3.0, .04), M["wood"], hut @ at(0, 2.2, 0), color=c(0xd8c2a0), ao=.8)
    s.emit(bm_prism([(-2.2, 0), (2.2, 0), (0, 1.4)], 3.6), M["cloth"], hut @ at(0, 3.2, 1.8, 0, 1, 1, 1, -math.pi / 2), color=c(0x5f8a5a), ao=1)
    s.release()
    s.hold(26, -28)
    tower = at(26, 1.6, -28)
    s.emit(bm_cylinder(1.3, 9, 16, top=.9), M["plaster"], tower @ at(0, 4.5, 0), color=c(0xf4efe6), ao=.7, smooth=True)
    for h in (2.5, 5.5):
        s.emit(bm_cylinder(1.28 - h * .045, 1.2, 16), M["paint"], tower @ at(0, h, 0), color=c(0xd8473a), smooth=True)
    s.emit(bm_cylinder(1.1, 1.2, 12), M["warm"], tower @ at(0, 9.6, 0), color=(1, 1, 1))
    s.emit(bm_cylinder(1.3, .8, 12, top=.2), M["paint"], tower @ at(0, 10.6, 0), color=c(0xd8473a), smooth=True)
    s.release()
    for x, z, tone in ((-16, -18, 0xffb347), (16, 17, 0xff6f61), (-19, 12, 0xffb347), (20, -4, 0xff6f61)):
        if not s.solid(x, z, .6):
            continue
        s.emit(bm_cylinder(.55, 1.2, 12, top=.3), M["paint"], at(x, .6, z), color=c(tone), smooth=True)
        s.emit(bm_sphere(.22, 1), M["cyan"], at(x, 1.35, z), color=(1, 1, 1))
    for i in range(10):
        a = s.random.uniform(0, math.tau)
        r = s.random.uniform(5, 19)
        x, z = math.cos(a) * r, math.sin(a) * r
        if s.clear_of_routes(x, z, 1):
            P.brain_coral(s, M, x, z, s.random.uniform(.4, .8), s.random.choice((0xff9a7a, 0xd98ad8, 0xffd36a)), y=-1.2, collide=False)
    scatter(s, (3, 19), 30, lambda x, z: P.seagrass(s, M, x, z, 5, .5, 0x6fb04a, y=-1.2))


# ---- 9/10 sky -------------------------------------------------------------------------------------

def sky(s, M, storm=False):
    rng = s.random
    deck, top = (0x6d7396, 0xb8c0de) if storm else (0xffd8b0, 0xfff4e4)
    # A continuous cloud deck below the flight plane.
    for ring, (radius, count, y) in enumerate(((9, 6, -12), (21, 11, -11.5), (35, 16, -12), (51, 20, -13), (70, 22, -15), (40, 26, -30))):
        for i in range(count):
            a = i / count * math.tau + rng.uniform(-.1, .1)
            r = radius + rng.uniform(-5, 5)
            size = rng.uniform(4.5, 7) * (1 + min(ring, 4) * .22)
            tone = mix(c(deck), c(top), rng.uniform(.1, .6))
            P.cloud(s, M, math.cos(a) * r, y + rng.uniform(-1, 1), math.sin(a) * r, size * (1.8 if ring == 5 else 1.2), int(tone[0] * 255) << 16 | int(tone[1] * 255) << 8 | int(tone[2] * 255), 5, .45, shade=.55 if storm else .72, detail=2 if ring < 2 else 1)
    towers = 7 if storm else 5
    for i in range(towers):
        a = i / towers * math.tau + .6
        r = rng.uniform(46, 62)
        x, z = math.cos(a) * r, math.sin(a) * r
        if s.low_only(x, z, 70):
            continue
        for k in range(5):
            P.cloud(s, M, x + rng.uniform(-3, 3), -4 + k * 5.5, z + rng.uniform(-3, 3), 9 - k * .8, 0x5d6488 if storm else 0xfff0dc, 5, .7, shade=.5 if storm else .7, detail=1)
        if storm:
            bolt = [Vector((x, 22, z))]
            for k in range(6):
                bolt.append(bolt[-1] + Vector((rng.uniform(-2, 2), -3.8, rng.uniform(-2, 2))))
            s.emit(bm_tube(bolt, .16, 4), M["white"], color=(1, 1, 1))
    # The storm arena ring: floating crystal pylons mark the duel boundary.
    for i in range(10 if storm else 0):
        a = i / 10 * math.tau + .2
        x, z = math.cos(a) * 21.8, math.sin(a) * 21.8
        low = s.low_only(x, z, 40)
        rock = displace(bm_sphere(1, 2), .3, 1.1, rng.uniform(0, 40))
        s.emit(rock, M["stone"], at(x, -1.2, z, rng.uniform(0, 6), 1.3, 1.9, 1.3, math.pi), color=c(0x59607a if storm else 0xc9a98a), ao=.5, ao_height=2.5, smooth=True)
        if not low:
            s.emit(bm_cylinder(.35, 2.4, 6, top=0), M["cyan" if storm else "warm"], at(x, 1.2, z, a), color=(1, 1, 1))
    if not storm:
        s.hold(0, -46)
        s.emit(bm_torus(7, .35, 48, 8), M["white"], at(0, 8, -46, 0, 1, 1, 1, math.pi / 2), color=(1, 1, 1))
        s.emit(bm_torus(7.8, .18, 48, 6), M["metal"], at(0, 8, -46, 0, 1, 1, 1, math.pi / 2), color=c(0xd9a93a))
        for x in (-10, 10):
            s.emit(bm_cylinder(.35, 14, 8), M["metal"], at(x, 3, -46), color=c(0xd9a93a), smooth=True)
            s.emit(bm_sphere(.6, 1), M["warm"], at(x, 10.4, -46), color=(1, 1, 1))
        s.release()
        for i in range(6):
            a = -math.pi / 2 + (i - 2.5) * .45
            x, z = math.cos(a) * 30, math.sin(a) * 30
            s.emit(bm_lathe_buoy(), M["paint"], at(x, -.6, z), color=c(0xf4efe6), ao=.8, smooth=True)
            s.emit(bm_sphere(.35, 1), M["warm"], at(x, 1.9, z), color=(1, 1, 1))


def bm_lathe_buoy():
    return kit.bm_lathe([(0, -1), (.6, -.6), (.8, 0), (.5, .8), (.2, 1.6), (0, 1.7)], 12)


# ---- 11 orbit -------------------------------------------------------------------------------------

def orbit(s, M):
    # A circular docking apron: KAI hovers over a real surface with the Earth below the rim.
    edge = s.play_radius
    s.hold(0, 0, fixed=True)
    s.emit(bm_cylinder(edge + 3, .8, 64), M["paint"], at(0, G - .4, 0), color=c(0xaab4bd), ao=1)
    s.emit(bm_cylinder(edge + .9, .03, 64), M["paint"], at(0, G + .01, 0), color=c(0x7d8894), ao=1)
    for ring in range(4):
        for i in range(12 + ring * 6):
            a = (i + ring * .5) / (12 + ring * 6) * math.tau
            r = 3 + ring * 4.2
            s.emit(bm_box(2.8, .025, 3.2), M["paint"], at(math.cos(a) * r, G + .02, math.sin(a) * r, math.pi / 2 - a), color=scale(c(0x8a95a0), s.random.uniform(.9, 1.08)), ao=1, jitter=.02)
    for i in range(12):
        a = i / 12 * math.tau
        s.emit(bm_box(.08, .04, 19), M["dark"], at(math.cos(a) * 9.6, G + .035, math.sin(a) * 9.6, math.pi / 2 - a), color=c(0x3a4250), ao=1)
    for radius in (6, 12, edge + 1.6):
        s.emit(bm_torus(radius, .07, 64, 4), M["paint"], at(0, G + .03, 0, 0, 1, .25, 1), color=c(0xd9e2ea), ao=1)
    for i in range(36):
        a = i / 36 * math.tau
        s.emit(bm_box(.9, .03, .22), M["paint"], at(math.cos(a) * (edge + 2.2), G + .02, math.sin(a) * (edge + 2.2), math.pi / 2 - a), color=c(0xffc84a if i % 2 else 0x2a2f36), ao=1)
    for i in range(16):
        a = i / 16 * math.tau
        s.emit(bm_box(.22, .12, .22), M["cyan" if i % 4 else "red"], at(math.cos(a) * (edge + 2.75), G + .06, math.sin(a) * (edge + 2.75)), color=(1, 1, 1))
    s.emit(bm_cylinder(edge + 2.6, 6, 64, top=12), M["metal"], at(0, G - 3.8, 0), color=c(0x6a7480), ao=.7, smooth=True)
    s.release()
    s.hold(0, -40)
    # The station proper: hub, docking ring, modules, truss spars and solar wings.
    s.emit(bm_torus(14, 1.1, 64, 12), M["plaster"], at(0, 12, -42, 0, 1, 1, 1, math.pi / 2), color=c(0xeceae4), ao=.85, smooth=True)
    s.emit(bm_torus(14, .25, 64, 6), M["cyan"], at(0, 12, -40.9, 0, 1, 1, 1, math.pi / 2), color=(1, 1, 1))
    for i in range(6):
        a = i / 6 * math.tau
        P.truss(s, M, (0, 12, -42), (math.cos(a) * 13.5, 12 + math.sin(a) * 13.5, -42), .9)
    s.emit(bm_uv_sphere(3.2, 24, 12), M["plaster"], at(0, 12, -42), color=c(0xf4f2ec), ao=.9, smooth=True)
    P.module(s, M, 0, 12, -32, 12, 1.6, 0, math.pi / 2)
    P.module(s, M, -8, 20, -46, 9, 1.4, .4, math.pi / 2 - .2, band=0xd9573f)
    P.module(s, M, 9, 4, -48, 10, 1.5, -.3, math.pi / 2 + .1, band=0x3f7fd8)
    for side in (-1, 1):
        P.truss(s, M, (side * 4, 12, -38), (side * 34, 12, -34), 1.0)
        for k in range(3):
            P.solar_panel(s, M, side * (14 + k * 7), 12, -32.5, 6.2, 5, 0, .15 * side)
            P.solar_panel(s, M, side * (14 + k * 7), 12, -35.8, 6.2, 5, 0, -.15 * side)
    s.release()
    sx, sz = s.push(0, -40)
    s.hold(0, 0, fixed=True)
    for side in (-1, 1):
        P.truss(s, M, (side * (edge + 2.8), G - .4, 0), (side * 30 + sx, 6, -22 + sz), .8)
    # Small parked shuttles on the apron rim, beyond the play boundary and parallel to it.
    for angle in (math.atan2(-8, -24), math.atan2(-12, 25)):
        x, z = math.cos(angle) * (edge + 1.7), math.sin(angle) * (edge + 1.7)
        b = at(x, G + .6, z, math.atan2(-math.sin(angle), math.cos(angle)))
        s.emit(bm_uv_sphere(1.4, 16, 8), M["plaster"], b @ at(0, 0, 0, 0, 1, .7, 2.1), color=c(0xf4f2ec), ao=.8, smooth=True)
        s.emit(bm_box(4.4, .12, 1.4), M["paint"], b @ at(0, -.2, .6), color=c(0x3f7fd8))
        s.emit(bm_box(1.2, .5, .9), M["glass"], b @ at(0, .55, -1.6), color=c(0xb6c8d6))
    s.release()


# ---- 12-14 moon ------------------------------------------------------------------------------------

def crater_field(craters):
    def height(x, z, r):
        h = 0.0
        for cx, cz, radius, depth in craters:
            d = math.hypot(x - cx, z - cz) / radius
            if d < 1.6:
                h += -depth * (1 - smoothstep(0, 1, d)) + depth * .55 * math.exp(-((d - 1.05) ** 2) * 18)
        return h
    return height


def lunar(s, M, kind):
    regolith = ground_colors(0xb3b1ad, 0xc4c2be, 0x8f8d8a, .06, 71 + len(kind), rim=0x9a9894)
    if kind == "crater":
        def height(x, z, r):
            steps = smoothstep(21, 44, r) * 18
            return math.floor(steps / 3) * 3 + smoothstep(0, 1, (steps % 3) / 3) ** 6 * 3 + fbm(x * .08, z * .08, 2, 3) * .6 * smoothstep(21, 30, r)
    else:
        outer = crater_field([(-34, -30, 9, 3), (30, -34, 12, 4), (42, 6, 8, 2.5), (-44, 8, 10, 3), (8, -48, 14, 5), (-18, -52, 9, 3)])

        def height(x, z, r):
            return smoothstep(21, 30, r) * (outer(x, z, r) + 1.5 + 5 * smoothstep(36, 60, r) * (fbm(x * .03, z * .03, 4, 9) * .5 + .7))
    terrain(s, M["ground"], height, regolith)
    # Shallow craters inside the play space are colour and low rims only; they never collide.
    for x, z, radius in ((-5, 12, 2.2), (14, 3, 1.6), (-15, -8, 2.6), (6, -14, 1.8), (-14, 14, 1.2)):
        if s.clear_of_routes(x, z, radius * .5):
            s.emit(bm_torus(radius, .32, 28, 6), M["stone"], at(x, G - .06, z, 0, 1, .38, 1), color=c(0xb9b7b3), ao=.85, smooth=True)
            P.ground_patch(s, M, x, z, radius * .8, 0x8a8884)
            for k in range(4):
                a = s.random.uniform(0, math.tau)
                P.rock(s, M, x + math.cos(a) * radius * 1.25, z + math.sin(a) * radius * 1.25, s.random.uniform(.12, .25), 0x9a9894, collide=False)
    scatter(s, (19.5, 34), 36, lambda x, z: P.rock(s, M, x, z, s.random.uniform(.6, 1.8), 0x8f8c88, y=G + 1.2 * smoothstep(21, 30, math.hypot(x, z))))
    scatter(s, (5, 19), 26, lambda x, z: P.rock(s, M, x, z, s.random.uniform(.15, .35), 0x9a9894, collide=False))
    gold, foil = 0xd9a93a, 0xc9b27a
    if kind == "moonplain":
        s.hold(-16, -26)
        lander = at(-16, G, -26, .3)
        octagon = [(math.cos(i / 8 * math.tau + math.pi / 8) * 2.2, math.sin(i / 8 * math.tau + math.pi / 8) * 2.2) for i in range(8)]
        s.emit(bm_prism(octagon, 1.8, .06), M["foil"], lander @ at(0, 1.9, 0), color=c(gold), ao=.8)
        for k in range(8):
            a = k / 8 * math.tau + math.pi / 8
            s.emit(bm_box(.08, 1.8, .08), M["metal"], lander @ at(math.cos(a) * 2.05, 2.8, math.sin(a) * 2.05), color=c(0x2a2f36))
        s.emit(bm_box(3.0, 2.0, 2.6, .25, 2), M["plaster"], lander @ at(0, 4.7, 0), color=c(0xe8e6e0), ao=.9)
        s.emit(bm_cylinder(.9, .9, 12, top=.5), M["metal"], lander @ at(0, 6.1, 0), color=c(0xb9bec2), smooth=True)
        s.emit(bm_box(.9, .8, .1), M["glass"], lander @ at(-.6, 5.0, 1.32, .2), color=c(0xb6c8d6))
        s.emit(bm_box(.9, .8, .1), M["glass"], lander @ at(.6, 5.0, 1.32, -.2), color=c(0xb6c8d6))
        s.emit(bm_box(1.3, .08, 1.3), M["metal"], lander @ at(0, 1.0, 2.6), color=c(0xb9bec2))
        for k in range(6):
            s.emit(bm_box(.9, .05, .12), M["metal"], lander @ at(0, .25 + k * .3, 2.35 + k * .05), color=c(0xb9bec2))
        s.emit(bm_cylinder(1.0, 1.0, 12, top=.6), M["dark"], lander @ at(0, .9, 0), color=c(0x3a3f46), smooth=True)
        for i in range(4):
            a = i / 4 * math.tau + math.pi / 4
            foot = lander @ Vector((math.cos(a) * 3.6, .1, math.sin(a) * 3.6))
            hip = lander @ Vector((math.cos(a) * 1.8, 2.2, math.sin(a) * 1.8))
            s.emit(bm_tube([hip, foot], .12, 6), M["metal"], color=c(0xb9bec2))
            s.emit(bm_cylinder(.5, .12, 10), M["metal"], at(foot.x, G + .06, foot.z), color=c(0xb9bec2))
        s.solid(-16, -26, 4.2)
        s.release()
        for i in range(8):
            s.emit(bm_box(.6, .06, .25), M["ground"], at(-12 + i * 1.1, G + .015, -18 + i * .9, .7), color=c(0x7f7d7a), ao=1)
        with s.anchor(-9, -22):
            s.emit(bm_cylinder(.05, 3.2, 5), M["metal"], at(-9, G + 1.6, -22), color=c(0xe8e6e0))
            s.emit(bm_box(1.8, 1.1, .03), M["cloth"], at(-8.1, G + 2.6, -22), color=c(0x3f7fd8), ao=1)
        s.hold(14, -24)
        rover = at(14, G, -24, -.4)
        if s.solid(14, -24, 2.2):
            s.emit(bm_box(3.2, .3, 1.9, .05), M["metal"], rover @ at(0, .9, 0), color=c(0xb9bec2))
            for wx in (-1.2, 1.2):
                for wz in (-1.1, 1.1):
                    s.emit(bm_cylinder(.45, .3, 12), M["dark"], rover @ at(wx, .45, wz, 0, 1, 1, 1, math.pi / 2), color=c(0x5a5d62), smooth=True)
            s.emit(bm_box(.8, .1, .8), M["glass"], rover @ at(-.8, 1.3, 0), color=c(0x3b5cc4))
            P.dish(s, M, 14.6, -24.4, .6, 1.8, 0, .8)
        s.release()
    elif kind == "crater":
        for x, z, yaw in ((-22, -12, .4), (22, -10, -.4), (-18, 18, 2.4)):
            s.hold(x, z)
            if not P.solid_box(s, x, z, 5, 4, yaw):
                s.release()
                continue
            hut = at(x, G, z, yaw)
            s.emit(bm_cylinder(2.2, 5, 16), M["plaster"], hut @ at(0, 1.6, 0, 0, 1, 1, 1, math.pi / 2), color=c(0xe8e6e0), ao=.7, smooth=True)
            s.emit(bm_box(1.2, 1.8, .2), M["glass"], hut @ at(0, 1.4, 2.5), color=c(0xb6c8d6))
            s.emit(bm_box(1.3, .3, .3), M["warm"], hut @ at(0, 2.6, 2.5), color=(1, 1, 1))
            s.release()
        for x, z in ((-26, -24), (26, -26)):
            s.hold(x, z)
            P.mast(s, M, x, z, 12, glow="warm")
            s.emit(bm_box(.4, .4, 10), M["metal"], at(x, G + 12, z + 5 * (1 if x < 0 else 1)), color=c(0xd9a93a))
            s.emit(bm_box(1.4, .8, 1.0), M["warm"], at(x, G + 11.2, z + 9.5), color=(1, 1, 1))
            s.release()
        s.hold(0, -19)
        rail = [Vector((-30 + i * 3, G + .08, -18 - math.sin(i * .5) * 2)) for i in range(21)]
        s.emit(bm_tube(rail, .08, 4), M["metal"], color=c(0x8a8f96))
        s.emit(bm_tube([p + Vector((0, 0, 1.2)) for p in rail], .08, 4), M["metal"], color=c(0x8a8f96))
        for i in (3, 9, 15):
            p = rail[i]
            if s.solid(p.x, p.z + .6, 1.1):
                s.emit(bm_box(1.8, 1.0, 1.4, .08), M["paint"], at(p.x, G + .8, p.z + .6), color=c(0xd9a93a), ao=.8)
                s.emit(bm_box(1.5, .5, 1.1), M["stone"], at(p.x, G + 1.45, p.z + .6), color=c(0x7a7876))
        s.release()
        for x, z in ((-12, -22), (12, -23), (0, -30)):
            P.crate(s, M, x, z, 1.2, 0xb9bec2)
        with s.anchor(4, -34):
            s.emit(bm_cylinder(1.4, 8, 12, top=.5), M["metal"], at(4, G + 4, -34), color=c(0xd9a93a), ao=.7)
            s.emit(bm_box(4, 2, 4, .05), M["metal"], at(4, G + 1, -34), color=c(0x8a8f96), ao=.7)
    else:
        s.hold(15, -27)
        obs = at(15, G, -27)
        s.solid(15, -27, 6.4, force=True)
        s.emit(bm_cylinder(6.2, 4.2, 28), M["plaster"], obs @ at(0, 2.1, 0), color=c(0xe8e6e0), ao=.65, smooth=True)
        s.emit(bm_uv_sphere(6.0, 28, 12), M["metal"], obs @ at(0, 4.2, 0, .6, 1, .9, 1), color=c(0xd9dde0), ao=.9, smooth=True)
        s.emit(bm_box(1.8, 5.6, 12.4), M["glass"], obs @ at(0, 6.5, 0, .6, 1, 1, 1, 0, .1), color=c(0x0b1320))
        s.emit(bm_cylinder(.9, 9, 12), M["metal"], obs @ at(1.5, 7, 1.5, 0, 1, 1, 1, -.6), color=c(0x3b4450))
        s.release()
        P.dish(s, M, -16, -26, 5, 5, .5, .8)
        for k in range(4):
            with s.anchor(-30 + k * 5.5, -22):
                P.solar_panel(s, M, -30 + k * 5.5, G + 1.4, -22, 4.8, 3, 0, .45)
                s.emit(bm_box(.15, 1.4, .15), M["metal"], at(-30 + k * 5.5, G + .7, -22), color=c(0x9aa2a8))
        with s.anchor(24, -8):
            P.module(s, M, 24, G + 1.6, -8, 8, 1.6, math.pi / 2, math.pi / 2)
            s.solid(24, -8, 2.0)
            s.solid(24, -12, 2.0)
            s.solid(24, -4, 2.0)
        P.mast(s, M, -6, -30, 10, glow="cyan")
        for x, z in ((-3, -18), (3, -18)):
            P.lantern_post(s, M, x, z, 2.0, "cyan")


# ---- geology samples ---------------------------------------------------------------------------

def sample(s, M, glass=False):
    if glass:
        for i in range(7):
            a = i * 2.399
            r = 0 if i == 0 else .45
            h = 1.5 - i * .12
            s.emit(bm_cylinder(.18 + (.08 if i == 0 else 0), h, 6, top=0), M["cyan"] if i % 3 == 0 else M["crystal"], at(math.cos(a) * r, h / 2, math.sin(a) * r, a, 1, 1, 1, .25 * math.sin(a) if i else 0, .25 * math.cos(a) if i else 0), color=(1, 1, 1))
        rock_bm = displace(bm_sphere(.7, 2), .15, 2, 3)
        s.emit(rock_bm, M["stone"], at(0, .05, 0, 0, 1, .35, 1), color=c(0x8f8d89), ao=.7, smooth=True)
    else:
        for i in range(6):
            a = i * 2.3
            r = 0 if i == 0 else .42
            hexagon = [(math.cos(k / 6 * math.tau) * .28, math.sin(k / 6 * math.tau) * .28) for k in range(6)]
            s.emit(bm_prism(hexagon, .9 - i * .08, .02), M["stone"], at(math.cos(a) * r, 0, math.sin(a) * r, a * .3), color=c(0x2c2f38), ao=.6, ao_height=.8)
        s.emit(displace(bm_sphere(.75, 2), .12, 2, 5), M["stone"], at(0, .05, 0, 0, 1, .3, 1), color=c(0x4a4640), ao=.7, smooth=True)


# ---- driver ------------------------------------------------------------------------------------

BUILDERS = {
    "city": lambda s, M: city(s, M), "country": countryside, "beach": coast, "reef": reef, "wreck": wreck, "abyss": abyss,
    "platform": platform, "atolls": atolls, "stormsky": lambda s, M: sky(s, M, True), "highsky": lambda s, M: sky(s, M, False),
    "orbit": orbit, "moonplain": lambda s, M: lunar(s, M, "moonplain"), "crater": lambda s, M: lunar(s, M, "crater"),
    "observatory": lambda s, M: lunar(s, M, "observatory"), "home": lambda s, M: city(s, M, True),
    "glass": lambda s, M: sample(s, M, True), "basalt": lambda s, M: sample(s, M, False),
}


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    selected = [key for key in BUILDERS if not args or key in args]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = P.materials()
    M["shallow"] = kit.Material("Water shallow", 0x2aa9c0, metal=.05, rough=.05, uv=1 / 8, alpha=.5)
    M["crystal"] = kit.Material("Impact glass", 0x9ff2ff, metal=.1, rough=.05, glow=.6)
    manifest_path = OUT / "journey-manifest.json"
    previous = {}
    if manifest_path.exists():
        previous = {asset["name"]: asset for asset in json.loads(manifest_path.read_text(encoding="utf8")).get("assets", [])}
    report = []
    for index, key in enumerate(BUILDERS):
        name = "journey_" + key
        if key not in selected:
            if name in previous:
                report.append(previous[name])
            continue
        scene = Scene(key, 1000 + index * 37, keep_clear(key), kit.AUTHORED_EDGE if key in ("glass", "basalt") else PLAY_RADIUS)
        BUILDERS[key](scene, M)
        root = bpy.data.objects.new("Journey_" + key, None)
        bpy.context.collection.objects.link(root)
        if key not in ("glass", "basalt"):
            # Exported as glTF extras: the runtime reads collision from the model it actually loaded.
            root["colliders"] = json.dumps([list(col) for col in scene.colliders])
        objects = scene.build(root)
        bpy.ops.object.select_all(action="DESELECT")
        root.select_set(True)
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = root
        path = OUT / (name + ".glb")
        bpy.ops.export_scene.gltf(
            filepath=str(path), export_format="GLB", use_selection=True, export_apply=True, export_yup=True,
            export_vertex_color="MATERIAL", export_extras=True, export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
            export_draco_position_quantization=15, export_draco_normal_quantization=10, export_draco_texcoord_quantization=12,
            export_draco_color_quantization=8)
        triangles = 0
        for obj in objects:
            obj.data.calc_loop_triangles()
            triangles += len(obj.data.loop_triangles)
        entry = {"name": name, "file": path.name, "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()[:16],
                 "triangles": triangles, "meshes": len(objects)}
        if key not in ("glass", "basalt"):
            entry["colliders"] = [list(col) for col in scene.colliders]
        report.append(entry)
        print(f"BUILT {name}: {triangles} tris, {len(objects)} meshes, {entry['bytes']} bytes, {len(scene.colliders)} colliders, {scene.skipped} props skipped for gameplay")
        collection = bpy.data.collections.new("ENV_" + key)
        bpy.context.scene.collection.children.link(collection)
        for obj in [root] + objects:
            for old in list(obj.users_collection):
                old.objects.unlink(obj)
            collection.objects.link(obj)
        collection.hide_viewport = True
    if len(selected) == len(BUILDERS):
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "discovery_environments.blend"))
    manifest_path.write_text(json.dumps({"generator": "Blender / build_journey.py", "source": "assets/blender/discovery_environments.blend", "compression": "KHR_draco_mesh_compression", "assets": report}, indent=2), encoding="utf8")
    print("TOTAL_BYTES", sum(asset["bytes"] for asset in report))


main()
