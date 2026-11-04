// Every edit the toolbar, the panels and the keyboard can ask for, in one place.
import { editor } from './store.js';
import { importFile, getMedia, getAudio, ACCEPT_VISUAL, ACCEPT_AUDIO } from './media.js';
import {
  makeVideoClip, makeImageClip, makeAudioClip, makeTextClip, makeStickerClip, makeFxClip, makeFilterClip, makeAdjustClip, placeClip, mainTrack, normalizeMain, splitClip, isSrcTimed, setSpeed, projectDur, isVisual, dropEmptyTracks, srcAt, makeColorClip, findClip, propValue, fits,
} from './model.js';
import { clone, uid, toast, pickFiles, clamp } from './util.js';
import { ensureFont } from './text.js';

let player = null;
export const bindPlayer = (p) => { player = p; };
export const getPlayer = () => player;
const P = () => editor.project;
const now = () => player.t;
const commit = (l) => { editor.commit(l); player.refresh(); };

/** Puts media on the timeline: main track when `where` says so, otherwise as an overlay at the playhead. */
export async function addToTimeline(m, where = 'main') {
  if (m.type === 'audio') return addAudio(m);
  const main = mainTrack(P());
  if (where === 'main') {
    const c = m.type === 'video' ? makeVideoClip(m) : makeImageClip(m, 0, 3);
    // Insert after the clip under the playhead, like a video editor does; at the end when the playhead is at the end.
    let idx = main.clips.length;
    for (let i = 0; i < main.clips.length; i++) { const k = main.clips[i]; if (now() < k.start + k.dur - 1e-3) { idx = i + 1; break; } }
    main.clips.splice(idx, 0, c);
    normalizeMain(P());
    editor.select(c.id);
    player.seek(c.start);
    commit('add');
    return c;
  }
  const c = m.type === 'video' ? makeVideoClip(m, now()) : makeImageClip(m, now(), 4);
  c.tf.s = 0.5;
  placeClip(P(), c, 'overlay');
  editor.select(c.id);
  commit('overlay');
  return c;
}
export async function addAudio(m, at = now()) {
  if (m.virtual) await getAudio(m.id);
  const c = makeAudioClip(m, at);
  // A song usually outlasts the video. It stops with the picture and fades out; dragging its edge brings the rest back.
  const end = P().tracks.filter((t) => t.kind !== 'audio' && t.kind !== 'fx').flatMap((t) => t.clips).reduce((x, k) => Math.max(x, k.start + k.dur), 0);
  if (m.tag === 'music' && end > at + 0.5 && c.dur > end - at) { c.dur = c.len = end - at; c.fadeOut = Math.min(1.5, c.dur * 0.2); }
  placeClip(P(), c, 'audio');
  editor.select(c.id);
  commit('audio');
  return c;
}
export function addText(over = {}) {
  const c = makeTextClip(now(), 3, over);
  placeClip(P(), c, 'text');
  ensureFont(c, () => player.invalidate());
  editor.select(c.id);
  commit('text');
  return c;
}
export function addSticker(st) {
  const c = makeStickerClip(st, now(), 3);
  placeClip(P(), c, 'text');
  editor.select(c.id);
  commit('sticker');
  return c;
}
export function addEffect(fx) {
  const c = makeFxClip(fx, now(), Math.max(1, Math.min(3, projectDur(P()) - now() || 3)));
  placeClip(P(), c, 'fx'); editor.select(c.id); commit('effect'); return c;
}
export function addFilter(f) {
  const c = makeFilterClip(f, now(), Math.max(1, Math.min(5, projectDur(P()) - now() || 3)));
  placeClip(P(), c, 'fx'); editor.select(c.id); commit('filter'); return c;
}
export function addAdjust() {
  const c = makeAdjustClip(now(), Math.max(1, Math.min(5, projectDur(P()) - now() || 3)));
  placeClip(P(), c, 'fx'); editor.select(c.id); commit('adjust'); return c;
}
export function addColor(color, color2) {
  const c = makeColorClip(color, 0, 3, color2);
  const main = mainTrack(P());
  let idx = main.clips.length;
  for (let i = 0; i < main.clips.length; i++) { const k = main.clips[i]; if (now() < k.start + k.dur - 1e-3) { idx = i + 1; break; } }
  main.clips.splice(idx, 0, c); normalizeMain(P()); editor.select(c.id); player.seek(c.start); commit('color');
}

