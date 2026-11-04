// The song library. Every track is composed from code at first use (seeded, so identical on every device),
// which keeps the site free of licensing problems and needs no audio files. Beats are known exactly, so templates cut on them.
import { rng } from './util.js';

const SR = 44100;
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const SCALES = { maj: [0, 2, 4, 5, 7, 9, 11], min: [0, 2, 3, 5, 7, 8, 10], dor: [0, 2, 3, 5, 7, 9, 10], pent: [0, 2, 4, 7, 9], minp: [0, 3, 5, 7, 10], pelog: [0, 1, 3, 7, 8], hijaz: [0, 1, 4, 5, 7, 8, 10] };
/** Chord progressions as scale degrees (0 = I), major scale or natural minor. */
const PROG = {
  maj1: [0, 4, 5, 3], maj2: [0, 5, 3, 4], maj3: [3, 4, 0, 5], maj4: [0, 3, 4, 3], maj5: [0, 2, 5, 4], maj6: [5, 3, 0, 4],
  min1: [0, 5, 2, 6], min2: [0, 3, 6, 2], min3: [0, 6, 5, 6], min4: [0, 3, 5, 4], min5: [5, 6, 0, 0], min6: [0, 2, 3, 6],
};

const T = (id, name, genre, mood, bpm, key, mode, prog, len = 90) => ({ id, name, genre, mood, bpm, key, mode, prog, len });
export const TRACKS = [
  T('pop1', 'Pagi Cerah', 'Pop', 'Ceria', 112, 'C', 'maj', 'maj1'), T('pop2', 'Langkah Ringan', 'Pop', 'Ceria', 118, 'G', 'maj', 'maj2'), T('pop3', 'Senyum Kecil', 'Pop', 'Hangat', 104, 'D', 'maj', 'maj3'), T('pop4', 'Kota Sore', 'Pop', 'Santai', 96, 'A', 'maj', 'maj6'),
  T('edm1', 'Gelombang Listrik', 'EDM', 'Energik', 128, 'F', 'min', 'min1'), T('edm2', 'Puncak Malam', 'EDM', 'Energik', 126, 'A', 'min', 'min2'), T('edm3', 'Lepas Landas', 'EDM', 'Epik', 130, 'D', 'min', 'min4'),
  T('lofi1', 'Hujan di Jendela', 'Lo-fi', 'Santai', 76, 'F', 'maj', 'maj5'), T('lofi2', 'Kopi Dini Hari', 'Lo-fi', 'Santai', 72, 'D', 'min', 'min6'), T('lofi3', 'Buku Lama', 'Lo-fi', 'Tenang', 82, 'Bb', 'maj', 'maj3'),
  T('cine1', 'Cakrawala', 'Sinematik', 'Epik', 92, 'D', 'min', 'min5'), T('cine2', 'Sang Penjelajah', 'Sinematik', 'Epik', 104, 'C', 'min', 'min1'), T('cine3', 'Kenangan Biru', 'Sinematik', 'Sedih', 70, 'A', 'min', 'min2'),
  T('trap1', 'Jalanan', 'Hip-hop', 'Keren', 140, 'G', 'min', 'min3'), T('trap2', 'Tanpa Rem', 'Hip-hop', 'Keren', 150, 'E', 'min', 'min1'), T('trap3', 'Bayang Kota', 'Hip-hop', 'Gelap', 136, 'C', 'min', 'min6'),
  T('aco1', 'Jalan Pulang', 'Akustik', 'Hangat', 98, 'G', 'maj', 'maj1'), T('aco2', 'Tepi Danau', 'Akustik', 'Tenang', 84, 'D', 'maj', 'maj3'), T('aco3', 'Teman Lama', 'Akustik', 'Ceria', 116, 'C', 'maj', 'maj4'),
  T('corp1', 'Maju Bersama', 'Korporat', 'Optimis', 110, 'C', 'maj', 'maj2'), T('corp2', 'Ide Baru', 'Korporat', 'Optimis', 120, 'E', 'maj', 'maj1'), T('corp3', 'Presentasi Besar', 'Korporat', 'Mantap', 100, 'F', 'maj', 'maj6'),
  T('amb1', 'Awan Pelan', 'Ambient', 'Tenang', 60, 'E', 'maj', 'maj3'), T('amb2', 'Laut Dalam', 'Ambient', 'Misteri', 56, 'C', 'min', 'min2'), T('amb3', 'Fajar', 'Ambient', 'Tenang', 66, 'G', 'maj', 'maj5'),
  T('funk1', 'Goyang Sabtu', 'Funk', 'Ceria', 108, 'E', 'min', 'min3'), T('funk2', 'Lampu Disko', 'Funk', 'Ceria', 116, 'A', 'dor', 'min3'), T('funk3', 'Sepatu Baru', 'Funk', 'Keren', 102, 'D', 'min', 'min4'),
  T('house1', 'Atap Kota', 'House', 'Energik', 124, 'A', 'min', 'min2'), T('house2', 'Pesta Pantai', 'House', 'Ceria', 122, 'F', 'maj', 'maj2'), T('house3', 'Lantai Dansa', 'House', 'Energik', 125, 'C', 'min', 'min4'),
  T('phonk1', 'Drift Malam', 'Phonk', 'Gelap', 150, 'F', 'min', 'min3'), T('phonk2', 'Ban Berasap', 'Phonk', 'Gelap', 160, 'D', 'min', 'min5'), T('phonk3', 'Tikungan Tajam', 'Phonk', 'Keren', 145, 'G', 'min', 'min3'),
  T('nus1', 'Tirta Dewata', 'Nusantara', 'Tradisi', 88, 'D', 'pelog', 'min5'), T('nus2', 'Sawah Pagi', 'Nusantara', 'Tenang', 78, 'G', 'pent', 'maj4'), T('nus3', 'Tari Rampak', 'Nusantara', 'Energik', 120, 'A', 'pelog', 'min3'),
  T('kop1', 'Goyang Koplo', 'Koplo', 'Ceria', 132, 'A', 'hijaz', 'min3'), T('kop2', 'Pantura Malam', 'Koplo', 'Energik', 138, 'E', 'min', 'min4'), T('kop3', 'Hajatan', 'Koplo', 'Ceria', 128, 'D', 'hijaz', 'min1'),
  T('rom1', 'Janji Suci', 'Romantis', 'Romantis', 72, 'F', 'maj', 'maj1'), T('rom2', 'Hari Bahagia', 'Romantis', 'Romantis', 80, 'C', 'maj', 'maj3'), T('rom3', 'Rindu', 'Romantis', 'Sedih', 66, 'A', 'min', 'min6'),
  T('syn1', 'Neon 1985', 'Synthwave', 'Retro', 100, 'A', 'min', 'min3'), T('syn2', 'Mobil Sport', 'Synthwave', 'Retro', 110, 'E', 'min', 'min4'), T('syn3', 'Arkade', 'Synthwave', 'Keren', 118, 'C', 'min', 'min2'),
  T('kid1', 'Taman Bermain', 'Riang', 'Ceria', 120, 'C', 'maj', 'maj4'), T('kid2', 'Balon Warna', 'Riang', 'Ceria', 128, 'G', 'maj', 'maj1'), T('kid3', 'Kucing Lucu', 'Riang', 'Lucu', 108, 'F', 'maj', 'maj2'),
  T('rock1', 'Gas Terus', 'Rock', 'Energik', 134, 'E', 'min', 'min3'), T('rock2', 'Panggung Besar', 'Rock', 'Epik', 120, 'A', 'min', 'min4'), T('rock3', 'Jalan Raya', 'Rock', 'Keren', 146, 'D', 'min', 'min1'),
];
export const GENRES = [...new Set(TRACKS.map((t) => t.genre))];
export const trackById = (id) => TRACKS.find((t) => t.id === id);
/** Beat times of a library song. */
export function trackBeats(id, upto = Infinity) {
  const t = trackById(id); if (!t) return [];
  const out = [], b = 60 / t.bpm;
  for (let x = 0; x < Math.min(t.len, upto); x += b) out.push(x);
  return out;
}

