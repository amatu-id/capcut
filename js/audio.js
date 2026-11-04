// Project sound. One function builds the graph of a clip; the live preview and the offline export both call it, so they sound alike.
import { getAudio, getMedia, mediaBus, PEAKS_PER_SEC } from './media.js';
import { curveSrc, propValue, projectDur, hasAudio } from './model.js';
import { hash, clamp } from './util.js';

export const VOICES = [
  { id: 'none', name: 'Asli', cat: 'Dasar' },
  { id: 'echo', name: 'Bergema', cat: 'Ruang', p: { echo: .5, echoTime: .32, echoFb: .45 } },
  { id: 'echolong', name: 'Gema Lembah', cat: 'Ruang', p: { echo: .55, echoTime: .6, echoFb: .55, reverb: .25, room: .8 } },
  { id: 'hall', name: 'Aula', cat: 'Ruang', p: { reverb: .45, room: .7 } },
  { id: 'stadium', name: 'Stadion', cat: 'Ruang', p: { reverb: .6, room: 1, echo: .2, echoTime: .4, echoFb: .3 } },
  { id: 'cave', name: 'Gua', cat: 'Ruang', p: { reverb: .7, room: .9, echo: .34, echoTime: .24, echoFb: .5, chain: 'dark' } },
  { id: 'bathroom', name: 'Kamar Mandi', cat: 'Ruang', p: { reverb: .5, room: .22 } },
  { id: 'church', name: 'Gereja', cat: 'Ruang', p: { reverb: .7, room: 1 } },
  { id: 'chipmunk', name: 'Tupai', cat: 'Karakter', p: { pitch: 8 } },
  { id: 'kid', name: 'Anak-anak', cat: 'Karakter', p: { pitch: 4.5, chain: 'bright' } },
  { id: 'higher', name: 'Nada Tinggi', cat: 'Karakter', p: { pitch: 3 } },
  { id: 'lower', name: 'Nada Rendah', cat: 'Karakter', p: { pitch: -3 } },
  { id: 'deep', name: 'Suara Berat', cat: 'Karakter', p: { pitch: -5, chain: 'warm' } },
  { id: 'giant', name: 'Raksasa', cat: 'Karakter', p: { pitch: -8, reverb: .28, room: .7 } },
  { id: 'monster', name: 'Monster', cat: 'Karakter', p: { pitch: -7, chain: 'distort' } },
  { id: 'ghost', name: 'Hantu', cat: 'Karakter', p: { pitch: -2, reverb: .6, room: 1, echo: .3, echoTime: .36, echoFb: .5, chain: 'thin' } },
  { id: 'robot', name: 'Robot', cat: 'Mesin', p: { chain: 'robot' } },
  { id: 'alien', name: 'Alien', cat: 'Mesin', p: { pitch: 2, chain: 'alien' } },
  { id: 'dalek', name: 'Mesin Rusak', cat: 'Mesin', p: { pitch: -2, chain: 'ring30' } },
  { id: 'chorus', name: 'Paduan Suara', cat: 'Mesin', p: { chain: 'chorus', reverb: .22, room: .6 } },
  { id: 'phone', name: 'Telepon', cat: 'Alat', p: { chain: 'phone' } },
  { id: 'radio', name: 'Radio', cat: 'Alat', p: { chain: 'radio' } },
  { id: 'walkie', name: 'Walkie-talkie', cat: 'Alat', p: { chain: 'walkie' } },
  { id: 'megaphone', name: 'Megafon', cat: 'Alat', p: { chain: 'megaphone' } },
  { id: 'vinyl', name: 'Piringan Hitam', cat: 'Alat', p: { chain: 'vinyl' } },
  { id: 'underwater', name: 'Bawah Air', cat: 'Alat', p: { chain: 'water' } },
];
const voiceOf = (a) => VOICES.find((v) => v.id === a?.voice)?.p || {};

/* ---- worker ---- */
let worker = null, jobSeq = 0;
const jobs = new Map();
function dsp(msg, transfer = []) {
  worker ||= (() => {
    const w = new Worker(new URL('./dsp.worker.js', import.meta.url));
    w.onmessage = (e) => { const j = jobs.get(e.data.id); if (!j) return; jobs.delete(e.data.id); e.data.error ? j.rej(new Error(e.data.error)) : j.res(e.data); };
    return w;
  })();
  const id = ++jobSeq;
  return new Promise((res, rej) => { jobs.set(id, { res, rej }); worker.postMessage({ ...msg, id }, transfer); });
}