export async function importFiles(files, { add = false, where = 'main' } = {}) {
  const out = [];
  const big = files.length > 1 || files.some((f) => f.size > 8e7);
  const note = big ? toast('Mengimpor ' + files.length + ' berkas…', '', 60000) : null;
  for (const f of files) {
    try {
      const m = await importFile(f);
      out.push(m);
      if (add) await addToTimeline(m, where);
    } catch (e) { toast(e.message || 'Gagal mengimpor ' + f.name, 'bad', 5000); }
  }
  note?.remove();
  return out;
}
export const pickVisual = async (o) => importFiles(await pickFiles(ACCEPT_VISUAL), o);
export const pickAudio = async (o) => {
  const files = await pickFiles(ACCEPT_AUDIO);
  const out = [];
  for (const f of files) {
    try {
      // A video picked here is used for its sound only.
      const vid = f.type.startsWith('video/') || /\.(mp4|mov|mkv|webm|m4v)$/i.test(f.name);
      const m = await importFile(f, vid ? { type: 'audio', salt: 'a', name: f.name.replace(/\.[^.]+$/, '') + ' (suara)' } : {});
      out.push(m);
      if (o?.add !== false) await addAudio(m);
    } catch (e) { toast(e.message, 'bad', 5000); }
  }
  return out;
};

const sel = () => editor.selected;

/** Clips under the playhead that the Split button acts on. */
export function splitAtPlayhead() {
  const t = now(), s = sel();
  const targets = [];
  if (s && t > s.clip.start && t < s.clip.start + s.clip.dur) targets.push(s);
  else for (const tr of P().tracks) { if (tr.kind !== 'main') continue; const c = tr.clips.find((k) => t > k.start && t < k.start + k.dur); if (c) targets.push({ clip: c, track: tr }); }
  let n = 0, right = null;
  for (const { clip, track } of targets) { const r = splitClip(track, clip, t); if (r) { right = r; n++; } }
  if (!n) { toast('Letakkan penanda waktu di tengah klip untuk memotong.'); return; }
  if (right) editor.select(right.id);
  normalizeMain(P());
  commit('split');
}
export function deleteSelected() {
  const s = sel(); if (!s) return;
  s.track.clips = s.track.clips.filter((c) => c !== s.clip);
  if (s.track.kind === 'main') normalizeMain(P());
  dropEmptyTracks(P());
  editor.select(null);
  player.seek(Math.min(player.t, projectDur(P())));
  commit('delete');
}
export function duplicateSelected() {
  const s = sel(); if (!s) return;
  const c = clone(s.clip); c.id = uid();
  if (s.track.kind === 'main') {
    s.track.clips.splice(s.track.clips.indexOf(s.clip) + 1, 0, c);
    normalizeMain(P());
  } else { c.start = s.clip.start + s.clip.dur; if (!fits(s.track, c.start, c.dur)) s.track.clips.push(c); else placeClip(P(), c); s.track.clips.sort((a, b) => a.start - b.start); }
  editor.select(c.id); commit('duplicate');
}
export function copySelected() { const s = sel(); if (s) { editor.clipboard = clone(s.clip); toast('Klip disalin'); } }
export function pasteClip() {
  const c0 = editor.clipboard; if (!c0) return;
  const c = clone(c0); c.id = uid(); c.start = now();
  if (['video', 'image', 'color'].includes(c.kind)) placeClip(P(), c, 'overlay'); else placeClip(P(), c);
  editor.select(c.id); commit('paste');
}
export function reverseSelected() {
  const s = sel(); if (!s || !isSrcTimed(s.clip)) return toast('Pilih klip video atau audio.');
  s.clip.reverse = !s.clip.reverse;
  commit('reverse');
  toast(s.clip.reverse ? 'Klip dibalik' : 'Arah klip kembali normal');
}
export function flipSelected(axis = 'h') { const s = sel(); if (!s || !isVisual(s.clip)) return; s.clip[axis === 'h' ? 'flipH' : 'flipV'] = !s.clip[axis === 'h' ? 'flipH' : 'flipV']; commit('flip'); }
export function rotateSelected() { const s = sel(); if (!s?.clip.tf) return; s.clip.tf.rot = (Math.round(s.clip.tf.rot / 90) * 90 + 90) % 360; commit('rotate'); }
export function toggleMute() { const s = sel(); if (!s || !('muted' in s.clip)) return; s.clip.muted = !s.clip.muted; commit('mute'); }

