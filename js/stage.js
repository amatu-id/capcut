// The preview: canvas sizing, and the selection box that moves, scales and rotates the selected picture or text directly.
import { editor } from './store.js';
import { getMedia } from './media.js';
import { propValue, setProp, setKey, hasKeys, isVisual } from './model.js';
import { renderText } from './text.js';
import { stickerSource } from './stickers.js';
import { animState } from './anim.js';
import { h, clamp } from './util.js';

export class Stage {
  constructor(wrap, canvas, comp, player) {
    this.wrap = wrap; this.canvas = canvas; this.comp = comp; this.player = player;
    this.overlay = h('div.stage-ov');
    this.box = h('div.sel-box', { style: { display: 'none' } },
      ...['nw', 'ne', 'sw', 'se'].map((p) => h('i.hd.' + p, { 'data-h': p })),
      h('i.hd.rot', { 'data-h': 'rot' }));
    this.gx = h('div.guide.gx', { style: { display: 'none' } }); this.gy = h('div.guide.gy', { style: { display: 'none' } });
    this.overlay.append(this.gx, this.gy, this.box);
    wrap.append(this.overlay);
    new ResizeObserver(() => this.layout()).observe(wrap);
    this.overlay.addEventListener('pointerdown', (e) => this.down(e));
    this.overlay.addEventListener('pointermove', (e) => this.move(e));
    this.overlay.addEventListener('pointerup', (e) => this.up(e));
    this.overlay.addEventListener('pointercancel', (e) => this.up(e));
    this.overlay.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    this.overlay.addEventListener('dblclick', () => { const s = editor.selected; if (s?.clip.kind === 'text') this.onEditText?.(s.clip); });
    this.pts = new Map();
  }
  layout() {
    const P = editor.project; if (!P) return;
    const r = this.wrap.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return;
    const k = Math.min(r.width / P.w, r.height / P.h), w = Math.floor(P.w * k), hh = Math.floor(P.h * k);
    this.dw = w; this.dh = hh;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const short = Math.min(w, hh) * dpr, cap = 1080 / short;
    const q = Math.min(dpr, dpr * cap);
    const cw = Math.max(2, Math.round((w * q) / 2) * 2), ch = Math.max(2, Math.round((hh * q) / 2) * 2);
    if (this.canvas.width !== cw || this.canvas.height !== ch) { this.canvas.width = cw; this.canvas.height = ch; }
    Object.assign(this.canvas.style, { width: w + 'px', height: hh + 'px' });
    Object.assign(this.overlay.style, { width: w + 'px', height: hh + 'px' });
    this.player.invalidate();
    this.updateBox();
  }
  /** The selected clip's on-screen box, in project pixels, before rotation. */
  clipBox(c, t) {
    const P = editor.project, u = t - c.start, a = animState(c.anim, clamp(u, 0, c.dur), c.dur);
    const s = propValue(c, 's', u) * a.s;
    let w = P.w, hh = P.h;
    if (c.kind === 'text') { const r = renderText(c, Math.min(this.dw / P.w, 1), clamp(u, 0, c.dur), P.w); if (r) { w = r.w; hh = r.h; } }
    else if (c.kind === 'sticker') { const r = stickerSource(c.sticker), base = Math.min(P.w, P.h) * .3; w = base * (r && r.aspect < 1 ? r.aspect : 1); hh = base * (r && r.aspect >= 1 ? 1 / r.aspect : 1); }
    else if (c.kind === 'color') { w = P.w; hh = P.h; }
    else {
      const m = getMedia(c.media); if (!m?.w) return null;
      const cr = c.crop || { l: 0, t: 0, r: 0, b: 0 }, dw = m.w * (1 - cr.l - cr.r), dh = m.h * (1 - cr.t - cr.b);
      if (c.fit === 'stretch') { w = P.w; hh = P.h; } else { const fs = c.fit === 'cover' ? Math.max(P.w / dw, P.h / dh) : Math.min(P.w / dw, P.h / dh); w = dw * fs; hh = dh * fs; }
    }
    return { w: w * s, h: hh * s, x: propValue(c, 'x', u) + a.x, y: propValue(c, 'y', u) + a.y, rot: propValue(c, 'rot', u) + a.rot };
  }
  updateBox() {
    const s = editor.selected, P = editor.project;
    const t = this.player.t;
    if (!s || !P || !isVisual(s.clip) || t < s.clip.start || t >= s.clip.start + s.clip.dur || this.player.playing) { this.box.style.display = 'none'; return; }
    const b = this.clipBox(s.clip, t); if (!b) { this.box.style.display = 'none'; return; }
    const k = this.dw / P.w, cx = this.dw / 2 + b.x * this.dw, cy = this.dh / 2 + b.y * this.dh;
    Object.assign(this.box.style, { display: '', width: b.w * k + 'px', height: b.h * k + 'px', transform: `translate(${cx - (b.w * k) / 2}px,${cy - (b.h * k) / 2}px) rotate(${b.rot}deg)` });
  }
  _xy(e) { const r = this.overlay.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  _hitClip(x, y) {
    const P = editor.project, t = this.player.t, k = this.dw / P.w;
    for (let i = P.tracks.length - 1; i >= 0; i--) {
      const tr = P.tracks[i];
      const c = tr.clips.find((q) => t >= q.start && t < q.start + q.dur);
      if (!c || !isVisual(c) || tr.hidden) continue;
      const b = this.clipBox(c, t); if (!b) continue;
      const cx = this.dw / 2 + b.x * this.dw, cy = this.dh / 2 + b.y * this.dh, a = -b.rot * Math.PI / 180, dx = x - cx, dy = y - cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a), ly = dx * Math.sin(a) + dy * Math.cos(a);
      if (Math.abs(lx) <= (b.w * k) / 2 && Math.abs(ly) <= (b.h * k) / 2) return c;
    }
    return null;
  }
  down(e) {
    if (!editor.project) return;
    this.overlay.setPointerCapture(e.pointerId);
    const p = this._xy(e); this.pts.set(e.pointerId, p);
    if (this.player.playing) this.player.pause();
    const handle = e.target.dataset?.h;
    if (this.pts.size === 2) { const s = editor.selected; if (s?.clip.tf) { const [a, b] = [...this.pts.values()]; const u = this.player.t - s.clip.start; this.pinch = { c: s.clip, d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: propValue(s.clip, 's', u), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), rot: propValue(s.clip, 'rot', u) }; this.drag = null; } return; }
    let c = editor.selected?.clip;
    if (!handle) {
      const hit = this._hitClip(p[0], p[1]);
      const keepSel = c && isVisual(c) && this._inside(c, p);
      if (!keepSel) { c = hit; editor.select(c?.id || null); }
    }
    if (!c || !isVisual(c)) { this.drag = null; return; }
    const P = editor.project, u = this.player.t - c.start;
    const v = { x: propValue(c, 'x', u), y: propValue(c, 'y', u), s: propValue(c, 's', u), rot: propValue(c, 'rot', u) };
    const b = this.clipBox(c, this.player.t);
    const cx = this.dw / 2 + b.x * this.dw, cy = this.dh / 2 + b.y * this.dh;
    this.drag = { c, handle: handle || 'move', p, v, cx, cy, d0: Math.hypot(p[0] - cx, p[1] - cy), a0: Math.atan2(p[1] - cy, p[0] - cx), P, u };
    e.stopPropagation();
  }
  _inside(c, p) {
    const t = this.player.t;
    if (t < c.start || t >= c.start + c.dur) return false;
    const b = this.clipBox(c, t); if (!b) return false;
    const k = this.dw / editor.project.w, cx = this.dw / 2 + b.x * this.dw, cy = this.dh / 2 + b.y * this.dh, a = -b.rot * Math.PI / 180, dx = p[0] - cx, dy = p[1] - cy;
    return Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) <= (b.w * k) / 2 && Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) <= (b.h * k) / 2;
  }
  move(e) {
    if (!this.pts.has(e.pointerId)) return;
    const p = this._xy(e); this.pts.set(e.pointerId, p);
    if (this.pinch && this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()], { c } = this.pinch, u = this.player.t - c.start;
      setProp(c, 's', u, clamp(this.pinch.s * (Math.hypot(a[0] - b[0], a[1] - b[1]) / this.pinch.d), .05, 8));
      setProp(c, 'rot', u, this.pinch.rot + (Math.atan2(b[1] - a[1], b[0] - a[0]) - this.pinch.ang) * 180 / Math.PI);
      this.moved = true; this._live(); return;
    }
    const d = this.drag; if (!d) return;
    const { c, u } = d;
    if (d.handle === 'move') {
      let nx = d.v.x + (p[0] - d.p[0]) / this.dw, ny = d.v.y + (p[1] - d.p[1]) / this.dh;
      const snapX = Math.abs(nx) < 0.012, snapY = Math.abs(ny) < 0.012;
      if (snapX) nx = 0; if (snapY) ny = 0;
      this.gx.style.display = snapX ? '' : 'none'; this.gy.style.display = snapY ? '' : 'none';
      setProp(c, 'x', u, nx); setProp(c, 'y', u, ny);
    } else if (d.handle === 'rot') {
      let r = d.v.rot + (Math.atan2(p[1] - d.cy, p[0] - d.cx) - d.a0) * 180 / Math.PI;
      for (const q of [0, 45, 90, 135, 180, -45, -90, -135, -180]) if (Math.abs(r - q) < 2.5) r = q;
      setProp(c, 'rot', u, r);
    } else setProp(c, 's', u, clamp((d.v.s * Math.hypot(p[0] - d.cx, p[1] - d.cy)) / (d.d0 || 1), .03, 8));
    this.moved = true;
    this._live();
  }
  _live() { this.player.invalidate(); this.updateBox(); editor.touch(); }
  up(e) {
    this.pts.delete(e.pointerId);
    if (this.pts.size < 2) this.pinch = null;
    this.gx.style.display = this.gy.style.display = 'none';
    if (this.moved && !this.pts.size) { this.moved = false; editor.commit('stage'); this.player.invalidate(); }
    if (!this.pts.size) this.drag = null;
  }
  wheel(e) {
    const s = editor.selected;
    if (!s?.clip.tf || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const u = this.player.t - s.clip.start;
    setProp(s.clip, 's', u, clamp(propValue(s.clip, 's', u) * Math.exp(-e.deltaY * .004), .03, 8));
    this._live();
    clearTimeout(this.wt); this.wt = setTimeout(() => editor.commit('stage'), 300);
  }
}
export { setKey, hasKeys };
