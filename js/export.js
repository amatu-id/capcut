// Writes the finished video: frame-accurate decoding, the same compositor as the preview, hardware encoding, and the offline sound mix.
import {
  Output, Mp4OutputFormat, WebMOutputFormat, MovOutputFormat, Mp3OutputFormat, BufferTarget, StreamTarget, CanvasSource, AudioBufferSource, VideoSampleSink, canEncodeVideo, canEncodeAudio, getFirstEncodableAudioCodec,
} from './vendor/mediabunny.min.mjs';
import { registerMp3Encoder } from './vendor/mp3-encoder.min.mjs';
import { Compositor } from './render.js';
import { getMedia } from './media.js';
import { projectDur, srcAt, activeClips, transitionAt } from './model.js';
import { renderMix, encodeWav } from './audio.js';
import { ensureFont } from './text.js';
import { loadSticker } from './stickers.js';
import { clamp } from './util.js';

export const RESOLUTIONS = [[480, '480p', 'Hemat'], [720, '720p', 'HD'], [1080, '1080p', 'Full HD'], [1440, '2K', 'QHD'], [2160, '4K', 'Ultra HD']];
export const FRAME_RATES = [24, 25, 30, 50, 60];
export const QUALITIES = [['low', 'Hemat', 0.55], ['good', 'Disarankan', 1], ['high', 'Tinggi', 1.6], ['max', 'Maksimal', 2.5]];
export const CODECS = [['avc', 'MP4 · H.264', 'Paling kompatibel', 'mp4'], ['hevc', 'MP4 · H.265', 'Ukuran lebih kecil', 'mp4'], ['vp9', 'WebM · VP9', 'Untuk web', 'webm'], ['av1', 'MP4 · AV1', 'Paling hemat, lambat', 'mp4']];

/** The picture size for a chosen short side, keeping the project's shape and even dimensions. */
export function exportSize(P, shortSide) {
  const k = shortSide / Math.min(P.w, P.h);
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return { w: even(P.w * k), h: even(P.h * k) };
}
export function estimateBitrate(w, h, fps, q) {
  const f = QUALITIES.find((x) => x[0] === q)?.[2] ?? 1;
  return Math.round(w * h * fps * 0.14 * f * (fps > 40 ? 0.75 : 1));
}

/** Reads frames in timeline order from one clip's file. Two clips on one file get two readers. */
class FrameReader {
  constructor(track) { this.sink = new VideoSampleSink(track); this.iter = null; this.cur = null; this.next = null; this.lastT = -1; }
  async _restart(t) {
    await this.iter?.return?.();
    this.cur?.close(); this.next?.close(); this.cur = this.next = null;
    this.iter = this.sink.samples(Math.max(0, t));
    const a = await this.iter.next();
    this.cur = a.done ? null : a.value;
    const b = this.cur ? await this.iter.next() : { done: true };
    this.next = b.done ? null : b.value;
  }
  /** The frame showing at source time t. */
  async at(t) {
    const forward = this.cur && t >= this.cur.timestamp - 1e-4;
    if (!this.iter || !forward || t > this.cur.timestamp + 2.5) await this._restart(t);
    while (this.next && this.next.timestamp <= t + 1e-4) {
      this.cur.close();
      this.cur = this.next;
      const r = await this.iter.next();
      this.next = r.done ? null : r.value;
    }
    return this.cur;
  }
  async close() { await this.iter?.return?.().catch(() => {}); this.cur?.close(); this.next?.close(); this.cur = this.next = null; this.iter = null; }
}

/** Backup for files WebCodecs cannot read: seek a video element and wait for that exact frame. */
class ElementReader {
  constructor(url) {
    this.v = document.createElement('video'); this.v.muted = true; this.v.playsInline = true; this.v.preload = 'auto'; this.v.src = url;
    this.ready = new Promise((r, j) => { this.v.onloadeddata = r; this.v.onerror = () => j(new Error('Video tidak bisa dibaca saat ekspor.')); });
  }
  async at(t) {
    await this.ready;
    t = clamp(t, 0, Math.max(0, this.v.duration - 0.03));
    if (Math.abs(this.v.currentTime - t) > 1e-3) await new Promise((r) => { this.v.onseeked = r; this.v.currentTime = t; });
    return this.v;
  }
  async close() { this.v.removeAttribute('src'); this.v.load(); }
}

