// Media files: storage on the device, probing, film-strip thumbnails, audio decoding and waveforms.
// Files live in the browser's private disk (OPFS), or the Cache API where that is missing. Both stay outside IndexedDB on purpose:
// the portal syncs IndexedDB to Drive, and video files must not travel through that.
import { Input, ALL_FORMATS, BlobSource, CanvasSink, AudioBufferSink } from './vendor/mediabunny.min.mjs';
import { hash, Emitter } from './util.js';
import { renderTrack, renderSfx, trackById, sfxById } from './music.js';

export const mediaBus = new Emitter();
const store = new Map();
const DIR = 'amatu-cut-media';
const CACHE = 'amatu-cut-media-v1';
const PEAK_RATE = 60;

/* ---- disk ---- */
async function opfs() {
  try {
    if (!navigator.storage?.getDirectory || !('createWritable' in FileSystemFileHandle.prototype)) return null;
    return await (await navigator.storage.getDirectory()).getDirectoryHandle(DIR, { create: true });
  } catch { return null; }
}
async function saveBlob(id, blob) {
  navigator.storage?.persist?.().catch(() => {});
  const d = await opfs();
  if (d) {
    const fh = await d.getFileHandle(id, { create: true }), w = await fh.createWritable();
    await w.write(blob); await w.close();
    return;
  }
  const c = await caches.open(CACHE);
  await c.put('/m/' + id, new Response(blob, { headers: { 'content-type': blob.type || 'application/octet-stream', 'x-size': String(blob.size) } }));
}
async function loadBlob(id, type = '') {
  const d = await opfs();
  if (d) {
    try { const f = await (await d.getFileHandle(id)).getFile(); return type ? new Blob([f], { type }) : f; } catch { /* maybe stored by the fallback */ }
  }
  try { const c = await caches.open(CACHE); const r = await c.match('/m/' + id); return r ? await r.blob() : null; } catch { return null; }
}
export async function deleteBlob(id) {
  const d = await opfs();
  if (d) await d.removeEntry(id).catch(() => {});
  try { (await caches.open(CACHE)).delete('/m/' + id); } catch { /* nothing to remove */ }
}
/**
 * Removes files no saved project uses. `graceMs` protects recent imports: a file picked a moment ago
 * may belong to a project that does not exist yet, or to a template dialog still open.
 */
export async function collectGarbage(keepIds, graceMs = 0) {
  const now = Date.now();
  const d = await opfs();
  if (d) {
    for await (const [k, fh] of d.entries()) {
      if (keepIds.has(k)) continue;
      const f = await fh.getFile().catch(() => null);
      if (f && now - f.lastModified >= graceMs) await d.removeEntry(k).catch(() => {});
    }
  }
  if (graceMs) return;   // the Cache API keeps no dates, so it is only swept when the user asks
  try { const c = await caches.open(CACHE); for (const r of await c.keys()) { const id = new URL(r.url).pathname.split('/').pop(); if (!keepIds.has(id)) c.delete(r); } } catch { /* no cache */ }
}
export async function storageInfo() { try { return await navigator.storage.estimate(); } catch { return null; } }

/* ---- registry ---- */
export const getMedia = (id) => {
  if (!id) return null;
  let m = store.get(id);
  if (m) return m;
  if (id.startsWith('music:')) { const t = trackById(id.slice(6)); if (t) { m = { id, type: 'audio', name: t.name, dur: t.len, hasAudio: true, virtual: true, tag: 'music' }; store.set(id, m); } return m || null; }
  if (id.startsWith('sfx:')) { const s = sfxById(id.slice(4)); if (s) { m = { id, type: 'audio', name: s.name, dur: s.len, hasAudio: true, virtual: true, tag: 'sfx' }; store.set(id, m); } return m || null; }
  return null;
};
export const allMedia = () => [...store.values()].filter((m) => !m.virtual && !m.sample);
export const metaOf = (m) => ({ id: m.id, type: m.type, name: m.name, size: m.size, w: m.w, h: m.h, dur: m.dur, hasAudio: m.hasAudio, derived: m.derived || undefined });
export function registerSample(m) { store.set(m.id, m); }

const IMG_EXT = /\.(jpe?g|png|webp|gif|bmp|avif|svg|heic|heif)$/i;
const AUD_EXT = /\.(mp3|wav|m4a|aac|ogg|oga|flac|opus|wma)$/i;
const VID_EXT = /\.(mp4|mov|m4v|webm|mkv|avi|3gp|ts|mts)$/i;
export const ACCEPT_VISUAL = 'video/*,image/*,.mov,.mkv,.m4v,.webm';
export const ACCEPT_AUDIO = 'audio/*,video/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,.opus';
const typeOf = (f) => {
  if (f.type.startsWith('image/') || IMG_EXT.test(f.name)) return 'image';
  if (f.type.startsWith('audio/') || AUD_EXT.test(f.name)) return 'audio';
  if (f.type.startsWith('video/') || VID_EXT.test(f.name)) return 'video';
  return null;
};

