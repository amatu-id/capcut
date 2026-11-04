// Colour looks. Each filter is a set of grading values; the shader in render.js is the only place that turns them into pixels.
// Values: bri con sat exp temp tint hue high shad vib fade vig grain mono, lift/gain [r,g,b], ssh/shi = split-tone colours with spl = strength.

const F = (id, name, cat, p) => ({ id, name, cat, p });

export const FILTERS = [
  // Sinematik
  F('teal', 'Teal & Oranye', 'Sinematik', { con: .14, sat: .08, ssh: [.05, .35, .42], shi: [.95, .6, .28], spl: .34 }),
  F('blockbuster', 'Blockbuster', 'Sinematik', { con: .22, sat: -.08, ssh: [.04, .22, .34], shi: [1, .72, .42], spl: .3, vig: .28 }),
  F('noir', 'Film Noir', 'Sinematik', { mono: 1, con: .36, bri: -.03, vig: .42, grain: .12 }),
  F('dune', 'Gurun', 'Sinematik', { temp: .34, con: .14, sat: -.12, shi: [1, .76, .5], spl: .2, fade: .04 }),
  F('matrix', 'Matriks', 'Sinematik', { tint: -.3, con: .2, sat: -.2, ssh: [.02, .32, .12], spl: .3, bri: -.03 }),
  F('arctic', 'Arktik', 'Sinematik', { temp: -.36, sat: -.14, con: .1, shi: [.72, .88, 1], spl: .2 }),
  F('drama', 'Drama', 'Sinematik', { con: .32, sat: -.18, shad: -.14, high: -.08, vig: .3 }),
  F('moody', 'Moody', 'Sinematik', { con: .1, sat: -.26, exp: -.14, fade: .07, ssh: [.14, .2, .28], spl: .22, vig: .22 }),
  F('epic', 'Epik', 'Sinematik', { con: .26, vib: .2, shad: -.1, ssh: [.05, .16, .3], shi: [1, .85, .6], spl: .24 }),
  // Retro
  F('kodak', 'Kodak 70', 'Retro', { temp: .18, fade: .1, con: -.04, sat: .06, shi: [1, .84, .58], spl: .2, grain: .08 }),
  F('polaroid', 'Polaroid', 'Retro', { fade: .16, sat: -.08, temp: .12, ssh: [.1, .22, .28], spl: .22, vig: .12 }),
  F('sepia', 'Sepia', 'Retro', { mono: 1, ssh: [.26, .15, .06], shi: [1, .86, .62], spl: .7, fade: .05, con: .04 }),
  F('vhs', 'VHS 90', 'Retro', { sat: .2, fade: .12, con: -.06, tint: .1, grain: .2 }),
  F('cross', 'Cross Process', 'Retro', { con: .2, sat: .2, ssh: [.06, .24, .36], shi: [1, .94, .5], spl: .36 }),
  F('faded', 'Pudar', 'Retro', { fade: .24, sat: -.2, con: -.1 }),
  F('agfa', 'Agfa', 'Retro', { sat: .1, tint: -.08, con: .08, fade: .08, ssh: [.1, .26, .16], spl: .18, grain: .06 }),
  F('dust', 'Kenangan', 'Retro', { fade: .18, temp: .2, sat: -.16, vig: .26, grain: .14 }),
  F('bw', 'Hitam Putih', 'Retro', { mono: 1, con: .12 }),
  F('silver', 'Silver', 'Retro', { mono: 1, con: .26, high: .1, fade: .05 }),
  // Potret
  F('natural', 'Natural', 'Potret', { vib: .12, con: .05, exp: .02 }),
  F('soft', 'Lembut', 'Potret', { fade: .08, con: -.08, exp: .06, sat: -.04, temp: .05 }),
  F('peach', 'Persik', 'Potret', { temp: .14, tint: .08, exp: .05, shi: [1, .84, .76], spl: .2, fade: .04 }),
  F('rose', 'Mawar', 'Potret', { tint: .18, exp: .04, shi: [1, .8, .84], spl: .22, sat: -.04 }),
  F('glow', 'Bercahaya', 'Potret', { exp: .1, shad: .14, high: -.06, vib: .1, fade: .03 }),
  F('porcelain', 'Porselen', 'Potret', { exp: .12, sat: -.14, tint: .04, fade: .06 }),
  F('honey', 'Madu', 'Potret', { temp: .26, sat: .05, shi: [1, .82, .52], spl: .18 }),
  F('clean', 'Bersih', 'Potret', { exp: .08, con: .1, vib: .1, shad: .05 }),
  // Pemandangan
  F('vivid', 'Hidup', 'Pemandangan', { sat: .24, vib: .28, con: .12 }),
  F('forest', 'Hutan', 'Pemandangan', { tint: -.14, vib: .22, shad: .05, con: .08, ssh: [.05, .22, .12], spl: .15 }),
  F('ocean', 'Samudra', 'Pemandangan', { temp: -.18, vib: .3, con: .1, shi: [.72, .92, 1], spl: .14 }),
  F('sunset', 'Senja', 'Pemandangan', { temp: .32, tint: .08, sat: .18, con: .1, shi: [1, .64, .36], spl: .22 }),
  F('golden', 'Golden Hour', 'Pemandangan', { temp: .3, exp: .05, vib: .14, shi: [1, .78, .42], spl: .22, shad: .04 }),
  F('hdr', 'HDR', 'Pemandangan', { shad: .26, high: -.24, con: .12, vib: .22 }),
  F('mist', 'Berkabut', 'Pemandangan', { fade: .2, con: -.14, sat: -.1, temp: -.08, exp: .06 }),
  F('alpine', 'Alpen', 'Pemandangan', { temp: -.1, con: .16, vib: .18, high: -.12 }),
  // Makanan
  F('tasty', 'Lezat', 'Makanan', { temp: .14, vib: .3, con: .1, exp: .05 }),
  F('fresh', 'Segar', 'Makanan', { vib: .2, exp: .08, tint: -.05, con: .06 }),
  F('cafe', 'Kafe', 'Makanan', { temp: .22, fade: .08, sat: -.05, con: .06, vig: .14 }),
  F('crispy', 'Renyah', 'Makanan', { con: .2, vib: .22, temp: .06, shad: -.05 }),
  // Gaya
  F('neon', 'Neon', 'Gaya', { sat: .46, con: .22, tint: .2, ssh: [.2, .02, .5], shi: [.5, .95, 1], spl: .24 }),
  F('cyber', 'Cyberpunk', 'Gaya', { con: .26, sat: .22, ssh: [.05, .3, .6], shi: [1, .3, .75], spl: .36, tint: .08 }),
  F('vapor', 'Vaporwave', 'Gaya', { fade: .1, sat: .14, ssh: [.3, .1, .55], shi: [.45, 1, .95], spl: .36 }),
  F('pastel', 'Pastel', 'Gaya', { fade: .22, sat: -.1, exp: .1, con: -.12, tint: .06 }),
  F('comic', 'Komik', 'Gaya', { con: .44, sat: .32, shad: -.1 }),
  F('mint', 'Mint', 'Gaya', { tint: -.16, temp: -.1, fade: .08, exp: .04 }),
  F('lilac', 'Lila', 'Gaya', { tint: .2, temp: -.14, fade: .08, sat: -.05 }),
  F('dark', 'Gelap', 'Gaya', { exp: -.22, con: .16, sat: -.1, vig: .32 }),
  F('flame', 'Api', 'Gaya', { temp: .46, tint: .1, con: .22, sat: .22 }),
  F('ice', 'Es', 'Gaya', { temp: -.46, con: .1, exp: .03 }),
  F('hue90', 'Warna Alien', 'Gaya', { hue: 90, sat: .1, con: .06 }),
  F('hue200', 'Warna Terbalik', 'Gaya', { hue: 200, sat: .08 }),
];
export const FILTER_CATS = [...new Set(FILTERS.map((f) => f.cat))];
export const filterById = (id) => FILTERS.find((f) => f.id === id);

