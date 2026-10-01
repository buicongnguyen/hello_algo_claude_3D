// What lives where. Each destination gets a few kinds of small creatures (one draw call each),
// GPU-only motes and, where plants grow, sway. Counts are for the high tier; the quality tier
// scales them (LIFE_BUDGET). The camera sits south-east of KAI, so flocks fly on the far (north)
// side and the flanks, and every swarm parts around the camera's line to KAI.
// Speeds are m/s, beat is wing/tail cycles per second, lengths are metres.

export const LIFE_BUDGET = Object.freeze({ low: .45, medium: .7, high: 1 });

const AREA = (x, z, rx, rz, y0, y1) => ({ x, z, rx, rz, y0, y1 });

// Creatures, tuned once and reused across destinations.
const pigeons = (area, count = 24, seed = 11) => ({ name: "pigeons", shape: "bird", shapeOptions: { span: .9 }, motion: "flap", count, schools: 3, area, seed,
  length: .8, speed: [2.6, 3.6], fleeSpeed: 5, turnRate: 1.2, bank: 1.1, maxPitch: .35, beat: 2.4, beatPerSpeed: .5, amplitude: .55, fleeAmplitude: .8, glide: .3, scare: 0,
  colors: [[0x9aa3ad, 0xe8edf2], [0x7d858f, 0xd0d6dc], [0xb3a89a, 0xf2ece4]] });
const gulls = (area, count = 12, seed = 21) => ({ name: "gulls", shape: "bird", shapeOptions: { span: 1.2 }, motion: "flap", count, schools: 6, area, seed,
  length: .95, speed: [2.2, 3.2], fleeSpeed: 5, turnRate: .9, bank: 1.3, maxPitch: .3, beat: 1.6, beatPerSpeed: .3, amplitude: .5, fleeAmplitude: .7, glide: .15, scare: 0,
  colors: [[0xf4f6f8, 0x5d6670], [0xe8ecef, 0x3d434a]] });
const swallows = (area, count = 14, seed = 31) => ({ name: "swallows", shape: "bird", shapeOptions: { span: 1.35, body: .9 }, motion: "flap", count, schools: 7, area, seed,
  length: .55, speed: [4, 6], fleeSpeed: 7, turnRate: 2.6, bank: 1.4, maxPitch: .45, beat: 4, beatPerSpeed: .4, amplitude: .7, fleeAmplitude: .9, glide: .4, scare: 0,
  colors: [[0x1f2b4a, 0xf2e6d6], [0x2a2140, 0xe8b08a]] });
const geese = (area, seed = 41) => ({ name: "geese", shape: "bird", shapeOptions: { span: 1.25 }, motion: "flap", count: 14, schools: 2, formation: "vee", area, seed,
  length: 1, lengthJitter: .08, speed: [3, 3.4], fleeSpeed: 4, turnRate: .5, bank: .9, maxPitch: .15, beat: 2.1, beatPerSpeed: .1, amplitude: .55, fleeAmplitude: .6, glide: .2, scare: 0,
  colors: [[0x6b5a48, 0xe8e0d0], [0x5a4c3e, 0xd8cfbe]] });
const doves = (area, seed = 51) => ({ name: "doves", shape: "bird", shapeOptions: { span: 1.1 }, motion: "flap", count: 12, schools: 2, area, seed,
  length: .7, speed: [2.4, 3.2], fleeSpeed: 5, turnRate: 1.1, bank: 1.2, maxPitch: .35, beat: 2.6, beatPerSpeed: .4, amplitude: .6, fleeAmplitude: .8, glide: .3, scare: 0,
  colors: [[0xfbf8ff, 0xd9e4ff], [0xfff6ee, 0xffd9e8]] });
const butterflies = (area, count = 10, seed = 61) => ({ name: "butterflies", shape: "butterfly", motion: "flutter", count, schools: count, area, seed,
  length: .55, lengthJitter: .15, speed: [.6, 1.1], fleeSpeed: 2.4, turnRate: 3.5, maxPitch: .6, climbRate: 3, beat: 6, beatPerSpeed: 1, amplitude: .85, fleeAmplitude: .95, scare: 1.8,
  colors: [[0xffb347, 0xff6a3d], [0x9fd8ff, 0x3f6fd6], [0xfff1a0, 0xffc93a], [0xffc1e3, 0xd65aa8]] });
