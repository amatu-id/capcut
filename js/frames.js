// Single stills from a video file, plus the small thumbnails for the filter, effect and transition galleries.
import { VideoSampleSink } from './vendor/mediabunny.min.mjs';
import { getMedia } from './media.js';
import { Compositor } from './render.js';
import { newProject, makeImageClip, makeFxClip, makeFilterClip } from './model.js';
import { sampleMedia } from './samples.js';
import { effectById } from './effects.js';
import { filterById } from './filters.js';

export async function exportFrameOfClip(c, srcT) {
  const m = getMedia(c.media);
  const cv = document.createElement('canvas');
  try {
    if (!m.vt || !(await m.vt.canDecode())) throw new Error('no decoder');
    const s = await new VideoSampleSink(m.vt).getSample(Math.max(0, srcT));
    const rot = s.rotation || 0;
    cv.width = rot % 180 ? s.codedHeight : s.codedWidth; cv.height = rot % 180 ? s.codedWidth : s.codedHeight;
    s.draw(cv.getContext('2d'), 0, 0, cv.width, cv.height);
    s.close();
  } catch {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.src = m.url;
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = j; });
    await new Promise((r) => { v.onseeked = r; v.currentTime = Math.min(srcT, v.duration - 0.03); });
    cv.width = v.videoWidth; cv.height = v.videoHeight; cv.getContext('2d').drawImage(v, 0, 0);
    v.removeAttribute('src'); v.load();
  }
  return new Promise((r) => cv.toBlob(r, 'image/png'));
}

const TW = 176, TH = 112;
let thumbComp = null, thumbCv = null;
const queue = [];
let running = false;
const prov = { video: () => null, image: (c) => getMedia(c.media)?.bitmap, bgImage: (id) => getMedia(id)?.bitmap };

function project(sampleA = 3, sampleB = 2) {
  const s = sampleMedia(), P = newProject('t', '16:9');
  P.w = TW * 4; P.h = TH * 4; P.bg = { type: 'color', color: '#000000' };
  const a = makeImageClip(s[sampleA], 0, 2); a.fit = 'cover';
  const b = makeImageClip(s[sampleB], 2, 2); b.fit = 'cover';
  P.tracks[0].clips = [a, b];
  return P;
}
function makeProject(kind, id) {
  const P = project();
  if (kind === 'filter') P.tracks.push({ id: 'f', kind: 'fx', clips: [makeFilterClip(filterById(id), 0, 4)] });
  if (kind === 'effect') P.tracks.push({ id: 'f', kind: 'fx', clips: [makeFxClip(effectById(id), 0, 4)] });
  if (kind === 'transition') P.tracks[0].clips[0].trans = { id, d: 1 };
  return P;
}
function render(kind, id, canvas, p = 0.36) {
  if (!thumbComp) {
    thumbCv = document.createElement('canvas'); thumbCv.width = TW; thumbCv.height = TH;
    thumbComp = new Compositor(thumbCv, { preserve: true });
  }
  const P = makeProject(kind, id);
  const t = kind === 'transition' ? 1.5 + p : kind === 'effect' ? 1.1 : 0.5;
  thumbComp.render(P, t, prov);
  canvas.getContext('2d').drawImage(thumbCv, 0, 0, canvas.width, canvas.height);
}
function pump() {
  if (running) return;
  const job = queue.shift();
  if (!job) return;
  running = true;
  const go = () => {
    try { if (job.canvas.isConnected) render(job.kind, job.id, job.canvas); else if (job.canvas.__pending) queue.push(job); } catch (e) { console.warn(job.id, e.message); }
    running = false;
    pump();
  };
  (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(go, { timeout: 80 });
}
/** A gallery thumbnail, drawn by the real compositor shortly after it appears. */
export function thumbCanvas(kind, id) {
  const c = document.createElement('canvas'); c.width = TW; c.height = TH; c.className = 'thumb';
  queue.push({ kind, id, canvas: c });
  setTimeout(pump, 30);
  if (kind === 'transition') {
    let raf = 0, st = 0;
    c.addEventListener('pointerenter', () => { st = performance.now(); const tick = () => { const p = ((performance.now() - st) / 1100) % 1; try { render(kind, id, c, p); } catch { /* no thumb */ } raf = requestAnimationFrame(tick); }; tick(); });
    c.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); try { render(kind, id, c); } catch { /* no thumb */ } });
  }
  return c;
}