export async function detectBeats(buf) {
  const n = buf.length, mono = new Float32Array(n), a = buf.getChannelData(0), b = buf.getChannelData(buf.numberOfChannels - 1);
  for (let i = 0; i < n; i++) mono[i] = (a[i] + b[i]) / 2;
  const r = await dsp({ op: 'beats', mono, sr: buf.sampleRate }, [mono.buffer]);
  return r.result;
}

/* ---- processed clips ---- */
const processed = new Map();
const running = new Map();
const totalPitch = (c) => (c.audio?.pitch || 0) + (voiceOf(c.audio).pitch || 0);
const needsDsp = (c) => c.reverse || !!c.curve || (c.speed !== 1 && c.keepPitch) || totalPitch(c) !== 0 || (c.audio?.denoise || 0) > 0;
const dspKey = (c) => hash([c.media, c.in.toFixed(3), c.len.toFixed(3), c.dur.toFixed(3), c.speed, c.reverse, c.keepPitch, totalPitch(c), c.audio?.denoise || 0, c.curve ? c.curve.pts.join() : ''].join('|'));

/** The buffer a clip plays. Ready now, or null while it is still being worked on (the promise from ensureClipAudio resolves when done). */
function clipBuffer(c) {
  const m = getMedia(c.media);
  if (!m?.audio) return null;
  if (!needsDsp(c)) return { buf: m.audio, base: c.in, rate: c.speed };
  const hit = processed.get(dspKey(c));
  return hit ? { buf: hit, base: 0, rate: 1 } : null;
}
export async function ensureClipAudio(c) {
  const src = await getAudio(c.media);
  if (!src || !needsDsp(c)) return;
  const key = dspKey(c);
  if (processed.has(key)) return;
  if (running.has(key)) return running.get(key);
  const a = Math.floor(c.in * src.sampleRate), b = Math.min(src.length, Math.ceil((c.in + c.len) * src.sampleRate));
  if (b - a < 16) return;
  const channels = []; for (let i = 0; i < src.numberOfChannels; i++) channels.push(src.getChannelData(i).slice(a, b));
  const opts = { speed: c.speed, keepPitch: c.keepPitch, pitch: totalPitch(c), reverse: c.reverse, denoise: c.audio?.denoise || 0 };
  if (c.curve) {
    const N = 256, table = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) table[i] = curveSrc(c.curve, i / N);
    table[0] = 0; table[N] = 1;
    opts.table = table; opts.outLen = Math.round(c.dur * src.sampleRate);
  }
  mediaBus.emit('busy', 1);
  const job = dsp({ op: 'process', channels, opts }, channels.map((x) => x.buffer)).then((r) => {
    const n = r.channels[0].length;
    const out = new AudioBuffer({ length: Math.max(1, n), numberOfChannels: r.channels.length, sampleRate: src.sampleRate });
    r.channels.forEach((d, i) => out.copyToChannel(d, i));
    processed.set(key, out);
    if (processed.size > 60) processed.delete(processed.keys().next().value);
    running.delete(key);
    mediaBus.emit('busy', -1);
    mediaBus.emit('audio-processed', key);
  }).catch((e) => { running.delete(key); mediaBus.emit('busy', -1); console.warn(e); });
  running.set(key, job);
  return job;
}

/* ---- graph ---- */
function makeIR(ctx, room) {
  const sec = 0.35 + room * 3.4, len = Math.ceil(sec * ctx.sampleRate), b = ctx.createBuffer(2, len, ctx.sampleRate);
  let seed = 12345;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 1073741823.5 - 1; };
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < len; i++) { const e = (1 - i / len) ** (2 + room * 1.2); lp += (rnd() - lp) * (0.75 - 0.55 * (i / len)); d[i] = lp * e * (i < 200 ? i / 200 : 1); }
  }
  return b;
}
const irCache = new WeakMap();
function getIR(ctx, room) {
  let m = irCache.get(ctx);
  if (!m) irCache.set(ctx, m = new Map());
  const k = Math.round(room * 10);
  if (!m.has(k)) m.set(k, makeIR(ctx, k / 10));
  return m.get(k);
}
const curves = new Map();
function drive(k) { if (curves.has(k)) return curves.get(k); const c = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } curves.set(k, c); return c; }