const reefFish = (area, seed = 71) => [
  { name: "clownfish", shape: "fish", motion: "swim", count: 18, schools: 4, area, seed, length: .7, speed: [.6, 1.1], colors: [[0xff7a1a, 0xffffff]] },
  { name: "tangs", shape: "fish", shapeOptions: { deep: 1.7, saddle: false }, motion: "swim", count: 16, schools: 2, area, seed: seed + 1, length: .9, speed: [.7, 1.2], colors: [[0x2f6fe0, 0xffd23a]] },
  { name: "butterflyfish", shape: "fish", shapeOptions: { deep: 1.9 }, motion: "swim", count: 12, schools: 6, area, seed: seed + 2, length: .7, speed: [.5, .9], colors: [[0xffe04a, 0x2a2a30], [0xfff4c2, 0xff8a2a]] },
];
const bubbles = (box, count = 40, seed = 81) => ({ name: "bubbles", kind: "rise", count, box, seed, size: .16, speed: .8, wobble: .15, colors: [0xdff8ff], opacity: .6 });

const LAND_SWAY = { angle: .12, stiffness: .8, frequency: .45, flutter: .015 };
const CURRENT_SWAY = { angle: .22, stiffness: 4, frequency: .22, flutter: .01 };

export const LIFE = {
  city: {
    swarms: [pigeons(AREA(0, -12, 30, 20, 5, 10)), butterflies(AREA(-6, -2, 12, 10, .7, 2.4), 10)],
    motes: [{ name: "dawn dust", count: 60, box: AREA(0, -4, 24, 20, .6, 6), size: .12, speed: .2, wobble: .5, colors: [0xffe2b0], opacity: .5, additive: true, seed: 91 }],
    sway: LAND_SWAY,
  },
  country: {
    swarms: [swallows(AREA(0, -6, 30, 24, 2.5, 7)), butterflies(AREA(0, -4, 24, 18, .6, 2.6), 16, 62)],
    motes: [{ name: "dandelion seeds", kind: "rise", count: 70, box: AREA(0, -6, 26, 22, .4, 7), size: .14, speed: .18, wobble: .7, colors: [0xffffff, 0xfff6d8], opacity: .7, seed: 92 }],
    sway: LAND_SWAY,
  },
  beach: {
    swarms: [gulls(AREA(0, -24, 36, 18, 4.5, 10))],
    sway: LAND_SWAY,
  },
  reef: {
    swarms: reefFish(AREA(0, -2, 24, 22, 1.2, 5)),
    motes: [bubbles(AREA(0, -4, 20, 18, .5, 14))],
    sway: CURRENT_SWAY,
  },
  wreck: {
    swarms: [
      { name: "sardines", shape: "fish", shapeOptions: { slim: .7, deep: .8, saddle: false }, motion: "swim", count: 56, schools: 2, area: AREA(0, -10, 22, 16, 1.5, 6), seed: 101,
        length: .5, lengthJitter: .1, speed: [1.6, 2.2], fleeSpeed: 4.5, turnRate: 2.2, beat: 1.6, colors: [[0xc3d1de, 0x5d7f9e]] },
      { name: "groupers", shape: "fish", shapeOptions: { deep: 1.3 }, motion: "swim", count: 4, schools: 4, area: AREA(0, 0, 18, 16, 1, 3), seed: 102,
        length: 1.2, speed: [.35, .6], turnRate: 1.2, beat: 1.2, amplitude: .07, colors: [[0x7a5a3a, 0xc9a46a]] },
    ],
    motes: [bubbles(AREA(0, -8, 18, 14, .5, 12), 30, 82)],
    sway: CURRENT_SWAY,
  },
  abyss: {
    swarms: [
      { name: "lanternfish", shape: "fish", shapeOptions: { slim: .85 }, motion: "swim", count: 30, schools: 5, area: AREA(0, -4, 24, 20, 1.2, 5), seed: 111,
        length: .55, speed: [.8, 1.4], glow: 2.5, colors: [[0x1d2440, 0x7ff3ff], [0x24183a, 0xff8ad8]] },
      { name: "jellyfish", shape: "jelly", motion: "pulse", count: 12, schools: 12, area: AREA(0, -6, 22, 18, 2, 7), seed: 112,
        length: .8, lengthJitter: .3, speed: [.15, .35], fleeSpeed: .9, turnRate: .6, maxPitch: .15, beat: .35, beatPerSpeed: 0, amplitude: .35, fleeAmplitude: .45, scare: 2,
        glow: 1.4, colors: [[0xff7ad9, 0xffd0f4], [0xa98bff, 0xe4d6ff], [0x6fe7ff, 0xd8fbff]] },
    ],
    motes: [{ name: "biolume plankton", count: 110, box: AREA(0, -4, 24, 22, .4, 8), size: .14, speed: .2, wobble: .6, colors: [0x6fe7ff, 0xa98bff], opacity: .8, additive: true, seed: 113 }],
    sway: { ...CURRENT_SWAY, angle: .12 },
  },
  platform: {
    swarms: [gulls(AREA(-4, -20, 30, 18, 4, 9), 10, 121)],
  },
  atolls: {
    swarms: [gulls(AREA(0, -22, 36, 18, 4.5, 10), 10, 131)],
    sway: LAND_SWAY,
  },
  stormsky: {
    motes: [{ name: "rain", kind: "fall", count: 260, box: AREA(0, 0, 22, 22, .3, 16), size: .07, speed: 9, wobble: .05, colors: [0xbfd4ff], opacity: .55, seed: 141 }],
  },
  highsky: {
    swarms: [geese(AREA(-4, -16, 32, 16, 5, 9))],
    motes: [{ name: "wind motes", count: 50, box: AREA(0, -6, 24, 20, .5, 8), size: .09, speed: .3, wobble: 1.4, colors: [0xffffff], opacity: .45, seed: 151 }],
  },
  orbit: {},
  moonplain: { motes: [{ name: "regolith dust", count: 60, box: AREA(0, -2, 20, 18, .2, 1.4), size: .1, speed: .08, wobble: .5, colors: [0xd8d4cc], opacity: .45, seed: 161 }] },
  crater: { motes: [{ name: "regolith dust", count: 60, box: AREA(0, -2, 20, 18, .2, 1.4), size: .1, speed: .08, wobble: .5, colors: [0xd8d4cc], opacity: .45, seed: 162 }] },
  observatory: { motes: [{ name: "regolith dust", count: 50, box: AREA(0, -2, 20, 18, .2, 1.4), size: .1, speed: .08, wobble: .5, colors: [0xd8d4cc], opacity: .45, seed: 163 }] },
  home: {
    swarms: [doves(AREA(0, -14, 30, 18, 5, 10)), butterflies(AREA(0, 2, 14, 12, .7, 2.4), 6, 171)],
    motes: [
      { name: "fireflies", count: 90, box: AREA(0, -4, 22, 20, .5, 4), size: .55, speed: .25, wobble: .6, colors: [0xfff09a, 0xc8ff8a], opacity: .9, additive: true, seed: 172 },
      { name: "festival petals", kind: "fall", count: 110, box: AREA(0, -2, 16, 16, .4, 9), size: .3, speed: .5, wobble: .5, colors: [0xff8fc4, 0xffd166, 0x8fe3ff, 0xffffff], opacity: .85, seed: 173 },
    ],
    sway: LAND_SWAY,
  },
  // The home island (Beach Brawl, expeditions, free roam): gulls over the sea, butterflies by the palms.
  island: {
    swarms: [gulls(AREA(0, -20, 34, 16, 4.5, 9), 10, 181), butterflies(AREA(0, -2, 16, 12, .6, 2.4), 8, 182)],
  },
};

