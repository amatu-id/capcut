// The left panel (a sheet on a phone): media, sound, text, stickers, effects, transitions, filters.
import { h, icon, toast, fmtDur, fmtTime, modal } from './util.js';
import { allMedia, mediaBus, getAudio, getMedia, thumbAt } from './media.js';
import * as A from './actions.js';
import { editor } from './store.js';
import { TRACKS, GENRES, SFX, renderTrack, renderSfx } from './music.js';
import { TEXT_PRESETS, TEXT_CATS, renderText, ensureFont } from './text.js';
import { STICKER_SVG, EMOJI_GROUPS, stickerSvgUrl } from './stickers.js';
import { EFFECTS, EFFECT_CATS } from './effects.js';
import { FILTERS, FILTER_CATS } from './filters.js';
import { TRANSITIONS, TRANSITION_CATS, transitionById } from './transitions.js';
import { thumbCanvas } from './frames.js';
import { mainTrack, isVisual } from './model.js';
import { recordVoice } from './record.js';
import { autoCaptions, importSrt } from './captions.js';

export const LIB_TABS = [
  ['media', 'Media', 'media'], ['audio', 'Audio', 'music'], ['text', 'Teks', 'text'], ['sticker', 'Stiker', 'sticker'],
  ['effect', 'Efek', 'effect'], ['trans', 'Transisi', 'transition'], ['filter', 'Filter', 'filter'],
];

const chips = (cats, cur, on) => h('div.chips', cats.map((c) => h('button.chip' + (c === cur ? '.on' : ''), { onclick: () => on(c) }, c)));

const card = (thumb, name, onclick, extra) => h('button.card', { onclick, title: name }, thumb, h('span.card-name', name), extra);

export class Library {
  constructor(root) {
    this.root = root; this.tab = 'media'; this.filterCat = FILTER_CATS[0]; this.fxCat = EFFECT_CATS[0]; this.trCat = TRANSITION_CATS[0]; this.textCat = TEXT_CATS[0]; this.genre = 'Semua'; this.audTab = 'music'; this.stCat = EMOJI_GROUPS[0][0];
    mediaBus.on('added', () => { if (this.tab === 'media') this.render(); });
    mediaBus.on('thumbs', () => { if (this.tab === 'media') this.refreshMediaThumbs(); });
  }
  show(tab) { this.tab = tab; this.render(); }
  render() {
    const body = this[{ media: 'media', audio: 'audio', text: 'text', sticker: 'sticker', effect: 'effect', trans: 'trans', filter: 'filter' }[this.tab]]();
    this.root.replaceChildren(body);
    this.root.scrollTop = 0;
  }
  media() {
    const list = allMedia();
    const drop = h('div.dropzone', { onclick: () => A.pickVisual({ add: false }) }, icon('upload', 22), h('b', 'Impor foto & video'), h('small', 'Klik atau seret berkas ke sini'));
    const grid = h('div.media-grid');
    for (const m of list) {
      if (m.type === 'audio') continue;
      const cv = document.createElement('canvas'); cv.width = 176; cv.height = 112; cv.dataset.media = m.id;
      this._paint(cv, m);
      const add = h('button.fab', { title: 'Tambah ke linimasa', onclick: (e) => { e.stopPropagation(); A.addToTimeline(m, 'main'); } }, icon('plus', 15));
      const over = h('button.fab.fab2', { title: 'Tambah sebagai hamparan', onclick: (e) => { e.stopPropagation(); A.addToTimeline(m, 'overlay'); } }, icon('layers', 14));
      grid.append(h('div.media-card', { title: m.name, onclick: () => A.addToTimeline(m, 'main') }, cv, m.type === 'video' ? h('span.dur', fmtTime(m.dur)) : null, m.missing ? h('span.dur.bad', 'Hilang') : null, h('span.mname', m.name), add, over));
    }
    return h('div', h('h3.lib-title', 'Media'), drop,
      h('div.row-btns',
        h('button.btn.sm', { onclick: () => colorDialog() }, icon('drop', 15), 'Latar warna'),
        h('button.btn.sm', { onclick: () => A.pickVisual({ add: true, where: 'overlay' }) }, icon('logo', 15), 'Sisip logo')),
      list.some((m) => m.type !== 'audio') ? grid : h('p.empty', 'Berkas yang diimpor tersimpan di perangkat ini dan muncul di sini.'));
  }
  _paint(cv, m) {
    const x = cv.getContext('2d'), th = thumbAt(m, m.dur ? m.dur * .3 : 0);
    x.fillStyle = '#1a1c21'; x.fillRect(0, 0, cv.width, cv.height);
    if (!th) return;
    const k = Math.max(cv.width / th.width, cv.height / th.height), w = th.width * k, ht = th.height * k;
    x.drawImage(th, (cv.width - w) / 2, (cv.height - ht) / 2, w, ht);
  }
  refreshMediaThumbs() { this.root.querySelectorAll('canvas[data-media]').forEach((cv) => { const m = getMedia(cv.dataset.media); if (m) this._paint(cv, m); }); }

