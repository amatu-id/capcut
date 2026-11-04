// The project document and every rule of timeline time. No DOM here, so preview and export read the same truth.
import { uid, clone, clamp, EASE, lerp } from './util.js';

export const RATIOS = [
  { id: '9:16', w: 1080, h: 1920, hint: 'TikTok · Reels · Shorts' },
  { id: '16:9', w: 1920, h: 1080, hint: 'YouTube · Layar lebar' },
  { id: '1:1', w: 1080, h: 1080, hint: 'Feed Instagram' },
  { id: '4:5', w: 1080, h: 1350, hint: 'Potret Instagram' },
  { id: '3:4', w: 1080, h: 1440, hint: 'Potret' },
  { id: '4:3', w: 1440, h: 1080, hint: 'Klasik' },
  { id: '21:9', w: 2520, h: 1080, hint: 'Sinematik' },
  { id: '2:1', w: 2160, h: 1080, hint: 'Sinematik lebar' },
];

export const SPEED_CURVES = [
  { id: 'montage', name: 'Montase', pts: [1.6, 1.6, 0.5, 0.5, 2.4, 2.4, 0.5, 1.2] },
  { id: 'hero', name: 'Pahlawan', pts: [2.2, 2.2, 0.35, 0.35, 0.35, 2.2, 2.2, 2.2] },
  { id: 'bullet', name: 'Peluru', pts: [3, 3, 0.25, 0.2, 0.25, 3, 3, 3] },
  { id: 'jump', name: 'Lompat', pts: [0.6, 0.6, 3, 3, 0.6, 0.6, 3, 0.6] },
  { id: 'flashin', name: 'Masuk Cepat', pts: [3.5, 3, 2, 1, 1, 1, 1, 1] },
  { id: 'flashout', name: 'Keluar Cepat', pts: [1, 1, 1, 1, 1, 2, 3, 3.5] },
  { id: 'ramp', name: 'Makin Cepat', pts: [0.4, 0.6, 0.8, 1, 1.4, 1.8, 2.4, 3] },
  { id: 'slowdown', name: 'Makin Lambat', pts: [3, 2.4, 1.8, 1.4, 1, 0.8, 0.6, 0.4] },
];

export function newProject(name = 'Proyek baru', ratio = '9:16') {
  const r = RATIOS.find((x) => x.id === ratio) || RATIOS[0];
  return {
    id: uid(), name, ratio: r.id, w: r.w, h: r.h, fps: 30, created: Date.now(), updated: Date.now(), thumb: '',
    bg: { type: 'blur', color: '#000000', color2: '#1f2937', blur: 0.6, media: null },
    tracks: [{ id: uid(), kind: 'main', clips: [] }],
    media: [], markers: [], watermark: null, master: { vol: 1 },
  };
}

const NEUTRAL_AUDIO = { voice: 'none', pitch: 0, echo: 0, echoTime: 0.28, echoFb: 0.4, reverb: 0, room: 0.5, eq: [0, 0, 0, 0, 0], denoise: 0, comp: false, norm: false, low: 0, high: 0 };
export const neutralAudio = () => clone(NEUTRAL_AUDIO);

function visual(extra) {
  return {
    id: uid(), start: 0, dur: 3, tf: { x: 0, y: 0, s: 1, rot: 0, op: 1 }, kf: {}, blend: 'normal', flipH: false, flipV: false, crop: null, fit: 'contain', radius: 0,
    mask: null, chroma: null, adjust: {}, filter: null, fx: [], anim: { in: null, out: null, loop: null }, sharp: 0, cleanup: 0, trans: null, ...extra,
  };
}

