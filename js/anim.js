// Clip motion presets: in, out and loop. Each returns what to add to the clip's transform at progress p (0..1).
// Fields: x y (canvas fractions), s (multiplier), rot (deg), rx ry (3D tilt, deg), op (multiplier), blur (0..1).
import { EASE, clamp } from './util.js';

const { cubicOut, cubicIn, back, bounce, elastic, inout } = EASE;
const I = (id, name, f, d = 0.5) => ({ id, name, f, d });

export const ANIM_IN = [
  I('fade', 'Muncul Pudar', (p) => ({ op: p })),
  I('zoomin', 'Zoom Masuk', (p) => ({ s: 0.6 + 0.4 * cubicOut(p), op: clamp(p * 2.5) })),
  I('zoomout', 'Zoom Mundur', (p) => ({ s: 1.6 - 0.6 * cubicOut(p), op: clamp(p * 2.5) })),
  I('pop', 'Letup', (p) => ({ s: back(p), op: clamp(p * 4) })),
  I('bounce', 'Memantul', (p) => ({ s: bounce(p), op: clamp(p * 5) })),
  I('elastic', 'Elastis', (p) => ({ s: elastic(p), op: clamp(p * 5) }), .8),
  I('slidel', 'Geser dari Kiri', (p) => ({ x: -(1 - cubicOut(p)), op: clamp(p * 3) })),
  I('slider', 'Geser dari Kanan', (p) => ({ x: 1 - cubicOut(p), op: clamp(p * 3) })),
  I('slideu', 'Geser dari Bawah', (p) => ({ y: 1 - cubicOut(p), op: clamp(p * 3) })),
  I('slided', 'Geser dari Atas', (p) => ({ y: -(1 - cubicOut(p)), op: clamp(p * 3) })),
  I('rise', 'Naik Halus', (p) => ({ y: 0.09 * (1 - cubicOut(p)), op: p })),
  I('rotate', 'Putar Masuk', (p) => ({ rot: -60 * (1 - cubicOut(p)), s: 0.7 + 0.3 * cubicOut(p), op: clamp(p * 3) })),
  I('spin', 'Pusar Masuk', (p) => ({ rot: -360 * (1 - cubicOut(p)), s: cubicOut(p), op: clamp(p * 4) }), .7),
  I('flipx', 'Balik Horizontal', (p) => ({ ry: 90 * (1 - cubicOut(p)), op: clamp(p * 4) }), .6),
  I('flipy', 'Balik Vertikal', (p) => ({ rx: 90 * (1 - cubicOut(p)), op: clamp(p * 4) }), .6),
  I('swing', 'Ayun Masuk', (p) => ({ rot: 18 * Math.sin(p * 9) * (1 - p), s: 0.85 + 0.15 * cubicOut(p), op: clamp(p * 3) }), .7),
  I('blurin', 'Fokus Masuk', (p) => ({ blur: 1 - p, op: clamp(p * 2) })),
  I('dropin', 'Jatuh', (p) => ({ y: -0.7 * (1 - bounce(p)), op: clamp(p * 6) }), .8),
  I('shakein', 'Guncang Masuk', (p) => ({ x: Math.sin(p * 40) * 0.05 * (1 - p), s: 1.08 - .08 * p, op: clamp(p * 4) })),
];

export const ANIM_OUT = [
  I('fade', 'Hilang Pudar', (p) => ({ op: 1 - p })),
  I('zoomin', 'Zoom Keluar', (p) => ({ s: 1 + 0.6 * cubicIn(p), op: clamp((1 - p) * 2.5) })),
  I('zoomout', 'Mengecil', (p) => ({ s: 1 - 0.6 * cubicIn(p), op: clamp((1 - p) * 2.5) })),
  I('pop', 'Letup', (p) => ({ s: 1 - cubicIn(p) + Math.sin(p * Math.PI) * .12, op: clamp((1 - p) * 4) })),
  I('slidel', 'Geser ke Kiri', (p) => ({ x: -cubicIn(p), op: clamp((1 - p) * 3) })),
  I('slider', 'Geser ke Kanan', (p) => ({ x: cubicIn(p), op: clamp((1 - p) * 3) })),
  I('slideu', 'Geser ke Atas', (p) => ({ y: -cubicIn(p), op: clamp((1 - p) * 3) })),
  I('slided', 'Geser ke Bawah', (p) => ({ y: cubicIn(p), op: clamp((1 - p) * 3) })),
  I('sink', 'Turun Halus', (p) => ({ y: 0.09 * cubicIn(p), op: 1 - p })),
  I('rotate', 'Putar Keluar', (p) => ({ rot: 60 * cubicIn(p), s: 1 - 0.3 * cubicIn(p), op: clamp((1 - p) * 3) })),
  I('spin', 'Pusar Keluar', (p) => ({ rot: 360 * cubicIn(p), s: 1 - cubicIn(p), op: clamp((1 - p) * 4) }), .7),
  I('flipx', 'Balik Horizontal', (p) => ({ ry: -90 * cubicIn(p), op: clamp((1 - p) * 4) }), .6),
  I('flipy', 'Balik Vertikal', (p) => ({ rx: -90 * cubicIn(p), op: clamp((1 - p) * 4) }), .6),
  I('blurout', 'Buram Keluar', (p) => ({ blur: p, op: clamp((1 - p) * 2) })),
];