  audio() {
    const tabs = h('div.seg', [['music', 'Musik'], ['sfx', 'Efek Suara'], ['mine', 'Punya Saya']].map(([k, l]) => h('button' + (this.audTab === k ? '.on' : ''), { onclick: () => { this.audTab = k; this.render(); } }, l)));
    const box = h('div');
    if (this.audTab === 'music') {
      const list = this.genre === 'Semua' ? TRACKS : TRACKS.filter((t) => t.genre === this.genre);
      box.append(chips(['Semua', ...GENRES], this.genre, (g) => { this.genre = g; this.render(); }),
        h('p.note', 'Lagu asli yang dibuat aplikasi ini. Bebas dipakai, tanpa klaim hak cipta.'),
        h('div.tracks', list.map((t) => this._trackRow('music:' + t.id, t.name, t.genre + ' · ' + t.mood + ' · ' + t.bpm + ' BPM', () => renderTrack(t.id)))));
    } else if (this.audTab === 'sfx') {
      const cats = [...new Set(SFX.map((s) => s.cat))];
      for (const c of cats) box.append(h('h4.sub', c), h('div.tracks', SFX.filter((s) => s.cat === c).map((s) => this._trackRow('sfx:' + s.id, s.name, s.len.toFixed(1) + ' dtk', () => renderSfx(s.id)))));
    } else {
      box.append(
        h('div.row-btns', h('button.btn.sm', { onclick: () => A.pickAudio() }, icon('upload', 15), 'Impor lagu'), h('button.btn.sm', { onclick: () => recordVoice() }, icon('mic', 15), 'Rekam suara')),
        h('button.btn.sm.w100', { onclick: () => A.pickAudio() }, icon('extract', 15), 'Ambil suara dari berkas video'),
        h('div.tracks', allMedia().filter((m) => m.type === 'audio').map((m) => this._trackRow(m.id, m.name, fmtDur(m.dur), () => getAudio(m.id)))),
      );
    }
    return h('div', h('h3.lib-title', 'Audio'), tabs, box);
  }
  _trackRow(id, name, sub, load) {
    const play = h('button.ib.round', { title: 'Dengar', onclick: async (e) => {
      e.stopPropagation();
      const pl = A.getPlayer(), wasMe = this.playing === id;
      pl.audio.stopAudition();
      this.root.querySelectorAll('.playing').forEach((n) => { n.classList.remove('playing'); n.replaceChildren(icon('play', 15)); });
      this.playing = null;
      if (wasMe) return;
      this.playing = id;
      pl.audio.unlock();
      play.replaceChildren(h('span.spin'));
      const buf = await load();
      if (this.playing !== id) return;
      play.classList.add('playing'); play.replaceChildren(icon('pause', 15));
      pl.audio.audition(buf, () => { play.classList.remove('playing'); play.replaceChildren(icon('play', 15)); if (this.playing === id) this.playing = null; });
    } }, icon('play', 15));
    const add = h('button.ib.round', { title: 'Tambah ke linimasa', onclick: async (e) => {
      e.stopPropagation();
      add.replaceChildren(h('span.spin'));
      const m = getMedia(id);
      await load();
      A.getPlayer().audio.stopAudition();
      await A.addAudio(m);
      add.replaceChildren(icon('check', 15));
      setTimeout(() => add.replaceChildren(icon('plus', 15)), 1100);
    } }, icon('plus', 15));
    return h('div.track-row', play, h('div.track-txt', h('b', name), h('small', sub)), add);
  }
  text() {
    const list = TEXT_PRESETS.filter((p) => p.cat === this.textCat);
    const grid = h('div.text-grid', list.map((p) => {
      const cv = document.createElement('canvas'); cv.width = 176; cv.height = 96;
      const draw = () => {
        const c = { id: 'pv:' + p.id, ...p.o, text: p.name, size: 52, dur: 1, maxW: .96, tanim: null };
        const r = renderText(c, 1, 0, 340);
        const x = cv.getContext('2d'); x.clearRect(0, 0, 176, 96);
        const k = Math.min(1, 168 / r.w, 88 / r.h);
        x.drawImage(r.canvas, (176 - r.w * k) / 2, (96 - r.h * k) / 2, r.w * k, r.h * k);
      };
      draw(); ensureFont({ ...p.o, text: p.name }, draw);
      return h('button.text-card', { title: p.name, onclick: () => A.addText({ ...JSON.parse(JSON.stringify(p.o)), text: p.name === 'Polos' ? 'Teks Anda' : p.name, name: p.name }) }, cv);
    }));
    return h('div', h('h3.lib-title', 'Teks'),
      h('button.btn.primary.w100', { onclick: () => A.addText() }, icon('plus', 16), 'Tambah teks'),
      h('div.row-btns', h('button.btn.sm', { onclick: () => autoCaptions() }, icon('caption', 15), 'Subtitel otomatis'), h('button.btn.sm', { onclick: () => importSrt() }, icon('upload', 15), 'Impor SRT')),
      chips(TEXT_CATS, this.textCat, (c) => { this.textCat = c; this.render(); }), grid);
  }
  sticker() {
    const group = EMOJI_GROUPS.find((g) => g[0] === this.stCat);
    const cats = [...EMOJI_GROUPS.map((g) => g[0]), 'Label'];
    return h('div', h('h3.lib-title', 'Stiker'), chips(cats, this.stCat, (c) => { this.stCat = c; this.render(); }),
      this.stCat === 'Label'
        ? h('div.sticker-grid', STICKER_SVG.map(([id, name]) => h('button.st', { title: name, onclick: () => A.addSticker({ type: 'svg', v: id }) }, h('img', { src: stickerSvgUrl(id), alt: name, loading: 'lazy' }))))
        : h('div.sticker-grid.emoji', (group?.[1] || []).map((e) => h('button.st', { onclick: () => A.addSticker({ type: 'emoji', v: e }) }, e))));
  }
  effect() {
    return h('div', h('h3.lib-title', 'Efek video'), chips(EFFECT_CATS, this.fxCat, (c) => { this.fxCat = c; this.render(); }),
      h('p.note', 'Klik untuk menaruh efek di linimasa. Efek memengaruhi semua lapisan di bawahnya.'),
      h('div.grid2', EFFECTS.filter((e) => e.cat === this.fxCat).map((e) => card(thumbCanvas('effect', e.id), e.name, () => A.addEffect(e)))));
  }
  trans() {
    return h('div', h('h3.lib-title', 'Transisi'), chips(TRANSITION_CATS, this.trCat, (c) => { this.trCat = c; this.render(); }),
      h('button.btn.sm.w100', { onclick: () => applyTransitionAll() }, icon('sparkle', 15), 'Terapkan acak ke semua potongan'),
      h('p.note', 'Klik transisi untuk memasangnya di potongan terdekat dari penanda waktu. Arahkan kursor untuk melihat geraknya.'),
      h('div.grid2', TRANSITIONS.filter((t) => t.cat === this.trCat).map((t) => card(thumbCanvas('transition', t.id), t.name, () => setNearestTransition(t.id)))));
  }
  filter() {
    return h('div', h('h3.lib-title', 'Filter'), chips(FILTER_CATS, this.filterCat, (c) => { this.filterCat = c; this.render(); }),
      h('div.row-btns', h('button.btn.sm', { onclick: () => A.addAdjust() }, icon('adjust', 15), 'Lapisan penyesuaian')),
      h('p.note', 'Dengan klip terpilih: filter dipasang ke klip itu. Tanpa pilihan: menjadi lapisan filter di linimasa.'),
      h('div.grid2', FILTERS.filter((f) => f.cat === this.filterCat).map((f) => card(thumbCanvas('filter', f.id), f.name, () => {
        const s = editor.selected;
        if (s && isVisual(s.clip) && ['video', 'image', 'color'].includes(s.clip.kind)) { s.clip.filter = { id: f.id, amt: s.clip.filter?.amt ?? 1 }; editor.commit('filter'); A.getPlayer().invalidate(); editor.emit('select'); toast('Filter ' + f.name + ' dipasang'); } else A.addFilter(f);
      }))));
  }
}