/* ---------- instruments ---------- */
/** Noise and reverb responses are the same for a whole song, so every bar shares one copy. */
function makeKit(seed) {
  const r = rng(seed), n = new AudioBuffer({ length: SR * 2, numberOfChannels: 1, sampleRate: SR }), d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  const sec = 2.2, len = sec * SR | 0, ir = new AudioBuffer({ length: len, numberOfChannels: 2, sampleRate: SR });
  for (let c = 0; c < 2; c++) { const x = ir.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const e = (1 - i / len) ** 2.6; lp += (r() * 2 - 1 - lp) * (0.55 - 0.4 * i / len); x[i] = lp * e; } }
  return { noise: n, ir, strings: new Map() };
}

class Band {
  constructor(ctx, seed, kit = makeKit(seed)) {
    this.ctx = ctx; this.r = rng(seed); this.noiseBuf = kit.noise; this.kitCache = kit.strings;
    this.master = ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(ctx.destination);
    this.pump = ctx.createGain(); this.pump.connect(this.master);   // the bus that ducks under the kick
    this.drums = ctx.createGain(); this.drums.connect(this.master);
    this.revIn = ctx.createGain(); const rev = ctx.createConvolver(); rev.buffer = kit.ir; const revG = ctx.createGain(); revG.gain.value = 0.5; this.revIn.connect(rev); rev.connect(revG); revG.connect(this.master);
    this.dlyIn = ctx.createGain(); const d1 = ctx.createDelay(2); this.dly = d1; const fb = ctx.createGain(); fb.gain.value = 0.34; const dl = ctx.createBiquadFilter(); dl.frequency.value = 2600; this.dlyIn.connect(d1); d1.connect(dl); dl.connect(fb); fb.connect(d1); dl.connect(this.pump);
  }
  setDelay(sec) { this.dly.delayTime.value = sec; }
  duck(t, depth = 0.55, rel = 0.26) { const g = this.pump.gain; g.setTargetAtTime(1 - depth, t, 0.004); g.setTargetAtTime(1, t + 0.04, rel / 3); }
  env(t, a, d, s, r, dur, peak = 1) {
    const g = this.ctx.createGain(), p = g.gain;
    p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.linearRampToValueAtTime(peak * s, t + a + d);
    p.setValueAtTime(peak * s, Math.max(t + a + d, t + dur)); p.linearRampToValueAtTime(0, Math.max(t + a + d, t + dur) + r);
    return g;
  }
  send(node, { dry = 1, rev = 0, dly = 0, bus } = {}) {
    const c = this.ctx, b = bus || this.pump;
    if (dry) { const g = c.createGain(); g.gain.value = dry; node.connect(g); g.connect(b); }
    if (rev) { const g = c.createGain(); g.gain.value = rev; node.connect(g); g.connect(this.revIn); }
    if (dly) { const g = c.createGain(); g.gain.value = dly; node.connect(g); g.connect(this.dlyIn); }
  }
  osc(type, f, t, end, det = 0) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.start(t); o.stop(end); return o; }
  noise(t, end, offset = 0) { const n = this.ctx.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true; n.start(t, offset || this.r() * 1.5); n.stop(end); return n; }
  flt(type, f, q = 0.7) { const x = this.ctx.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  pan(v) { const p = this.ctx.createStereoPanner(); p.pan.value = v; return p; }

  // Drums
  kick(t, v = 1, opts = {}) {
    const { f0 = 150, f1 = 48, d = 0.3 } = opts;
    const o = this.osc('sine', f0, t, t + d + 0.05); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.drums);
    const c = this.noise(t, t + 0.02), cg = this.ctx.createGain(); cg.gain.setValueAtTime(v * 0.25, t); cg.gain.exponentialRampToValueAtTime(0.001, t + 0.018); const h = this.flt('highpass', 2500); c.connect(h); h.connect(cg); cg.connect(this.drums);
  }
  snare(t, v = .8, { tone = 190, d = 0.2, rev = .12 } = {}) {
    const o = this.osc('triangle', tone, t, t + 0.12); const g = this.ctx.createGain(); g.gain.setValueAtTime(v * 0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); o.connect(g); g.connect(this.drums);
    const n = this.noise(t, t + d + .02), f = this.flt('bandpass', 2600, .5), ng = this.ctx.createGain(); ng.gain.setValueAtTime(v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + d);
    n.connect(f); f.connect(ng); this.send(ng, { bus: this.drums, rev });
  }
  clap(t, v = .7, rev = .2) {
    for (const off of [0, .012, .024]) { const n = this.noise(t + off, t + off + .16), f = this.flt('bandpass', 1500, .9), g = this.ctx.createGain(); g.gain.setValueAtTime(v * (off ? .5 : .85), t + off); g.gain.exponentialRampToValueAtTime(0.001, t + off + (off === .024 ? .15 : .03)); n.connect(f); f.connect(g); this.send(g, { bus: this.drums, rev }); }
  }
  hat(t, v = .3, open = false, panV = 0.12) {
    const d = open ? .22 : .045, n = this.noise(t, t + d + .01), f = this.flt('highpass', open ? 6500 : 8000), g = this.ctx.createGain(), p = this.pan(panV);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); n.connect(f); f.connect(g); g.connect(p); p.connect(this.drums);
  }
  shaker(t, v = .16) { const n = this.noise(t, t + .07), f = this.flt('bandpass', 7000, 1.2), g = this.ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.linearRampToValueAtTime(v, t + .02); g.gain.exponentialRampToValueAtTime(0.001, t + .065); n.connect(f); f.connect(g); g.connect(this.drums); }
  tom(t, f0 = 120, v = .7) { const o = this.osc('sine', f0 * 1.6, t, t + .3); o.frequency.exponentialRampToValueAtTime(f0, t + .06); const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + .28); o.connect(g); this.send(g, { bus: this.drums, rev: .15 }); }
  taiko(t, v = 1) { const o = this.osc('sine', 110, t, t + .9); o.frequency.exponentialRampToValueAtTime(52, t + .16); const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + .85); const n = this.noise(t, t + .1), f = this.flt('lowpass', 900), ng = this.ctx.createGain(); ng.gain.setValueAtTime(v * .5, t); ng.gain.exponentialRampToValueAtTime(0.001, t + .08); n.connect(f); f.connect(ng); this.send(ng, { bus: this.drums, rev: .3 }); o.connect(g); this.send(g, { bus: this.drums, rev: .35 }); }
  cowbell(t, m, v = .34) { const f = hz(m); const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + .3); const bp = this.flt('bandpass', f * 1.7, 1.4); for (const r of [1, 1.48]) this.osc('square', f * r, t, t + .32).connect(bp); bp.connect(g); this.send(g, { rev: .12 }); }
  kendang(t, kind = 0, v = .6) {
    const f = [240, 150, 340, 95][kind], d = [.13, .2, .07, .3][kind];
    const o = this.osc('sine', f * 1.5, t, t + d + .02); o.frequency.exponentialRampToValueAtTime(f, t + .03); const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(g); this.send(g, { bus: this.drums, rev: .08 });
    const n = this.noise(t, t + .03), bp = this.flt('bandpass', f * 4, 1), ng = this.ctx.createGain(); ng.gain.setValueAtTime(v * .3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + .02); n.connect(bp); bp.connect(ng); ng.connect(this.drums);
  }
  // Pitched
  bass(t, m, dur, { type = 'sawtooth', cut = 520, v = .55, glide = 0 } = {}) {
    const end = t + dur + .06, o = this.osc(type, hz(m), t, end), s = this.osc('sine', hz(m), t, end);
    if (glide) o.frequency.setTargetAtTime(hz(m + glide), t + dur * .5, .04);
    const f = this.flt('lowpass', cut, 2); f.frequency.setValueAtTime(cut * 2.4, t); f.frequency.exponentialRampToValueAtTime(cut, t + .1);
    const e = this.env(t, .005, .06, .75, .05, dur, v); o.connect(f); s.connect(f); f.connect(e); this.send(e);
  }
  b808(t, m, dur, { v = .85, glide = 0, drive = 0 } = {}) {
    const end = t + dur + .08, o = this.osc('sine', hz(m), t, end);
    o.frequency.setValueAtTime(hz(m + 12), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .05);
    if (glide) o.frequency.setTargetAtTime(hz(m + glide), t + dur * .6, .05);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + Math.max(0.01, dur * .7)); g.gain.exponentialRampToValueAtTime(0.001, end);
    if (drive) { const w = this.ctx.createWaveShaper(); const cv = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cv[i] = Math.tanh(x * (1 + drive * 8)); } w.curve = cv; o.connect(w); w.connect(g); const l = this.flt('lowpass', 1800); g.connect(l); this.send(l, { bus: this.drums }); } else { o.connect(g); this.send(g, { bus: this.drums }); }
  }
  pluck(t, m, dur = .3, { v = .3, type = 'sawtooth', cut = 2600, rev = .2, dly = .18, pan = 0 } = {}) {
    const end = t + dur + .2, o = this.osc(type, hz(m), t, end, -6), o2 = this.osc(type, hz(m), t, end, 6);
    const f = this.flt('lowpass', cut, 2); f.frequency.setValueAtTime(cut * 2.5, t); f.frequency.exponentialRampToValueAtTime(cut * .45, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur + .15);
    o.connect(f); o2.connect(f); f.connect(g); const p = this.pan(pan); g.connect(p); this.send(p, { rev, dly });
  }
  piano(t, m, dur = 1, { v = .34, rev = .25, soft = 0, pan = 0 } = {}) {
    const f = hz(m), end = t + Math.min(3.2, dur + 1.2), g = this.ctx.createGain(), bright = soft ? 1200 : 3400 + (m - 60) * 40;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + .005); g.gain.exponentialRampToValueAtTime(v * .32, t + .5); g.gain.setTargetAtTime(0.0001, t + dur, .28);
    const l = this.flt('lowpass', bright, .5); l.frequency.setValueAtTime(bright * 1.5, t); l.frequency.exponentialRampToValueAtTime(bright * .7, t + .5);
    [[1, 1], [2, .42], [3, .18], [4, .08], [5.02, .04]].forEach(([r, a]) => { const o = this.osc('sine', f * r, t, end, r === 1 ? 2 : -2); const pg = this.ctx.createGain(); pg.gain.value = a; o.connect(pg); pg.connect(l); });
    l.connect(g); const p = this.pan(pan); g.connect(p); this.send(p, { rev });
  }
  ekeys(t, m, dur = .5, { v = .28, rev = .2, cut = 1800, trem = 0 } = {}) {
    const f = hz(m), end = t + dur + .5, c = this.osc('sine', f, t, end), mod = this.osc('sine', f * 2, t, end), mg = this.ctx.createGain();
    mg.gain.setValueAtTime(f * 1.3, t); mg.gain.exponentialRampToValueAtTime(f * .12, t + .35); mod.connect(mg); mg.connect(c.frequency);
    const l = this.flt('lowpass', cut), g = this.env(t, .004, .3, .55, .28, dur, v); c.connect(l); l.connect(g);
    if (trem) { const lfo = this.osc('sine', trem, t, end), lg = this.ctx.createGain(); lg.gain.value = v * .25; lfo.connect(lg); lg.connect(g.gain); }
    this.send(g, { rev });
  }
  pad(t, notes, dur, { v = .11, cut = 1500, rev = .4, type = 'sawtooth', a = .5, r = .6 } = {}) {
    const f = this.flt('lowpass', cut, .6); const e = this.env(t, a, .2, .85, r, dur, v), end = t + dur + r + .05;
    for (const m of notes) for (const d of [-9, 8]) this.osc(type, hz(m), t, end, d).connect(f);
    f.connect(e); this.send(e, { rev });
  }
  stab(t, notes, dur = .2, { v = .13, cut = 2600, rev = .22, dly = .14, type = 'sawtooth' } = {}) {
    const f = this.flt('lowpass', cut, 1.2); f.frequency.setValueAtTime(cut * 1.7, t); f.frequency.exponentialRampToValueAtTime(cut * .55, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.setTargetAtTime(0.0001, t + dur * .6, .05); const end = t + dur + .3;
    for (const m of notes) for (const d of [-11, 0, 11]) this.osc(type, hz(m), t, end, d).connect(f);
    f.connect(g); this.send(g, { rev, dly });
  }
  supersaw(t, notes, dur, { v = .07, cut = 5200 } = {}) {
    const f = this.flt('lowpass', cut, .8), e = this.env(t, .012, .08, .85, .1, dur, v), end = t + dur + .15;
    for (const m of notes) for (const d of [-19, -8, 0, 8, 19]) this.osc('sawtooth', hz(m), t, end, d).connect(f);
    f.connect(e); this.send(e, { rev: .22 });
  }
  strings(t, notes, dur, { v = .085, rev = .55, a = .4 } = {}) {
    const f = this.flt('lowpass', 2800, .5), e = this.env(t, a, .3, .9, .7, dur, v), end = t + dur + .8;
    for (const m of notes) for (const d of [-12, -4, 5, 13]) { const o = this.osc('sawtooth', hz(m), t, end, d); const lfo = this.osc('sine', 5.2, t, end), lg = this.ctx.createGain(); lg.gain.value = 3; lfo.connect(lg); lg.connect(o.detune); o.connect(f); }
    f.connect(e); this.send(e, { rev });
  }
  brass(t, notes, dur, { v = .1 } = {}) {
    const f = this.flt('lowpass', 900, 1.3); f.frequency.setValueAtTime(500, t); f.frequency.linearRampToValueAtTime(2600, t + .22); f.frequency.linearRampToValueAtTime(1300, t + dur);
    const e = this.env(t, .06, .2, .8, .25, dur, v), end = t + dur + .3;
    for (const m of notes) for (const d of [-6, 6]) this.osc('sawtooth', hz(m), t, end, d).connect(f);
    f.connect(e); this.send(e, { rev: .4 });
  }
  lead(t, m, dur, { v = .14, type = 'square', cut = 3000, rev = .2, dly = .24, vib = 0, slide = null } = {}) {
    const end = t + dur + .12, o = this.osc(type, hz(m), t, end);
    if (slide != null) { o.frequency.setValueAtTime(hz(slide), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .07); }
    if (vib) { const l = this.osc('sine', 5.6, t + .12, end), lg = this.ctx.createGain(); lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); }
    const f = this.flt('lowpass', cut, .8), e = this.env(t, .012, .06, .75, .09, dur, v); o.connect(f); f.connect(e); this.send(e, { rev, dly });
  }
  flute(t, m, dur, { v = .2, rev = .4, dly = .2 } = {}) {
    const end = t + dur + .2, o = this.osc('sine', hz(m), t, end), l = this.osc('sine', 5, t + .15, end), lg = this.ctx.createGain(); lg.gain.value = 14; l.connect(lg); lg.connect(o.detune);
    o.frequency.setValueAtTime(hz(m - 1), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + .08);
    const n = this.noise(t, end), bp = this.flt('bandpass', hz(m) * 2, 3), ng = this.ctx.createGain(); ng.gain.value = .05;
    const e = this.env(t, .05, .1, .8, .14, dur, v); o.connect(e); n.connect(bp); bp.connect(ng); ng.connect(e); this.send(e, { rev, dly });
  }
  bell(t, m, dur = 1.2, { v = .14, rev = .4, dly = .25 } = {}) {
    const f = hz(m), end = t + dur + .1, g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    [[1, 1], [2.76, .38], [5.4, .14]].forEach(([r, a]) => { const o = this.osc('sine', f * r, t, end), pg = this.ctx.createGain(); pg.gain.setValueAtTime(a, t); pg.gain.exponentialRampToValueAtTime(a * .01 + .0001, t + dur * (1 / r + .15)); o.connect(pg); pg.connect(g); });
    this.send(g, { rev, dly });
  }
  gamelan(t, m, dur = 1.4, { v = .17, rev = .36 } = {}) {
    const f = hz(m), end = t + dur + .1, g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    [[1, 1, 0], [1.006, .8, 0], [2.4, .35, 0], [3.76, .16, 0], [6.1, .08, 0]].forEach(([r, a]) => { const o = this.osc('sine', f * r, t, end), pg = this.ctx.createGain(); pg.gain.value = a; o.connect(pg); pg.connect(g); });
    this.send(g, { rev, dly: .08 });
  }
  /** Plucked string by Karplus-Strong, precomputed per pitch. Sounds far more like a real guitar than an oscillator. */
  string(t, m, { v = .4, dark = .5, dur = 1.6, pan = 0, rev = .14 } = {}) {
    const key = m + ':' + dark;
    let b = this.kitCache.get(key);
    if (!b) {
      const f = hz(m), N = Math.max(2, Math.round(SR / f)), len = SR * 2 | 0; b = this.ctx.createBuffer(1, len, SR); const x = b.getChannelData(0), buf = new Float32Array(N);
      const rr = rng(m * 37 + 11); for (let i = 0; i < N; i++) buf[i] = rr() * 2 - 1;
      let lp = 0; for (let i = 0; i < N; i++) { lp += (buf[i] - lp) * .6; buf[i] = lp; }
      let idx = 0; const damp = .5 - dark * .02, loss = .9955 + (60 - Math.min(60, Math.abs(m - 60))) * .00002;
      for (let i = 0; i < len; i++) { const nx = (idx + 1) % N, s = (buf[idx] * (1 - damp) + buf[nx] * damp) * loss; x[i] = buf[idx]; buf[idx] = s; idx = nx; }
      this.kitCache.set(key, b);
    }
    const s = this.ctx.createBufferSource(); s.buffer = b; const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .08); s.start(t); s.stop(t + dur + .1);
    const p = this.pan(pan); s.connect(g); g.connect(p); this.send(p, { rev });
  }
  strum(t, notes, { down = true, v = .3, gap = .012, dur = 1.2 } = {}) { (down ? notes : [...notes].reverse()).forEach((m, i) => this.string(t + i * gap, m, { v: v * (.85 + (i / notes.length) * .3), dur, pan: (i / notes.length - .5) * .35 })); }
  powerchord(t, m, dur, { v = .13 } = {}) {
    const w = this.ctx.createWaveShaper(), cv = new Float32Array(2048); for (let i = 0; i < 2048; i++) { const x = i / 1024 - 1; cv[i] = Math.tanh(x * 7); } w.curve = cv; w.oversample = '2x';
    const f = this.flt('lowpass', 3200, .7), hp = this.flt('highpass', 110), g = this.env(t, .004, .05, .85, .05, dur, v), end = t + dur + .1;
    for (const n of [m, m + 7, m + 12]) for (const d of [-8, 8]) { const o = this.osc('sawtooth', hz(n), t, end, d); o.connect(w); }
    w.connect(hp); hp.connect(f); f.connect(g); this.send(g, { rev: .1 });
  }
  riser(t, dur, v = .16) { const n = this.noise(t, t + dur), f = this.flt('bandpass', 400, 1.1); f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(9000, t + dur); const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + .02); n.connect(f); f.connect(g); this.send(g, { rev: .3, bus: this.master }); }
  impact(t, v = .8) { const o = this.osc('sine', 90, t, t + 1.6); o.frequency.exponentialRampToValueAtTime(30, t + .9); const g = this.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5); o.connect(g); this.send(g, { rev: .4, bus: this.master }); const n = this.noise(t, t + .9), f = this.flt('lowpass', 1800); const ng = this.ctx.createGain(); ng.gain.setValueAtTime(v * .3, t); ng.gain.exponentialRampToValueAtTime(0.001, t + .8); n.connect(f); f.connect(ng); this.send(ng, { rev: .5, bus: this.master }); }
  vinyl(t0, end) { const n = this.noise(t0, end), f = this.flt('bandpass', 3200, .4), g = this.ctx.createGain(); g.gain.value = .011; n.connect(f); f.connect(g); g.connect(this.master); for (let t = t0 + .1; t < end; t += .3 + this.r() * 1.3) { const c = this.noise(t, t + .006), cg = this.ctx.createGain(); cg.gain.value = .05 + this.r() * .09; c.connect(cg); cg.connect(this.master); } }
}

