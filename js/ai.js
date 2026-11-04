// Improving a clip's picture with AI on this device: sharper photos and videos, cut-outs for photos.
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource, VideoSampleSink } from './vendor/mediabunny.min.mjs';
import { getMedia, importFile } from './media.js';
import { clamp, uid } from './util.js';

let worker = null, seq = 0;
const pending = new Map();
let progressFn = null;
function ai() {
  if (worker) return worker;
  worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.type === 'progress') { progressFn?.(d.p, d.text); return; }
    const j = pending.get(d.id); if (!j) return;
    pending.delete(d.id);
    d.type === 'error' ? j.rej(new Error(d.error)) : j.res(d);
  };
  worker.onerror = (e) => { for (const j of pending.values()) j.rej(new Error(e.message || 'AI gagal')); pending.clear(); };
  return worker;
}
const call = (msg, transfer) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ai().postMessage({ ...msg, id }, transfer || []); });

function pixelsOf(source, w, h) {
  const cv = new OffscreenCanvas(w, h), x = cv.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(source, 0, 0, w, h);
  return x.getImageData(0, 0, w, h).data.buffer;
}
async function upscaleBuffer(data, w, h) { const r = await call({ op: 'upscale', data, w, h }, [data]); return r; }

/** Sharper photo: returns a new image media, which the clip then shows in place of the original. */
export async function upscaleImage(media, { factor = 2, onProgress } = {}) {
  progressFn = onProgress;
  const bm = media.bitmap;
  const limit = 1024, k = Math.min(1, limit / Math.max(bm.width, bm.height));
  const w = Math.round(bm.width * k), h = Math.round(bm.height * k);
  onProgress?.(0.02, 'Menyiapkan AI');
  const r = await upscaleBuffer(pixelsOf(bm, w, h), w, h);
  const tw = Math.round(bm.width * factor), th = Math.round(bm.height * factor);
  const big = new OffscreenCanvas(r.w, r.h); big.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
  const out = new OffscreenCanvas(Math.min(tw, r.w), Math.min(th, r.h)), x = out.getContext('2d');
  x.imageSmoothingQuality = 'high'; x.drawImage(big, 0, 0, out.width, out.height);
  const blob = await out.convertToBlob({ type: 'image/jpeg', quality: .95 });
  const file = new File([blob], media.name.replace(/\.[^.]+$/, '') + ' (HD).jpg', { type: 'image/jpeg', lastModified: Date.now() });
  return importFile(file, { derived: media.id });
}

/** Sharper video: works through the clip's range frame by frame and stores a new high-resolution file. */
export async function upscaleVideoClip(c, { targetShort = 1080, onProgress, signal } = {}) {
  const m = getMedia(c.media);
  if (!m.vt || !(await m.vt.canDecode())) throw new Error('Video ini tidak bisa diproses di browser ini.');
  progressFn = (p, t) => onProgress?.(p * 0.05, t);
  const stats = await m.vt.computePacketStats(120).catch(() => null);
  const fps = clamp(Math.round(stats?.averagePacketRate || 30), 10, 60);
  const dw = m.w, dh = m.h, short = Math.min(dw, dh);
  const inShort = Math.min(short, Math.max(240, Math.ceil(targetShort / 4)));
  const ik = inShort / short, iw = Math.round((dw * ik) / 2) * 2, ih = Math.round((dh * ik) / 2) * 2;
  const ok = targetShort / Math.min(iw * 4, ih * 4);
  const ow = Math.round(((iw * 4 * Math.min(1, ok)) / 2)) * 2, oh = Math.round(((ih * 4 * Math.min(1, ok)) / 2)) * 2;
  const src = new OffscreenCanvas(iw, ih), sx = src.getContext('2d', { willReadFrequently: true });
  const outCv = document.createElement('canvas'); outCv.width = ow; outCv.height = oh;
  const ox = outCv.getContext('2d'); ox.imageSmoothingQuality = 'high';
  const tmp = new OffscreenCanvas(iw * 4, ih * 4), tx = tmp.getContext('2d');
  const target = new BufferTarget();
  const out = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target });
  const vs = new CanvasSource(outCv, { codec: 'avc', bitrate: Math.round(ow * oh * fps * 0.2), keyFrameInterval: 1 });
  out.addVideoTrack(vs, { frameRate: fps });
  await out.start();
  const from = c.in, to = c.in + c.len, sink = new VideoSampleSink(m.vt);
  const total = Math.max(1, Math.round(c.len * fps));
  let i = 0;
  const times = (async function* () { for (let k = 0; k < total; k++) yield from + k / fps; })();
  try {
    for await (const s of sink.samplesAtTimestamps(times)) {
      if (signal?.aborted) { s?.close(); throw new DOMException('Dibatalkan', 'AbortError'); }
      if (s) {
        s.draw(sx, 0, 0, iw, ih);
        s.close();
        const data = sx.getImageData(0, 0, iw, ih).data.buffer;
        const r = await upscaleBuffer(data, iw, ih);
        tx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
        ox.drawImage(tmp, 0, 0, ow, oh);
        await vs.add(i / fps, 1 / fps);
      }
      i++;
      onProgress?.(0.05 + (i / total) * 0.93, 'Bingkai ' + i + ' / ' + total);
    }
    vs.close();
    await out.finalize();
  } catch (e) { await out.cancel().catch(() => {}); throw e; }
  const file = new File([target.buffer], (m.name || 'video').replace(/\.[^.]+$/, '') + ` (HD ${uid()}).mp4`, { type: 'video/mp4', lastModified: Date.now() });
  const media = await importFile(file, { derived: m.id });
  void to;
  return { media, offset: from };
}

/** Cuts a person or object out of a photo. Returns a new transparent image media. */
export async function removeBackground(media, { onProgress } = {}) {
  progressFn = onProgress;
  const bm = media.bitmap, k = Math.min(1, 2048 / Math.max(bm.width, bm.height)), w = Math.round(bm.width * k), h = Math.round(bm.height * k);
  onProgress?.(0.02, 'Menyiapkan AI');
  const r = await call({ op: 'matte', data: pixelsOf(bm, w, h), w, h });
  const file = new File([r.blob], media.name.replace(/\.[^.]+$/, '') + ' (tanpa latar).png', { type: 'image/png', lastModified: Date.now() });
  return importFile(file, { derived: media.id });
}