function elMeta(url, kind) {
  return new Promise((res) => {
    const el = document.createElement(kind);
    el.preload = 'metadata'; el.muted = true; el.playsInline = true;
    const done = (v) => { el.removeAttribute('src'); el.load?.(); res(v); };
    el.onloadedmetadata = () => {
      if (el.duration === Infinity) { el.currentTime = 1e9; el.ontimeupdate = () => { el.ontimeupdate = null; done({ dur: el.duration, w: el.videoWidth, h: el.videoHeight }); }; return; }
      done({ dur: el.duration, w: el.videoWidth, h: el.videoHeight });
    };
    el.onerror = () => done(null);
    el.src = url;
  });
}

async function probe(blob) {
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack(), at = await input.getPrimaryAudioTrack();
  const dur = await input.computeDuration();
  return { input, vt, at, dur, w: vt?.displayWidth || 0, h: vt?.displayHeight || 0, hasAudio: !!at };
}

async function hydrate(m, blob) {
  m.blob = blob; m.missing = false;
  m.url = URL.createObjectURL(blob);
  if (m.type === 'image') {
    const bm = await createImageBitmap(blob).catch(() => null);
    if (!bm) throw new Error('Gambar ini tidak bisa dibaca di browser ini: ' + m.name);
    m.bitmap = await fitBitmap(bm, 4096);
    m.bitmap.__key = m.id;
    m.w = m.bitmap.width; m.h = m.bitmap.height;
  } else {
    const p = await probe(blob).catch(() => null);
    if (p) { m.input = p.input; m.vt = p.vt; m.at = p.at; if (m.type === 'video' && p.w) { m.w = p.w; m.h = p.h; } if (p.dur) m.dur = p.dur; m.hasAudio = p.hasAudio; }
    if (!m.dur || !isFinite(m.dur)) { const e = await elMeta(m.url, m.type === 'audio' ? 'audio' : 'video'); if (e) { m.dur = e.dur; if (e.w) { m.w = e.w; m.h = e.h; } } }
    if (m.type === 'video' && !m.w) { const e = await elMeta(m.url, 'video'); if (e?.w) { m.w = e.w; m.h = e.h; m.dur ||= e.dur; } else throw new Error('Video ini tidak bisa dibuka: ' + m.name); }
    if (!m.dur) throw new Error('Durasi berkas tidak terbaca: ' + m.name);
  }
}
async function fitBitmap(bm, max) {
  if (bm.width <= max && bm.height <= max) return bm;
  const k = max / Math.max(bm.width, bm.height);
  const out = await createImageBitmap(bm, { resizeWidth: Math.round(bm.width * k), resizeHeight: Math.round(bm.height * k), resizeQuality: 'high' });
  bm.close();
  return out;
}

/** Brings a file into the app. Same file twice = same media. */
export async function importFile(file, extra = {}) {
  const type = extra.type || typeOf(file);
  if (!type) throw new Error('Jenis berkas tidak didukung: ' + file.name);
  const id = 'm' + hash(file.name + '|' + file.size + '|' + (file.lastModified || 0) + (extra.salt || ''));
  let m = store.get(id);
  if (m && !m.missing) return m;
  m = m || { id, type, name: file.name, size: file.size, ...extra };
  await hydrate(m, file);
  store.set(id, m);
  await saveBlob(id, file);
  mediaBus.emit('added', m);
  afterImport(m);
  return m;
}

function afterImport(m) {
  makeThumbs(m);
  if (m.hasAudio || m.type === 'audio') getAudio(m.id).catch(() => {});
}

/** Reconnects a project's media after opening it. Files absent from this device are marked missing. */
export async function restoreMedia(metas) {
  await Promise.all((metas || []).map(async (meta) => {
    let m = store.get(meta.id);
    if (m && !m.missing) return;
    m = m || { ...meta };
    store.set(meta.id, m);
    const blob = await loadBlob(meta.id);
    if (!blob) { m.missing = true; return; }
    try { await hydrate(m, blob); afterImport(m); } catch (e) { console.warn(e); m.missing = true; }
  }));
}
export async function relink(m, file) { await hydrate(m, file); await saveBlob(m.id, file); afterImport(m); mediaBus.emit('added', m); }