export function makeVideoClip(m, start = 0) {
  const c = visual({ kind: 'video', media: m.id, name: m.name, start, in: 0, len: m.dur, dur: m.dur, speed: 1, curve: null, reverse: false, keepPitch: true, vol: 1, muted: false, fadeIn: 0, fadeOut: 0, audio: neutralAudio(), blendFrames: false, up: null });
  return c;
}
export function makeImageClip(m, start = 0, dur = 3) { return visual({ kind: 'image', media: m.id, name: m.name, start, dur, up: null, cut: null }); }
export function makeColorClip(color = '#111827', start = 0, dur = 3, color2 = null) { return visual({ kind: 'color', name: 'Warna', color, color2, start, dur, fit: 'stretch' }); }
export function makeAudioClip(m, start = 0) {
  return { id: uid(), kind: 'audio', media: m.id, name: m.name, start, in: 0, len: m.dur, dur: m.dur, speed: 1, curve: null, reverse: false, keepPitch: true, vol: 1, muted: false, fadeIn: 0, fadeOut: 0, audio: neutralAudio(), kf: {}, duck: 0, tag: m.tag || '' };
}
export function makeTextClip(start = 0, dur = 3, over = {}) {
  return {
    ...visual({ kind: 'text', start, dur, fit: 'none' }),
    name: 'Teks', text: 'Teks Anda', font: 'Inter', size: 90, weight: 800, italic: false, color: '#ffffff', grad: null, align: 'center', lineH: 1.15, spacing: 0, upper: false,
    stroke: null, shadow: { c: 'rgba(0,0,0,.55)', b: 14, x: 0, y: 4 }, glow: null, box: null, maxW: 0.88, tanim: { in: null, out: null, loop: null }, tf: { x: 0, y: 0, s: 1, rot: 0, op: 1 }, ...over,
  };
}
export function makeStickerClip(sticker, start = 0, dur = 3) { return { ...visual({ kind: 'sticker', start, dur, fit: 'none', sticker, name: 'Stiker' }), tf: { x: 0, y: 0, s: 1, rot: 0, op: 1 } }; }
export function makeFxClip(fx, start = 0, dur = 3) { return { id: uid(), kind: 'effect', name: fx.name, start, dur, effect: fx.id, amt: 1, p1: 0.5, p2: 0.5, kf: {} }; }
export function makeFilterClip(fl, start = 0, dur = 3) { return { id: uid(), kind: 'filter', name: fl.name, start, dur, filter: { id: fl.id, amt: 1 }, kf: {} }; }
export function makeAdjustClip(start = 0, dur = 3) { return { id: uid(), kind: 'adjust', name: 'Penyesuaian', start, dur, adjust: {}, kf: {} }; }

export const isVisual = (c) => ['video', 'image', 'color', 'text', 'sticker'].includes(c.kind);
export const hasAudio = (c) => c.kind === 'audio' || c.kind === 'video';
export const isSrcTimed = (c) => c.kind === 'video' || c.kind === 'audio';
export const trackKindFor = (c) => (['effect', 'filter', 'adjust'].includes(c.kind) ? 'fx' : c.kind === 'audio' ? 'audio' : c.kind === 'text' || c.kind === 'sticker' ? 'text' : 'overlay');

export const mainTrack = (p) => p.tracks.find((t) => t.kind === 'main');
export function findClip(p, id) {
  for (const t of p.tracks) { const c = t.clips.find((x) => x.id === id); if (c) return { clip: c, track: t }; }
  return null;
}
export const projectDur = (p) => { let d = 0; for (const t of p.tracks) for (const c of t.clips) d = Math.max(d, c.start + c.dur); return d; };

