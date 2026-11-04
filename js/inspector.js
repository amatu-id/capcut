// The right panel (a sheet on a phone): everything about the selected clip, or the project when nothing is selected.
import { h, icon, toast, download, pickFiles, clamp } from './util.js';
import { editor } from './store.js';
import { getMedia, getAudio, importFile } from './media.js';
import * as A from './actions.js';
import { RATIOS, SPEED_CURVES, propValue, keyAt, setKey, delKey, hasKeys, setProp, setSpeed, setCurve, normalizeMain, isVisual, allKeyTimes, trackKindFor, projectDur, isSrcTimed } from './model.js';
import { ADJUST_FIELDS, FILTERS, FILTER_CATS } from './filters.js';
import { EFFECTS, effectById } from './effects.js';
import { TRANSITIONS, transitionById } from './transitions.js';
import { ANIM_IN, ANIM_OUT, ANIM_LOOP } from './anim.js';
import { TEXT_IN, TEXT_OUT, TEXT_LOOP, FONTS, TEXT_PRESETS, ensureFont } from './text.js';
import { BLENDS, MASKS } from './render.js';
import { VOICES } from './audio.js';
import { thumbCanvas } from './frames.js';
import { exportAudio } from './export.js';
import { removeSilence, splitScenes, beatsOf, fitMainToBeats, analyzeVideo } from './autoedit.js';
import { upscaleImage, upscaleVideoClip, removeBackground } from './ai.js';

const EASES = [['linear', 'Linear'], ['inout', 'Halus'], ['in', 'Pelan → Cepat'], ['out', 'Cepat → Pelan'], ['back', 'Lewat Sedikit'], ['elastic', 'Elastis'], ['bounce', 'Memantul'], ['hold', 'Tahan']];

const pl = () => A.getPlayer();
const live = () => { editor.touch(); pl().invalidate(); };
const done = (l) => { editor.commit(l); pl().refresh(); };
const u = (c) => clamp(pl().t - c.start, 0, c.dur);

export function slider({ label, min, max, step = 0.01, value, fmt, unit = '', oninput, onend }) {
  const display = (v) => (fmt ? fmt(v) : Math.abs(step) >= 1 ? Math.round(v) : (+v).toFixed(step < 0.1 ? 2 : 1)) + unit;
  const val = h('input.val', {
    value: display(value), inputMode: 'decimal', 'aria-label': label,
    onfocus: () => val.select(),
    onchange: () => { const n = parseFloat(val.value.replace(',', '.')); if (isFinite(n)) { const f = fmt?.inverse ? fmt.inverse(n) : n, v = clamp(f, min, max); r.value = v; oninput(v); onend?.(v); val.value = display(v); r.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%'); } else val.value = display(+r.value); },
  });
  const r = h('input.range', { type: 'range', min, max, step, value, 'aria-label': label,
    oninput: () => { const v = +r.value; val.value = display(v); r.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%'); oninput(v); },
    onchange: () => onend?.(+r.value), ondblclick: () => { const d = min <= 0 && max >= 0 ? 0 : min; r.value = d; val.value = display(d); r.style.setProperty('--p', ((d - min) / (max - min)) * 100 + '%'); oninput(d); onend?.(d); } });
  r.style.setProperty('--p', ((value - min) / (max - min)) * 100 + '%');
  const el = h('div.ctl', h('label.ctl-l', label), r, val);
  el.set = (v) => { r.value = v; val.value = display(v); r.style.setProperty('--p', ((v - min) / (max - min)) * 100 + '%'); };
  return el;
}
const pct = (v) => Math.round(v * 100);
pct.inverse = (n) => n / 100;

function toggle(label, value, on) { const i = h('input', { type: 'checkbox', checked: !!value, onchange: () => on(i.checked) }); return h('label.toggle', h('span', label), i, h('i')); }
function select(label, opts, value, on) { const s = h('select.input', { 'aria-label': label, onchange: () => on(s.value) }, opts.map(([v, l]) => h('option', { value: v, selected: v === value }, l))); return h('div.ctl.ctl-sel', h('label.ctl-l', label), s); }
function colorInput(label, value, on, onend) { const i = h('input.color', { type: 'color', value: value || '#000000', 'aria-label': label, oninput: () => on(i.value), onchange: () => onend?.(i.value) }); return h('div.ctl.ctl-sel', h('label.ctl-l', label), i); }
const section = (title, ...kids) => h('section.sec', title ? h('h4', title) : null, kids);
/** The colour that dominates the picture's border, which on a green screen is the screen itself. */
function keyColorOf(c) {
  const src = c.kind === 'image' ? getMedia(c.media)?.bitmap : pl().pool.get(c)?.v;
  if (!src || (src.readyState !== undefined && src.readyState < 2)) return null;
  const W = 64, H = 36, x = new OffscreenCanvas(W, H).getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data, bins = new Map();
  for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) {
    if (px > 3 && px < W - 4 && py > 3 && py < H - 4) continue;
    const i = (py * W + px) * 4, key = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4);
    const b = bins.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2]; bins.set(key, b);
  }
  let top = null;
  for (const b of bins.values()) if (!top || b.n > top.n) top = b;
  if (!top) return null;
  const hex = (v) => Math.round(v / top.n).toString(16).padStart(2, '0');
  return '#' + hex(top.r) + hex(top.g) + hex(top.b);
}
const animCard = (name, on, cur) => h('button.anim' + (cur ? '.on' : ''), { onclick: on }, name);