class ExportProvider {
  constructor() { this.readers = new Map(); this.frames = new Map(); }
  _pick(c) { return c.up?.media && getMedia(c.up.media)?.url ? getMedia(c.up.media) : getMedia(c.media); }
  async prepare(P, t) {
    const list = activeClips(P, t).filter((c) => c.kind === 'video');
    const tr = transitionAt(P, t);
    if (tr) for (const c of [tr.a, tr.b]) if (c.kind === 'video' && !list.includes(c)) list.push(c);
    const live = new Set(list.map((c) => c.id));
    for (const [id, r] of this.readers) if (!live.has(id)) { await r.close(); this.readers.delete(id); this._dropFrame(id); }
    for (const c of list) {
      const m = this._pick(c);
      if (!m) { this._dropFrame(c.id); continue; }
      let r = this.readers.get(c.id);
      if (!r) {
        const can = m.vt && (await m.vt.canDecode().catch(() => false));
        r = can ? new FrameReader(m.vt) : new ElementReader(m.url);
        this.readers.set(c.id, r);
      }
      let s = srcAt(c, t);
      if (c.up?.media && m === getMedia(c.up.media)) s -= c.up.offset || 0;
      s = clamp(s, 0, Math.max(0, (m.dur || 1e9) - 0.001));
      const f = await r.at(s);
      if (!f) { this._dropFrame(c.id); continue; }
      if (f instanceof HTMLVideoElement) this.frames.set(c.id, { src: f, w: f.videoWidth, h: f.videoHeight, rot: 0 });
      else {
        const vf = f.toVideoFrame();
        const old = this.frames.get(c.id); old?.vf?.close(); old?.vf2?.close();
        const entry = { vf, src: vf, w: f.codedWidth, h: f.codedHeight, rot: ((f.rotation || 0) / 90) & 3, mip: true };
        if (c.blendFrames && r.next && Math.abs(c.speed) < 1) {
          const dt = r.next.timestamp - f.timestamp;
          if (dt > 0) { entry.vf2 = r.next.toVideoFrame(); entry.next = entry.vf2; entry.mix = clamp((s - f.timestamp) / dt); }
        }
        this.frames.set(c.id, entry);
      }
    }
  }
  _dropFrame(id) { const f = this.frames.get(id); f?.vf?.close(); f?.vf2?.close(); this.frames.delete(id); }
  video(c) { return this.frames.get(c.id) || null; }
  image(c) { const id = c.cut?.media || c.up?.media || c.media; return getMedia(id)?.bitmap || getMedia(c.media)?.bitmap || null; }
  bgImage(id) { return getMedia(id)?.bitmap || null; }
  async close() {
    for (const r of this.readers.values()) await r.close();
    for (const f of this.frames.values()) { f.vf?.close(); f.vf2?.close(); }
    this.readers.clear(); this.frames.clear();
  }
}

async function readyGraphics(P) {
  const jobs = [];
  for (const tr of P.tracks) for (const c of tr.clips) {
    if (c.kind === 'text') jobs.push(ensureFont(c));
    if (c.kind === 'sticker' && c.sticker.type !== 'emoji') jobs.push(loadSticker(c.sticker));
  }
  if (P.watermark?.kind === 'text') jobs.push(ensureFont(P.watermark.style));
  await Promise.all(jobs);
  await document.fonts?.ready;
}

async function makeTarget(mime, est) {
  try {
    if (navigator.storage?.getDirectory && 'createWritable' in FileSystemFileHandle.prototype) {
      const root = await navigator.storage.getDirectory(), dir = await root.getDirectoryHandle('amatu-cut-out', { create: true });
      for await (const k of dir.keys()) await dir.removeEntry(k).catch(() => {});
      const name = 'out-' + Date.now(), fh = await dir.getFileHandle(name, { create: true }), w = await fh.createWritable();
      const target = new StreamTarget(new WritableStream({
        write: (c) => w.write({ type: 'write', position: c.position, data: c.data }),
        close: () => w.close(), abort: (e) => w.abort(e).catch(() => {}),
      }), { chunked: true, chunkSize: 2 ** 22 });
      return { target, finish: async () => new Blob([await fh.getFile()], { type: mime }), drop: () => dir.removeEntry(name).catch(() => {}) };
    }
  } catch { /* fall back to memory */ }
  if (est > 1.5e9) throw new Error('Ukuran hasil terlalu besar untuk memori browser ini. Turunkan resolusi atau kualitas.');
  const target = new BufferTarget();
  return { target, finish: async () => new Blob([target.buffer], { type: mime }), drop: () => {} };
}

const aborted = (s) => { if (s?.aborted) throw new DOMException('Dibatalkan', 'AbortError'); };

/**
 * opts: {height, fps, quality, codec, signal, onProgress(p, info)}
 * Returns {blob, ext, stats}.
 */