/** Sends a video clip's sound to its own audio clip, muting the original. */
export function extractAudio() {
  const s = sel();
  if (!s || s.clip.kind !== 'video') return toast('Pilih klip video.');
  const m = getMedia(s.clip.media);
  if (!m?.hasAudio) return toast('Video ini tidak punya suara.', 'bad');
  const a = makeAudioClip(m, s.clip.start);
  a.in = s.clip.in; a.len = s.clip.len; a.dur = s.clip.dur; a.speed = s.clip.speed; a.curve = s.clip.curve && clone(s.clip.curve); a.reverse = s.clip.reverse; a.keepPitch = s.clip.keepPitch;
  a.vol = s.clip.vol; a.fadeIn = s.clip.fadeIn; a.fadeOut = s.clip.fadeOut; a.audio = clone(s.clip.audio); a.name = (m.name || 'Audio') + ' (suara)'; a.tag = 'voice';
  s.clip.muted = true;
  placeClip(P(), a, 'audio');
  editor.select(a.id);
  commit('extract');
  toast('Suara diekstrak ke trek audio. Simpan sebagai MP3 atau WAV lewat tab Suara.', '', 4000);
  return a;
}

/** Holds the current picture as a still for a few seconds. */
export async function freezeFrame(dur = 2) {
  const s = sel();
  const t = now();
  const main = mainTrack(P());
  const target = s?.clip.kind === 'video' ? s : (() => { const c = main.clips.find((k) => t >= k.start && t < k.start + k.dur && k.kind === 'video'); return c ? { clip: c, track: main } : null; })();
  if (!target) return toast('Letakkan penanda waktu pada klip video.');
  const { exportFrameOfClip } = await import('./frames.js');
  const blob = await exportFrameOfClip(target.clip, srcAt(target.clip, t));
  const file = new File([blob], 'Beku ' + uid() + '.png', { type: 'image/png', lastModified: Date.now() });
  const m = await importFile(file);
  const c = makeImageClip(m, t, dur);
  c.fit = target.clip.fit; c.adjust = clone(target.clip.adjust); c.filter = clone(target.clip.filter); c.name = 'Bingkai beku'; c.tf = { ...target.clip.tf }; c.flipH = target.clip.flipH; c.flipV = target.clip.flipV; c.crop = clone(target.clip.crop);
  if (target.track.kind === 'main') {
    const right = t > target.clip.start + .03 ? splitClip(target.track, target.clip, t) : target.clip;
    const at = target.track.clips.indexOf(right || target.clip);
    target.track.clips.splice(at < 0 ? target.track.clips.length : at, 0, c);
    normalizeMain(P());
  } else placeClip(P(), c, 'overlay');
  editor.select(c.id);
  commit('freeze');
}

export function setClipSpeed(c, v) { setSpeed(c, clamp(v, 0.1, 100)); if (findClip(P(), c.id)?.track.kind === 'main') normalizeMain(P()); }
export function toggleMarker() {
  const t = +now().toFixed(3), list = P().markers ||= [];
  const i = list.findIndex((m) => Math.abs(m - t) < 0.05);
  if (i >= 0) list.splice(i, 1); else { list.push(t); list.sort((a, b) => a - b); }
  commit('marker');
}
export { propValue };
