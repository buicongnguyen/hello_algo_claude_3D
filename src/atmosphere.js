// Art-directed sky, fog and light for every destination. Colors are sRGB hex values.
// sun is the direction towards the sun in game space (x east, y up, z south); it is normalized on use.
const look = (zenith, horizon, ground, fog, density, sun, sunColor, sunIntensity, hemiSky, hemiGround, hemi, extras = {}) => ({
  zenith, horizon, ground, fog, density, sun, sunColor, sunIntensity, hemiSky, hemiGround, hemi,
  exposure: 1, environment: .35, bloom: .32, rim: 0x9fd8ff, rimIntensity: .55, stars: 0, sunSize: 1, ...extras,
});

export const ATMOSPHERES = {
  // Shared island, Beach Brawl and Workshop.
  island: look(0x2f7fd0, 0xbfe6f4, 0xd9c49a, 0xa9d8ea, .0105, [-.5, .78, .38], 0xffefd2, 2.55, 0xcfeaff, 0xc2a070, .55),
  coral: look(0x3dbad0, 0xa9eef0, 0xe8b9ae, 0x86dcdc, .012, [-.45, .8, .4], 0xfff0e6, 2.3, 0xc6f6ff, 0xe8b2a4, .6, { rim: 0xffc6e2 }),
  scrapyard: look(0x2b2463, 0xb49ad8, 0x6d5c8a, 0x9a8acc, .012, [-.6, .55, .45], 0xffc9e6, 2.1, 0xc7b6ff, 0x5c4a78, .6, { rim: 0xff8ad8, bloom: .5 }),
  moonpool: look(0x060d24, 0x2d4a78, 0x16233a, 0x243d62, .014, [-.4, .7, .5], 0xa9c4ff, 1.45, 0x6f8fd0, 0x1a2338, .55, { rim: 0x7fb6ff, bloom: .6, stars: .7, environment: .22 }),

  city: look(0x4f86c6, 0xf6d2ae, 0x8c8a8a, 0xe7d2c2, .0078, [-.62, .42, .48], 0xffcf9c, 2.7, 0xbcd4ee, 0x8a7868, .6, { rim: 0xffe1c0, exposure: 1.02 }),
  country: look(0x3b8ee0, 0xd2ecf5, 0x8faa66, 0xcfe7ef, .0085, [-.45, .82, .36], 0xfff2d8, 2.75, 0xd2eaff, 0x7f9a4a, .6),
  beach: look(0x3f5aa8, 0xffbf8f, 0xb88b60, 0xe9c2ad, .0078, [-.8, .3, .52], 0xffc79a, 2.8, 0xa9c2f0, 0x9c7a58, .62, { rim: 0xffc090, sunSize: 1.8, exposure: 1.0 }),
  reef: look(0x5ad8e6, 0x117a92, 0x0a3a4b, 0x167f97, .028, [-.25, .95, .2], 0xc8f7ff, 2.2, 0x8be8f5, 0x1d5c60, .7, { rim: 0x7ff0ff, environment: .25, bloom: .45, underwater: true }),
  wreck: look(0x6cc2a8, 0x1c5c5c, 0x082628, 0x1f5e60, .021, [-.3, .92, .25], 0xbff4d8, 1.7, 0x86d8c0, 0x173c38, .65, { rim: 0x9ff6d8, environment: .2, bloom: .45, underwater: true }),
  abyss: look(0x10254a, 0x061228, 0x010308, 0x0b1a36, .024, [-.2, .96, .2], 0x8aa2ff, 1.1, 0x4a66b0, 0x141626, .85, { rim: 0x55a8ff, rimIntensity: .9, environment: .14, bloom: .5, exposure: 1.15, underwater: true }),
  platform: look(0x4d93cc, 0xdcecf2, 0x2f7ea0, 0xcfe4ec, .0095, [-.5, .75, .42], 0xfff5e2, 2.6, 0xd8ecff, 0x3f7890, .6),
  atolls: look(0x2a8be2, 0xc3f1f6, 0x2e9cc4, 0xc4ecf2, .0075, [-.42, .85, .32], 0xfff6e0, 2.9, 0xd6f0ff, 0x3aa2b8, .6, { environment: .45 }),
  stormsky: look(0x161b36, 0x56608a, 0x262c4c, 0x464f74, .014, [-.5, .6, .45], 0xa8b6ff, 1.5, 0x8290c8, 0x262a44, .7, { rim: 0xb9c6ff, rimIntensity: .8, bloom: .6, storm: true }),
  highsky: look(0x2a4c9e, 0xffcf96, 0xf6cfa6, 0xf2cbaa, .006, [-.78, .2, .58], 0xffc98a, 3.1, 0xffdcb8, 0xe9b08a, .6, { rim: 0xffd6a0, sunSize: 2.2, exposure: 1.03 }),
  orbit: look(0x000106, 0x040a1e, 0x02040c, 0x030714, .0022, [-.62, .45, .64], 0xffffff, 3.3, 0x5a78b8, 0x10121c, .3, { rim: 0x8fb8ff, rimIntensity: .7, environment: .18, stars: 1, bloom: .35 }),
  moonplain: look(0x000000, 0x0b1122, 0x1a1b20, 0x0a1020, .0025, [-.7, .34, .62], 0xf4f6ff, 3.2, 0x3a4a70, 0x2a2a2e, .28, { rim: 0x86a8ff, rimIntensity: .6, environment: .16, stars: 1, bloom: .45 }),
  crater: look(0x010008, 0x131026, 0x1c1a24, 0x14122a, .003, [-.42, .82, .45], 0xe8eaff, 3.0, 0x40385e, 0x28242e, .3, { rim: 0xb6a6ff, rimIntensity: .6, environment: .16, stars: 1, bloom: .5 }),
  observatory: look(0x000208, 0x0b1a33, 0x1a2028, 0x0c1a30, .0025, [-.58, .4, .7], 0xeef3ff, 3.0, 0x3f5f98, 0x262c34, .32, { rim: 0x7fc0ff, rimIntensity: .7, environment: .18, stars: 1, bloom: .55 }),
  home: look(0x111a44, 0xe0789a, 0x3a2f48, 0x5a4a78, .0075, [-.75, .2, .6], 0xffb087, 1.7, 0x8a90d8, 0x3a3048, .8, { rim: 0xff9ad0, rimIntensity: .8, bloom: .55, exposure: 1.05, sunSize: 1.6 }),
};

export function atmosphereFor(key) {
  return ATMOSPHERES[key] || ATMOSPHERES.island;
}

export function sunDirection(atmosphere) {
  const [x, y, z] = atmosphere.sun;
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}