/* ---------- harmony ---------- */
function harmony(tr) {
  const root = 48 + NOTE[tr.key];
  const scale = SCALES[tr.mode] || SCALES.maj;
  const seven = scale.length === 7 ? scale : (['pent'].includes(tr.mode) ? SCALES.maj : SCALES.min);
  const degree = (d, oct = 0) => { const n = seven.length, o = Math.floor(d / n), i = ((d % n) + n) % n; return root + seven[i] + 12 * (o + oct); };
  const chord = (d, oct = 1, size = 3) => { const out = []; for (let i = 0; i < size; i++) out.push(degree(d + i * 2, oct)); return out; };
  const inScale = (m) => { const s = ((m - root) % 12 + 12) % 12; return scale.includes(s); };
  const melodic = (m, dir = 1) => { let x = m; while (!inScale(x)) x += dir; return x; };
  return { root, scale, degree, chord, melodic, prog: PROG[tr.prog] };
}

/** A short rhythmic motif on chord tones, repeated with small changes: what makes a tune feel like a tune. */
function melody(r, H, bars, stepsPerBar, density) {
  const motif = [];
  for (let s = 0; s < stepsPerBar * 2; s++) if ((s % (stepsPerBar / 4) === 0 ? r() < .7 : r() < .32) * 1 && r() < density + .2) motif.push({ s, jump: r.int(-2, 2), len: r() < .25 ? 3 : r() < .6 ? 2 : 1 });
  if (!motif.length) motif.push({ s: 0, jump: 0, len: 2 });
  const out = [];
  let prev = H.degree(0, 2);
  for (let bar = 0; bar < bars; bar += 2) {
    const deg = H.prog[(bar / 2 * 2) % H.prog.length], ch = H.chord(deg, 2, 3), ch2 = H.chord(H.prog[(bar / 2 * 2 + 1) % H.prog.length], 2, 3);
    const varied = bar % 8 === 6;
    for (const n of motif) {
      if (varied && r() < .3) continue;
      const pool = n.s < stepsPerBar ? ch : ch2;
      let m;
      if (n.s % (stepsPerBar / 4) === 0) { m = pool.reduce((a, b) => (Math.abs(b - prev) < Math.abs(a - prev) ? b : a)); m += n.jump === 2 ? 12 * (m < 72 ? 1 : 0) : 0; } else m = H.melodic(prev + n.jump * 2, n.jump >= 0 ? 1 : -1);
      if (m > 84) m -= 12; if (m < 62) m += 12;
      prev = m;
      out.push({ bar: bar + Math.floor(n.s / stepsPerBar), step: n.s % stepsPerBar, m, len: n.len });
    }
  }
  return out;
}

