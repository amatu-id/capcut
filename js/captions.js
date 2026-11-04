// Subtitles: speech recognition on this device (Whisper in a worker), plus SRT files in and out.
import { h, icon, modal, toast, pickFiles, download, fmtTime } from './util.js';
import { editor } from './store.js';
import { getAudio, getMedia } from './media.js';
import { hasAudio, makeTextClip, placeClip, projectDur } from './model.js';
import { TEXT_PRESETS } from './text.js';
import { renderMix } from './audio.js';
import * as A from './actions.js';

const LANGS = [['indonesian', 'Indonesia'], ['english', 'Inggris'], ['javanese', 'Jawa'], ['malay', 'Melayu'], ['chinese', 'Mandarin'], ['japanese', 'Jepang'], ['korean', 'Korea'], ['arabic', 'Arab'], ['', 'Deteksi otomatis']];
const presets = () => TEXT_PRESETS.filter((p) => p.cat === 'Subtitel');
let worker = null;

/** Turns word timings into lines short enough to read. */
function linesFromWords(words, maxChars = 34, maxGap = 0.55) {
  const out = []; let cur = null;
  for (const w of words) {
    const text = (w.text || '').trim();
    if (!text) continue;
    const [a, b] = w.timestamp;
    if (cur && ((cur.text + ' ' + text).length > maxChars || a - cur.end > maxGap || /[.?!]$/.test(cur.text))) { out.push(cur); cur = null; }
    if (!cur) cur = { start: a, end: b ?? a + .3, text };
    else { cur.text += ' ' + text; cur.end = b ?? cur.end + .3; }
  }
  if (cur) out.push(cur);
  return out;
}

export function addCaptionClips(lines, presetId = 'caption', offset = 0) {
  const P = editor.project, preset = TEXT_PRESETS.find((p) => p.id === presetId)?.o || {};
  const y = P.h > P.w ? 0.28 : 0.36;
  let n = 0;
  for (const l of lines) {
    const dur = Math.max(0.3, l.end - l.start);
    const c = makeTextClip(offset + l.start, dur, { ...JSON.parse(JSON.stringify(preset)), text: l.text, name: l.text.slice(0, 24), caption: true });
    c.tf.y = y; c.maxW = .9;
    if (P.w > P.h) c.size = Math.round((c.size || 56) * 0.8);
    placeClip(P, c, 'text');
    n++;
  }
  editor.commit('captions');
  A.getPlayer().invalidate();
  return n;
}

async function speech16k(P) {
  const dur = projectDur(P);
  const mix = await renderMix(P, dur, 16000);
  if (!mix) return null;
  const a = mix.getChannelData(0), b = mix.getChannelData(1), m = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) m[i] = (a[i] + b[i]) / 2;
  return m;
}

export function autoCaptions() {
  const P = editor.project;
  const anySound = P.tracks.some((t) => t.clips.some((c) => hasAudio(c) && !c.muted && getMedia(c.media)?.hasAudio !== false && c.tag !== 'music' && c.tag !== 'sfx'));
  if (!anySound) return toast('Belum ada suara percakapan di linimasa.', 'bad');
  let lang = 'indonesian', preset = 'caption', model = 'base', busy = false;
  const status = h('p.muted'), bar = h('div.progress', h('i'));
  const go = h('button.btn.primary', { onclick: run }, icon('caption', 16), 'Buat subtitel');
  const selBox = (opts, val, on) => { const s = h('select.input', { onchange: () => on(s.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === val }, l))); return s; };
  const m = modal({
    title: 'Subtitel otomatis',
    onclose: () => { if (busy) { worker?.terminate(); worker = null; } },
    body: h('div.form',
      h('label', 'Bahasa', selBox(LANGS, lang, (v) => { lang = v; })),
      h('label', 'Ketelitian', selBox([['base', 'Teliti (unduh sekali, ±160 MB)'], ['tiny', 'Cepat (unduh sekali, ±75 MB)']], model, (v) => { model = v; })),
      h('label', 'Gaya', selBox(presets().map((p) => [p.id, p.name]), preset, (v) => { preset = v; })),
      h('p.note', 'Pengenalan suara berjalan di perangkat ini. Suara Anda tidak dikirim ke server mana pun. Model diunduh sekali, lalu tersimpan.'),
      bar, status),
    foot: [h('button.btn', { onclick: () => m.close() }, 'Tutup'), go],
  });
  const setP = (p, t) => { bar.firstChild.style.width = Math.round(p * 100) + '%'; if (t) status.textContent = t; };
  async function run() {
    busy = true; go.disabled = true;
    try {
      setP(0.02, 'Menyiapkan suara…');
      await Promise.all(P.tracks.flatMap((t) => t.clips.filter((c) => hasAudio(c)).map((c) => getAudio(c.media))));
      const pcm = await speech16k({ ...P, tracks: P.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.tag !== 'music' && c.tag !== 'sfx') })) });
      if (!pcm) throw new Error('Tidak ada suara untuk dikenali.');
      worker ||= new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
      const lines = await new Promise((res, rej) => {
        worker.onmessage = (e) => {
          const d = e.data;
          if (d.type === 'progress') setP(0.05 + d.p * 0.9, d.text);
          if (d.type === 'error') rej(new Error(d.error));
          if (d.type === 'captions') res(d.chunks);
        };
        worker.postMessage({ op: 'captions', pcm, language: lang, model }, [pcm.buffer]);
      });
      const n = addCaptionClips(linesFromWords(lines), preset);
      setP(1, n + ' baris subtitel ditambahkan.');
      toast(n + ' baris subtitel ditambahkan');
      busy = false;
      m.close();
    } catch (e) {
      busy = false; go.disabled = false;
      status.textContent = 'Gagal: ' + e.message;
    }
  }
}

const parseTime = (s) => { const m = s.trim().replace(',', '.').match(/(\d+):(\d+):(\d+(?:\.\d+)?)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0; };
export function parseSrt(txt) {
  const out = [];
  for (const block of txt.replace(/\r/g, '').split(/\n\s*\n/)) {
    const lines = block.trim().split('\n'), i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const text = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
    if (text) out.push({ start: parseTime(a), end: parseTime(b), text });
  }
  return out;
}
export async function importSrt() {
  const [f] = await pickFiles('.srt,.vtt,text/plain', false);
  if (!f) return;
  const lines = parseSrt(await f.text());
  if (!lines.length) return toast('Berkas subtitel kosong atau tidak dikenali.', 'bad');
  toast(addCaptionClips(lines, 'caption', 0) + ' baris subtitel diimpor');
}
const srtTime = (t) => { const ms = Math.round((t % 1) * 1000), s = Math.floor(t); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')},${String(ms).padStart(3, '0')}`; };
export function exportSrt() {
  const P = editor.project, list = [];
  for (const t of P.tracks) for (const c of t.clips) if (c.kind === 'text') list.push(c);
  if (!list.length) return toast('Belum ada teks untuk diekspor.', 'bad');
  list.sort((a, b) => a.start - b.start);
  const s = list.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.dur)}\n${c.text}\n`).join('\n');
  download(new Blob([s], { type: 'text/plain' }), (P.name || 'subtitel') + '.srt');
  void fmtTime;
}