/* ---- speed curves ---- */
const curveCache = new Map();
function curveTable(curve) {
  const key = curve.pts.join(',');
  let tb = curveCache.get(key);
  if (tb) return tb;
  const N = 128, n = curve.pts.length - 1, sp = new Float64Array(N + 1), cum = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const x = (i / N) * n, a = Math.min(n - 1, Math.floor(x)), f = x - a, sm = f * f * (3 - 2 * f);
    sp[i] = lerp(curve.pts[a], curve.pts[a + 1], sm);
  }
  // time spent in a slice is 1/speed of the source it covers, so cum maps "fraction of the source" to "fraction of the clip"
  let tot = 0;
  for (let i = 1; i <= N; i++) { tot += 2 / (sp[i] + sp[i - 1]) / N; cum[i] = tot; }
  for (let i = 1; i <= N; i++) cum[i] /= tot;
  tb = { cum, sp, avg: 1 / tot, N };
  curveCache.set(key, tb);
  return tb;
}
export const curveAvg = (curve) => curveTable(curve).avg;
/** u is 0..1 through the clip on the timeline, the result is 0..1 through the source. */
export function curveSrc(curve, u) {
  const { cum, N } = curveTable(curve);
  if (u <= 0) return u;
  if (u >= 1) return u;
  let lo = 0, hi = N;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= u) lo = m; else hi = m; }
  return (lo + (u - cum[lo]) / (cum[hi] - cum[lo] || 1)) / N;
}
export function speedAt(c, t) {
  if (!c.curve) return c.speed;
  const { sp, N, avg } = curveTable(c.curve);
  const x = clamp(curveSrc(c.curve, clamp((t - c.start) / c.dur)));
  return sp[Math.round(x * N)] * (c.len / c.dur) / avg;
}
/** Where in the source file a clip is at timeline time t. Goes past the ends during transitions, the caller clamps. */
export function srcAt(c, t) {
  const u = t - c.start;
  let off;
  if (c.curve) {
    const r = u / c.dur;
    off = r < 0 || r > 1 ? u * (c.len / c.dur) : curveSrc(c.curve, r) * c.len;
  } else off = u * c.speed;
  return c.reverse ? c.in + c.len - off : c.in + off;
}
export function setSpeed(c, speed) { c.speed = speed; c.curve = null; c.dur = Math.max(0.05, c.len / speed); }
export function setCurve(c, curve) {
  c.curve = curve ? { id: curve.id, pts: [...curve.pts] } : null;
  c.speed = 1;
  c.dur = curve ? Math.max(0.05, c.len / curveAvg(c.curve)) : c.len;
}

/* ---- keyframes (time t is relative to the clip start) ---- */
export const KEY_PROPS = { x: 'Posisi X', y: 'Posisi Y', s: 'Skala', rot: 'Putar', op: 'Opasitas', vol: 'Volume' };
export function propValue(c, prop, u) {
  const list = c.kf?.[prop];
  const base = prop === 'vol' ? c.vol : c.tf ? c.tf[prop] : 0;
  if (!list || !list.length) return base;
  if (u <= list[0].t) return list[0].v;
  const last = list[list.length - 1];
  if (u >= last.t) return last.v;
  for (let i = 0; i < list.length - 1; i++) {
    const a = list[i], b = list[i + 1];
    if (u >= a.t && u <= b.t) return lerp(a.v, b.v, (EASE[a.e] || EASE.linear)((u - a.t) / (b.t - a.t || 1)));
  }
  return base;
}
const NEAR = 1 / 60;
export const keyAt = (c, prop, u) => c.kf?.[prop]?.find((k) => Math.abs(k.t - u) < NEAR);
export function setKey(c, prop, u, v, e) {
  c.kf ||= {};
  const list = c.kf[prop] ||= [];
  const k = list.find((x) => Math.abs(x.t - u) < NEAR);
  if (k) { k.v = v; if (e) k.e = e; } else { list.push({ t: u, v, e: e || 'inout' }); list.sort((a, b) => a.t - b.t); }
}
export function delKey(c, prop, u) {
  const list = c.kf?.[prop]; if (!list) return;
  c.kf[prop] = list.filter((k) => Math.abs(k.t - u) >= NEAR);
  if (!c.kf[prop].length) delete c.kf[prop];
}
export const hasKeys = (c, prop) => !!c.kf?.[prop]?.length;
export const anyKeys = (c) => Object.values(c.kf || {}).some((l) => l.length);
export function allKeyTimes(c) {
  const s = new Set();
  for (const l of Object.values(c.kf || {})) for (const k of l) s.add(+k.t.toFixed(3));
  return [...s].sort((a, b) => a - b);
}
/** Sets a property the way the inspector means it: on a key when the clip is animated, otherwise on the base value. */
export function setProp(c, prop, u, v) {
  if (hasKeys(c, prop)) { setKey(c, prop, u, v); return; }
  if (prop === 'vol') c.vol = v; else c.tf[prop] = v;
}