function setNearestTransition(id) {
  const P = editor.project, m = mainTrack(P), t = A.getPlayer().t;
  if (m.clips.length < 2) return toast('Butuh minimal dua klip di trek utama.');
  const s = editor.selected;
  let target = s && m.clips.includes(s.clip) && s.clip !== m.clips[m.clips.length - 1] ? s.clip : null;
  if (!target) {
    let best = 1e9;
    for (let i = 0; i < m.clips.length - 1; i++) { const c = m.clips[i], d = Math.abs(c.start + c.dur - t); if (d < best) { best = d; target = c; } }
  }
  target.trans = { id, d: target.trans?.d || transitionById(id).d };
  editor.commit('transition');
  const pl = A.getPlayer();
  pl.seek(Math.max(0, target.start + target.dur - target.trans.d / 2 - 0.2));
  toast('Transisi ' + transitionById(id).name + ' dipasang');
  pl.invalidate();
}
function applyTransitionAll() {
  const m = mainTrack(editor.project);
  if (m.clips.length < 2) return toast('Butuh minimal dua klip di trek utama.');
  const pool = ['fade', 'pushl', 'whip', 'zoomin', 'flash', 'crosszoom', 'wiper', 'blur', 'glitch', 'lens'];
  m.clips.slice(0, -1).forEach((c) => { const id = pool[Math.floor(Math.random() * pool.length)]; c.trans = { id, d: transitionById(id).d }; });
  editor.commit('transition');
  A.getPlayer().invalidate();
  toast('Transisi dipasang di semua potongan');
}
function colorDialog() {
  const presets = [['#000000', ''], ['#ffffff', ''], ['#111827', ''], ['#7c3aed', '#1e1b4b'], ['#0ea5e9', '#1e3a8a'], ['#f43f5e', '#7f1d1d'], ['#f59e0b', '#b91c1c'], ['#10b981', '#064e3b'], ['#ec4899', '#6d28d9'], ['#fef3c7', '#fda4af']];
  const m = modal({
    title: 'Latar warna',
    body: h('div.swatches', presets.map(([a, b]) => h('button.swatch', { style: { background: b ? `linear-gradient(${a},${b})` : a }, onclick: () => { A.addColor(a, b || null); m.close(); } }))),
  });
}