function voiceChain(ctx, input, chain, when, end) {
  const f = (type, fr, q = .7) => { const x = ctx.createBiquadFilter(); x.type = type; x.frequency.value = fr; x.Q.value = q; return x; };
  const chainUp = (...nodes) => { let cur = input; for (const n of nodes) { cur.connect(n); cur = n; } return cur; };
  const ws = (k) => { const w = ctx.createWaveShaper(); w.curve = drive(k); return w; };
  const ring = (hzv, depth = 1) => {
    const g = ctx.createGain(); g.gain.value = 1 - depth;
    const o = ctx.createOscillator(); o.frequency.value = hzv; const og = ctx.createGain(); og.gain.value = depth;
    o.connect(og); og.connect(g.gain); o.start(when); o.stop(end);
    return g;
  };
  switch (chain) {
    case 'bright': return chainUp(f('highshelf', 3500));
    case 'warm': return chainUp((() => { const x = f('lowshelf', 200); x.gain.value = 4; return x; })());
    case 'dark': return chainUp(f('lowpass', 2800));
    case 'thin': return chainUp(f('highpass', 500));
    case 'distort': return chainUp(ws(4), f('lowpass', 3800));
    case 'robot': { const d = ctx.createDelay(.1); d.delayTime.value = .014; const fb = ctx.createGain(); fb.gain.value = .55; const r = ring(62, 1); const last = chainUp(r, d); last.connect(fb); fb.connect(d); return last; }
    case 'alien': return chainUp(ring(240, .85), f('highpass', 250));
    case 'ring30': return chainUp(ring(30, 1), ws(2));
    case 'chorus': {
      const out = ctx.createGain(); out.gain.value = .55; input.connect(out);
      for (const [dt, rate] of [[.021, .7], [.029, .9], [.037, 1.2]]) {
        const d = ctx.createDelay(.1); d.delayTime.value = dt; const l = ctx.createOscillator(); l.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = .0035; l.connect(lg); lg.connect(d.delayTime); l.start(when); l.stop(end);
        input.connect(d); d.connect(out);
      }
      return out;
    }
    case 'phone': return chainUp(f('highpass', 450, 1), f('lowpass', 3000, 1), ws(1.6));
    case 'radio': return chainUp(f('highpass', 550, 1), f('lowpass', 4000, 1.2), ws(2.8));
    case 'walkie': return chainUp(f('highpass', 800, 1.5), f('lowpass', 2600, 2), ws(5));
    case 'megaphone': return chainUp(f('highpass', 650, 1.2), f('peaking', 1800, 1.2), ws(7), f('lowpass', 4200));
    case 'vinyl': return chainUp(f('highpass', 180), f('lowpass', 3600), ws(1.4));
    case 'water': { const x = f('lowpass', 480, 3); const l = ctx.createOscillator(); l.frequency.value = 1.8; const lg = ctx.createGain(); lg.gain.value = 140; l.connect(lg); lg.connect(x.frequency); l.start(when); l.stop(end); return chainUp(x); }
    default: return input;
  }
}

const EQ_BANDS = [[80, 'lowshelf'], [300, 'peaking'], [1000, 'peaking'], [4000, 'peaking'], [11000, 'highshelf']];

const fadeAt = (c, u) => {
  let g = 1;
  if (c.fadeIn > 0 && u < c.fadeIn) g *= u / c.fadeIn;
  if (c.fadeOut > 0 && u > c.dur - c.fadeOut) g *= Math.max(0, (c.dur - u) / c.fadeOut);
  return g;
};

/** Music ducks under speech: returns gain over time, sampled at 20 Hz, from the waveforms of the other clips. */
function duckEnvelope(P, music) {
  if (!music.duck) return null;
  const rate = 20, n = Math.ceil(music.dur * rate) + 1, loud = new Float32Array(n);
  for (const tr of P.tracks) for (const c of tr.clips) {
    if (c === music || !hasAudio(c) || c.muted || c.tag === 'music' || c.tag === 'sfx') continue;
    const m = getMedia(c.media); if (!m?.peaks) continue;
    for (let i = 0; i < n; i++) {
      const t = music.start + i / rate; if (t < c.start || t >= c.start + c.dur) continue;
      const src = c.reverse ? c.in + c.len - (t - c.start) * (c.len / c.dur) : c.in + (t - c.start) * (c.len / c.dur);
      const p = m.peaks[Math.floor(src * PEAKS_PER_SEC)] || 0;
      if (p > 0.05) loud[i] = 1;
    }
  }
  const out = new Float32Array(n); let cur = 0;
  for (let i = 0; i < n; i++) { let ahead = 0; for (let j = i; j < Math.min(n, i + 4); j++) ahead = Math.max(ahead, loud[j]); cur += (ahead - cur) * (ahead > cur ? 0.5 : 0.08); out[i] = 1 - cur * music.duck; }
  return out;
}