export async function exportVideo(P, opts) {
  const { w, h } = exportSize(P, opts.height);
  const dur = projectDur(P);
  if (dur <= 0) throw new Error('Linimasa masih kosong.');
  const fps = opts.fps || P.fps || 30;
  const bitrate = estimateBitrate(w, h, fps, opts.quality);
  const codec = opts.codec || 'avc';
  if (!(await canEncodeVideo(codec, { width: w, height: h, bitrate }))) throw new Error('Browser ini tidak bisa menyandikan ' + codec.toUpperCase() + ' pada ' + w + '×' + h + '. Pilih format atau resolusi lain.');
  const webm = codec === 'vp9';
  const audioCodec = await getFirstEncodableAudioCodec(webm ? ['opus'] : ['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000, bitrate: 192000 });

  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const comp = new Compositor(cv, { preserve: true, hq: true });
  const prov = new ExportProvider();
  const report = (p, info) => opts.onProgress?.(p, info);

  report(0.001, 'Menyiapkan teks & stiker');
  await readyGraphics(P);
  aborted(opts.signal);
  report(0.005, 'Mencampur suara');
  const mix = audioCodec ? await renderMix(P, dur) : null;
  aborted(opts.signal);

  const est = (bitrate / 8) * dur + 192000 / 8 * dur;
  const mime = webm ? 'video/webm' : 'video/mp4';
  const sink = await makeTarget(mime, est);
  const format = webm ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: sink.target instanceof BufferTarget ? 'in-memory' : false });
  const out = new Output({ format, target: sink.target });
  const vs = new CanvasSource(cv, { codec, bitrate, keyFrameInterval: 2, sizeChangeBehavior: 'passThrough' });
  out.addVideoTrack(vs, { frameRate: fps });
  let as = null;
  if (mix && audioCodec) { as = new AudioBufferSource({ codec: audioCodec, bitrate: 192000 }); out.addAudioTrack(as); }

  const started = performance.now();
  try {
    await out.start();
    const audioJob = as ? as.add(mix).then(() => as.close()) : Promise.resolve();
    const total = Math.max(1, Math.round(dur * fps));
    for (let i = 0; i < total; i++) {
      aborted(opts.signal);
      const t = i / fps;
      await prov.prepare(P, t);
      comp.render(P, t, prov);
      await vs.add(t, 1 / fps);
      if (i % 3 === 0 || i === total - 1) {
        const p = (i + 1) / total, el = (performance.now() - started) / 1000;
        report(0.01 + p * 0.97, { frame: i + 1, total, eta: (el / p) * (1 - p), speed: (i + 1) / fps / el });
      }
    }
    vs.close();
    await audioJob;
    report(0.99, 'Merapikan berkas');
    await out.finalize();
    const blob = await sink.finish();
    return { blob, ext: webm ? 'webm' : 'mp4', stats: { w, h, fps, bitrate, dur, took: (performance.now() - started) / 1000, codec, audioCodec: as ? audioCodec : null } };
  } catch (e) {
    await out.cancel().catch(() => {});
    sink.drop();
    throw e;
  } finally {
    await prov.close();
    comp.dispose();
  }
}

/** Sound only: the whole project, or one clip when `clip` is given. */
export async function exportAudio(P, { format = 'mp3', clip = null, bitrate = 256000, onProgress } = {}) {
  onProgress?.(0.1);
  const buf = await renderMix(P, clip ? clip.dur : projectDur(P), 48000, clip);
  if (!buf) throw new Error('Tidak ada suara untuk diekspor.');
  onProgress?.(0.6);
  if (format === 'wav') return { blob: encodeWav(buf), ext: 'wav' };
  registerMp3Encoder();
  const target = new BufferTarget();
  const out = new Output({ format: new Mp3OutputFormat(), target });
  const src = new AudioBufferSource({ codec: 'mp3', bitrate });
  out.addAudioTrack(src);
  await out.start();
  await src.add(buf);
  src.close();
  await out.finalize();
  onProgress?.(1);
  return { blob: new Blob([target.buffer], { type: 'audio/mpeg' }), ext: 'mp3' };
}

/** One still frame at full project size, for a cover or a screenshot. */
export async function exportFrame(P, t) {
  const cv = document.createElement('canvas'); cv.width = P.w; cv.height = P.h;
  const comp = new Compositor(cv, { preserve: true, hq: true }), prov = new ExportProvider();
  await readyGraphics(P);
  await prov.prepare(P, t);
  comp.render(P, t, prov);
  const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
  await prov.close(); comp.dispose();
  return blob;
}