// Expedition pools: little fish just under each pool's surface, tinted toward its water so they
// read as submerged without a transparent pass (2.5D layering).
const POOL_FISH = { coral: [0xff7a1a, 0xffffff], scrapyard: [0xb8f3ff, 0x6a5ccf], moonpool: [0x8fe3ff, 0xfff1a0] };
const POOL_WATER = { coral: 0x399cae, scrapyard: 0x705bc6, moonpool: 0x399cae };
export function islandLife(theme, pools = []) {
  if (!theme) return LIFE.island;
  return {
    swarms: [
      ...LIFE.island.swarms.slice(theme === "moonpool" ? 1 : 0, theme === "moonpool" ? 1 : 2),
      ...pools.map(([x, z, radius], i) => ({ name: `pool fish ${i}`, shape: "fish", motion: "swim", count: 5, schools: 5, seed: 191 + i,
        area: AREA(x, z, radius * .72, radius * .72, .47, .5), length: .5, speed: [.35, .7], turnRate: 2.2, maxPitch: 0, scare: 1.8, fleeSpeed: 2,
        colors: [POOL_FISH[theme]], glow: theme === "moonpool" ? .8 : 0, water: { color: POOL_WATER[theme], mix: .35 } })),
    ],
    motes: theme === "moonpool" ? [{ name: "moon motes", count: 50, box: AREA(0, 0, 18, 18, .4, 4), size: .16, speed: .15, wobble: .5, colors: [0x8fe3ff], opacity: .7, additive: true, seed: 199 }] : [],
  };
}