const normCache = new Map();
function normGain(c, buf) {
  const k = hash([c.media, c.in, c.len].join('|'));
  if (normCache.has(k)) return normCache.get(k);
  const a = Math.floor(c.in * buf.sampleRate), b = Math.min(buf.length, Math.ceil((c.in + c.len) * buf.sampleRate));
  let peak = 0, sum = 0, n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) { const d = buf.getChannelData(ch); for (let i = a; i < b; i += 4) { const v = Math.abs(d[i]); if (v > peak) peak = v; sum += v * v; n++; } }
  const rms = Math.sqrt(sum / (n || 1));
  const g = clamp(Math.min(0.97 / (peak || 1), 0.16 / (rms || 1)), 0.1, 12);
  normCache.set(k, g);
  return g;
}

/**
 * Connects a clip into dest, starting at context time `when`, `off` seconds into the clip.
 * Returns the started nodes so the preview can stop them, or null when the buffer is not ready.
 */
export function playClip(ctx, P, c, when, off, dest) {
  const got = clipBuffer(c);
  if (!got) return null;
  const a = c.audio || {}, vp = voiceOf(a);
  const remain = c.dur - off;
  if (remain <= 0.001) return null;
  const end = when + remain;

  const src = ctx.createBufferSource();
  src.buffer = got.buf;
  src.playbackRate.value = got.rate;
  const startAt = got.base + off * got.rate;

  let node = src;
  const norm = a.norm ? normGain(c, getMedia(c.media).audio) : 1;
  if (norm !== 1) { const g = ctx.createGain(); g.gain.value = norm; node.connect(g); node = g; }
  if (a.low > 0) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 30 + a.low * 600; node.connect(f); node = f; }
  if (a.high > 0) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 18000 - a.high * 16500; node.connect(f); node = f; }
  (a.eq || []).forEach((gain, i) => {
    if (!gain) return;
    const f = ctx.createBiquadFilter(); f.type = EQ_BANDS[i][1]; f.frequency.value = EQ_BANDS[i][0]; f.gain.value = gain; f.Q.value = .9;
    node.connect(f); node = f;
  });
  if (vp.chain) node = voiceChain(ctx, node, vp.chain, when, end + 3);
  if (a.comp) { const k = ctx.createDynamicsCompressor(); k.threshold.value = -22; k.ratio.value = 4; k.attack.value = .004; k.release.value = .15; node.connect(k); const mk = ctx.createGain(); mk.gain.value = 1.5; k.connect(mk); node = mk; }

  // Volume, fades, keyframes and ducking all reduce to a single gain over time.
  const gain = ctx.createGain();
  const duck = c.kind === 'audio' ? duckEnvelope(P, c) : null;
  const animated = c.fadeIn > 0 || c.fadeOut > 0 || (c.kf?.vol?.length) || duck;
  const valueAt = (u) => propValue(c, 'vol', u) * fadeAt(c, u) * (duck ? duck[Math.floor(u * 20)] ?? 1 : 1);
  if (animated) {
    const rate = 30, n = Math.max(2, Math.ceil(remain * rate));
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = valueAt(off + (i / (n - 1)) * remain);
    gain.gain.setValueCurveAtTime(curve, when, remain);
  } else gain.gain.value = c.vol;
  node.connect(gain);
  gain.connect(dest);

  const echo = a.echo || vp.echo || 0;
  if (echo > 0) {
    const d = ctx.createDelay(2), fb = ctx.createGain(), wet = ctx.createGain(), lp = ctx.createBiquadFilter();
    d.delayTime.value = a.echo ? a.echoTime ?? .28 : vp.echoTime ?? .28; fb.gain.value = a.echo ? a.echoFb ?? .4 : vp.echoFb ?? .4; wet.gain.value = echo; lp.frequency.value = 3800;
    gain.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(dest);
  }
  const rev = a.reverb || vp.reverb || 0;
  if (rev > 0) {
    const cv = ctx.createConvolver(), wet = ctx.createGain();
    cv.buffer = getIR(ctx, a.reverb ? a.room ?? .5 : vp.room ?? .5); wet.gain.value = rev * 0.9;
    gain.connect(cv); cv.connect(wet); wet.connect(dest);
  }
  src.start(when, Math.max(0, startAt), remain * got.rate + 0.02);
  return { src, gain };
}

