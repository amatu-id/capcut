// Start-up, the home screen, the template and auto-edit flows, the editor shell and export.
import { h, icon, toast, modal, confirmBox, promptBox, fmtTime, fmtSize, fmtDur, download, pickFiles, isPhone, debounce } from './util.js';
import { editor, listProjects, getProject, putProject, removeProject, sweepMedia } from './store.js';
import { newProject, RATIOS, projectDur, mainTrack, isVisual, hasAudio, isSrcTimed } from './model.js';
import { Compositor } from './render.js';
import { Player } from './player.js';
import { Timeline } from './timeline.js';
import { Stage } from './stage.js';
import { Library, LIB_TABS } from './library.js';
import { Inspector, slider } from './inspector.js';
import * as A from './actions.js';
import { getMedia, importFile, restoreMedia, relink, mediaBus, ACCEPT_VISUAL, getAudio, storageInfo } from './media.js';
import { TEMPLATES, TEMPLATE_CATS, applyTemplate, templateById } from './templates.js';
import { TRACKS, GENRES } from './music.js';
import { sampleMedia } from './samples.js';
import { analyzeVideo } from './autoedit.js';
import { exportVideo, exportAudio, exportFrame, RESOLUTIONS, FRAME_RATES, QUALITIES, CODECS, exportSize, estimateBitrate } from './export.js';
import { exportSrt } from './captions.js';
import { TRANSITIONS, TRANSITION_CATS, transitionById } from './transitions.js';
import { thumbCanvas } from './frames.js';
import { setStickerReady } from './stickers.js';
import { ensureFont } from './text.js';

const $ = (id) => document.getElementById(id);

/* ==================== shared ==================== */
const homeEl = $('home'), editorEl = $('editor');
let shell = null;

function show(view) {
  homeEl.hidden = view !== 'home';
  editorEl.hidden = view !== 'editor';
  document.title = view === 'editor' && editor.project ? editor.project.name + ' · Amatu Cut' : 'Amatu Cut';
}

