// Automatic editing: looks through the footage to find its good moments, removes silence, splits scenes, cuts to the beat.
import { CanvasSink } from './vendor/mediabunny.min.mjs';
import { getMedia, getAudio, PEAKS_PER_SEC } from './media.js';
import { detectBeats } from './audio.js';
import { splitClip, trackKindFor, mainTrack, normalizeMain } from './model.js';
import { clamp } from './util.js';

const analyses = new Map();

/** Samples the video twice a second and scores each moment on motion, sharpness and exposure. */
export async function analyzeVideo(m, onProgress) {
  if (analyses.has(m.id)) return analyses.get(m.id);
  const step = m.dur > 300 ? Math.max(1, m.dur / 300) : 0.5;
  const count = Math.max(1, Math.floor(m.dur / step));
  const W = 48, H = Math.max(8, Math.round((48 * (m.h || 9)) / (m.w || 16)));
  const scores = [];
  if (!m.vt || !(await m.vt.canDecode().catch(() => false))) { analyses.set(m.id, null); return null; }
  try {
    const sink = new CanvasSink(m.vt, { width: W, height: H, fit: 'fill', poolSize: 1 });
    let prev = null, i = 0;
    const times = (async function* () { for (let k = 0; k < count; k++) yield k * step + step / 2; })();
    const tmp = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
    for await (const r of sink.canvasesAtTimestamps(times)) {
      if (!r) { i++; continue; }
      tmp.drawImage(r.canvas, 0, 0);
      const d = tmp.getImageData(0, 0, W, H).data, gray = new Float32Array(W * H);
      let sum = 0;
      for (let p = 0, g = 0; p < d.length; p += 4, g++) { gray[g] = d[p] * .3 + d[p + 1] * .59 + d[p + 2] * .11; sum += gray[g]; }
      const mean = sum / gray.length;
      let lap = 0, motion = 0, cut = 0;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const g = y * W + x; lap += Math.abs(4 * gray[g] - gray[g - 1] - gray[g + 1] - gray[g - W] - gray[g + W]); }
      lap /= (W - 2) * (H - 2);
      if (prev) { for (let g = 0; g < gray.length; g++) { const a = Math.abs(gray[g] - prev[g]); motion += a; if (a > 40) cut++; } motion /= gray.length; cut /= gray.length; }
      prev = gray;
      const expScore = 1 - Math.abs(mean - 118) / 118;
      scores.push({ t: i * step, motion, sharp: lap, exp: expScore, cut });
      i++;
      if (i % 6 === 0) onProgress?.(i / count);
    }
  } catch (e) { console.warn('analyze', e); }
  if (!scores.length) { analyses.set(m.id, null); return null; }
  const mxM = Math.max(1, ...scores.map((s) => s.motion)), mxS = Math.max(1, ...scores.map((s) => s.sharp));
  for (const s of scores) { const mo = s.motion / mxM; s.score = 0.45 * Math.min(1, mo * 1.4) * (mo > .9 ? .6 : 1) + 0.35 * (s.sharp / mxS) + 0.2 * Math.max(0, s.exp); s.scene = s.cut > 0.35; }
  const out = { step, scores };
  analyses.set(m.id, out);
  return out;
}
export const analysisOf = (id) => analyses.get(id);

/**
 * Chooses which part of a video fills a slot of `need` seconds. Uses the analysis when there is one,
 * and moves on through the file otherwise. `usedUpTo` is where the previous pick ended.
 */
export function pickWindow(m, need, usedUpTo = 0) {
  const len = Math.min(need, m.dur);
  const a = analyses.get(m.id);
  if (a?.scores?.length && m.dur > len * 1.5) {
    const w = Math.max(1, Math.round(len / a.step));
    let best = -1, bestAt = usedUpTo;
    for (let i = 0; i + w <= a.scores.length; i++) {
      const at = a.scores[i].t;
      if (at < usedUpTo) continue;
      let s = 0; let sceneCut = false;
      for (let j = i; j < i + w; j++) { s += a.scores[j].score; if (j > i && a.scores[j].scene) sceneCut = true; }
      s = s / w - (sceneCut ? .4 : 0) - (at - usedUpTo) * .002;
      if (s > best) { best = s; bestAt = at; }
    }
    if (best > -1) return { start: bestAt, len, next: bestAt + len };
    return { start: 0, len, next: len };   // the good parts are used up, so start over
  }
  let start = usedUpTo;
  if (start + len > m.dur) start = 0;
  return { start, len, next: start + len };
}