export class Inspector {
  constructor(root, titleEl) { this.root = root; this.titleEl = titleEl; this.tab = {}; this.livers = []; }
  render() {
    const s = editor.selected;
    this.livers = [];
    this.root.replaceChildren();
    if (!editor.project) return;
    if (!s) { this.titleEl.textContent = 'Proyek'; this.root.append(this.projectPanel()); return; }
    const c = s.clip;
    const tabs = this.tabsFor(c);
    const kind = c.kind;
    let cur = this.tab[kind];
    if (!tabs.some((t) => t[0] === cur)) cur = tabs[0][0];
    this.tab[kind] = cur;
    this.titleEl.textContent = { video: 'Video', image: 'Foto', color: 'Warna', audio: 'Audio', text: 'Teks', sticker: 'Stiker', effect: 'Efek', filter: 'Filter', adjust: 'Penyesuaian' }[kind];
    const bar = h('div.tabs', tabs.map(([id, label]) => h('button' + (id === cur ? '.on' : ''), { onclick: () => { this.tab[kind] = id; this.render(); } }, label)));
    const body = tabs.find((t) => t[0] === cur)[2].call(this, c, s.track);
    this.root.append(tabs.length > 1 ? bar : '', h('div.tab-body', body));
  }
  /** Sliders of animated values follow the playhead. */
  tick() { if (this.livers.length) for (const f of this.livers) f(); }
  tabsFor(c) {
    const V = ['video', 'image', 'color'].includes(c.kind);
    if (c.kind === 'video') return [['basic', 'Dasar', this.basic], ['anim', 'Gerak', this.motion], ['speed', 'Kecepatan', this.speed], ['color', 'Warna', this.color], ['fx', 'Efek', this.clipFx], ['mask', 'Masker', this.maskPanel], ['q', 'Kualitas', this.quality], ['sound', 'Suara', this.sound]];
    if (V) return [['basic', 'Dasar', this.basic], ['anim', 'Gerak', this.motion], ['color', 'Warna', this.color], ['fx', 'Efek', this.clipFx], ['mask', 'Masker', this.maskPanel], ...(c.kind === 'image' ? [['q', 'Kualitas', this.quality]] : [])];
    if (c.kind === 'audio') return [['sound', 'Suara', this.sound], ['voice', 'Ubah Suara', this.voice], ['eq', 'EQ', this.eq], ['speed', 'Kecepatan', this.speed], ['beat', 'Ketukan', this.beat]];
    if (c.kind === 'text') return [['text', 'Teks', this.textPanel], ['style', 'Gaya', this.textStyle], ['tanim', 'Animasi', this.textAnim], ['basic', 'Posisi', this.basic], ['anim', 'Gerak', this.motion]];
    if (c.kind === 'sticker') return [['basic', 'Posisi', this.basic], ['anim', 'Gerak', this.motion]];
    if (c.kind === 'effect') return [['fxclip', 'Efek', this.fxClip]];
    if (c.kind === 'filter') return [['fltclip', 'Filter', this.filterClip]];
    return [['adjclip', 'Penyesuaian', this.adjustClip]];
  }
  keyed(c, prop, label, min, max, step, fmt) {
    const el = slider({ label, min, max, step, fmt, value: propValue(c, prop, u(c)), oninput: (v) => { setProp(c, prop, u(c), v); live(); }, onend: () => done(prop) });
    const dia = h('button.key', { title: 'Keyframe', 'aria-label': 'Keyframe ' + label, onclick: () => {
      const t = u(c);
      if (keyAt(c, prop, t)) delKey(c, prop, t); else setKey(c, prop, t, propValue(c, prop, t));
      paint(); done('key');
    } }, icon('keyframe', 14));
    const paint = () => { dia.classList.toggle('has', hasKeys(c, prop)); dia.classList.toggle('on', !!keyAt(c, prop, u(c))); };
    paint();
    el.append(dia);
    this.livers.push(() => { if (hasKeys(c, prop)) { el.set(propValue(c, prop, u(c))); paint(); } else paint(); });
    return el;
  }
  basic(c) {
    const out = [];
    out.push(section('Transformasi',
      this.keyed(c, 's', 'Skala', 0.05, 5, 0.01, pct),
      this.keyed(c, 'x', 'Posisi X', -1.5, 1.5, 0.005, pct),
      this.keyed(c, 'y', 'Posisi Y', -1.5, 1.5, 0.005, pct),
      this.keyed(c, 'rot', 'Putar', -360, 360, 1),
      this.keyed(c, 'op', 'Opasitas', 0, 1, 0.01, pct),
      h('div.row-btns',
        h('button.btn.sm', { onclick: () => { c.tf = { x: 0, y: 0, s: 1, rot: 0, op: c.tf.op }; c.kf = {}; done('reset'); this.render(); } }, 'Atur ulang'),
        h('button.btn.sm', { onclick: () => A.flipSelected('h') }, icon('flip', 14), 'Cermin'),
        h('button.btn.sm', { onclick: () => A.rotateSelected() }, icon('rotate', 14), '90°'))));
    if (['video', 'image'].includes(c.kind)) {
      const CR = [['free', 'Bebas'], ['16:9', '16:9'], ['9:16', '9:16'], ['1:1', '1:1'], ['4:5', '4:5'], ['4:3', '4:3']];
      const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 };
      const setCrop = (k, v) => { c.crop = { ...cr, ...c.crop, [k]: v }; live(); };
      const m = getMedia(c.media);
      const preset = (id) => {
        if (id === 'free' || !m?.w) { c.crop = null; done('crop'); this.render(); return; }
        const [a, b] = id.split(':').map(Number), want = a / b, have = m.w / m.h;
        c.crop = want < have ? { l: (1 - want / have) / 2, r: (1 - want / have) / 2, t: 0, b: 0 } : { l: 0, r: 0, t: (1 - have / want) / 2, b: (1 - have / want) / 2 };
        done('crop'); this.render();
      };
      out.push(section('Tata letak',
        h('div.seg', [['contain', 'Pas'], ['cover', 'Penuh'], ['stretch', 'Regang']].map(([k, l]) => h('button' + (c.fit === k ? '.on' : ''), { onclick: () => { c.fit = k; done('fit'); this.render(); } }, l))),
        slider({ label: 'Sudut bulat', min: 0, max: 1, value: c.radius || 0, fmt: pct, oninput: (v) => { c.radius = v; live(); }, onend: () => done('radius') }),
        select('Blend', BLENDS, c.blend || 'normal', (v) => { c.blend = v; done('blend'); })));
      out.push(section('Potong gambar',
        h('div.chips', CR.map(([id, l]) => h('button.chip', { onclick: () => preset(id) }, l))),
        slider({ label: 'Kiri', min: 0, max: .48, value: cr.l, fmt: pct, oninput: (v) => setCrop('l', v), onend: () => done('crop') }),
        slider({ label: 'Kanan', min: 0, max: .48, value: cr.r, fmt: pct, oninput: (v) => setCrop('r', v), onend: () => done('crop') }),
        slider({ label: 'Atas', min: 0, max: .48, value: cr.t, fmt: pct, oninput: (v) => setCrop('t', v), onend: () => done('crop') }),
        slider({ label: 'Bawah', min: 0, max: .48, value: cr.b, fmt: pct, oninput: (v) => setCrop('b', v), onend: () => done('crop') })));
    }
    if (c.kind === 'image' || c.kind === 'color' || c.kind === 'text' || c.kind === 'sticker') {
      out.push(section('Durasi', slider({ label: 'Detik', min: 0.1, max: 60, step: 0.1, value: c.dur, oninput: (v) => { c.dur = v; if (editor.selected?.track.kind === 'main') normalizeMain(editor.project); live(); }, onend: () => done('dur') })));
    }
    if (c.kind === 'color') out.push(section('Warna', colorInput('Warna', c.color, (v) => { c.color = v; live(); }, () => done('color'))));
    return out;
  }
  motion(c) {
    const isText = c.kind === 'text';
    const animSec = (title, list, slot, durMax) => {
      const cur = c.anim?.[slot];
      const grid = h('div.anim-grid', animCard('Tanpa', () => { c.anim[slot] = null; done('anim'); this.render(); }, !cur), list.map((a) => animCard(a.name, () => {
        c.anim[slot] = { id: a.id, d: slot === 'loop' ? 0 : a.d };
        done('anim');
        pl().seek(slot === 'out' ? Math.max(c.start, c.start + c.dur - (a.d || .5) - .1) : c.start);
        pl().play();
        setTimeout(() => { if (pl().t > c.start + (slot === 'loop' ? 1.8 : (a.d || .5) + .25)) pl().pause(); }, slot === 'loop' ? 1800 : ((a.d || .5) + .3) * 1000);
        this.render();
      }, cur?.id === a.id)));
      return section(title, grid, cur && slot !== 'loop' ? slider({ label: 'Durasi', min: .1, max: durMax, step: .05, value: cur.d ?? .5, oninput: (v) => { cur.d = v; live(); }, onend: () => done('anim') }) : null);
    };
    const keys = allKeyTimes(c);
    const kfSec = section('Keyframe (gerak antar bingkai)',
      h('p.note', 'Ubah nilai pada dua titik waktu berbeda, klip bergerak halus di antaranya. Sentuh tombol wajik di tab Dasar, atau gunakan tombol di bawah.'),
      h('div.row-btns',
        h('button.btn.sm', { onclick: () => { const t = u(c); ['x', 'y', 's', 'rot', 'op'].forEach((p) => setKey(c, p, t, propValue(c, p, t))); done('key'); this.render(); toast('Keyframe ditambahkan pada ' + t.toFixed(2) + ' dtk'); } }, icon('keyframe', 14), 'Tambah keyframe'),
        h('button.btn.sm', { disabled: !keys.length, onclick: () => { c.kf = {}; done('key'); this.render(); } }, 'Hapus semua')),
      keys.length ? h('div.key-list', keys.map((t) => h('button.key-t', { onclick: () => pl().seek(c.start + t) }, t.toFixed(2) + ' s'))) : null,
      keys.length ? select('Gerak antar titik', EASES, Object.values(c.kf)[0]?.[0]?.e || 'inout', (v) => { for (const l of Object.values(c.kf)) l.forEach((k) => { k.e = v; }); done('ease'); }) : null,
      h('h5', 'Gerak siap pakai'),
      h('div.anim-grid', [
        ['Geser Kiri → Kanan', { x: [-.25, .25] }], ['Geser Kanan → Kiri', { x: [.25, -.25] }], ['Naik', { y: [.2, -.2] }], ['Turun', { y: [-.2, .2] }],
        ['Zoom Masuk', { s: [1, 1.5] }], ['Zoom Keluar', { s: [1.5, 1] }], ['Putar', { rot: [-8, 8] }], ['Muncul', { op: [0, 1] }],
      ].map(([name, spec]) => animCard(name, () => {
        for (const [p, [a, b]] of Object.entries(spec)) { c.kf[p] = [{ t: 0, v: a, e: 'inout' }, { t: c.dur, v: b, e: 'inout' }]; }
        done('key'); pl().seek(c.start); pl().play(); this.render();
      }))));
    return [isText ? null : animSec('Masuk', ANIM_IN, 'in', Math.min(5, c.dur)), isText ? null : animSec('Keluar', ANIM_OUT, 'out', Math.min(5, c.dur)), animSec('Berulang', ANIM_LOOP, 'loop', 1), kfSec];
  }
  speed(c, track) {
    const after = () => { if (track.kind === 'main') normalizeMain(editor.project); };
    const chips = [0.25, 0.5, 1, 1.5, 2, 4, 8];
    const media = getMedia(c.media);
    const curveSec = section('Kurva kecepatan',
      h('div.anim-grid', animCard('Normal', () => { setCurve(c, null); c.dur = c.len / c.speed; after(); done('curve'); this.render(); }, !c.curve), SPEED_CURVES.map((sc) => animCard(sc.name, () => { setCurve(c, sc); after(); done('curve'); this.render(); }, c.curve?.id === sc.id))),
      c.curve ? h('div.curve-eds', c.curve.pts.map((p, i) => h('input.vr', { type: 'range', min: .1, max: 6, step: .1, value: p, title: p + '×', orient: 'vertical', oninput: (e) => { c.curve.pts[i] = +e.target.value; c.curve.id = 'custom'; setCurve(c, c.curve); after(); live(); }, onchange: () => done('curve') }))) : null);
    return [
      section('Kecepatan tetap',
        h('div.chips', chips.map((v) => h('button.chip' + (!c.curve && Math.abs(c.speed - v) < 1e-3 ? '.on' : ''), { onclick: () => { setSpeed(c, v); after(); done('speed'); this.render(); } }, v + '×'))),
        slider({ label: 'Kecepatan', min: 0.1, max: 16, step: 0.05, unit: '×', value: c.speed, oninput: (v) => { setSpeed(c, v); after(); live(); }, onend: () => { done('speed'); this.render(); } }),
        toggle('Pertahankan nada suara', c.keepPitch, (v) => { c.keepPitch = v; done('pitch'); }),
        c.kind === 'video' ? toggle('Gerak lambat halus saat ekspor', c.blendFrames, (v) => { c.blendFrames = v; done('blend'); }) : null,
        toggle('Putar terbalik', c.reverse, (v) => { c.reverse = v; done('reverse'); }),
        h('p.muted.small', 'Durasi klip: ' + c.dur.toFixed(2) + ' dtk' + (media ? ' · dari ' + c.len.toFixed(2) + ' dtk sumber' : ''))),
      curveSec,
    ];
  }
  color(c) {
    const cur = c.filter;
    const applyF = (id) => { c.filter = id ? { id, amt: c.filter?.amt ?? 1 } : null; done('filter'); this.render(); };
    return [
      section('Filter',
        cur ? slider({ label: 'Kekuatan', min: 0, max: 1, value: cur.amt ?? 1, fmt: pct, oninput: (v) => { cur.amt = v; live(); }, onend: () => done('filter') }) : null,
        h('button.anim' + (!cur ? '.on' : ''), { onclick: () => applyF(null) }, 'Tanpa filter'),
        ...FILTER_CATS.map((cat) => h('details', { open: FILTERS.find((f) => f.id === cur?.id)?.cat === cat || (!cur && cat === FILTER_CATS[0]) }, h('summary', cat),
          h('div.grid3', FILTERS.filter((f) => f.cat === cat).map((f) => h('button.fcard' + (cur?.id === f.id ? '.on' : ''), { onclick: () => applyF(f.id), title: f.name }, thumbCanvas('filter', f.id), h('span', f.name))))))),
      section('Penyesuaian', ...ADJUST_FIELDS.map(([k, label, min, max]) => slider({ label, min, max, step: k === 'hue' ? 1 : .01, value: c.adjust?.[k] || 0, fmt: k === 'hue' ? null : pct, oninput: (v) => { (c.adjust ||= {})[k] = v; live(); }, onend: () => done('adjust') })),
        h('button.btn.sm', { onclick: () => { c.adjust = {}; done('adjust'); this.render(); } }, 'Atur ulang warna')),
    ];
  }
  clipFx(c) {
    const list = c.fx ||= [];
    return [
      section('Efek pada klip ini', list.length ? list.map((f, i) => h('div.fx-row', h('b', effectById(f.id)?.name || f.id),
        slider({ label: 'Kuat', min: 0, max: 1, value: f.amt ?? 1, fmt: pct, oninput: (v) => { f.amt = v; live(); }, onend: () => done('fx') }),
        h('button.ib', { title: 'Hapus', onclick: () => { list.splice(i, 1); done('fx'); this.render(); } }, icon('trash', 15)))) : h('p.muted.small', 'Belum ada. Pilih di bawah.')),
      section('Tambah efek', h('div.grid3', EFFECTS.map((e) => h('button.fcard', { title: e.name, onclick: () => { list.push({ id: e.id, amt: 1, p1: .5, p2: .5 }); done('fx'); this.render(); } }, thumbCanvas('effect', e.id), h('span', e.name))))),
    ];
  }
  maskPanel(c) {
    const m = c.mask, k = c.chroma;
    const setM = (patch) => { c.mask = { type: 'rect', x: .5, y: .5, w: .7, h: .7, rot: 0, feather: 0.01, invert: false, ...c.mask, ...patch }; };
    const out = [
      section('Masker',
        h('div.anim-grid', MASKS.map(([id, name]) => animCard(name, () => { if (id === 'none') c.mask = null; else setM({ type: id }); done('mask'); this.render(); }, (m?.type || 'none') === id))),
        m ? [
          slider({ label: 'Posisi X', min: 0, max: 1, value: m.x, fmt: pct, oninput: (v) => { m.x = v; live(); }, onend: () => done('mask') }),
          slider({ label: 'Posisi Y', min: 0, max: 1, value: m.y, fmt: pct, oninput: (v) => { m.y = v; live(); }, onend: () => done('mask') }),
          slider({ label: 'Lebar', min: .05, max: 2, value: m.w, fmt: pct, oninput: (v) => { m.w = v; live(); }, onend: () => done('mask') }),
          slider({ label: 'Tinggi', min: .05, max: 2, value: m.h, fmt: pct, oninput: (v) => { m.h = v; live(); }, onend: () => done('mask') }),
          slider({ label: 'Putar', min: -180, max: 180, step: 1, value: m.rot, oninput: (v) => { m.rot = v; live(); }, onend: () => done('mask') }),
          slider({ label: 'Tepi halus', min: 0, max: .5, value: m.feather, fmt: pct, oninput: (v) => { m.feather = v; live(); }, onend: () => done('mask') }),
          toggle('Balik masker', m.invert, (v) => { m.invert = v; done('mask'); }),
        ] : null),
    ];
    if (c.kind === 'video' || c.kind === 'image') out.push(section('Hapus warna latar (green screen)',
      toggle('Aktifkan', !!k, (v) => { c.chroma = v ? { color: keyColorOf(c) || '#00ff00', amt: .3, soft: .2, spill: .5 } : null; done('chroma'); this.render(); }),
      k ? [
        h('button.btn.sm', { onclick: () => { const col = keyColorOf(c); if (col) { k.color = col; done('chroma'); this.render(); } else toast('Gambar belum siap, coba lagi.'); } }, icon('chroma', 14), 'Deteksi warna latar'),
        colorInput('Warna latar', k.color, (v) => { k.color = v; live(); }, () => done('chroma')),
        slider({ label: 'Ketebalan', min: 0, max: 1, value: k.amt, fmt: pct, oninput: (v) => { k.amt = v; live(); }, onend: () => done('chroma') }),
        slider({ label: 'Tepi halus', min: 0, max: 1, value: k.soft, fmt: pct, oninput: (v) => { k.soft = v; live(); }, onend: () => done('chroma') }),
        slider({ label: 'Pantulan', min: 0, max: 1, value: k.spill, fmt: pct, oninput: (v) => { k.spill = v; live(); }, onend: () => done('chroma') }),
      ] : null));
    if (c.kind === 'image') out.push(section('Hapus latar otomatis',
      h('p.note', 'AI memisahkan orang atau benda dari latarnya, di perangkat ini.'),
      this.aiButton(c.cut ? 'Kembalikan latar' : 'Hapus latar foto', 'wand', async (prog) => {
        if (c.cut) { c.cut = null; done('cut'); this.render(); return; }
        const m2 = await removeBackground(getMedia(c.media), { onProgress: prog });
        c.cut = { media: m2.id }; done('cut'); this.render();
      })));
    return out;
  }
  aiButton(label, ic, run) {
    const bar = h('div.progress.hide', h('i')), txt = h('p.muted.small');
    let busy = false;
    const b = h('button.btn.w100', { onclick: async () => {
      if (busy) return;
      busy = true; b.disabled = true; bar.classList.remove('hide');
      const prog = (p, t) => { bar.firstChild.style.width = Math.round(clamp(p) * 100) + '%'; if (t) txt.textContent = t; };
      try { await run(prog); } catch (e) { txt.textContent = 'Gagal: ' + e.message; toast('Gagal: ' + e.message, 'bad', 5000); }
      busy = false; b.disabled = false; bar.classList.add('hide');
    } }, icon(ic, 16), label);
    return h('div', b, bar, txt);
  }
  quality(c) {
    const m = getMedia(c.media);
    const info = m ? `${m.w} × ${m.h} px` + (c.up ? ' · versi HD aktif' : '') : '';
    const up = c.up?.media ? getMedia(c.up.media) : null;
    return [
      section('Peningkat cepat (langsung)',
        slider({ label: 'Ketajaman', min: 0, max: 1, value: c.sharp || 0, fmt: pct, oninput: (v) => { c.sharp = v; live(); }, onend: () => done('sharp') }),
        slider({ label: 'Kurangi bintik', min: 0, max: 1, value: c.cleanup || 0, fmt: pct, oninput: (v) => { c.cleanup = v; live(); }, onend: () => done('clean') }),
        h('p.note', 'Pakai GPU, tampak langsung di pratinjau. Saat ekspor resolusi tinggi, gambar kecil diperbesar dengan penajam tepi.')),
      section('Peningkat AI',
        h('p.muted.small', 'Sumber: ' + info + (up ? ' → ' + up.w + ' × ' + up.h + ' px' : '')),
        c.kind === 'image' ? this.aiButton(c.up ? 'Kembali ke asli' : 'Tingkatkan foto 2× dengan AI', 'hd', async (prog) => {
          if (c.up) { c.up = null; done('up'); this.render(); return; }
          const nm = await upscaleImage(m, { factor: 2, onProgress: prog });
          c.up = { media: nm.id }; done('up'); this.render(); toast('Foto ditingkatkan');
        }) : this.aiButton(c.up ? 'Kembali ke video asli' : 'Tingkatkan video ke 1080p dengan AI', 'hd', async (prog) => {
          if (c.up) { c.up = null; done('up'); this.render(); return; }
          if (c.len > 30) toast('Ini bisa lama: setiap bingkai diproses AI satu per satu.', '', 4000);
          const r = await upscaleVideoClip(c, { targetShort: 1080, onProgress: prog });
          c.up = { media: r.media.id, offset: r.offset }; done('up'); this.render(); toast('Video ditingkatkan');
        }),
        h('p.note', 'Model AI diunduh sekali (±2,5 MB). Video diproses bingkai demi bingkai, paling cocok untuk klip pendek.')),
    ];
  }
  sound(c, track) {
    const hasSrc = getMedia(c.media)?.hasAudio !== false;
    if (!hasSrc) return section('Suara', h('p.muted', 'Video ini tidak memiliki suara.'));
    const dlMenu = async (fmt) => {
      const t = toast('Menyiapkan suara…', '', 60000);
      try { const r = await exportAudio(editor.project, { format: fmt, clip: c }); download(r.blob, (c.name || 'suara').replace(/\.[^.]+$/, '') + '.' + r.ext); } catch (e) { toast(e.message, 'bad'); }
      t.remove();
    };
    return [
      section('Volume',
        toggle('Bisukan klip', c.muted, (v) => { c.muted = v; done('mute'); }),
        this.keyed(c, 'vol', 'Volume', 0, 4, 0.01, pct),
        slider({ label: 'Masuk halus', min: 0, max: Math.min(10, c.dur), step: .05, value: c.fadeIn, unit: ' dtk', oninput: (v) => { c.fadeIn = v; live(); }, onend: () => done('fade') }),
        slider({ label: 'Keluar halus', min: 0, max: Math.min(10, c.dur), step: .05, value: c.fadeOut, unit: ' dtk', oninput: (v) => { c.fadeOut = v; live(); }, onend: () => done('fade') }),
        toggle('Samakan keras suara', c.audio.norm, (v) => { c.audio.norm = v; done('norm'); }),
        c.kind === 'audio' ? slider({ label: 'Redam musik', min: 0, max: 1, value: c.duck || 0, fmt: pct, oninput: (v) => { c.duck = v; }, onend: () => done('duck') }) : null),
      section('Bersihkan',
        slider({ label: 'Kurangi bising', min: 0, max: 1, value: c.audio.denoise, fmt: pct, oninput: (v) => { c.audio.denoise = v; }, onend: () => done('denoise') }),
        toggle('Pemadat suara (compressor)', c.audio.comp, (v) => { c.audio.comp = v; done('comp'); }),
        this.aiButton('Hapus jeda diam otomatis', 'scissors', async () => {
          const n = await removeSilence(editor.project, track, c);
          done('silence');
          toast(n ? 'Jeda ' + n.toFixed(1) + ' detik dihapus' : 'Tidak ditemukan jeda panjang');
          this.render();
        })),
      section('Simpan suara',
        h('div.row-btns',
          h('button.btn.sm', { onclick: () => dlMenu('mp3') }, icon('download', 14), 'MP3'),
          h('button.btn.sm', { onclick: () => dlMenu('wav') }, icon('download', 14), 'WAV'),
          c.kind === 'video' ? h('button.btn.sm', { onclick: () => A.extractAudio() }, icon('extract', 14), 'Ekstrak ke trek') : null)),
      c.kind === 'video' ? [section('Ubah suara', ...this.voice(c))] : null,
    ];
  }
  voice(c) {
    const a = c.audio;
    const cats = [...new Set(VOICES.map((v) => v.cat))];
    return [
      h('h5', 'Intonasi'),
      slider({ label: 'Nada', min: -12, max: 12, step: .5, value: a.pitch, unit: ' smt', oninput: (v) => { a.pitch = v; }, onend: () => done('pitch') }),
      h('h5', 'Gema & ruang'),
      slider({ label: 'Gema', min: 0, max: 1, value: a.echo, fmt: pct, oninput: (v) => { a.echo = v; }, onend: () => done('echo') }),
      slider({ label: 'Jeda gema', min: .05, max: 1.2, step: .01, value: a.echoTime, unit: ' dtk', oninput: (v) => { a.echoTime = v; }, onend: () => done('echo') }),
      slider({ label: 'Ulangan gema', min: 0, max: .9, value: a.echoFb, fmt: pct, oninput: (v) => { a.echoFb = v; }, onend: () => done('echo') }),
      slider({ label: 'Gaung', min: 0, max: 1, value: a.reverb, fmt: pct, oninput: (v) => { a.reverb = v; }, onend: () => done('reverb') }),
      slider({ label: 'Ukuran ruang', min: 0, max: 1, value: a.room, fmt: pct, oninput: (v) => { a.room = v; }, onend: () => done('reverb') }),
      h('h5', 'Pengubah suara'),
      ...cats.map((cat) => h('div', h('small.lbl', cat), h('div.anim-grid', VOICES.filter((v) => v.cat === cat).map((v) => animCard(v.name, () => { a.voice = v.id; done('voice'); this.render(); }, a.voice === v.id))))),
    ];
  }
  eq(c) {
    const a = c.audio, labels = ['Bass 80 Hz', '300 Hz', '1 kHz', '4 kHz', 'Treble 11 kHz'];
    const P = [['Datar', [0, 0, 0, 0, 0]], ['Bass Kuat', [7, 3, 0, 0, 1]], ['Suara Jelas', [-2, -1, 2, 4, 2]], ['Hangat', [3, 2, 0, -1, -2]], ['Cerah', [-1, 0, 1, 3, 5]], ['Podcast', [-3, 1, 3, 3, 0]], ['Musik', [4, 1, -1, 2, 4]]];
    return [
      section('Preset', h('div.anim-grid', P.map(([n, v]) => animCard(n, () => { a.eq = [...v]; done('eq'); this.render(); }, a.eq.join() === v.join())))),
      section('Ekualiser', a.eq.map((g, i) => slider({ label: labels[i], min: -12, max: 12, step: .5, value: g, unit: ' dB', oninput: (v) => { a.eq[i] = v; }, onend: () => done('eq') }))),
      section('Saring', slider({ label: 'Potong rendah', min: 0, max: 1, value: a.low, fmt: pct, oninput: (v) => { a.low = v; }, onend: () => done('low') }), slider({ label: 'Potong tinggi', min: 0, max: 1, value: a.high, fmt: pct, oninput: (v) => { a.high = v; }, onend: () => done('high') })),
    ];
  }
  beat(c) {
    const info = h('p.muted.small', '');
    const media = getMedia(c.media);
    if (media?.beats) info.textContent = 'Terdeteksi ' + media.beats.bpm + ' BPM, ' + media.beats.beats.length + ' ketukan.';
    const addMarkers = async (mode) => {
      const b = await beatsOf(c.media);
      if (!b?.beats?.length) throw new Error('Ketukan tidak terdeteksi.');
      info.textContent = 'Terdeteksi ' + b.bpm + ' BPM, ' + b.beats.length + ' ketukan.';
      const ratio = c.dur / c.len, mapT = (s) => c.start + (s - c.in) * ratio;
      const list = b.beats.filter((s) => s >= c.in && s < c.in + c.len).map(mapT);
      if (mode === 'mark') { editor.project.markers = [...new Set([...(editor.project.markers || []), ...list.map((x) => +x.toFixed(3))])].sort((x, y) => x - y); done('markers'); toast(list.length + ' penanda ketukan ditambahkan'); }
      if (mode === 'fit') { const n = fitMainToBeats(editor.project, list, 2); done('fit-beat'); toast(n + ' klip disesuaikan dengan ketukan'); }
    };
    return section('Ketukan otomatis',
      h('p.note', 'Mencari tempo lagu, lalu memberi penanda kuning di linimasa. Klip otomatis menempel ke penanda saat digeser.'),
      this.aiButton('Tandai ketukan', 'beat', () => addMarkers('mark')),
      this.aiButton('Potong klip utama mengikuti ketukan', 'scissors', () => addMarkers('fit')),
      h('button.btn.sm', { onclick: () => { editor.project.markers = []; done('markers'); } }, 'Hapus semua penanda'),
      info);
  }
  textPanel(c) {
    const ta = h('textarea.input.ta', { value: c.text, rows: 3, placeholder: 'Tulis teks…', oninput: () => { c.text = ta.value; c.name = ta.value.split('\n')[0].slice(0, 24) || 'Teks'; live(); }, onchange: () => done('text') });
    setTimeout(() => { if (!matchMedia('(pointer: coarse)').matches) { ta.focus(); ta.select(); } }, 30);
    const preview = [...TEXT_PRESETS].slice(0, 42);
    return [
      section('', ta),
      section('Font', h('select.input', { 'aria-label': 'Font', onchange: (e) => { c.font = e.target.value; ensureFont(c, live); done('font'); } }, FONTS.map(([f]) => h('option', { value: f, selected: f === c.font, style: { fontFamily: f } }, f))),
        slider({ label: 'Ukuran', min: 16, max: 300, step: 1, value: c.size, oninput: (v) => { c.size = v; live(); }, onend: () => done('size') }),
        select('Tebal', [[300, 'Tipis'], [400, 'Normal'], [600, 'Sedang'], [700, 'Tebal'], [800, 'Ekstra'], [900, 'Hitam']].map(([a, b]) => [String(a), b]), String(c.weight || 400), (v) => { c.weight = +v; ensureFont(c, live); done('weight'); }),
        h('div.seg', [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']].map(([k, l]) => h('button' + (c.align === k ? '.on' : ''), { onclick: () => { c.align = k; done('align'); this.render(); } }, l))),
        toggle('Miring', c.italic, (v) => { c.italic = v; ensureFont(c, live); done('italic'); }),
        toggle('Huruf besar', c.upper, (v) => { c.upper = v; done('upper'); }),
        slider({ label: 'Jarak huruf', min: -.05, max: .6, value: c.spacing || 0, oninput: (v) => { c.spacing = v; live(); }, onend: () => done('spacing') }),
        slider({ label: 'Jarak baris', min: .8, max: 2.2, value: c.lineH || 1.15, oninput: (v) => { c.lineH = v; live(); }, onend: () => done('lineH') }),
        slider({ label: 'Lebar maks', min: .2, max: 1, value: c.maxW || .88, fmt: pct, oninput: (v) => { c.maxW = v; live(); }, onend: () => done('maxW') })),
      section('Gaya siap pakai', h('div.anim-grid', preview.map((p) => animCard(p.name, () => {
        const keep = { text: c.text, id: c.id, start: c.start, dur: c.dur, tf: c.tf, kf: c.kf, anim: c.anim, tanim: c.tanim, name: c.name, kind: c.kind };
        Object.assign(c, { stroke: null, shadow: null, glow: null, box: null, grad: null, spacing: 0, upper: false, italic: false, ...JSON.parse(JSON.stringify(p.o)), ...keep });
        ensureFont(c, live); done('preset'); this.render();
      })))),
    ];
  }
  textStyle(c) {
    return [
      section('Warna',
        toggle('Gradasi', !!c.grad, (v) => { c.grad = v ? ['#fde68a', '#f43f5e'] : null; done('grad'); this.render(); }),
        c.grad ? [colorInput('Atas', c.grad[0], (v) => { c.grad[0] = v; live(); }, () => done('grad')), colorInput('Bawah', c.grad[1], (v) => { c.grad[1] = v; live(); }, () => done('grad'))] : colorInput('Warna teks', c.color, (v) => { c.color = v; live(); }, () => done('color'))),
      section('Garis tepi',
        toggle('Aktifkan', !!c.stroke, (v) => { c.stroke = v ? { c: '#000000', w: 6 } : null; done('stroke'); this.render(); }),
        c.stroke ? [colorInput('Warna', c.stroke.c, (v) => { c.stroke.c = v; live(); }, () => done('stroke')), slider({ label: 'Tebal', min: 1, max: 30, step: 1, value: c.stroke.w, oninput: (v) => { c.stroke.w = v; live(); }, onend: () => done('stroke') })] : null),
      section('Bayangan',
        toggle('Aktifkan', !!c.shadow, (v) => { c.shadow = v ? { c: 'rgba(0,0,0,.6)', b: 12, x: 0, y: 4 } : null; done('shadow'); this.render(); }),
        c.shadow ? [slider({ label: 'Blur', min: 0, max: 60, step: 1, value: c.shadow.b, oninput: (v) => { c.shadow.b = v; live(); }, onend: () => done('shadow') }), slider({ label: 'Geser X', min: -40, max: 40, step: 1, value: c.shadow.x || 0, oninput: (v) => { c.shadow.x = v; live(); }, onend: () => done('shadow') }), slider({ label: 'Geser Y', min: -40, max: 40, step: 1, value: c.shadow.y || 0, oninput: (v) => { c.shadow.y = v; live(); }, onend: () => done('shadow') })] : null),
      section('Cahaya (glow)',
        toggle('Aktifkan', !!c.glow, (v) => { c.glow = v ? { c: '#22d3ee', b: 24 } : null; done('glow'); this.render(); }),
        c.glow ? [colorInput('Warna', c.glow.c, (v) => { c.glow.c = v; live(); }, () => done('glow')), slider({ label: 'Kekuatan', min: 2, max: 80, step: 1, value: c.glow.b, oninput: (v) => { c.glow.b = v; live(); }, onend: () => done('glow') })] : null),
      section('Kotak latar',
        toggle('Aktifkan', !!c.box, (v) => { c.box = v ? { c: '#000000', op: .7, r: .2, px: .3, py: .14, line: false } : null; done('box'); this.render(); }),
        c.box ? [colorInput('Warna', c.box.c, (v) => { c.box.c = v; live(); }, () => done('box')), slider({ label: 'Opasitas', min: 0, max: 1, value: c.box.op, fmt: pct, oninput: (v) => { c.box.op = v; live(); }, onend: () => done('box') }), slider({ label: 'Sudut', min: 0, max: .6, value: c.box.r, oninput: (v) => { c.box.r = v; live(); }, onend: () => done('box') }), toggle('Per baris', c.box.line, (v) => { c.box.line = v; done('box'); })] : null),
    ];
  }
  textAnim(c) {
    c.tanim ||= { in: null, out: null, loop: null };
    const sec = (title, list, slot, max) => {
      const cur = c.tanim[slot];
      return section(title, h('div.anim-grid', animCard('Tanpa', () => { c.tanim[slot] = null; done('tanim'); this.render(); }, !cur), list.map((a) => animCard(a.name, () => {
        c.tanim[slot] = { id: a.id, d: a.d };
        done('tanim');
        pl().seek(slot === 'out' ? Math.max(c.start, c.start + c.dur - (a.d || .7) - .1) : c.start);
        pl().play();
        this.render();
      }, cur?.id === a.id))), cur && slot !== 'loop' ? slider({ label: 'Durasi', min: .1, max: max, step: .05, value: cur.d ?? .7, oninput: (v) => { cur.d = v; live(); }, onend: () => done('tanim') }) : null);
    };
    return [sec('Masuk', TEXT_IN, 'in', Math.min(6, c.dur)), sec('Keluar', TEXT_OUT, 'out', Math.min(6, c.dur)), sec('Berulang', TEXT_LOOP, 'loop', 1)];
  }
  fxClip(c) {
    return section(effectById(c.effect)?.name || 'Efek',
      slider({ label: 'Kekuatan', min: 0, max: 2, value: c.amt ?? 1, fmt: pct, oninput: (v) => { c.amt = v; live(); }, onend: () => done('amt') }),
      slider({ label: 'Pengatur A', min: 0, max: 1, value: c.p1 ?? .5, fmt: pct, oninput: (v) => { c.p1 = v; live(); }, onend: () => done('p1') }),
      slider({ label: 'Pengatur B', min: 0, max: 1, value: c.p2 ?? .5, fmt: pct, oninput: (v) => { c.p2 = v; live(); }, onend: () => done('p2') }),
      h('h5', 'Ganti efek'),
      h('div.grid3', EFFECTS.map((e) => h('button.fcard' + (c.effect === e.id ? '.on' : ''), { title: e.name, onclick: () => { c.effect = e.id; c.name = e.name; done('fx'); this.render(); } }, thumbCanvas('effect', e.id), h('span', e.name)))));
  }
  filterClip(c) {
    return section('Filter',
      slider({ label: 'Kekuatan', min: 0, max: 1, value: c.filter.amt ?? 1, fmt: pct, oninput: (v) => { c.filter.amt = v; live(); }, onend: () => done('amt') }),
      h('div.grid3', FILTERS.map((f) => h('button.fcard' + (c.filter.id === f.id ? '.on' : ''), { title: f.name, onclick: () => { c.filter.id = f.id; c.name = f.name; done('filter'); this.render(); } }, thumbCanvas('filter', f.id), h('span', f.name)))));
  }
  adjustClip(c) {
    return section('Penyesuaian', ...ADJUST_FIELDS.filter(([k]) => k !== 'sharpen').map(([k, label, min, max]) => slider({ label, min, max, step: k === 'hue' ? 1 : .01, value: c.adjust?.[k] || 0, fmt: k === 'hue' ? null : pct, oninput: (v) => { c.adjust[k] = v; live(); }, onend: () => done('adjust') })));
  }
  projectPanel() {
    const P = editor.project;
    const applyRatio = (r) => { P.ratio = r.id; P.w = r.w; P.h = r.h; P.ratioLocked = true; done('ratio'); this.onRatio?.(); this.render(); };
    const bg = P.bg;
    const wm = P.watermark;
    const m = this;
    const main = P.tracks.find((t) => t.kind === 'main');
    const sceneBtn = main.clips.some((c) => c.kind === 'video');
    return h('div.tab-body',
      section('Rasio',
        h('div.ratio-grid', RATIOS.map((r) => {
          const k = 26 / Math.max(r.w, r.h);
          return h('button.ratio' + (P.ratio === r.id ? '.on' : ''), { onclick: () => applyRatio(r), title: r.hint }, h('i', { style: { width: r.w * k + 'px', height: r.h * k + 'px' } }), h('span', r.id));
        }))),
      section('Latar',
        h('div.seg', [['blur', 'Blur'], ['color', 'Warna'], ['gradient', 'Gradasi'], ['image', 'Gambar']].map(([k, l]) => h('button' + (bg.type === k ? '.on' : ''), { onclick: async () => {
          if (k === 'image') { const [f] = await pickFiles('image/*', false); if (!f) return; const media = await importFile(f); bg.media = media.id; }
          bg.type = k; done('bg'); this.render();
        } }, l))),
        bg.type === 'blur' ? slider({ label: 'Blur', min: .1, max: 1, value: bg.blur ?? .6, fmt: pct, oninput: (v) => { bg.blur = v; live(); }, onend: () => done('bg') }) : null,
        bg.type === 'color' || bg.type === 'gradient' ? colorInput('Warna', bg.color, (v) => { bg.color = v; live(); }, () => done('bg')) : null,
        bg.type === 'gradient' ? colorInput('Warna 2', bg.color2 || '#000000', (v) => { bg.color2 = v; live(); }, () => done('bg')) : null,
        h('button.btn.sm', { onclick: () => { for (const c of main.clips) if (c.fit !== 'stretch') c.fit = 'cover'; done('fit'); toast('Semua klip mengisi penuh kanvas'); } }, 'Penuhi kanvas untuk semua klip')),
      section('Tanda air (watermark)',
        h('div.seg', [['', 'Tanpa'], ['text', 'Teks'], ['image', 'Logo']].map(([k, l]) => h('button' + ((wm?.kind || '') === k ? '.on' : ''), { onclick: async () => {
          if (!k) P.watermark = null;
          else if (k === 'text') P.watermark = { kind: 'text', text: P.watermark?.text || '© ' + (P.name || 'Amatu'), pos: wm?.pos || 'br', op: wm?.op ?? .6, size: wm?.size ?? .2, style: { font: 'Inter', weight: 700, size: 42, color: '#ffffff', shadow: { c: 'rgba(0,0,0,.5)', b: 6, x: 0, y: 1 } } };
          else { const [f] = await pickFiles('image/*', false); if (!f) return; const media = await importFile(f); P.watermark = { kind: 'image', media: media.id, pos: wm?.pos || 'br', op: wm?.op ?? .8, size: wm?.size ?? .2 }; }
          done('watermark'); this.render();
        } }, l))),
        wm ? [
          wm.kind === 'text' ? h('input.input', { value: wm.text, placeholder: 'Teks tanda air', oninput: (e) => { wm.text = e.target.value; live(); }, onchange: () => done('watermark') }) : null,
          wm.kind === 'text' ? h('select.input', { 'aria-label': 'Font', onchange: (e) => { wm.style.font = e.target.value; ensureFont(wm.style, live); done('watermark'); } }, FONTS.map(([f]) => h('option', { value: f, selected: f === wm.style.font }, f))) : null,
          h('div.pos-grid', [['tl', '↖'], ['t', '↑'], ['tr', '↗'], ['l', '←'], ['c', '•'], ['r', '→'], ['bl', '↙'], ['b', '↓'], ['br', '↘']].map(([p, l]) => h('button' + (wm.pos === p ? '.on' : ''), { onclick: () => { wm.pos = p; done('watermark'); this.render(); } }, l))),
          h('button.btn.sm' + (wm.pos === 'tile' ? '.primary' : ''), { onclick: () => { wm.pos = wm.pos === 'tile' ? 'br' : 'tile'; done('watermark'); this.render(); } }, 'Ulang di seluruh gambar'),
          slider({ label: 'Opasitas', min: .05, max: 1, value: wm.op, fmt: pct, oninput: (v) => { wm.op = v; live(); }, onend: () => done('watermark') }),
          slider({ label: 'Ukuran', min: .05, max: .8, value: wm.size, fmt: pct, oninput: (v) => { wm.size = v; live(); }, onend: () => done('watermark') }),
        ] : h('p.note', 'Tanda air muncul sepanjang video dan ikut terekspor.')),
      section('Suara utama', slider({ label: 'Volume', min: 0, max: 2, value: P.master?.vol ?? 1, fmt: pct, oninput: (v) => { (P.master ||= {}).vol = v; if (pl().audio.master) pl().audio.master.gain.value = v; }, onend: () => done('master') })),
      sceneBtn ? section('Edit otomatis', m.aiButton('Potong otomatis per adegan', 'scissors', async (prog) => {
        let total = 0;
        for (const c of [...main.clips]) {
          if (c.kind !== 'video') continue;
          await analyzeVideo(getMedia(c.media), (p) => prog(p, 'Melihat isi video'));
          total += await splitScenes(P, main, c);
        }
        normalizeMain(P); done('scene');
        toast(total ? total + ' potongan adegan dibuat' : 'Tidak ditemukan pergantian adegan');
      })) : null,
    );
  }
}
export { TRANSITIONS, transitionById, projectDur, isVisual, isSrcTimed, trackKindFor, getAudio };