/* ---- film strip ---- */
async function makeThumbs(m) {
  if (m.thumbs || m.type === 'audio') return;
  m.thumbs = [];
  if (m.type === 'image') {
    const h = 96, w = Math.max(16, Math.round((m.w / m.h) * h)), cv = document.createElement('canvas');
    cv.width = w; cv.height = h; cv.getContext('2d').drawImage(m.bitmap, 0, 0, w, h);
    m.thumbs = [cv]; m.thumbStep = Infinity; mediaBus.emit('thumbs', m);
    return;
  }
  const count = Math.min(90, Math.max(2, Math.ceil(m.dur / 1.5))), step = m.dur / count;
  m.thumbStep = step;
  const h = 96, w = Math.max(16, Math.round((m.w / m.h) * h));
  const put = (cv) => { const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(cv, 0, 0, w, h); m.thumbs.push(c); if (m.thumbs.length % 4 === 1) mediaBus.emit('thumbs', m); };
  try {
    if (!m.vt || !(await m.vt.canDecode())) throw new Error('no decoder');
    const sink = new CanvasSink(m.vt, { width: w, height: h, fit: 'fill', poolSize: 1 });
    const times = (async function* () { for (let i = 0; i < count; i++) yield (i + 0.5) * step; })();
    for await (const r of sink.canvasesAtTimestamps(times)) if (r) put(r.canvas);
  } catch {
    await thumbsByElement(m, count, step, put).catch(() => {});
  }
  mediaBus.emit('thumbs', m);
}
function thumbsByElement(m, count, step, put) {
  return new Promise((res, rej) => {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = m.url;
    let i = 0;
    const next = () => { if (i >= count) { v.removeAttribute('src'); v.load(); res(); return; } v.currentTime = Math.min(m.dur - 0.05, (i + 0.5) * step); i++; };
    v.onseeked = () => { put(v); next(); };
    v.onloadeddata = next;
    v.onerror = () => rej(new Error('video'));
  });
}
export function thumbAt(m, srcT) {
  if (!m?.thumbs?.length) return null;
  if (m.thumbStep === Infinity) return m.thumbs[0];
  return m.thumbs[Math.max(0, Math.min(m.thumbs.length - 1, Math.floor(srcT / m.thumbStep)))] || null;
}

/* ---- audio ---- */
const audioJobs = new Map();
function peaksOf(buf) {
  const n = Math.ceil(buf.duration * PEAK_RATE), out = new Float32Array(n), win = buf.sampleRate / PEAK_RATE, chs = [];
  for (let c = 0; c < Math.min(2, buf.numberOfChannels); c++) chs.push(buf.getChannelData(c));
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * win), b = Math.min(buf.length, Math.floor((i + 1) * win));
    let mx = 0;
    for (let s = a; s < b; s += 8) for (const d of chs) { const v = Math.abs(d[s]); if (v > mx) mx = v; }
    out[i] = mx;
  }
  return out;
}
export const PEAKS_PER_SEC = PEAK_RATE;

async function decodeWithSink(m) {
  if (!m.at || !(await m.at.canDecode())) throw new Error('no audio decoder');
  const sink = new AudioBufferSink(m.at);
  const srcRate = m.at.sampleRate || 48000, chans = Math.min(2, m.at.numberOfChannels || 2);
  const long = m.dur > 1500;   // very long sources: half the rate in mono keeps the memory reasonable
  const dec = long ? 2 : 1, outCh = long ? 1 : chans, rate = srcRate / dec;
  const total = Math.ceil((m.dur + 0.5) * rate);
  const out = new AudioBuffer({ length: total, numberOfChannels: outCh, sampleRate: rate });
  const data = []; for (let c = 0; c < outCh; c++) data.push(out.getChannelData(c));
  for await (const w of sink.buffers()) {
    const b = w.buffer, at = Math.round(w.timestamp * rate);
    if (at >= total) continue;
    for (let c = 0; c < outCh; c++) {
      const src = b.getChannelData(Math.min(c, b.numberOfChannels - 1));
      if (long) {
        const s2 = b.getChannelData(b.numberOfChannels - 1), d = data[c];
        for (let i = 0, j = at; i < src.length && j < total; i += dec, j++) d[j] = (src[i] + s2[i]) / 2;
      } else data[c].set(at + src.length > total ? src.subarray(0, total - at) : src, Math.max(0, at));
    }
  }
  return out;
}
async function decodeWhole(m) {
  const ac = new OfflineAudioContext(2, 1, 44100);
  return ac.decodeAudioData(await m.blob.arrayBuffer());
}
export function getAudio(id) {
  const m = getMedia(id);
  if (!m) return Promise.resolve(null);
  if (m.audio) return Promise.resolve(m.audio);
  if (m.type === 'image' || m.missing) return Promise.resolve(null);
  if (audioJobs.has(id)) return audioJobs.get(id);
  m.decoding = true;
  const job = (async () => {
    let buf = null;
    if (id.startsWith('music:')) buf = await renderTrack(id.slice(6));
    else if (id.startsWith('sfx:')) buf = await renderSfx(id.slice(4));
    else if (m.hasAudio !== false) {
      try { buf = await decodeWithSink(m); } catch (e) {
        if (m.size && m.size < 800e6) buf = await decodeWhole(m).catch(() => null);
      }
    }
    m.decoding = false;
    if (buf) { m.audio = buf; m.peaks = peaksOf(buf); if (m.virtual) m.dur = buf.duration; mediaBus.emit('audio', m); }
    else m.hasAudio = false;
    audioJobs.delete(id);
    return buf;
  })();
  audioJobs.set(id, job);
  return job;
}