/** Timeline times where a video's picture changes scene. */
export async function detectScenes(m) {
  const a = await analyzeVideo(m);
  if (!a) return [];
  const out = [];
  for (const s of a.scores) if (s.scene && (!out.length || s.t - out[out.length - 1] > 0.6)) out.push(s.t);
  return out;
}

/** Splits a clip at each scene change inside it. Returns how many cuts were made. */
export async function splitScenes(P, track, c) {
  const m = getMedia(c.media);
  const scenes = await detectScenes(m);
  const ratio = c.len / c.dur;
  let cur = c, n = 0;
  for (const s of scenes) {
    if (s <= c.in + .1 || s >= c.in + c.len - .1) continue;
    const t = c.start + (s - c.in) / ratio;
    const r = splitClip(track, cur, t);
    if (r) { cur = r; n++; }
  }
  return n;
}

/** Quiet spans of a media file, from its waveform. */
export function silences(m, { threshold = 0.035, minGap = 0.45, a = 0, b = m.dur } = {}) {
  const pk = m.peaks; if (!pk) return [];
  const out = []; let start = null;
  const i0 = Math.floor(a * PEAKS_PER_SEC), i1 = Math.min(pk.length, Math.ceil(b * PEAKS_PER_SEC));
  for (let i = i0; i < i1; i++) {
    const quiet = pk[i] < threshold;
    if (quiet && start == null) start = i;
    if ((!quiet || i === i1 - 1) && start != null) {
      if ((i - start) / PEAKS_PER_SEC >= minGap) out.push([start / PEAKS_PER_SEC, i / PEAKS_PER_SEC]);
      start = null;
    }
  }
  return out;
}

/** Removes the silent parts of a talking clip and closes the gaps. Returns the seconds removed. */
export async function removeSilence(P, track, c, opts = {}) {
  await getAudio(c.media);
  const m = getMedia(c.media);
  if (!m?.peaks) throw new Error('Klip ini tidak punya suara.');
  const ratio = c.len / c.dur;
  const pad = opts.pad ?? 0.08;
  const quiet = silences(m, { threshold: opts.threshold, minGap: opts.minGap, a: c.in, b: c.in + c.len }).map(([x, y]) => [x + pad, y - pad]).filter(([x, y]) => y - x > 0.1);
  if (!quiet.length) return 0;
  // Work from the end, so earlier timeline positions stay valid while cutting.
  let removed = 0;
  const spans = quiet.map(([x, y]) => [c.start + (x - c.in) / ratio, c.start + (y - c.in) / ratio]).reverse();
  let right = c;
  const toDrop = [];
  for (const [x, y] of spans) {
    const after = splitClip(track, right, y);
    const mid = splitClip(track, right, x);
    const drop = mid || (Math.abs(right.start - x) < .04 ? right : null);
    if (drop) { toDrop.push(drop.id); removed += y - x; }
    void after;
  }
  track.clips = track.clips.filter((k) => !toDrop.includes(k.id));
  if (track.kind === 'main') normalizeMain(P);
  else { let t = c.start; const part = track.clips.filter((k) => k.start >= c.start - 1e-3 && k.media === c.media).sort((u, v) => u.start - v.start); for (const k of part) { k.start = t; t += k.dur; } }
  return removed;
}

/** Beat times of any audio clip's source, in source time. */
export async function beatsOf(mediaId) {
  const m = getMedia(mediaId);
  if (m.beats) return m.beats;
  const buf = await getAudio(mediaId);
  if (!buf) return null;
  m.beats = await detectBeats(buf);
  return m.beats;
}

/**
 * Cuts the clips of the main track to the beat of a song: each clip stays until the next nth beat.
 * Clips that are too short for their slot are kept whole.
 */
export function fitMainToBeats(P, beats, every = 2) {
  const main = mainTrack(P);
  if (!main.clips.length || beats.length < 2) return 0;
  let bi = 0, changed = 0;
  main.clips.forEach((c) => {
    const start = beats[bi] ?? null;
    const next = beats[bi + every] ?? null;
    if (start == null || next == null) return;
    const slot = next - start;
    bi += every;
    if (c.kind === 'image' || c.kind === 'color') { c.dur = slot; changed++; return; }
    if (c.kind === 'video' && slot < c.dur) {
      const ratio = c.len / c.dur;
      c.len = slot * ratio; c.dur = slot; changed++;
    }
  });
  normalizeMain(P);
  return changed;
}

export { trackKindFor, clamp };