/* ==================== template thumbnails ==================== */
const THUMB_W = 180;
let thumbComp = null;
const thumbQueue = [];
let thumbBusy = false;
const thumbProv = { video: () => null, image: (c) => getMedia(c.media)?.bitmap, bgImage: () => null };
async function drawTemplateThumb(tpl, canvas) {
  const samples = sampleMedia();
  const order = [...samples.slice(hashN(tpl.id) % samples.length), ...samples];
  const P = await applyTemplate(tpl, order.slice(0, 6), { previewOnly: true });
  const r = P.w / P.h;
  const W = THUMB_W, H = Math.round(W / Math.max(.56, Math.min(1.78, r)));
  if (!thumbComp) { const c = document.createElement('canvas'); thumbComp = { cv: c, comp: new Compositor(c, { preserve: true }) }; }
  thumbComp.cv.width = W; thumbComp.cv.height = H;
  const jobs = [];
  for (const t of P.tracks) for (const c of t.clips) if (c.kind === 'text') jobs.push(ensureFont(c));
  await Promise.all(jobs);
  const draw = () => { thumbComp.cv.width = W; thumbComp.cv.height = H; thumbComp.comp.render(P, Math.min(1.6, projectDur(P) * .3), thumbProv); canvas.width = W; canvas.height = H; canvas.getContext('2d').drawImage(thumbComp.cv, 0, 0); };
  draw();
}
const hashN = (s) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
function pumpThumbs() {
  if (thumbBusy) return;
  const job = thumbQueue.shift(); if (!job) return;
  if (!job.canvas.isConnected) { pumpThumbs(); return; }
  thumbBusy = true;
  (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(() => drawTemplateThumb(job.tpl, job.canvas).catch((e) => console.warn(job.tpl.id, e)).finally(() => { thumbBusy = false; pumpThumbs(); }), { timeout: 60 });
}
const templateCard = (tpl) => {
  const cv = document.createElement('canvas'); cv.width = THUMB_W; cv.height = 320;
  thumbQueue.push({ tpl, canvas: cv }); setTimeout(pumpThumbs, 40);
  const shape = tpl.ratio === '9:16' ? 'tall' : tpl.ratio === '16:9' || tpl.ratio === '21:9' ? 'wide' : 'square';
  return h('button.tcard.' + shape, { onclick: () => openTemplate(tpl), title: tpl.desc }, h('span.tcard-img', cv), h('span.tcard-name', tpl.name), h('small', tpl.ratio + ' · ' + tpl.cat));
};

/* ==================== home ==================== */
let homeCat = 'Semua';
async function renderHome() {
  const projects = await listProjects();
  const body = h('div.home-in');
  body.append(
    h('header.home-top',
      h('div.brand', h('span.logo', icon('scissors', 18)), h('b', 'Amatu Cut')),
      h('div.sp'),
      h('button.btn', { onclick: storageDialog, title: 'Penyimpanan' }, icon('folder', 16), h('span.hide-sm', 'Penyimpanan'))),
    h('section.hero',
      h('div.hero-tx', h('h1', 'Edit video lengkap, langsung di browser'), h('p', 'Pilih template, masukkan foto atau video, dan video langsung jadi. Atau edit sendiri di linimasa: potong, transisi, teks, musik, efek, keyframe, sampai ekspor 4K.')),
      h('div.hero-act',
        h('button.action.primary', { onclick: newProjectDialog }, icon('plus', 24), h('b', 'Proyek baru'), h('small', 'Edit manual di linimasa')),
        h('button.action', { onclick: autoEditDialog }, icon('wand', 24), h('b', 'Edit otomatis'), h('small', 'Pilih media, jadi sendiri')),
        h('button.action', { onclick: () => $('tpl-sec')?.scrollIntoView({ behavior: 'smooth' }) }, icon('template', 24), h('b', TEMPLATES.length + ' template'), h('small', 'Transisi & lagu sudah siap')))),
  );
  if (projects.length) {
    body.append(h('section', h('h2', 'Proyek saya'), h('div.projects', projects.map((p) => h('div.pcard', { onclick: () => openProject(p.id) },
      h('div.pthumb', p.thumb ? h('img', { src: p.thumb, alt: '' }) : icon('media', 26)),
      h('div.pinfo', h('b', p.name), h('small', fmtDur(projectDur(p)) + ' · ' + p.ratio + ' · ' + new Date(p.updated).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }))),
      h('button.ib', { title: 'Menu', 'aria-label': 'Menu proyek', onclick: (e) => { e.stopPropagation(); projectMenu(p); } }, icon('dots')))))));
  }
  const tplGrid = h('div.tgrid');
  const fillGrid = () => { tplGrid.replaceChildren(...(homeCat === 'Semua' ? TEMPLATES : TEMPLATES.filter((t) => t.cat === homeCat)).map(templateCard)); };
  const chipsEl = h('div.chips');
  const drawChips = () => chipsEl.replaceChildren(...['Semua', ...TEMPLATE_CATS].map((c) => h('button.chip' + (c === homeCat ? '.on' : ''), { onclick: () => { homeCat = c; drawChips(); thumbQueue.length = 0; fillGrid(); } }, c)));
  drawChips();
  fillGrid();
  body.append(h('section', { id: 'tpl-sec' }, h('h2', 'Template'), chipsEl, tplGrid));
  body.append(h('section.feat-sec', h('h2', 'Semua ada di sini'), h('div.feat-grid', [
    ['scissors', 'Potong & rapikan', 'Pisah, trim, salin, bekukan bingkai, balik arah, urutkan.'],
    ['transition', TRANSITIONS.length + ' transisi', 'Dorong, zoom, cambuk, glitch, 3D, bentuk, dan lainnya.'],
    ['keyframe', 'Keyframe gerak', 'Posisi, skala, putar dan opasitas bergerak halus antar bingkai.'],
    ['text', 'Teks & subtitel', 'Puluhan gaya dan animasi, subtitel otomatis dari suara.'],
    ['music', 'Lagu & efek suara', TRACKS.length + ' lagu bebas royalti di ' + GENRES.length + ' genre, atau lagu sendiri.'],
    ['mic', 'Edit suara', 'Ekstrak, ubah nada, gema, gaung, EQ, kurangi bising, rekam suara.'],
    ['filter', 'Warna & efek', 'Filter, penyesuaian warna, efek glitch, cahaya dan partikel.'],
    ['logo', 'Logo & tanda air', 'Sisipkan gambar, stiker, atau tanda air di seluruh video.'],
    ['chroma', 'Green screen & masker', 'Hapus latar warna, masker bentuk, blend mode, picture-in-picture.'],
    ['hd', 'Tingkatkan resolusi', 'Penajam langsung dan AI di perangkat, ekspor sampai 4K.'],
    ['speed', 'Kecepatan', 'Tetap atau kurva: lambat, cepat, efek pahlawan.'],
    ['beat', 'Ikuti ketukan', 'Deteksi tempo lagu dan potong otomatis di ketukan.'],
  ].map(([ic, t, d]) => h('div.feat', icon(ic, 20), h('b', t), h('small', d))))));
  homeEl.replaceChildren(body);
}
function projectMenu(p) {
  const m = modal({
    title: p.name,
    body: h('div.menu-list',
      h('button', { onclick: async () => { m.close(); const n = await promptBox('Ganti nama', p.name); if (n) { p.name = n; await putProject(p); renderHome(); } } }, icon('text', 16), 'Ganti nama'),
      h('button', { onclick: async () => { m.close(); const c = JSON.parse(JSON.stringify(p)); c.id = Date.now().toString(36); c.name = p.name + ' (salinan)'; c.updated = Date.now(); await putProject(c); renderHome(); } }, icon('copy', 16), 'Duplikat'),
      h('button.danger', { onclick: async () => { m.close(); if (await confirmBox('Hapus proyek?', '"' + p.name + '" akan dihapus permanen.', 'Hapus', true)) { await removeProject(p.id); sweepMedia(3 * 864e5).catch(() => {}); renderHome(); } } }, icon('trash', 16), 'Hapus')),
  });
}
async function storageDialog() {
  const est = await storageInfo();
  modal({ title: 'Penyimpanan', body: h('div',
    h('p.muted', 'Foto dan video tersimpan di perangkat ini saja dan tidak diunggah ke mana pun. Proyek (tanpa berkas media) ikut tersinkron ke akun Anda, jadi di perangkat lain Anda perlu memilih ulang berkas aslinya.'),
    est ? h('p', 'Terpakai ' + fmtSize(est.usage || 0) + ' dari ' + fmtSize(est.quota || 0) + '.') : null,
    h('button.btn', { onclick: async (e) => { e.target.disabled = true; await sweepMedia(); toast('Berkas yang tidak dipakai sudah dibersihkan'); e.target.disabled = false; } }, 'Bersihkan berkas tak terpakai')) });
}
function ratioPicker(cur, on) {
  const wrap = h('div.ratio-grid');
  const draw = (id) => wrap.replaceChildren(...RATIOS.map((r) => {
    const k = 26 / Math.max(r.w, r.h);
    return h('button.ratio' + (id === r.id ? '.on' : ''), { onclick: () => { on(r.id); draw(r.id); }, title: r.hint }, h('i', { style: { width: r.w * k + 'px', height: r.h * k + 'px' } }), h('span', r.id));
  }));
  draw(cur);
  return wrap;
}
function newProjectDialog() {
  let ratio = '9:16';
  const name = h('input.input', { value: 'Proyek ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }), 'aria-label': 'Nama proyek' });
  const m = modal({
    title: 'Proyek baru',
    body: h('div.form', h('label', 'Nama', name), h('label', 'Bentuk video', ratioPicker(ratio, (r) => { ratio = r; }))),
    foot: [h('button.btn', { onclick: () => m.close() }, 'Batal'), h('button.btn.primary', { onclick: () => { m.close(); const p = newProject(name.value || 'Proyek baru', ratio); p.ratioLocked = true; openEditor(p); } }, 'Buat')],
  });
}

/* ==================== template preview ==================== */
function openTemplate(tpl) {
  const samples = sampleMedia();
  const canvas = h('canvas.tp-cv');
  let P = null, comp = null, player = null;
  const status = h('div.tp-status', h('span.spin'), 'Menyusun contoh…');
  const playBtn = h('button.ib.big', { 'aria-label': 'Putar', onclick: () => { player?.toggle(); } }, icon('pause', 20));
  const title = h('input.input', { value: tpl.title?.[1]?.replace(/\n/g, ' ') || '', placeholder: 'Judul', 'aria-label': 'Judul' });
  const sub = tpl.sub ? h('input.input', { value: tpl.sub[1], placeholder: 'Subjudul', 'aria-label': 'Subjudul' }) : null;
  const useBtn = h('button.btn.primary.w100', { onclick: () => pick() }, icon('media', 16), 'Pilih foto / video');
  const keepVoice = h('input', { type: 'checkbox' });
  const m = modal({
    title: tpl.name, wide: true,
    onclose: () => { player?.destroy(); comp?.dispose(); },
    body: h('div.tp',
      h('div.tp-view', canvas, status, h('div.tp-ctrl', playBtn)),
      h('div.tp-side',
        h('p.muted', tpl.desc),
        h('div.tp-meta', h('span', tpl.ratio), h('span', 'Lagu: ' + (TRACKS.find((t) => t.id === tpl.track)?.name || '-')), h('span', 'Disarankan ' + tpl.min + '+ media')),
        tpl.title ? h('label.form-l', 'Judul', title) : null,
        sub ? h('label.form-l', 'Subjudul', sub) : null,
        h('label.toggle', h('span', 'Pertahankan suara asli video'), keepVoice, h('i')),
        useBtn,
        h('button.btn.w100', { onclick: () => { useMediaFrom(); } }, icon('wand', 15), 'Pakai contoh dulu, edit nanti'),
        h('p.note', 'Contoh memakai gambar bawaan. Video Anda akan dipotong otomatis mengikuti ketukan lagu.'))),
  });
  const useMediaFrom = () => generate(samples.slice(0, tpl.min || 6));
  async function pick() {
    const files = await pickFiles(ACCEPT_VISUAL);
    if (!files.length) return;
    useBtn.disabled = true; useBtn.replaceChildren(h('span.spin'), 'Mengimpor…');
    const media = [];
    for (const f of files) { try { media.push(await importFile(f)); } catch (e) { toast(e.message, 'bad'); } }
    await generate(media);
    useBtn.disabled = false; useBtn.replaceChildren(icon('media', 16), 'Pilih foto / video');
  }
  async function generate(media) {
    if (!media.length) return;
    useBtn.disabled = true; useBtn.replaceChildren(h('span.spin'), 'Menganalisis media…');
    for (const med of media) if (med.type === 'video') await analyzeVideo(med).catch(() => null);
    try {
      const p = await applyTemplate(tpl, media, { title: title.value || undefined, sub: sub?.value, keepVoice: keepVoice.checked });
      p.name = tpl.name + ' ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      m.close();
      openEditor(p);
      toast('Video jadi. Silakan edit atau langsung ekspor.', 'good', 3500);
    } catch (e) { toast(e.message, 'bad'); useBtn.disabled = false; }
  }
  (async () => {
    try {
      P = await applyTemplate(tpl, samples.slice(0, Math.max(6, tpl.min || 6)).concat(samples), {});
      if (!m.el.isConnected) return;
      const k = Math.min(1, 640 / Math.min(P.w, P.h));
      canvas.width = Math.round(P.w * k / 2) * 2; canvas.height = Math.round(P.h * k / 2) * 2;
      canvas.style.aspectRatio = P.w + '/' + P.h;
      comp = new Compositor(canvas);
      player = new Player({
        getProject: () => P,
        draw: (t) => comp.render(P, t, player),
        onState: (on) => playBtn.replaceChildren(icon(on ? 'pause' : 'play', 20)),
      });
      for (const t of P.tracks) for (const c of t.clips) { if (c.kind === 'text') ensureFont(c, () => player.invalidate()); }
      status.remove();
      player.play();
    } catch (e) { status.textContent = e.message; }
  })();
}

/* ==================== auto edit ==================== */
const STYLES = [
  ['Otomatis', 'Dipilih sesuai isi media', 'viral-beat'], ['Energik', 'Potong cepat di ketukan', 'viral-beat'], ['Santai', 'Lembut dan hangat', 'aesthetic'], ['Sinematik', 'Warna film dan bar hitam', 'travel-epic'],
  ['Romantis', 'Untuk momen berdua', 'love'], ['Keluarga', 'Kenangan yang hangat', 'memories'], ['Promosi', 'Jualan dan iklan', 'promo-sale'], ['Retro', 'Kaset lama', 'retro'], ['Liburan', 'Cerah dan seru', 'travel-reel'],
];
function autoEditDialog() {
  let media = [], style = STYLES[0], ratio = '9:16', trackId = '', keep = false;
  const list = h('div.ae-list');
  const refreshList = () => { list.replaceChildren(...media.map((m) => h('div.ae-item', { title: m.name }, m.thumbs?.[0] ? (() => { const c = document.createElement('canvas'); c.width = 72; c.height = 72; const t = m.thumbs[0], k = Math.max(72 / t.width, 72 / t.height); c.getContext('2d').drawImage(t, (72 - t.width * k) / 2, (72 - t.height * k) / 2, t.width * k, t.height * k); return c; })() : icon(m.type === 'video' ? 'media' : 'image', 22), m.type === 'video' ? h('small', fmtTime(m.dur)) : null))); go.disabled = !media.length; };
  mediaBus.on('thumbs', () => refreshList());
  const add = h('button.dropzone', { onclick: async () => { const fs = await pickFiles(ACCEPT_VISUAL); add.classList.add('busy'); for (const f of fs) { try { media.push(await importFile(f)); } catch (e) { toast(e.message, 'bad'); } } add.classList.remove('busy'); refreshList(); } }, icon('upload', 22), h('b', 'Pilih foto & video'), h('small', 'Semakin banyak semakin bagus'));
  const styleBox = h('div.anim-grid');
  const drawStyles = () => styleBox.replaceChildren(...STYLES.map((s) => h('button.anim.style' + (s === style ? '.on' : ''), { onclick: () => { style = s; drawStyles(); } }, h('b', s[0]), h('small', s[1]))));
  drawStyles();
  const bar = h('div.progress.hide', h('i')), note = h('p.muted.small');
  const go = h('button.btn.primary', { disabled: true, onclick: run }, icon('wand', 16), 'Buat video');
  const m = modal({
    title: 'Edit otomatis',
    body: h('div.form', add, list,
      h('label', 'Gaya', styleBox),
      h('label', 'Bentuk video', ratioPicker(ratio, (r) => { ratio = r; })),
      h('label', 'Lagu', h('select.input', { onchange: (e) => { trackId = e.target.value; } }, h('option', { value: '' }, 'Sesuai gaya'), TRACKS.map((t) => h('option', { value: t.id }, t.name + ' · ' + t.genre)))),
      h('label.toggle', h('span', 'Pertahankan suara asli video'), h('input', { type: 'checkbox', onchange: (e) => { keep = e.target.checked; } }), h('i')),
      bar, note),
    foot: [h('button.btn', { onclick: () => m.close() }, 'Batal'), go],
  });
  async function run() {
    go.disabled = true; bar.classList.remove('hide');
    const setP = (p, t) => { bar.firstChild.style.width = Math.round(p * 100) + '%'; note.textContent = t; };
    try {
      const vids = media.filter((x) => x.type === 'video');
      for (let i = 0; i < vids.length; i++) await analyzeVideo(vids[i], (p) => setP((i + p) / Math.max(1, vids.length) * .7, 'Melihat bagian terbaik video ' + (i + 1) + ' dari ' + vids.length));
      setP(.8, 'Menyusun lagu dan potongan');
      const tpl = { ...templateById(style[2]) };
      if (trackId) tpl.track = trackId;
      if (style[0] === 'Otomatis') { const avg = vids.length ? vids.reduce((a, v) => a + v.dur, 0) / vids.length : 0; tpl.cut = media.length >= 14 ? [1, 1, 2] : avg > 10 ? [4, 2, 2] : [2, 2, 4]; }
      tpl.min = Math.max(media.length, vids.length ? Math.min(14, vids.reduce((a, v) => a + Math.floor(v.dur / 2.5), 0)) : 0, 5);
      const P = await applyTemplate(tpl, media, { ratio, keepVoice: keep });
      P.name = 'Otomatis ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      setP(1, 'Selesai');
      m.close();
      openEditor(P);
      toast('Video jadi. Silakan edit atau langsung ekspor.', 'good', 3500);
    } catch (e) { note.textContent = 'Gagal: ' + e.message; go.disabled = false; }
  }
}

/* ==================== editor shell ==================== */
class Shell {
  constructor() {
    this.canvas = $('stage-cv');
    this.comp = new Compositor(this.canvas);
    this.player = new Player({ getProject: () => editor.project, draw: (t) => this.draw(t), onTime: (t) => this.onTime(t), onState: (on) => this.onState(on) });
    A.bindPlayer(this.player);
    this.stage = new Stage($('stage-wrap'), this.canvas, this.comp, this.player);
    this.timeline = new Timeline($('tl-cv'), this.player);
    this.library = new Library($('lib-body'));
    this.inspector = new Inspector($('insp-body'), $('insp-title'));
    this.inspector.onRatio = () => this.stage.layout();
    this.timeline.onTransition = (c) => this.transitionDialog(c);
    const editText = () => { this.inspector.tab.text = 'text'; this.inspector.render(); this.openSheet('insp'); };
    this.timeline.onEditText = editText; this.stage.onEditText = editText;
    this.comp.onrestore = () => this.player.invalidate();
    this.buildChrome();
    this.bindEditor();
    this.bindKeys();
    this.bindDrop();
    setStickerReady(() => this.player.invalidate());
  }
  draw(t) {
    const P = editor.project;
    if (!P) return;
    const e = this.empty;
    if (projectDur(P) <= 0) {
      if (!e) { this.empty = true; $('stage-hint').hidden = false; }
    } else if (e) { this.empty = false; $('stage-hint').hidden = true; }
    this.comp.render(P, t, this.player);
    this.stage.updateBox();
    if (this.wantThumb) { this.wantThumb = false; this.makeThumb(); }
  }
  makeThumb() {
    const P = editor.project, c = document.createElement('canvas'), k = 200 / Math.max(this.canvas.width, this.canvas.height);
    c.width = Math.max(2, this.canvas.width * k); c.height = Math.max(2, this.canvas.height * k);
    c.getContext('2d').drawImage(this.canvas, 0, 0, c.width, c.height);
    try { P.thumb = c.toDataURL('image/jpeg', .62); } catch { /* keep the old cover */ }
  }
  onTime(t) {
    const P = editor.project; if (!P) return;
    $('t-cur').textContent = fmtTime(t, P.fps); $('t-dur').textContent = fmtTime(projectDur(P));
    this.timeline.followPlayhead(t); this.timeline.paint();
    this.inspector.tick();
    this.stage.updateBox();
  }
  onState(on) {
    const b = $('b-play'); b.replaceChildren(icon(on ? 'pause' : 'play', 22)); b.setAttribute('aria-label', on ? 'Jeda' : 'Putar'); this.stage.updateBox();
  }
  buildChrome() {
    const P = this.player;
    $('b-play').onclick = () => P.toggle();
    $('b-prev').onclick = () => { P.pause(); P.seek(P.t - 1 / (editor.project?.fps || 30)); };
    $('b-next').onclick = () => { P.pause(); P.seek(P.t + 1 / (editor.project?.fps || 30)); };
    $('b-start').onclick = () => P.seek(0);
    $('b-end').onclick = () => P.seek(P.duration);
    $('b-full').onclick = () => { const el = $('stage-area'); document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.().catch(() => {}); };
    $('b-back').onclick = () => this.leave();
    $('b-undo').onclick = () => editor.undo();
    $('b-redo').onclick = () => editor.redo();
    $('b-export').onclick = () => this.exportDialog();
    $('p-name').onchange = () => { editor.project.name = $('p-name').value || 'Proyek'; editor.commit('name'); document.title = editor.project.name + ' · Amatu Cut'; };
    $('b-add').onclick = () => A.pickVisual({ add: true, where: 'main' });

    const rail = $('lib-rail');
    rail.replaceChildren(...LIB_TABS.map(([id, label, ic]) => h('button', { 'data-tab': id, onclick: () => this.libTab(id) }, icon(ic, 20), h('span', label))));
    rail.append(h('button', { onclick: () => this.leaveToTemplates() }, icon('template', 20), h('span', 'Template')));
    this.libTab('media', false);

    const tools = [
      ['split', 'Potong', () => A.splitAtPlayhead(), 'S'], ['trash', 'Hapus', () => A.deleteSelected(), 'Del'], ['copy', 'Duplikat', () => A.duplicateSelected(), '⌘D'],
      ['freeze', 'Beku', () => A.freezeFrame(), ''], ['reverse', 'Balik', () => A.reverseSelected(), ''], ['flip', 'Cermin', () => A.flipSelected('h'), ''], ['rotate', 'Putar', () => A.rotateSelected(), ''],
      ['speed', 'Kecepatan', () => this.openInspectorTab('speed'), ''], ['volume', 'Suara', () => this.openInspectorTab('sound'), ''], ['extract', 'Ekstrak', () => A.extractAudio(), ''],
      ['keyframe', 'Keyframe', () => this.openInspectorTab('anim'), ''], ['marker', 'Penanda', () => A.toggleMarker(), 'M'],
    ];
    $('tl-tools').replaceChildren(
      h('div.tools-l', h('button.tool.edit-btn', { onclick: () => this.openSheet('insp') }, icon('adjust', 18), h('span', 'Atur')), tools.map(([ic, label, fn, key]) => h('button.tool', { onclick: fn, title: label + (key ? ' (' + key + ')' : '') }, icon(ic, 18), h('span', label)))),
      h('div.tools-r',
        h('button.tool.tog' + (this.timeline.snap ? '.on' : ''), { title: 'Tempel otomatis', onclick: (e) => { this.timeline.snap = !this.timeline.snap; e.currentTarget.classList.toggle('on', this.timeline.snap); } }, icon('magnet', 18)),
        h('button.tool', { title: 'Perkecil', onclick: () => this.timeline.zoomBy(.72) }, icon('zoomout', 18)),
        h('button.tool', { title: 'Perbesar', onclick: () => this.timeline.zoomBy(1.38) }, icon('zoomin', 18)),
        h('button.tool', { title: 'Tampilkan semua', onclick: () => this.timeline.fit() }, icon('full', 18))),
    );
    // Dragging the divider resizes the timeline (desktop).
    const grip = $('tl-grip');
    let gy = null, gh = 0;
    grip.onpointerdown = (e) => { gy = e.clientY; gh = $('tl-wrap').offsetHeight; grip.setPointerCapture(e.pointerId); };
    grip.onpointermove = (e) => { if (gy != null) editorEl.style.setProperty('--tl-h', Math.max(140, Math.min(innerHeight * .65, gh - (e.clientY - gy))) + 'px'); };
    grip.onpointerup = () => { gy = null; };
    for (const b of document.querySelectorAll('[data-close-sheet]')) b.onclick = () => this.closeSheets();
    $('sheet-bg').onclick = () => this.closeSheets();
  }
  libTab(id, open = true) {
    this.library.show(id);
    for (const b of $('lib-rail').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === id);
    if (open) this.openSheet('lib');
  }
  openSheet(which) {
    if (!isPhone()) return;
    $('lib-panel').classList.toggle('open', which === 'lib');
    $('insp').classList.toggle('open', which === 'insp');
    $('sheet-bg').hidden = false;
  }
  closeSheets() { $('lib-panel').classList.remove('open'); $('insp').classList.remove('open'); $('sheet-bg').hidden = true; }
  openInspectorTab(tab) {
    const s = editor.selected;
    if (!s) return toast('Pilih klip dulu di linimasa.');
    const avail = this.inspector.tabsFor(s.clip).map((t) => t[0]);
    if (avail.includes(tab)) this.inspector.tab[s.clip.kind] = tab;
    else if (tab === 'sound' && avail.includes('sound')) this.inspector.tab[s.clip.kind] = 'sound';
    else return toast('Tidak tersedia untuk klip ini.');
    this.inspector.render();
    this.openSheet('insp');
  }
  bindEditor() {
    editor.on('open', () => {
      this.stage.layout(); this.timeline.resize(); this.timeline.fit();
      this.player.reset();
      this.player.seek(0);
      $('p-name').value = editor.project.name;
      this.inspector.render();
      this.checkMissing();
    });
    editor.on('change', (label) => {
      const P = editor.project; if (!P) return;
      if (label === 'ratio') this.stage.layout();
      // The first clip on an empty timeline: show all of it at once.
      if (label === 'add' && mainTrack(P).clips.length === 1) this.timeline.fit();
      $('b-undo').disabled = !editor.history.canUndo; $('b-redo').disabled = !editor.history.canRedo;
      if (label === 'timeline' || label === 'history' || label === 'split' || label === 'key') this.inspector.render();
      if (label === 'history') { this.stage.layout(); this.player.refresh(); }
      this.onTime(this.player.t);
      this.timeline.paint();
      this.player.invalidate();
    });
    editor.on('touch', () => { this.timeline.paint(); this.player.invalidate(); $('t-dur').textContent = fmtTime(projectDur(editor.project)); });
    editor.on('select', () => {
      this.inspector.render(); this.timeline.paint(); this.stage.updateBox();
      document.body.classList.toggle('has-sel', !!editor.sel);
    });
    editor.on('saved', () => { this.wantThumb = true; this.player.invalidate(); $('save-st').textContent = 'Tersimpan'; });
    for (const ev of ['audio', 'thumbs']) mediaBus.on(ev, () => this.timeline.paint());
    let busyN = 0;
    mediaBus.on('busy', (d) => { busyN += d; $('busy').hidden = busyN <= 0; });
    mediaBus.on('added', () => { $('stage-hint').hidden = projectDur(editor.project || { tracks: [] }) > 0; });
  }
  checkMissing() {
    const P = editor.project;
    const miss = (P.media || []).map((x) => getMedia(x.id)).filter((m) => m?.missing);
    if (!miss.length) return;
    const list = h('div.menu-list');
    const draw = () => list.replaceChildren(...miss.filter((m) => m.missing).map((m) => h('button', { onclick: async () => {
      const [f] = await pickFiles(m.type === 'audio' ? 'audio/*,video/*' : m.type === 'image' ? 'image/*' : 'video/*', false);
      if (!f) return;
      try { await relink(m, f); draw(); this.player.invalidate(); this.timeline.paint(); if (!miss.some((x) => x.missing)) dlg.close(); } catch (e) { toast(e.message, 'bad'); }
    } }, icon('upload', 16), m.name)));
    draw();
    const dlg = modal({ title: 'Berkas ada di perangkat lain', body: h('div', h('p.muted', 'Foto dan video tidak ikut tersinkron. Pilih ulang berkas yang sama untuk melanjutkan proyek ini.'), list) });
  }
  async leave() {
    this.player.pause();
    this.closeSheets();
    if (editor.project) { this.makeThumbNow(); await editor.saveNow(); }
    location.hash = '';
    show('home');
    renderHome();
  }
  makeThumbNow() { try { this.player.draw(this.player.t); this.makeThumb(); } catch { /* cover stays */ } }
  async leaveToTemplates() { await this.leave(); setTimeout(() => $('tpl-sec')?.scrollIntoView({ behavior: 'smooth' }), 60); }
  bindKeys() {
    addEventListener('keydown', (e) => {
      if (editorEl.hidden || document.querySelector('.modal-bg')) return;
      const tag = e.target?.tagName;
      if (tag === 'TEXTAREA' || (tag === 'INPUT' && !['range', 'checkbox'].includes(e.target.type)) || tag === 'SELECT' || e.target?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase(), P = this.player;
      const stop = () => { e.preventDefault(); };
      if (k === ' ') { stop(); P.toggle(); }
      else if (mod && k === 'z') { stop(); e.shiftKey ? editor.redo() : editor.undo(); }
      else if (mod && k === 'y') { stop(); editor.redo(); }
      else if (mod && k === 'd') { stop(); A.duplicateSelected(); }
      else if (mod && k === 'c') { A.copySelected(); }
      else if (mod && k === 'v') { A.pasteClip(); }
      else if (mod && k === 'b') { stop(); A.splitAtPlayhead(); }
      else if (mod && k === 's') { stop(); editor.saveNow(); toast('Tersimpan'); }
      else if (k === 's' && !mod) { A.splitAtPlayhead(); }
      else if (k === 'delete' || k === 'backspace') { stop(); A.deleteSelected(); }
      else if (k === 'arrowleft') { stop(); P.pause(); P.seek(P.t - (e.shiftKey ? 1 : 1 / (editor.project?.fps || 30))); }
      else if (k === 'arrowright') { stop(); P.pause(); P.seek(P.t + (e.shiftKey ? 1 : 1 / (editor.project?.fps || 30))); }
      else if (k === 'home') { stop(); P.seek(0); }
      else if (k === 'end') { stop(); P.seek(P.duration); }
      else if (k === 'm') A.toggleMarker();
      else if (k === 'escape') editor.select(null);
      else if (k === '=' || k === '+') this.timeline.zoomBy(1.3);
      else if (k === '-') this.timeline.zoomBy(.77);
    });
  }
  bindDrop() {
    const box = $('drop-veil');
    let n = 0;
    addEventListener('dragenter', (e) => { if (editorEl.hidden || !e.dataTransfer?.types?.includes('Files')) return; n++; box.hidden = false; });
    addEventListener('dragleave', () => { n = Math.max(0, n - 1); if (!n) box.hidden = true; });
    addEventListener('dragover', (e) => { if (!editorEl.hidden) e.preventDefault(); });
    addEventListener('drop', (e) => {
      if (editorEl.hidden) return;
      e.preventDefault(); n = 0; box.hidden = true;
      const files = [...(e.dataTransfer?.files || [])];
      if (files.length) A.importFiles(files, { add: true, where: 'main' });
    });
    addEventListener('paste', (e) => {
      if (editorEl.hidden || ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) return;
      const files = [...(e.clipboardData?.files || [])];
      if (files.length) { e.preventDefault(); A.importFiles(files, { add: true, where: 'overlay' }); }
    });
  }
  transitionDialog(clip) {
    let cat = transitionById(clip.trans?.id)?.cat || TRANSITION_CATS[0];
    const body = h('div');
    const apply = (id) => {
      if (id) clip.trans = { id, d: clip.trans?.d || transitionById(id).d }; else clip.trans = null;
      editor.commit('transition');
      if (id) { this.player.seek(Math.max(0, clip.start + clip.dur - clip.trans.d / 2 - .25)); this.player.play(); setTimeout(() => { if (this.player.t > clip.start + clip.dur + clip.trans?.d / 2 + .2) this.player.pause(); }, (clip.trans.d + .7) * 1000); }
      draw();
    };
    const draw = () => {
      body.replaceChildren(
        h('div.chips', TRANSITION_CATS.map((c) => h('button.chip' + (c === cat ? '.on' : ''), { onclick: () => { cat = c; draw(); } }, c))),
        clip.trans ? slider({ label: 'Durasi', min: .1, max: 3, step: .05, value: clip.trans.d, unit: ' dtk', oninput: (v) => { clip.trans.d = v; this.player.invalidate(); }, onend: () => editor.commit('transition') }) : null,
        h('div.row-btns',
          h('button.btn.sm', { disabled: !clip.trans, onclick: () => apply(null) }, 'Hapus transisi'),
          h('button.btn.sm', { disabled: !clip.trans, onclick: () => { const m = mainTrack(editor.project); m.clips.slice(0, -1).forEach((c) => { c.trans = { ...clip.trans }; }); editor.commit('transition'); toast('Dipakai di semua potongan'); } }, 'Pakai di semua')),
        h('div.grid3', TRANSITIONS.filter((t) => t.cat === cat).map((t) => h('button.fcard' + (clip.trans?.id === t.id ? '.on' : ''), { onclick: () => apply(t.id), title: t.name }, thumbCanvas('transition', t.id), h('span', t.name)))));
    };
    draw();
    modal({ title: 'Transisi', body });
  }

  exportDialog() {
    const P = editor.project;
    if (projectDur(P) <= 0) return toast('Linimasa masih kosong.', 'bad');
    this.player.pause();
    const short = Math.min(P.w, P.h);
    const o = { height: Math.min(1080, short), fps: P.fps || 30, quality: 'good', codec: 'avc' };
    const info = h('div.exp-info');
    const refresh = () => {
      const { w, h: ht } = exportSize(P, o.height), br = estimateBitrate(w, ht, o.fps, o.quality), d = projectDur(P);
      info.replaceChildren(
        h('div', h('small', 'Ukuran'), h('b', w + ' × ' + ht)),
        h('div', h('small', 'Durasi'), h('b', fmtDur(d))),
        h('div', h('small', 'Perkiraan berkas'), h('b', fmtSize((br + 192000) / 8 * d))));
      drawOpts();
    };
    const opts = h('div.form');
    const drawOpts = () => opts.replaceChildren(
      h('label', 'Resolusi', h('div.seg.wrap', RESOLUTIONS.map(([v, l, sub]) => h('button' + (o.height === v ? '.on' : ''), { onclick: () => { o.height = v; refresh(); } }, h('b', l), h('small', sub))))),
      h('label', 'Frame rate', h('div.seg', FRAME_RATES.map((v) => h('button' + (o.fps === v ? '.on' : ''), { onclick: () => { o.fps = v; refresh(); } }, v + ' fps')))),
      h('label', 'Kualitas', h('div.seg', QUALITIES.map(([v, l]) => h('button' + (o.quality === v ? '.on' : ''), { onclick: () => { o.quality = v; refresh(); } }, l)))),
      h('label', 'Format', h('div.seg.wrap', CODECS.map(([v, l, sub]) => h('button' + (o.codec === v ? '.on' : ''), { onclick: () => { o.codec = v; refresh(); } }, h('b', l), h('small', sub))))),
    );
    refresh();
    const ctl = { abort: null };
    const main = h('div', info, opts);
    const others = h('div.row-btns',
      h('button.btn.sm', { onclick: () => doAudio('mp3') }, icon('music', 14), 'Suara MP3'),
      h('button.btn.sm', { onclick: () => doAudio('wav') }, icon('music', 14), 'Suara WAV'),
      h('button.btn.sm', { onclick: async () => { const b = await exportFrame(P, this.player.t); download(b, P.name + '.png'); } }, icon('image', 14), 'Gambar PNG'),
      h('button.btn.sm', { onclick: () => exportSrt() }, icon('caption', 14), 'Subtitel SRT'));
    const goBtn = h('button.btn.primary', { onclick: run }, icon('export', 16), 'Ekspor video');
    const closeBtn = h('button.btn', { onclick: () => m.close() }, 'Tutup');
    const m = modal({ title: 'Ekspor', body: h('div', main, others), foot: [closeBtn, goBtn], onclose: () => { ctl.abort?.abort(); this.closeWake?.(); } });
    const doAudio = async (fmt) => {
      const t = toast('Menyiapkan suara…', '', 120000);
      try { const r = await exportAudio(P, { format: fmt }); download(r.blob, P.name + '.' + r.ext); } catch (e) { toast(e.message, 'bad', 5000); }
      t.remove();
    };
    async function wake() { try { return await navigator.wakeLock?.request('screen'); } catch { return null; } }
    const self = this;
    async function run() {
      await editor.saveNow();
      const bar = h('div.progress.big', h('i')), pct = h('b.exp-pct', '0%'), line = h('p.muted', 'Menyiapkan…');
      main.replaceChildren(h('div.exp-run', pct, bar, line, h('p.note', 'Biarkan halaman ini terbuka. Semua diproses di perangkat Anda.')));
      others.remove(); goBtn.remove();
      closeBtn.textContent = 'Batalkan';
      ctl.abort = new AbortController();
      const lock = await wake(); self.closeWake = () => lock?.release?.().catch(() => {});
      try {
        const r = await exportVideo(P, { ...o, signal: ctl.abort.signal, onProgress: (p, i) => {
          bar.firstChild.style.width = (p * 100).toFixed(1) + '%'; pct.textContent = Math.round(p * 100) + '%';
          if (typeof i === 'string') line.textContent = i;
          else if (i?.total) line.textContent = 'Bingkai ' + i.frame + ' / ' + i.total + ' · sisa ' + fmtDur(i.eta) + ' · ' + i.speed.toFixed(1) + '× waktu nyata';
        } });
        ctl.abort = null; lock?.release?.().catch(() => {});
        const url = URL.createObjectURL(r.blob), name = (P.name || 'video') + ' ' + r.stats.h + 'p.' + r.ext;
        window.__lastExport = r;
        const vid = h('video.exp-video', { src: url, controls: true, playsInline: true, muted: false });
        main.replaceChildren(vid, h('div.exp-info', h('div', h('small', 'Ukuran'), h('b', r.stats.w + ' × ' + r.stats.h)), h('div', h('small', 'Berkas'), h('b', fmtSize(r.blob.size))), h('div', h('small', 'Waktu proses'), h('b', fmtDur(r.stats.took)))));
        closeBtn.textContent = 'Tutup';
        closeBtn.parentElement.append(
          navigator.canShare?.({ files: [new File([], 'a.mp4', { type: 'video/mp4' })] }) ? h('button.btn', { onclick: () => navigator.share({ files: [new File([r.blob], name, { type: r.blob.type })] }).catch(() => {}) }, 'Bagikan') : '',
          h('button.btn.primary', { onclick: () => download(r.blob, name) }, icon('download', 16), 'Simpan video'));
        download(r.blob, name);
      } catch (e) {
        lock?.release?.().catch(() => {});
        if (e.name === 'AbortError') { toast('Ekspor dibatalkan'); m.close(); return; }
        console.error(e);
        line.textContent = 'Gagal: ' + e.message;
        closeBtn.textContent = 'Tutup';
      }
    }
  }
}

async function openEditor(p) {
  shell ||= new Shell();
  show('editor');
  if (location.hash !== '#p=' + p.id) history.replaceState(null, '', '#p=' + p.id);
  await restoreMedia(p.media);
  sampleMedia();
  for (const t of p.tracks) for (const c of t.clips) if (hasAudio(c) && !c.muted) getAudio(c.media).catch(() => {});
  editor.open(p);
  await editor.saveNow();
  if (p.tracks.some((t) => t.clips.some((c) => c.kind === 'text'))) for (const t of p.tracks) for (const c of t.clips) if (c.kind === 'text') ensureFont(c, () => shell.player.invalidate());
  $('b-undo').disabled = true; $('b-redo').disabled = true;
  shell.player.invalidate();
  document.title = p.name + ' · Amatu Cut';
}
async function openProject(id) {
  const p = await getProject(id);
  if (!p) { toast('Proyek tidak ditemukan.', 'bad'); location.hash = ''; show('home'); renderHome(); return; }
  openEditor(p);
}

async function boot() {
  const test = document.createElement('canvas').getContext('webgl2');
  if (!test) { homeEl.replaceChildren(h('div.fatal', h('h2', 'Browser ini belum didukung'), h('p', 'Amatu Cut membutuhkan WebGL2. Gunakan Chrome, Edge atau Safari versi terbaru.'))); return; }
  test.getExtension('WEBGL_lose_context')?.loseContext();
  sampleMedia();
  const m = location.hash.match(/#p=(.+)/);
  if (m) { await openProject(m[1]); } else { show('home'); await renderHome(); }
  window.addEventListener('beforeunload', () => { if (editor.project) editor.saveNow(); });
  setTimeout(() => sweepMedia(3 * 864e5).catch(() => {}), 8000);
}
window.AMATU_CUT = { editor, get shell() { return shell; }, openEditor, newProject, TEMPLATES, applyTemplate, exportVideo, exportAudio, getAudio, isVisual, isSrcTimed, debounce };
boot();