/* ---- live preview ---- */
export class LiveAudio {
  constructor() { this.ctx = null; this.live = new Map(); this.playing = false; }
  _ensure() {
    if (this.ctx) return this.ctx;
    const C = window.AudioContext || window.webkitAudioContext;
    this.ctx = new C({ latencyHint: 'interactive' });
    this.master = this.ctx.createGain();
    const lim = this.ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .08; lim.knee.value = 0;
    this.master.connect(lim); lim.connect(this.ctx.destination);
    return this.ctx;
  }
  /** The browser only allows sound after a user action, so this is called from one. */
  unlock() { const c = this._ensure(); if (c.state !== 'running') c.resume().catch(() => {}); }
  get now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; }
  timeAt() { return this.startT + (this.now - this.startCtx); }
  start(P, t) {
    this._ensure(); this.unlock();
    this.stop();
    this.P = P; this.startT = t; this.startCtx = this.ctx.currentTime + 0.05; this.playing = true;
    this.master.gain.value = P.master?.vol ?? 1;
    this.prepare(P, t);
    this.schedule(t);
  }
  prepare(P, t) { for (const tr of P.tracks) for (const c of tr.clips) if (hasAudio(c) && !c.muted && c.start + c.dur > t) ensureClipAudio(c).catch(() => {}); }
  /** Starts whatever begins soon. Called every frame; clips already running are skipped. */
  schedule(t) {
    if (!this.playing) return;
    const P = this.P, horizon = t + 1.2;
    for (const tr of P.tracks) {
      if (tr.muted) continue;
      for (const c of tr.clips) {
        if (!hasAudio(c) || c.muted || this.live.has(c.id)) continue;
        if (c.kind === 'video' && !getMedia(c.media)?.hasAudio) continue;
        if (c.start >= horizon || c.start + c.dur <= t + 0.03) continue;
        const off = Math.max(0, t - c.start) + (t > c.start ? 0.06 : 0);
        const when = this.startCtx + (Math.max(c.start, t + (t > c.start ? 0.06 : 0)) - this.startT);
        const nodes = playClip(this.ctx, P, c, Math.max(when, this.ctx.currentTime + 0.01), off, this.master);
        if (nodes) this.live.set(c.id, nodes);
      }
    }
  }
  stop() {
    for (const n of this.live.values()) { try { n.src.stop(); n.src.disconnect(); n.gain.disconnect(); } catch { /* already ended */ } }
    this.live.clear(); this.playing = false;
  }
  /** Plays one buffer, for trying a song from the library. */
  audition(buf, onend) {
    this._ensure(); this.unlock(); this.stopAudition();
    const s = this.ctx.createBufferSource(); s.buffer = buf; s.connect(this.master); this.master.gain.value = 1; s.start(); s.onended = () => { if (this.aud === s) this.aud = null; onend?.(); };
    this.aud = s;
  }
  stopAudition() { if (this.aud) { try { this.aud.onended = null; this.aud.stop(); } catch { /* ended */ } this.aud = null; } }
}

/* ---- offline ---- */
export async function renderMix(P, dur = projectDur(P), sr = 48000, onlyClip = null) {
  const list = onlyClip ? [onlyClip] : [];
  if (!onlyClip) for (const tr of P.tracks) { if (tr.muted) continue; for (const c of tr.clips) if (hasAudio(c) && !c.muted) list.push(c); }
  await Promise.all(list.map((c) => ensureClipAudio(c)));
  const usable = list.filter((c) => clipBuffer(c));
  if (!usable.length) return null;
  const ctx = new OfflineAudioContext(2, Math.max(1, Math.ceil(dur * sr)), sr);
  const m = ctx.createGain(); m.gain.value = P.master?.vol ?? 1;
  const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.ratio.value = 20; lim.attack.value = .002; lim.release.value = .08; lim.knee.value = 0;
  m.connect(lim); lim.connect(ctx.destination);
  for (const c of usable) { const start = onlyClip ? 0 : c.start; playClip(ctx, P, c, start, 0, m); }
  return ctx.startRendering();
}

export function encodeWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, b = new ArrayBuffer(44 + n * ch * 2), v = new DataView(b);
  const tag = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); tag(8, 'WAVE'); tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); tag(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 32768 : s * 32767, true); o += 2; }
  return new Blob([b], { type: 'audio/wav' });
}