export const ANIM_LOOP = [
  I('kenburnsin', 'Ken Burns Masuk', (p) => ({ s: 1.02 + p * 0.16 }), 0),
  I('kenburnsout', 'Ken Burns Mundur', (p) => ({ s: 1.18 - p * 0.16 }), 0),
  I('panl', 'Geser Pelan Kiri', (p) => ({ s: 1.16, x: 0.06 - p * 0.12 }), 0),
  I('panr', 'Geser Pelan Kanan', (p) => ({ s: 1.16, x: -0.06 + p * 0.12 }), 0),
  I('panu', 'Geser Pelan Atas', (p) => ({ s: 1.16, y: 0.05 - p * 0.1 }), 0),
  I('pand', 'Geser Pelan Bawah', (p) => ({ s: 1.16, y: -0.05 + p * 0.1 }), 0),
  I('drift', 'Melayang Diagonal', (p) => ({ s: 1.14 + p * .06, x: -0.04 + p * .08, y: 0.03 - p * .06, rot: -1 + 2 * p }), 0),
  I('pulse', 'Denyut', (p, t) => ({ s: 1 + Math.sin(t * 5) * 0.035 }), 0),
  I('heartbeat', 'Detak Jantung', (p, t) => { const b = t % 1; return { s: 1 + Math.exp(-b * 9) * 0.1 + Math.exp(-Math.abs(b - .25) * 14) * .06 }; }, 0),
  I('float', 'Mengambang', (p, t) => ({ y: Math.sin(t * 2) * 0.012, x: Math.cos(t * 1.4) * 0.006 }), 0),
  I('swing', 'Berayun', (p, t) => ({ rot: Math.sin(t * 2.6) * 4 }), 0),
  I('wiggle', 'Bergoyang', (p, t) => ({ rot: Math.sin(t * 13) * 2.4 }), 0),
  I('shake', 'Bergetar', (p, t) => ({ x: Math.sin(t * 61) * 0.004, y: Math.cos(t * 47) * 0.004 }), 0),
  I('spin', 'Berputar', (p, t) => ({ rot: t * 60 }), 0),
  I('tilt3d', 'Miring 3D', (p, t) => ({ ry: Math.sin(t * 1.5) * 14, rx: Math.cos(t * 1.2) * 6 }), 0),
  I('flicker', 'Berkedip', (p, t) => ({ op: 0.72 + 0.28 * (Math.sin(t * 31) * Math.sin(t * 13) > 0 ? 1 : 0.4) }), 0),
];

const byId = (list, id) => list.find((a) => a.id === id);

/** Combined motion of a clip at u seconds into it. */
export function animState(anim, u, dur) {
  const o = { x: 0, y: 0, s: 1, rot: 0, rx: 0, ry: 0, op: 1, blur: 0 };
  if (!anim) return o;
  const add = (d) => {
    if (!d) return;
    o.x += d.x || 0; o.y += d.y || 0; if (d.s != null) o.s *= d.s; o.rot += d.rot || 0; o.rx += d.rx || 0; o.ry += d.ry || 0;
    if (d.op != null) o.op *= d.op;
    if (d.blur) o.blur = Math.max(o.blur, d.blur);
  };
  if (anim.loop) { const a = byId(ANIM_LOOP, anim.loop.id); if (a) add(a.f(clamp(u / dur), u)); }
  if (anim.in) {
    const a = byId(ANIM_IN, anim.in.id), d = Math.min(anim.in.d ?? a?.d ?? 0.5, dur);
    if (a && u < d) add(a.f(clamp(u / d)));
  }
  if (anim.out) {
    const a = byId(ANIM_OUT, anim.out.id), d = Math.min(anim.out.d ?? a?.d ?? 0.5, dur);
    if (a && u > dur - d) add(a.f(clamp((u - (dur - d)) / d)));
  }
  return o;
}
export { inout };