/** The song's shape in bars: which layers play where. */
function sections(tr, barSec) {
  const total = Math.max(16, Math.round(tr.len / barSec / 4) * 4);
  const list = [];
  const push = (kind, bars) => { const left = total - list.reduce((a, s) => a + s.bars, 0); if (left > 0) list.push({ kind, bars: Math.min(bars, left) }); };
  push('intro', 4); push('verse', 8); push('chorus', 8); push('break', 4); push('verse', 8); push('chorus', 8); push('chorus', 8);
  while (list.reduce((a, s) => a + s.bars, 0) < total - 4) { push('verse', 4); push('chorus', 8); }
  const used = list.reduce((a, s) => a + s.bars, 0);
  if (used < total) list.push({ kind: 'outro', bars: total - used });
  else list[list.length - 1].kind = 'outro';
  const bars = [];
  list.forEach((s) => { for (let i = 0; i < s.bars; i++) bars.push({ kind: s.kind, i, of: s.bars, last: i === s.bars - 1 }); });
  return bars;
}

/* ---------- genres: each plays one bar ---------- */
const GENRE = {
  Pop(b, t, bar, H, ctx) {
    const { kind, last } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), full = kind === 'chorus';
    if (kind !== 'intro' && kind !== 'break') { for (let i = 0; i < 4; i++) { if (i % 2 === 0 || (full && i === 3 && ctx.barI % 2)) b.kick(t + i * beat, .9); if (i % 2) b.clap(t + i * beat, .55); } for (let i = 0; i < 8; i++) b.hat(t + i * step * 2, i % 2 ? .22 : .12); }
    if (kind !== 'intro') for (const [s, l] of [[0, 2.5], [3, .5], [4, 1.5], [6, 1]]) b.bass(t + s * step * 2, H.degree(ctx.deg, -1), l * step * 2, { type: 'triangle', cut: 800, v: .5 });
    for (let i = 0; i < 4; i++) b.ekeys(t + i * beat, ch[i % 3] + (i === 3 ? 12 : 0), beat * .9, { v: .16 });
    b.pad(t, ch, beat * 4, { v: full ? .075 : .05, cut: 1400 });
    if (full && last) b.riser(t + beat * 2, beat * 2, .1);
  },
  EDM(b, t, bar, H, ctx) {
    const { kind, i, of, last } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), drop = kind === 'chorus';
    if (kind === 'break') { b.pad(t, ch, beat * 4, { v: .09, cut: 700 + (i / of) * 3000 }); for (let s = 0; s < 8; s++) b.pluck(t + s * step * 2, ch[s % 3] + 12, step * 2, { v: .13, cut: 2000 }); if (last) { b.riser(t, beat * 4, .18); for (let s = 0; s < 16; s++) b.snare(t + s * step, .07 + s * .018, { rev: 0, d: .07 }); } return; }
    if (kind !== 'intro') for (let s = 0; s < 4; s++) { b.kick(t + s * beat, 1, { d: .26 }); b.duck(t + s * beat, drop ? .72 : .4); }
    if (drop) { b.clap(t + beat, .6); b.clap(t + beat * 3, .6); for (let s = 0; s < 4; s++) b.hat(t + s * beat + beat / 2, .3, true); for (const s of [0, 3, 6, 8, 11, 14]) b.supersaw(t + s * step, ch, step * 2.2, { v: .05 }); for (let s = 0; s < 4; s++) b.bass(t + s * beat + beat / 2, H.degree(ctx.deg, -1), beat * .45, { v: .5, cut: 700 }); }
    else { if (kind !== 'intro') for (let s = 0; s < 16; s++) if (s % 2) b.hat(t + s * step, .14); b.pad(t, ch, beat * 4, { v: .06, cut: 1100 }); for (const s of [0, 3, 6, 9, 12, 14]) b.pluck(t + s * step, ch[(s >> 1) % 3] + 12, .22, { v: .16 }); }
    if (last && kind !== 'intro' && kind !== 'outro') b.riser(t + beat * 2, beat * 2, .12);
    if (i === 0 && drop) b.impact(t, .5);
  },
  'Lo-fi'(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, sw = step * .32, ch = H.chord(ctx.deg, 1, 4);
    ch.forEach((m, i) => b.ekeys(t + i * .018, m, beat * 1.8, { v: .13, cut: 1000, rev: .2, trem: 3.2 }));
    ch.slice(1).forEach((m, i) => b.ekeys(t + beat * 2.5 + i * .018, m, beat, { v: .1, cut: 900, trem: 3.2 }));
    if (kind !== 'intro') {
      for (const s of [0, 2.5]) b.kick(t + s * beat, .62, { f0: 110, f1: 46, d: .24 });
      b.snare(t + beat, .3, { d: .13, tone: 170, rev: .08 }); b.snare(t + beat * 3, .3, { d: .13, tone: 170, rev: .08 });
      for (let s = 0; s < 8; s++) b.hat(t + s * step * 2 + (s % 2 ? sw : 0), s % 2 ? .1 : .16);
      b.bass(t, H.degree(ctx.deg, -1), beat * 1.5, { type: 'sine', cut: 500, v: .46 }); b.bass(t + beat * 2.5, H.degree(ctx.deg + 4, -1), beat, { type: 'sine', cut: 500, v: .36 });
    }
  },
  Sinematik(b, t, bar, H, ctx) {
    const { kind, i, last } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), big = kind === 'chorus';
    b.strings(t, ch, beat * 4, { v: big ? .085 : .05 }); b.strings(t, [H.degree(ctx.deg, -1)], beat * 4, { v: big ? .1 : .05, a: .6 });
    for (let s = 0; s < 8; s++) b.piano(t + s * step * 2, ch[[0, 1, 2, 1][s % 4]] + 12, beat * .5, { v: big ? .14 : .18, rev: .4 });
    if (big) { b.taiko(t, 1); b.taiko(t + beat * 1.5, .6); b.taiko(t + beat * 2.5, .7); b.taiko(t + beat * 3, .85); for (let s = 0; s < 8; s++) b.hat(t + s * step * 2, .07); b.brass(t, ch, beat * 2.8, { v: .07 }); }
    else if (kind === 'verse') { b.taiko(t, .5); if (i % 2) b.taiko(t + beat * 2.5, .35); }
    if (last && kind !== 'intro') b.riser(t, beat * 4, .1);
    if (i === 0 && big) b.impact(t, .6);
  },
  'Hip-hop'(b, t, bar, H, ctx) {
    const { kind, last } = bar, { beat, step } = ctx, r = ctx.r, m = H.degree(ctx.deg, -2) + 12;
    if (kind !== 'intro') {
      b.b808(t, m, beat * 1.4, { glide: 0 }); b.b808(t + beat * 1.75, m, beat * .7); b.b808(t + beat * 3, m + (ctx.barI % 4 === 3 ? 3 : 0), beat * .9, { glide: ctx.barI % 2 ? -2 : 0 });
      b.kick(t, .7, { d: .14 }); b.kick(t + beat * 1.75, .55, { d: .14 });
      b.clap(t + beat, .6, .12); b.clap(t + beat * 3, .6, .12);
      for (let s = 0; s < 16; s += 2) { b.hat(t + s * step * .5 * 2 * .5 * 2, .16); }
      if (ctx.barI % 2) for (let s = 0; s < 6; s++) b.hat(t + beat * 2.5 + s * step / 3, .07 + s * .02);
      if (r() < .4) b.hat(t + beat * 2 + step, .25, true);
    }
    const ch = H.chord(ctx.deg, 1, 3);
    for (const [s, n] of [[0, 2], [3, 1], [6, 0], [8, 2], [11, 1], [14, 0]]) b.bell(t + s * step, ch[n] + 12, .8, { v: .1 });
    b.pad(t, ch, beat * 4, { v: .035, cut: 800 });
    if (last && kind === 'chorus') b.riser(t + beat * 3, beat, .08);
  },
  Akustik(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 0, 3), bassN = H.degree(ctx.deg, -1), set = [bassN, ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12];
    const pat = [[0, 1], [2, 1], [3, 0], [5, 0], [6, 1]];
    for (const [s, d] of pat) b.strum(t + s * beat / 2, set, { down: !!d, v: d ? .26 : .18, dur: beat * 1.2 });
    if (kind === 'chorus' || kind === 'verse') { b.kick(t, .5, { f0: 100, d: .18 }); b.kick(t + beat * 2, .42, { f0: 100, d: .18 }); b.clap(t + beat, .28, .2); b.clap(t + beat * 3, .28, .2); for (let s = 0; s < 8; s++) b.shaker(t + s * step * 2, s % 2 ? .1 : .16); }
    if (kind === 'chorus') { b.bass(t, bassN, beat * 2, { type: 'triangle', cut: 500, v: .36 }); b.bass(t + beat * 2, H.degree(ctx.deg + 4, -1), beat * 2, { type: 'triangle', cut: 500, v: .3 }); }
  },
  Korporat(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), up = kind === 'chorus';
    for (let s = 0; s < 8; s++) b.piano(t + s * step * 2, ch[[0, 2, 1, 2][s % 4]] + (s % 4 === 2 ? 12 : 0), beat * .45, { v: .17, rev: .2 });
    for (let s = 0; s < 16; s++) if (s % 4 !== 0) b.pluck(t + s * step, ch[s % 3] + 12, .14, { v: up ? .09 : .06, cut: 2200, rev: .1 });
    if (kind !== 'intro') { for (let s = 0; s < 4; s++) { if (up || s % 2 === 0) b.kick(t + s * beat, .55, { f0: 120 }); if (s % 2) b.clap(t + s * beat, .34); } for (let s = 0; s < 8; s++) b.shaker(t + s * step * 2, .1); b.bass(t, H.degree(ctx.deg, -1), beat * 3.6, { type: 'triangle', cut: 600, v: .36 }); }
    if (up) b.strings(t, ch, beat * 4, { v: .05, a: .15 });
  },
  Ambient(b, t, bar, H, ctx) {
    const { beat } = ctx, ch = H.chord(ctx.deg, 0, 4), r = ctx.r;
    b.pad(t, ch, beat * 4, { v: .07, cut: 900, a: beat, r: beat * 1.5, rev: .7, type: 'triangle' });
    b.pad(t, [H.degree(ctx.deg, -1)], beat * 4, { v: .1, cut: 400, a: beat, r: beat, type: 'sine', rev: .5 });
    for (let s = 0; s < 3; s++) if (r() < .55) b.bell(t + r.int(0, 7) * beat / 2, ch[r.int(0, 3)] + 24, 3, { v: .05, rev: .8, dly: .4 });
  },
  Funk(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, deg = H.degree(ctx.deg, -1), ch = H.chord(ctx.deg, 1, 4);
    for (const [s, n, l] of [[0, 0, 1.5], [3, 0, .7], [4, 12, .7], [6, 0, 1], [8, 7, 1], [10, 10, .7], [11, 12, .7], [12, 0, 1], [14, 3, 1]]) b.bass(t + s * step, deg + n, l * step, { type: 'square', cut: 950, v: .34 });
    if (kind !== 'intro') { for (const s of [0, 6, 10]) b.kick(t + s * step, .8); b.snare(t + beat, .55, { d: .13 }); b.snare(t + beat * 3, .55, { d: .13 }); for (let s = 0; s < 16; s++) b.hat(t + s * step, s % 4 === 2 ? .24 : .09, s % 8 === 2); }
    for (const s of [2, 5, 7, 10, 13, 15]) ch.slice(1).forEach((m, i) => b.string(t + s * step + i * .004, m + 12, { v: .17, dur: step * .55, rev: .05 }));
    if (kind === 'chorus') for (const [s, n] of [[0, 0], [3, 0], [6, 1], [12, 2]]) b.brass(t + s * step, [ch[n] + 12, ch[n + 1] + 12], step * 1.3, { v: .07 });
  },
  House(b, t, bar, H, ctx) {
    const { kind, last } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 4), full = kind === 'chorus';
    if (kind !== 'break' && kind !== 'intro') for (let s = 0; s < 4; s++) { b.kick(t + s * beat, .95, { d: .22 }); b.duck(t + s * beat, .45); }
    if (kind !== 'intro') { for (let s = 0; s < 4; s++) b.hat(t + s * beat + beat / 2, .28, true); if (kind !== 'break') { b.clap(t + beat, .5); b.clap(t + beat * 3, .5); for (let s = 0; s < 16; s++) if (s % 2) b.shaker(t + s * step, .08); } }
    for (const s of [0, 3, 6, 11, 14]) b.stab(t + s * step, ch, .14, { v: full ? .085 : .06, cut: 2200 });
    if (kind !== 'break' && kind !== 'intro') for (const s of [2, 5, 8, 10, 13]) b.bass(t + s * step, H.degree(ctx.deg, -1) + (s === 13 ? 12 : 0), step * 1.2, { v: .42, cut: 600 });
    if (last && kind !== 'outro') b.riser(t + beat * 2, beat * 2, .08);
  },
  Phonk(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, m = H.degree(ctx.deg, -2) + 12, ch = H.chord(ctx.deg, 1, 3);
    for (const [s, d] of [[0, 0], [3, 0], [6, 2], [8, 0], [10, 3], [12, 2], [14, -1]]) b.cowbell(t + s * step, H.degree(ctx.deg + d, 2));
    if (kind !== 'intro' && kind !== 'break') {
      b.b808(t, m, beat * 1.2, { drive: .9, v: .6 }); b.b808(t + beat * 1.5, m, beat * .4, { drive: .9, v: .55 }); b.b808(t + beat * 2.5, m + 3, beat * 1.2, { drive: .9, v: .6 });
      b.kick(t, .7, { d: .12 }); b.kick(t + beat * 1.5, .5, { d: .1 }); b.kick(t + beat * 2.5, .6, { d: .1 });
      b.snare(t + beat, .6, { d: .12, tone: 230, rev: 0 }); b.snare(t + beat * 3, .6, { d: .12, tone: 230, rev: 0 });
      for (let s = 0; s < 16; s++) b.hat(t + s * step, s % 2 ? .1 : .17);
    } else b.pad(t, ch, beat * 4, { v: .05, cut: 600 });
  },
  Nusantara(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, r = ctx.r, s0 = H.root + 12, sc = H.scale;
    const pick = (o) => s0 + sc[((o % sc.length) + sc.length) % sc.length] + 12 * Math.floor(o / sc.length);
    const pat = ctx.colot;
    pat.forEach((o, i) => b.gamelan(t + i * beat / 2, pick(o + ctx.deg) + 12, 1.1, { v: .11 }));
    b.gamelan(t, pick(ctx.deg) - 12, 3, { v: .22, rev: .5 });
    if (ctx.barI % 2) b.gamelan(t + beat * 2, pick(ctx.deg + 2) - 12, 2.2, { v: .13 });
    if (kind !== 'intro') for (let s = 0; s < 16; s++) { const pk = [0, -1, 2, 2, 1, -1, 2, 0, 0, 2, 1, 2, 3, -1, 2, 2][s]; if (pk >= 0) b.kendang(t + s * step, pk, pk === 3 ? .6 : .38); }
    if (kind === 'chorus' || kind === 'break') { const notes = [0, 2, 3, 1]; notes.forEach((n, i) => { if (r() < .8) b.flute(t + i * beat, pick(n + ctx.deg) + 12, beat * .9, { v: .13 }); }); }
    b.pad(t, [pick(ctx.deg) - 12], beat * 4, { v: .05, cut: 500, type: 'sine' });
  },
  Koplo(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, r = ctx.r, m = H.degree(ctx.deg, -1), ch = H.chord(ctx.deg, 1, 3);
    if (kind !== 'intro') {
      const pat = [[0, 3], [3, 0], [4, 2], [6, 1], [7, 2], [8, 3], [10, 0], [11, 2], [12, 1], [14, 0], [15, 2]];
      for (const [s, k] of pat) b.kendang(t + s * step, k, k === 3 ? .7 : .46);
      for (let s = 0; s < 8; s++) b.hat(t + s * step * 2 + step, .14, false);
      b.kick(t, .5, { d: .14 }); b.kick(t + beat * 2, .4, { d: .14 });
      for (const [s, o] of [[0, 0], [3, 0], [6, 12], [8, 0], [11, 7], [14, 0]]) b.bass(t + s * step, m + o, step * 1.3, { type: 'square', cut: 800, v: .33 });
    }
    for (const s of [2, 6, 10, 14]) b.stab(t + s * step, ch, .1, { v: .07, cut: 2400, dly: 0 });
    const phrase = ctx.suling;
    phrase.forEach((o, i) => { if (o !== null && (kind === 'chorus' || kind === 'break' || r() < .7)) b.lead(t + i * step * 2, H.degree(ctx.deg + o, 2), step * 1.8, { v: .1, type: 'sawtooth', cut: 2000, vib: 22, slide: H.degree(ctx.deg + o, 2) - 1, dly: .14 }); });
  },
  Romantis(b, t, bar, H, ctx) {
    const { kind, last } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 0, 3);
    [H.degree(ctx.deg, -1), ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 24, ch[2] + 12].forEach((m, i) => b.piano(t + (i * beat * 4) / 6, m, beat * 1.5, { v: i ? .17 : .22, rev: .42 }));
    if (kind !== 'intro') b.strings(t, ch.map((m) => m + 12), beat * 4, { v: kind === 'chorus' ? .07 : .04, a: .7 });
    if (kind === 'chorus') { b.bass(t, H.degree(ctx.deg, -1), beat * 3.6, { type: 'sine', cut: 500, v: .28 }); b.kick(t, .22, { f0: 80, d: .2 }); b.kick(t + beat * 2, .18, { f0: 80, d: .2 }); }
    if (last) b.bell(t + beat * 2, ch[2] + 24, 2.2, { v: .05 });
  },
  Synthwave(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), m = H.degree(ctx.deg, -1);
    for (let s = 0; s < 16; s++) b.bass(t + s * step, m + (s % 8 === 7 ? 12 : 0), step * .75, { v: .32, cut: 780 });
    for (let s = 0; s < 16; s++) b.pluck(t + s * step, ch[[0, 1, 2, 1][s % 4]] + 12 + (s % 8 > 3 ? 12 : 0), .12, { v: .07, type: 'square', cut: 3000, dly: .22, rev: .1 });
    b.pad(t, ch, beat * 4, { v: .055, cut: 1700, rev: .55 });
    if (kind !== 'intro') { for (let s = 0; s < 4; s++) { if (s % 2 === 0) b.kick(t + s * beat, .85); else b.snare(t + s * beat, .7, { d: .32, rev: .5, tone: 170 }); } for (let s = 0; s < 8; s++) b.hat(t + s * step * 2, .14); }
  },
  Riang(b, t, bar, H, ctx) {
    const { kind } = bar, { beat, step } = ctx, ch = H.chord(ctx.deg, 1, 3), m = H.degree(ctx.deg, -1);
    b.bass(t, m, beat * .8, { type: 'sine', cut: 700, v: .44 }); b.bass(t + beat * 2, H.degree(ctx.deg + 4, -1), beat * .8, { type: 'sine', cut: 700, v: .4 });
    for (const s of [1, 3]) ch.forEach((n, i) => b.string(t + s * beat + i * .006, n + 12, { v: .22, dur: beat * .5, rev: .06 }));
    if (kind !== 'intro') { b.clap(t + beat, .3, .1); b.clap(t + beat * 3, .3, .1); for (let s = 0; s < 8; s++) b.shaker(t + s * step * 2, .1); b.kick(t, .4, { f0: 110 }); b.kick(t + beat * 2, .32, { f0: 110 }); }
  },
  Rock(b, t, bar, H, ctx) {
    const { kind, i } = bar, { beat, step } = ctx, m = H.degree(ctx.deg, -1), full = kind === 'chorus';
    if (kind === 'intro') { b.powerchord(t, m + 12, beat * 3.6, { v: .1 }); return; }
    for (const s of full ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 3, 6, 8, 11, 14]) b.powerchord(t + s * step, m + 12, step * (full ? 1.7 : 1.4), { v: full ? .1 : .085 });
    for (let s = 0; s < 8; s++) b.bass(t + s * step * 2, m, step * 1.7, { type: 'sawtooth', cut: 500, v: .34 });
    for (const s of [0, 6, 8, 11]) b.kick(t + s * step, .9, { f0: 130, d: .18 });
    b.snare(t + beat, .8, { d: .2, tone: 200, rev: .18 }); b.snare(t + beat * 3, .8, { d: .2, tone: 200, rev: .18 });
    for (let s = 0; s < 8; s++) b.hat(t + s * step * 2, full ? .22 : .15, full);
    if (i === bar.of - 1) { for (let s = 0; s < 4; s++) b.tom(t + beat * 3 + s * step, 170 - s * 26, .55); }
  },
};
const HAS_LEAD = { Pop: 'pluck', EDM: 'saw', Korporat: 'bell', Akustik: 'flute', Synthwave: 'saw', Funk: 'square', Riang: 'bell', Romantis: 'piano', 'Hip-hop': null };