/* ---- structure ---- */
export function normalizeMain(p) {
  const m = mainTrack(p); let t = 0;
  m.clips.forEach((c, i) => {
    c.start = t; t += c.dur;
    const next = m.clips[i + 1];
    if (c.trans) { if (!next) c.trans = null; else c.trans.d = Math.min(c.trans.d, c.dur * 0.9, next.dur * 0.9); }
  });
}
export function transitionAt(p, t) {
  const m = mainTrack(p);
  for (let i = 0; i < m.clips.length - 1; i++) {
    const a = m.clips[i]; if (!a.trans) continue;
    const cut = a.start + a.dur, h = a.trans.d / 2;
    if (t >= cut - h && t < cut + h) return { a, b: m.clips[i + 1], p: (t - (cut - h)) / a.trans.d, trans: a.trans };
  }
  return null;
}
export const activeIn = (track, t) => track.clips.find((c) => t >= c.start && t < c.start + c.dur);
export function activeClips(p, t) { const out = []; for (const tr of p.tracks) { const c = activeIn(tr, t); if (c) out.push(c); } return out; }
const overlaps = (tr, s, d, skipId) => tr.clips.some((c) => c.id !== skipId && s < c.start + c.dur - 1e-4 && s + d > c.start + 1e-4);
export const fits = overlaps;

/** Puts a clip on a free spot of a track of the right kind, adding a track when none has room. */
export function placeClip(p, clip, kind = trackKindFor(clip)) {
  let tr = p.tracks.find((t) => t.kind === kind && !overlaps(t, clip.start, clip.dur));
  if (!tr) {
    tr = { id: uid(), kind, clips: [] };
    if (kind === 'audio') p.tracks.push(tr); else {
      const i = p.tracks.findIndex((t) => t.kind === 'audio');
      if (i < 0) p.tracks.push(tr); else p.tracks.splice(i, 0, tr);
    }
  }
  tr.clips.push(clip); tr.clips.sort((a, b) => a.start - b.start);
  return tr;
}
export function dropEmptyTracks(p) { p.tracks = p.tracks.filter((t) => t.kind === 'main' || t.clips.length); }

function sliceKeys(c, cut, keepLeft) {
  if (!c.kf) return {};
  const out = {};
  for (const [prop, list] of Object.entries(c.kf)) {
    const edge = propValue(c, prop, cut);
    const part = keepLeft ? list.filter((k) => k.t < cut - NEAR) : list.filter((k) => k.t > cut + NEAR).map((k) => ({ ...k, t: k.t - cut }));
    if (!part.length) continue;
    if (keepLeft) part.push({ t: cut, v: edge, e: 'linear' }); else part.unshift({ t: 0, v: edge, e: 'linear' });
    out[prop] = part;
  }
  return out;
}