export const ADJUST_FIELDS = [
  ['exp', 'Eksposur', -1, 1], ['bri', 'Kecerahan', -1, 1], ['con', 'Kontras', -1, 1], ['sat', 'Saturasi', -1, 1], ['vib', 'Vibrance', -1, 1],
  ['temp', 'Suhu warna', -1, 1], ['tint', 'Tint', -1, 1], ['hue', 'Hue', -180, 180], ['high', 'Sorotan', -1, 1], ['shad', 'Bayangan', -1, 1],
  ['fade', 'Pudar', 0, 1], ['vig', 'Vignette', 0, 1], ['grain', 'Bintik film', 0, 1], ['sharpen', 'Ketajaman', 0, 1],
];

const COLOR_KEYS = ['bri', 'con', 'sat', 'exp', 'temp', 'tint', 'hue', 'high', 'shad', 'vib', 'fade', 'vig', 'grain', 'mono', 'sharpen', 'spl'];

/** Merges manual adjustments and a filter at its strength into the one set of values the shader takes. */
export function mergeGrade(adjust, filter, amount = 1) {
  const o = {};
  for (const k of COLOR_KEYS) o[k] = adjust?.[k] || 0;
  o.ssh = [0, 0, 0]; o.shi = [1, 1, 1];
  const f = filter ? filterById(filter.id) : null;
  if (f) {
    const a = (filter.amt ?? 1) * amount;
    for (const k of COLOR_KEYS) if (f.p[k]) o[k] += f.p[k] * a;
    if (f.p.ssh) o.ssh = f.p.ssh;
    if (f.p.shi) o.shi = f.p.shi;
  }
  o.neutral = COLOR_KEYS.every((k) => !o[k]);
  return o;
}