const cache = new Map();
const pending = new Map();

/** Composes a song. Returns an AudioBuffer, cached for this visit. */
export function renderTrack(id) {
  if (cache.has(id)) return Promise.resolve(cache.get(id));
  if (pending.has(id)) return pending.get(id);
  const tr = trackById(id);
  if (!tr) return Promise.reject(new Error('Lagu tidak ada: ' + id));
  const job = (async () => {
    const beat = 60 / tr.bpm, step = beat / 4, barSec = beat * 4;
    const bars = sections(tr, barSec);
    const dur = bars.length * barSec + 2.5;
    const seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
    const r = rng(seed + 1), H = harmony(tr), kit = makeKit(seed);
    const fn = GENRE[tr.genre], lead = HAS_LEAD[tr.genre];
    const mel = melody(r, H, bars.length, 16, tr.genre === 'Pop' ? .55 : .45);
    const colot = Array.from({ length: 8 }, () => r.int(0, 4));
    const suling = Array.from({ length: 8 }, (_, i) => (i % 3 === 2 && r() < .4 ? null : r.int(0, 5)));

    // One audio graph for a whole song grows to thousands of nodes and renders slower with each one.
    // So every bar renders on its own, tail included, and equal bars are rendered once: that makes it fifty times faster.
    const TAIL = 2.6, chunkLen = Math.ceil((barSec + TAIL) * SR);
    const renderBar = async (bar, i, deg, notes, key) => {
      const ctx = new OfflineAudioContext(2, chunkLen, SR);
      const barSeed = (seed + [...key].reduce((a, c) => a * 33 + c.charCodeAt(0), 5)) >>> 0;
      const b = new Band(ctx, barSeed, kit);
      b.setDelay(beat * 0.75);
      const t = 0.02;
      if (tr.genre === 'Lo-fi') b.vinyl(t, t + barSec);
      fn(b, t, bar, H, { beat, step, deg, barI: i, r: rng(barSeed), colot, suling });
      for (const n of notes) {
        const nt = t + n.step * step, nd = n.len * step * 1.6;
        if (lead === 'pluck') b.pluck(nt, n.m, nd, { v: .15, cut: 2600 });
        else if (lead === 'saw') b.lead(nt, n.m, nd, { v: .08, type: 'sawtooth', cut: 2800, dly: .22 });
        else if (lead === 'bell') b.bell(nt, n.m, 1, { v: .09 });
        else if (lead === 'flute') b.flute(nt, n.m, nd, { v: .13 });
        else if (lead === 'square') b.lead(nt, n.m, nd, { v: .08, type: 'square', cut: 2200, vib: 10 });
        else if (lead === 'piano') b.piano(nt, n.m + 12, nd, { v: .12, rev: .45 });
      }
      return ctx.startRendering();
    };
    const plan = bars.map((bar, i) => {
      const deg = H.prog[i % H.prog.length];
      const notes = lead && (bar.kind === 'chorus' || (bar.kind === 'verse' && i % 2 === 1)) ? mel.filter((x) => x.bar === i) : [];
      const key = [bar.kind, bar.i, bar.of, deg, i % 4, notes.map((n) => n.step + ':' + n.m + ':' + n.len).join(',')].join('|');
      return { bar, i, deg, notes, key };
    });
    const unique = [...new Map(plan.map((p) => [p.key, p])).values()], done = new Map();
    const lanes = Math.min(6, Math.max(2, navigator.hardwareConcurrency || 4));
    let next = 0;
    await Promise.all(Array.from({ length: lanes }, async () => {
      while (next < unique.length) { const p = unique[next++]; done.set(p.key, await renderBar(p.bar, p.i, p.deg, p.notes, p.key)); }
    }));
    const total = Math.ceil(dur * SR), mix = [new Float32Array(total), new Float32Array(total)];
    plan.forEach((p) => {
      const b = done.get(p.key), at = Math.round(p.i * barSec * SR);
      for (let c = 0; c < 2; c++) { const src = b.getChannelData(c), out = mix[c], n = Math.min(src.length, total - at); for (let i = 0; i < n; i++) out[at + i] += src[i]; }
    });
    const whole = new AudioBuffer({ length: total, numberOfChannels: 2, sampleRate: SR });
    whole.copyToChannel(mix[0], 0); whole.copyToChannel(mix[1], 1);
    // Glue the bars together with one compressor over the finished mix.
    const post = new OfflineAudioContext(2, total, SR), src = post.createBufferSource(), comp = post.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 3; comp.attack.value = 0.008; comp.release.value = 0.16; comp.knee.value = 10;
    src.buffer = whole; src.connect(comp); comp.connect(post.destination); src.start();
    const buf = await post.startRendering();
    // Ease out at the very end, and make every song equally loud.
    let peak = 0, sum = 0, n = 0;
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i += 3) { const a = Math.abs(d[i]); if (a > peak) peak = a; sum += a * a; n++; } }
    const rms = Math.sqrt(sum / (n || 1));
    const g = Math.min(0.92 / (peak || 1), 0.17 / (rms || 1));
    const fadeFrom = total - 3 * SR;
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { let v = Math.tanh(d[i] * g * 1.05) * .98; if (i > fadeFrom) v *= Math.max(0, (total - i) / (3 * SR)); d[i] = v; } }
    cache.set(id, buf);
    pending.delete(id);
    return buf;
  })();
  pending.set(id, job);
  return job;
}