/** Splits at timeline time t, returns the new right-hand clip or null when t is too near an edge. */
export function splitClip(track, c, t) {
  const u = t - c.start;
  if (u < 0.03 || u > c.dur - 0.03) return null;
  const r = clone(c); r.id = uid();
  r.start = t; r.dur = c.dur - u;
  r.kf = sliceKeys(c, u, false);
  c.kf = sliceKeys(c, u, true);
  if (isSrcTimed(c)) {
    const off = Math.abs(srcAt(c, t) - (c.reverse ? c.in + c.len : c.in));
    if (c.curve) {
      const sample = (a, b) => Array.from({ length: 8 }, (_, i) => speedAt(c, c.start + lerp(a, b, i / 7)));
      r.curve = { id: 'custom', pts: sample(u, c.dur) };
      c.curve = { id: 'custom', pts: sample(0, u) };
    }
    if (c.reverse) { r.in = c.in; r.len = c.len - off; c.in = c.in + c.len - off; c.len = off; } else { r.in = c.in + off; r.len = c.len - off; c.len = off; }
    r.fadeIn = 0; c.fadeOut = 0;
  }
  c.dur = u;
  if (c.anim) { r.anim = { ...r.anim, in: null }; c.anim = { ...c.anim, out: null }; }
  if (c.tanim) { r.tanim = { ...r.tanim, in: null }; c.tanim = { ...c.tanim, out: null }; }
  c.trans = null;
  track.clips.splice(track.clips.indexOf(c) + 1, 0, r);
  return r;
}

/** Trim from either side, within what the source allows. Returns the clip edge actually reached. */
export function trimClip(c, side, t, media) {
  const ratio = isSrcTimed(c) ? c.len / c.dur : 1;
  const srcDur = isSrcTimed(c) ? (media?.dur ?? Infinity) : Infinity;
  const end = c.start + c.dur;
  if (side === 'l') {
    let nd = end - t;
    let room = Infinity;
    if (isSrcTimed(c)) room = (c.reverse ? srcDur - (c.in + c.len) + c.len : c.in + c.len) / ratio;
    nd = clamp(nd, 0.1, room);
    const delta = c.dur - nd;
    if (isSrcTimed(c)) {
      const dl = delta * ratio;
      if (!c.reverse) c.in += dl;
      c.len -= dl;
    }
    shiftKeys(c, -delta);
    c.dur = nd; c.start = end - nd;
  } else {
    let nd = t - c.start;
    let room = Infinity;
    if (isSrcTimed(c)) room = (c.reverse ? c.in + c.len : srcDur - c.in) / ratio;
    nd = clamp(nd, 0.1, room);
    if (isSrcTimed(c)) {
      const dl = (nd - c.dur) * ratio;
      if (c.reverse) c.in -= dl;
      c.len += dl;
    }
    c.dur = nd;
  }
}
function shiftKeys(c, dt) {
  if (!c.kf) return;
  for (const [k, l] of Object.entries(c.kf)) {
    c.kf[k] = l.map((x) => ({ ...x, t: x.t + dt })).filter((x) => x.t >= -NEAR);
    if (!c.kf[k].length) delete c.kf[k];
  }
}

/** The media a project uses, with what is needed to ask the user for a file again on another device. */
export function usedMediaIds(p) {
  const s = new Set();
  for (const t of p.tracks) for (const c of t.clips) { if (c.media) s.add(c.media); if (c.up?.media) s.add(c.up.media); if (c.cut?.media) s.add(c.cut.media); }
  if (p.bg?.media) s.add(p.bg.media);
  if (p.watermark?.media) s.add(p.watermark.media);
  return s;
}

/** Undo/redo as whole-document snapshots: small JSON, no media inside. */
const editOnly = (k, v) => (k === 'thumb' || k === 'updated' || k === 'media' && Array.isArray(v) ? undefined : v);
export class History {
  constructor(limit = 120) { this.limit = limit; this.reset(null); }
  reset(p) { this.stack = p ? [JSON.stringify(p, editOnly)] : []; this.i = this.stack.length - 1; }
  push(p) {
    const s = JSON.stringify(p, editOnly);
    if (this.stack[this.i] === s) return false;
    this.stack.length = this.i + 1; this.stack.push(s);
    if (this.stack.length > this.limit) this.stack.shift();
    this.i = this.stack.length - 1;
    return true;
  }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i < this.stack.length - 1; }
  undo() { if (!this.canUndo) return null; return JSON.parse(this.stack[--this.i]); }
  redo() { if (!this.canRedo) return null; return JSON.parse(this.stack[++this.i]); }
}