/* ---------- sound effects ---------- */
const S = (id, name, cat, len, f) => ({ id, name, cat, len, f });
const up = (o, a, b, t, d) => { o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d); };
export const SFX = [
  S('whoosh', 'Whoosh', 'Transisi', 1, (b) => { const n = b.noise(0, .9), f = b.flt('bandpass', 400, 1.4); f.frequency.setValueAtTime(300, 0); f.frequency.exponentialRampToValueAtTime(3200, .35); f.frequency.exponentialRampToValueAtTime(300, .85); const g = b.env(0, .3, .1, .6, .4, .3, .9); n.connect(f); f.connect(g); b.send(g, { rev: .2 }); }),
  S('swipe', 'Sapuan Cepat', 'Transisi', .5, (b) => { const n = b.noise(0, .3), f = b.flt('highpass', 800); f.frequency.setValueAtTime(600, 0); f.frequency.exponentialRampToValueAtTime(8000, .16); const g = b.env(0, .08, .05, .5, .12, .08, .7); n.connect(f); f.connect(g); b.send(g); }),
  S('swoosh', 'Swoosh Naik', 'Transisi', 1.3, (b) => { b.riser(0, 1.1, .7); }),
  S('impact', 'Hentakan', 'Transisi', 2, (b) => b.impact(0, 1)),
  S('boom', 'Boom', 'Transisi', 2.2, (b) => { b.impact(0, 1); b.taiko(0, 1); }),
  S('riser', 'Riser', 'Transisi', 2.4, (b) => { b.riser(0, 2.2, .7); const o = b.osc('sawtooth', 110, 0, 2.2); up(o, 110, 1400, 0, 2.2); const f = b.flt('lowpass', 1800), g = b.env(0, 1.6, .1, 1, .05, 2.1, .18); o.connect(f); f.connect(g); b.send(g, { rev: .2 }); }),
  S('drop', 'Jatuh', 'Transisi', 1.2, (b) => { const o = b.osc('sine', 1200, 0, 1); up(o, 1200, 70, 0, .9); const g = b.env(0, .01, .1, .9, .1, .85, .6); o.connect(g); b.send(g, { rev: .2 }); }),
  S('glitch', 'Glitch', 'Transisi', .6, (b) => { for (let i = 0; i < 9; i++) { const t = i * .05, o = b.osc('square', b.r() * 2400 + 200, t, t + .04), g = b.ctx.createGain(); g.gain.value = .24; o.connect(g); b.send(g); } }),
  S('pop', 'Pop', 'UI', .3, (b) => { const o = b.osc('sine', 400, 0, .16); up(o, 300, 900, 0, .07); const g = b.env(0, .004, .05, .3, .06, .06, .8); o.connect(g); b.send(g); }),
  S('click', 'Klik', 'UI', .2, (b) => { const n = b.noise(0, .02), f = b.flt('bandpass', 2600, 2), g = b.env(0, .001, .01, .1, .01, .005, 1.4); n.connect(f); f.connect(g); b.send(g); }),
  S('ding', 'Ding', 'UI', 1.5, (b) => b.bell(0, 88, 1.4, { v: .7, rev: .2, dly: 0 })),
  S('notif', 'Notifikasi', 'UI', 1, (b) => { b.bell(0, 83, .5, { v: .5, rev: .1, dly: 0 }); b.bell(.12, 88, .8, { v: .5, rev: .1, dly: 0 }); }),
  S('success', 'Sukses', 'UI', 1.2, (b) => [72, 76, 79, 84].forEach((m, i) => b.bell(i * .09, m, .8, { v: .42, rev: .2, dly: 0 }))),
  S('error', 'Salah', 'UI', .8, (b) => { for (const t of [0, .22]) { const o = b.osc('square', 150, t, t + .17), f = b.flt('lowpass', 900), g = b.env(t, .004, .02, .8, .02, .14, .4); o.connect(f); f.connect(g); b.send(g); } }),
  S('coin', 'Koin', 'UI', .6, (b) => { for (const [t, m] of [[0, 83], [.07, 88]]) { const o = b.osc('square', hz(m), t, t + .32), g = b.env(t, .002, .02, .6, .22, .08, .28); o.connect(g); b.send(g); } }),
  S('cash', 'Kasir', 'UI', 1, (b) => { [0, .05, .1].forEach((t, i) => b.bell(t, 91 + i * 2, .25, { v: .26, rev: 0, dly: 0 })); b.bell(.18, 96, .8, { v: .42, rev: .1, dly: 0 }); }),
  S('type', 'Mesin Tik', 'UI', 1.1, (b) => { for (let i = 0; i < 8; i++) { const t = i * .12 + b.r() * .04, n = b.noise(t, t + .02), f = b.flt('bandpass', 3400, 3), g = b.env(t, .001, .012, .1, .01, .004, 1.2); n.connect(f); f.connect(g); b.send(g); } }),
  S('shutter', 'Kamera', 'UI', .4, (b) => { for (const t of [0, .1]) { const n = b.noise(t, t + .05), f = b.flt('bandpass', 2600, 1), g = b.env(t, .001, .02, .2, .02, .02, 1); n.connect(f); f.connect(g); b.send(g); } }),
  S('tada', 'Tada', 'Lucu', 1.6, (b) => { [0, .12].forEach((t, i) => b.brass(t, i ? [72, 76, 79, 84] : [71, 74, 79], i ? 1.1 : .1, { v: .2 })); b.snare(.12, .6); }),
  S('boing', 'Boing', 'Lucu', .9, (b) => { const o = b.osc('sine', 200, 0, .8), l = b.osc('sine', 16, 0, .8), lg = b.ctx.createGain(); lg.gain.setValueAtTime(90, 0); lg.gain.linearRampToValueAtTime(4, .7); l.connect(lg); lg.connect(o.frequency); up(o, 180, 520, 0, .7); const g = b.env(0, .005, .1, .7, .1, .6, .6); o.connect(g); b.send(g); }),
  S('jump', 'Lompat', 'Lucu', .4, (b) => { const o = b.osc('square', 300, 0, .3); up(o, 240, 880, 0, .22); const g = b.env(0, .004, .05, .7, .05, .2, .24); o.connect(g); b.send(g); }),
  S('laser', 'Laser', 'Lucu', .5, (b) => { const o = b.osc('sawtooth', 1800, 0, .4); up(o, 1800, 140, 0, .34); const g = b.env(0, .004, .05, .6, .05, .28, .3); o.connect(g); b.send(g, { dly: .3 }); }),
  S('drumroll', 'Drum Roll', 'Lucu', 2.2, (b) => { for (let t = 0; t < 1.9; t += .05) b.snare(t, .12 + (t / 1.9) * .35, { d: .06, rev: 0 }); b.kick(1.95, 1); b.clap(1.95, .8); }),
  S('applause', 'Tepuk Tangan', 'Suasana', 3, (b) => { for (let i = 0; i < 180; i++) { const t = b.r() * 2.6, v = (1 - t / 3) * (.1 + b.r() * .2); const n = b.noise(t, t + .03), f = b.flt('bandpass', 1400 + b.r() * 1800, 1.2), g = b.ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + .025); n.connect(f); f.connect(g); b.send(g, { rev: .3 }); } }),
  S('thunder', 'Petir', 'Suasana', 3.5, (b) => { const n = b.noise(0, 3.4), f = b.flt('lowpass', 500), g = b.ctx.createGain(); g.gain.setValueAtTime(.001, 0); g.gain.exponentialRampToValueAtTime(1, .05); g.gain.exponentialRampToValueAtTime(.35, .5); g.gain.linearRampToValueAtTime(.6, .9); g.gain.exponentialRampToValueAtTime(.001, 3.3); n.connect(f); f.connect(g); b.send(g, { rev: .4 }); }),
  S('heart', 'Detak Jantung', 'Suasana', 2, (b) => { for (const t of [0, 1]) { b.kick(t, .9, { f0: 70, f1: 40, d: .18 }); b.kick(t + .24, .7, { f0: 65, f1: 38, d: .16 }); } }),
  S('sparkle', 'Kilau', 'Suasana', 1.6, (b) => { for (let i = 0; i < 9; i++) b.bell(i * .07, 88 + b.int?.(0, 8) || 88 + Math.floor(b.r() * 12), .6, { v: .18, rev: .4, dly: .2 }); }),
  S('rainamb', 'Hujan', 'Suasana', 5, (b) => { const n = b.noise(0, 5), f = b.flt('highpass', 1200), g = b.env(0, .5, .1, 1, .6, 4, .22); n.connect(f); f.connect(g); b.send(g); }),
];
const sfxCache = new Map();
export const sfxById = (id) => SFX.find((s) => s.id === id);
export async function renderSfx(id) {
  if (sfxCache.has(id)) return sfxCache.get(id);
  const s = sfxById(id);
  if (!s) throw new Error('Efek suara tidak ada');
  const ctx = new OfflineAudioContext(2, Math.ceil((s.len + .6) * SR), SR);
  const b = new Band(ctx, [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 3) >>> 0);
  b.setDelay(.12);
  s.f(b);
  const buf = await ctx.startRendering();
  sfxCache.set(id, buf);
  return buf;
}
