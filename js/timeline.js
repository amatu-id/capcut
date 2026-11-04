// The timeline: one canvas drawing film strips, waveforms and clips, with pointer handling for mouse and touch.
import { editor } from './store.js';
import { getMedia, thumbAt, mediaBus, PEAKS_PER_SEC } from './media.js';
import { projectDur, mainTrack, normalizeMain, trimClip, srcAt, allKeyTimes, trackKindFor, dropEmptyTracks, fits, isSrcTimed, hasAudio } from './model.js';
import { clamp, coarse, fmtTime, uid } from './util.js';

const COL = {
  bg: '#0e0f12', ruler: '#15171b', rulerText: '#7b808c', line: '#23262c', head: '#121418', trackAlt: '#111317', playhead: '#ffffff', sel: '#ffffff', marker: '#f5c542',
  video: '#253141', image: '#2b2f45', color: '#3b3a2c', audio: '#123f3a', music: '#1b3a55', sfx: '#3f2a4f', text: '#6d3b16', sticker: '#6a2f53', effect: '#46307e', filter: '#2d5a3a', adjust: '#285261',
};
const FG = { audio: '#2dd4bf', music: '#60a5fa', sfx: '#c084fc' };
const H_RULER = 26;
const rowH = (t, phone) => (t.kind === 'main' ? (phone ? 52 : 60) : t.kind === 'audio' ? (phone ? 34 : 42) : phone ? 28 : 32);
const orderForView = (tracks) => {
  // Overlays stack upward above the main track, the way they stack in the picture. Audio sits below.
  const top = tracks.filter((t) => t.kind !== 'main' && t.kind !== 'audio').reverse();
  return [...top, ...tracks.filter((t) => t.kind === 'main'), ...tracks.filter((t) => t.kind === 'audio')];
};
const clipColor = (c) => (c.kind === 'audio' ? COL[c.tag === 'music' ? 'music' : c.tag === 'sfx' ? 'sfx' : 'audio'] : COL[c.kind] || '#333');

export class Timeline {
  constructor(canvas, player) {
    this.cv = canvas; this.x = canvas.getContext('2d', { alpha: false }); this.player = player;
    this.pps = 60; this.sx = 0; this.sy = 0; this.snap = true; this.head = 0; this.drag = null; this.pointers = new Map();
    this.centerMode = coarse();
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas.parentElement);
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('dblclick', (e) => this.dbl(e));
    mediaBus.on('thumbs', () => this.paint());
    mediaBus.on('audio', () => this.paint());
    this.resize();
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    if (r.width < 2 || r.height < 2) return;
    this.W = r.width; this.H = r.height; this.phone = r.width < 620;
    this.head = this.phone ? 0 : 74;
    this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
    this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px';
    this.x.setTransform(d, 0, 0, d, 0, 0);
    this.paint();
  }
  get project() { return editor.project; }
  t2x(t) { return this.head + t * this.pps - this.sx; }
  x2t(x) { return (x - this.head + this.sx) / this.pps; }
  /** On a touch screen the playhead stays in the middle and the timeline slides under it. */
  followPlayhead(t) {
    if (this.centerMode) { this.sx = t * this.pps - (this.W - this.head) / 2; }
    else if (this.player.playing) {
      const px = this.t2x(t);
      if (px > this.W - 60) this.sx = Math.max(0, t * this.pps - (this.W - this.head) * 0.2);
      else if (px < this.head) this.sx = Math.max(0, t * this.pps - 40);
    }
  }
  fit() {
    const d = Math.max(2, projectDur(this.project || { tracks: [] }));
    this.pps = clamp(((this.W - this.head) * 0.92) / d, 4, 400);
    this.sx = this.centerMode ? this.player.t * this.pps - (this.W - this.head) / 2 : 0;
    this.paint();
  }
  zoomBy(f, anchorX = null) {
    const ax = anchorX ?? this.t2x(this.player.t), t = this.x2t(ax);
    this.pps = clamp(this.pps * f, 4, 600);
    if (!this.centerMode) this.sx = Math.max(0, t * this.pps - (ax - this.head));
    else this.followPlayhead(this.player.t);
    this.paint();
  }
  layout() {
    const P = this.project, rows = [];
    let y = H_RULER - this.sy;
    if (!P) return rows;
    for (const t of orderForView(P.tracks)) { const h = rowH(t, this.phone); rows.push({ track: t, y, h }); y += h + 3; }
    this.contentH = y + this.sy;
    return rows;
  }
  paint() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => { this.raf = 0; this._paint(); });
  }
  _paint() {
    const x = this.x, W = this.W, H = this.H, P = this.project;
    if (!W) return;
    x.fillStyle = COL.bg; x.fillRect(0, 0, W, H);
    if (!P) return;
    const rows = this.rows = this.layout();
    const dur = projectDur(P);
    x.save(); x.beginPath(); x.rect(this.head, H_RULER, W - this.head, H - H_RULER); x.clip();
    for (const r of rows) {
      x.fillStyle = COL.trackAlt; x.fillRect(this.head, r.y, W - this.head, r.h);
      for (const c of r.track.clips) this._clip(x, c, r);
    }
    this._transitions(x, rows);
    x.restore();
    // Empty main track hint.
    const main = mainTrack(P);
    if (!main.clips.length) {
      const r = rows.find((q) => q.track === main);
      if (r) { x.fillStyle = '#6b7280'; x.font = '12px Inter,system-ui'; x.textAlign = 'left'; x.fillText('Tambahkan video atau foto ke sini', this.head + 14, r.y + r.h / 2 + 4); }
    }
    // Ruler.
    x.fillStyle = COL.ruler; x.fillRect(this.head, 0, W - this.head, H_RULER);
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300], major = steps.find((s) => s * this.pps >= 70) || 600, minor = major / 5;
    x.font = '10px Inter,system-ui'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const first = Math.floor(this.x2t(this.head) / minor) * minor;
    for (let t = Math.max(0, first); this.t2x(t) < W; t += minor) {
      const px = this.t2x(t), isM = Math.abs(t / major - Math.round(t / major)) < 1e-6;
      if (px < this.head) continue;
      x.fillStyle = isM ? '#50545e' : '#2c2f36'; x.fillRect(Math.round(px), isM ? 14 : 20, 1, isM ? 12 : 6);
      if (isM) { x.fillStyle = COL.rulerText; x.fillText(fmtTime(t) + (major < 1 ? '.' + Math.round((t % 1) * 10) : ''), px + 4, 12); }
    }
    for (const m of P.markers || []) {
      const px = this.t2x(m); if (px < this.head || px > W) continue;
      x.fillStyle = COL.marker; x.globalAlpha = .75; x.beginPath(); x.moveTo(px - 3, 18); x.lineTo(px + 3, 18); x.lineTo(px, 25); x.fill(); x.globalAlpha = 1;
    }
    // Track headers.
    if (this.head) {
      x.fillStyle = COL.head; x.fillRect(0, 0, this.head, H);
      x.fillStyle = COL.line; x.fillRect(this.head - 1, 0, 1, H);
      x.save(); x.beginPath(); x.rect(0, H_RULER, this.head, H - H_RULER); x.clip();
      for (const r of rows) this._header(x, r);
      x.restore();
    }
    // End-of-project shade and playhead.
    const endX = this.t2x(dur);
    if (endX < W && endX > this.head) { x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(endX, H_RULER, W - endX, H - H_RULER); }
    const ph = this.t2x(this.player.t);
    if (ph >= this.head - 1) {
      x.fillStyle = COL.playhead; x.fillRect(Math.round(ph) - 0.5, 0, 1.5, H);
      x.beginPath(); x.moveTo(ph - 5.5, 0); x.lineTo(ph + 5.5, 0); x.lineTo(ph + 5.5, 7); x.lineTo(ph, 13); x.lineTo(ph - 5.5, 7); x.fill();
    }
    if (this.guide != null) { const g = this.t2x(this.guide); x.fillStyle = '#facc15'; x.fillRect(g, H_RULER, 1, H - H_RULER); }
  }
  _header(x, r) {
    const t = r.track, cy = r.y + r.h / 2;
    x.fillStyle = COL.head; x.fillRect(0, r.y, this.head - 1, r.h);
    x.fillStyle = '#7b808c'; x.font = '10.5px Inter,system-ui'; x.textAlign = 'left';
    x.fillText({ main: 'Utama', overlay: 'Lapisan', text: 'Teks', fx: 'Efek', audio: 'Audio' }[t.kind], 8, cy + 3.5);
    const ico = (on, draw) => { x.fillStyle = x.strokeStyle = on ? '#f87171' : '#7b808c'; x.lineWidth = 1.2; draw(58, cy); };
    if (t.kind === 'audio' || t.kind === 'main') ico(t.muted, (ix, y) => this._speaker(x, ix, y, t.muted));
    if (t.kind === 'overlay' || t.kind === 'text') ico(t.hidden, (ix, y) => { x.beginPath(); x.ellipse(ix, y, 6, 3.6, 0, 0, 7); x.stroke(); x.beginPath(); x.arc(ix, y, 1.4, 0, 7); x.fill(); if (t.hidden) { x.beginPath(); x.moveTo(ix - 6, y + 5); x.lineTo(ix + 6, y - 5); x.stroke(); } });
  }
  _speaker(x, ix, y, off) {
    x.beginPath(); x.moveTo(ix - 6, y - 2); x.lineTo(ix - 3, y - 2); x.lineTo(ix, y - 5); x.lineTo(ix, y + 5); x.lineTo(ix - 3, y + 2); x.lineTo(ix - 6, y + 2); x.closePath(); x.fill();
    x.beginPath();
    if (off) { x.moveTo(ix + 3, y - 3); x.lineTo(ix + 8, y + 3); x.moveTo(ix + 8, y - 3); x.lineTo(ix + 3, y + 3); } else x.arc(ix + 1, y, 5, -0.8, 0.8);
    x.stroke();
  }
  _clip(x, c, r) {
    const X = this.t2x(c.start), w = c.dur * this.pps;
    if (X + w < this.head || X > this.W) return;
    const y = r.y, h = r.h, sel = editor.sel === c.id, rad = 5;
    x.save();
    x.beginPath(); x.roundRect(X + 0.5, y, Math.max(2, w - 1), h, rad); x.clip();
    x.fillStyle = clipColor(c); x.fillRect(X, y, w, h);
    if (c.kind === 'video' || c.kind === 'image') this._strip(x, c, X, y, w, h);
    if (hasAudio(c) && getMedia(c.media)?.peaks && (c.kind === 'audio' || (h > 40 && !c.muted))) this._wave(x, c, X, y, w, h);
    const label = c.kind === 'text' ? (c.text || '').replace(/\n/g, ' ') : c.name || '';
    x.font = '500 10.5px Inter,system-ui'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    const lx = Math.max(X, this.head) + 6;
    if (w > 24) {
      const tagW = x.measureText(label).width;
      if (c.kind === 'video' || c.kind === 'image') { x.fillStyle = 'rgba(0,0,0,.55)'; x.fillRect(lx - 3, y + 3, tagW + 6, 14); }
      x.fillStyle = '#e8eaee'; x.fillText(label, lx, y + 14);
    }
    if (c.speed && c.speed !== 1 && w > 70) { x.fillStyle = '#fbbf24'; x.font = '600 10px Inter,system-ui'; x.textAlign = 'right'; x.fillText(c.speed.toFixed(c.speed < 1 ? 2 : 1) + '×', X + w - 8, y + 14); x.textAlign = 'left'; }
    if (c.curve && w > 70) { x.fillStyle = '#fbbf24'; x.font = '600 10px Inter,system-ui'; x.textAlign = 'right'; x.fillText('kurva', X + w - 8, y + 14); x.textAlign = 'left'; }
    if (c.muted && c.kind === 'video' && w > 40) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(X + w - 20, y + h - 17, 16, 14); x.strokeStyle = x.fillStyle = '#f87171'; x.lineWidth = 1.1; this._speakerSmall(x, X + w - 12, y + h - 10); }
    for (const [side, d] of [['in', c.fadeIn], ['out', c.fadeOut]]) {
      if (!d) continue;
      x.fillStyle = 'rgba(0,0,0,.42)'; x.beginPath();
      const fw = d * this.pps;
      if (side === 'in') { x.moveTo(X, y); x.lineTo(X + fw, y); x.lineTo(X, y + h); } else { x.moveTo(X + w, y); x.lineTo(X + w - fw, y); x.lineTo(X + w, y + h); }
      x.fill();
    }
    x.restore();
    // Keyframes.
    const keys = allKeyTimes(c);
    if (keys.length) {
      x.fillStyle = sel ? '#fff' : '#fbbf24';
      for (const k of keys) { const kx = X + k * this.pps, ky = y + h - 7; x.beginPath(); x.moveTo(kx, ky - 4); x.lineTo(kx + 4, ky); x.lineTo(kx, ky + 4); x.lineTo(kx - 4, ky); x.fill(); }
    }
    if (sel) {
      x.strokeStyle = COL.sel; x.lineWidth = 2; x.beginPath(); x.roundRect(X + 1, y + 1, Math.max(2, w - 2), h - 2, rad); x.stroke();
      const hw = this.phone ? 11 : 8;
      x.fillStyle = COL.sel;
      x.beginPath(); x.roundRect(X - 1, y, hw, h, [rad, 0, 0, rad]); x.fill();
      x.beginPath(); x.roundRect(X + w - hw + 1, y, hw, h, [0, rad, rad, 0]); x.fill();
      x.fillStyle = '#111';
      x.fillRect(X + hw / 2 - 1.5, y + h / 2 - 6, 2, 12); x.fillRect(X + w - hw / 2 - 0.5, y + h / 2 - 6, 2, 12);
    }
    if (getMedia(c.media)?.missing) { x.fillStyle = 'rgba(180,30,30,.5)'; x.fillRect(X, y, w, h); x.fillStyle = '#fff'; x.font = '11px Inter,system-ui'; x.fillText('Berkas tidak ada di perangkat ini', Math.max(X, this.head) + 6, y + h / 2 + 4); }
  }
  _speakerSmall(x, cx, cy) { x.beginPath(); x.moveTo(cx - 4, cy - 1.5); x.lineTo(cx - 2, cy - 1.5); x.lineTo(cx, cy - 3.5); x.lineTo(cx, cy + 3.5); x.lineTo(cx - 2, cy + 1.5); x.lineTo(cx - 4, cy + 1.5); x.fill(); x.beginPath(); x.moveTo(cx + 2, cy - 2); x.lineTo(cx + 5, cy + 2); x.moveTo(cx + 5, cy - 2); x.lineTo(cx + 2, cy + 2); x.stroke(); }
  _strip(x, c, X, y, w, h) {
    const m = getMedia(c.media); if (!m?.thumbs?.length) return;
    const first = m.thumbs[0], tw = (first.width / first.height) * h;
    const from = Math.max(this.head, X), to = Math.min(this.W, X + w);
    let px = X + Math.floor((from - X) / tw) * tw;
    for (; px < to; px += tw) {
      const t = c.kind === 'video' ? srcAt(c, c.start + (px - X + tw / 2) / this.pps) : 0;
      const th = thumbAt(m, t);
      if (th) x.drawImage(th, px, y, tw + .5, h);
    }
    x.fillStyle = 'rgba(0,0,0,.1)'; x.fillRect(X, y, w, h);
  }
  _wave(x, c, X, y, w, h) {
    const m = getMedia(c.media), pk = m.peaks, audio = c.kind === 'audio';
    const color = audio ? FG[c.tag === 'music' ? 'music' : c.tag === 'sfx' ? 'sfx' : 'audio'] : 'rgba(140,240,220,.8)';
    const wh = audio ? h - 20 : 16, base = audio ? y + 18 + wh / 2 : y + h - 10;
    x.fillStyle = color;
    const from = Math.max(Math.ceil(X), this.head), to = Math.min(Math.floor(X + w), this.W);
    const gain = c.vol ?? 1;
    for (let px = from; px < to; px += 2) {
      const t0 = srcAt(c, c.start + (px - X) / this.pps), t1 = srcAt(c, c.start + (px + 2 - X) / this.pps);
      const a = Math.floor(Math.min(t0, t1) * PEAKS_PER_SEC), b = Math.max(a + 1, Math.ceil(Math.max(t0, t1) * PEAKS_PER_SEC));
      let mx = 0;
      for (let i = a; i < b; i += Math.max(1, (b - a) >> 4)) if (pk[i] > mx) mx = pk[i];
      const v = Math.max(1, Math.min(1, mx * gain) * wh);
      if (audio) x.fillRect(px, base - v / 2, 1.2, v); else x.fillRect(px, base - v / 2, 1.2, v);
    }
  }
  _transitions(x, rows) {
    const P = this.project, m = mainTrack(P), r = rows.find((q) => q.track === m);
    if (!r) return;
    this.tmarks = [];
    for (let i = 0; i < m.clips.length - 1; i++) {
      const a = m.clips[i], cut = this.t2x(a.start + a.dur), cy = r.y + r.h / 2, sz = this.phone ? 11 : 10;
      if (cut < this.head - 20 || cut > this.W + 20) continue;
      this.tmarks.push({ clip: a, x: cut, y: cy, r: sz + 3 });
      x.fillStyle = a.trans ? '#ffffff' : 'rgba(10,11,14,.85)'; x.strokeStyle = a.trans ? '#111' : 'rgba(255,255,255,.55)'; x.lineWidth = 1;
      x.beginPath(); x.roundRect(cut - sz, cy - sz, sz * 2, sz * 2, 5); x.fill(); x.stroke();
      x.fillStyle = a.trans ? '#111' : '#d1d5db'; x.strokeStyle = x.fillStyle; x.lineWidth = 1.4;
      if (a.trans) { x.beginPath(); x.moveTo(cut - 5, cy - 4); x.lineTo(cut, cy); x.lineTo(cut - 5, cy + 4); x.closePath(); x.fill(); x.beginPath(); x.moveTo(cut + 5, cy - 4); x.lineTo(cut, cy); x.lineTo(cut + 5, cy + 4); x.closePath(); x.fill(); } else { x.beginPath(); x.moveTo(cut - 4, cy); x.lineTo(cut + 4, cy); x.moveTo(cut, cy - 4); x.lineTo(cut, cy + 4); x.stroke(); }
    }
  }

  /* ---- input ---- */
  _hit(px, py) {
    if (py < H_RULER) return { type: 'ruler' };
    // The selected clip's handles come first: its edge often sits right under a transition button.
    const picked = editor.selected;
    if (picked) {
      const row = (this.rows || []).find((r) => r.track === picked.track);
      if (row && py >= row.y && py <= row.y + row.h) {
        const X = this.t2x(picked.clip.start), w = picked.clip.dur * this.pps, hw = this.phone ? 16 : 9;
        if (px >= X - 3 && px <= X + hw) return { type: 'trim', side: 'l', clip: picked.clip, track: row.track, row };
        if (px >= X + w - hw && px <= X + w + 3) return { type: 'trim', side: 'r', clip: picked.clip, track: row.track, row };
      }
    }
    for (const m of this.tmarks || []) if (Math.abs(px - m.x) <= m.r && Math.abs(py - m.y) <= m.r) return { type: 'trans', clip: m.clip };
    for (const r of this.rows || []) {
      if (py < r.y || py > r.y + r.h) continue;
      if (px < this.head) return { type: 'header', track: r.track, row: r };
      for (const c of r.track.clips) {
        const X = this.t2x(c.start), w = c.dur * this.pps;
        const hw = (this.phone ? 16 : 9);
        if (px >= X - 3 && px <= X + w + 3) {
          const sel = editor.sel === c.id;
          if (sel || !coarse()) {
            if (px <= X + hw) return { type: 'trim', side: 'l', clip: c, track: r.track, row: r };
            if (px >= X + w - hw) return { type: 'trim', side: 'r', clip: c, track: r.track, row: r };
          }
          return { type: 'clip', clip: c, track: r.track, row: r };
        }
      }
      return { type: 'empty', track: r.track, row: r };
    }
    return { type: 'empty' };
  }
  _xy(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  down(e) {
    if (!this.project) return;
    this.cv.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, this._xy(e));
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), pps: this.pps, cx: (a[0] + b[0]) / 2 };
      this.drag = null; clearTimeout(this.lp);
      return;
    }
    const [px, py] = this._xy(e), hit = this._hit(px, py);
    this.downAt = { px, py, t: performance.now(), sx: this.sx, sy: this.sy, pt: this.player.t };
    this.moved = false;
    if (hit.type === 'ruler') { this.drag = { type: 'scrub' }; this._scrub(px); return; }
    if (hit.type === 'trans') { this.drag = { type: 'tap-trans', clip: hit.clip }; return; }
    if (hit.type === 'header') { this._headerClick(hit, px); return; }
    if (hit.type === 'trim') {
      editor.select(hit.clip.id);
      this.drag = { type: 'trim', side: hit.side, clip: hit.clip, track: hit.track, before: hit.clip.start + (hit.side === 'r' ? hit.clip.dur : 0), snap: this._snapPoints(hit.clip) };
      this.paint(); return;
    }
    if (hit.type === 'clip') {
      if (e.pointerType === 'touch') {
        // On touch a press pans and a tap selects; a long press picks the clip up.
        this.drag = { type: 'pan' };
        this.lp = setTimeout(() => { if (!this.moved) { editor.select(hit.clip.id); this.drag = this._startMove(hit); navigator.vibrate?.(12); this.paint(); } }, 320);
        this.tapHit = hit;
        return;
      }
      editor.select(hit.clip.id);
      this.drag = this._startMove(hit);
      this.paint(); return;
    }
    if (e.pointerType === 'touch') { this.drag = { type: 'pan' }; this.tapHit = { type: 'empty' }; return; }
    editor.select(null);
    this.drag = { type: 'scrub' }; this._scrub(px);
  }
  _startMove(hit) { return { type: 'move', clip: hit.clip, track: hit.track, grabDt: this.x2t(this.downAt.px) - hit.clip.start, snap: this._snapPoints(hit.clip), orig: { start: hit.clip.start, trackId: hit.track.id, idx: hit.track.clips.indexOf(hit.clip) } }; }
  _headerClick(hit, px) {
    const t = hit.track;
    if (px < 44) return;
    if (t.kind === 'audio' || t.kind === 'main') t.muted = !t.muted;
    else if (t.kind === 'overlay' || t.kind === 'text') t.hidden = !t.hidden;
    editor.commit('track'); this.player.refresh(); this.paint();
  }
  _scrub(px) { const t = clamp(this.x2t(px), 0, projectDur(this.project)); this.player.pause(); this.player.seek(t); }
  _snapPoints(skip) {
    if (!this.snap) return [];
    const pts = [0, this.player.t, ...(this.project.markers || [])];
    for (const t of this.project.tracks) for (const c of t.clips) if (c !== skip) pts.push(c.start, c.start + c.dur);
    return pts;
  }
  _snap(t, pts) {
    const lim = 8 / this.pps; let best = null, bd = lim;
    for (const p of pts) { const d = Math.abs(p - t); if (d < bd) { bd = d; best = p; } }
    this.guide = best;
    return best ?? t;
  }
  move(e) {
    if (!this.pointers.has(e.pointerId)) { this._hover(e); return; }
    this.pointers.set(e.pointerId, this._xy(e));
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      this.pps = clamp(this.pinch.pps * (d / this.pinch.d), 4, 600);
      if (this.centerMode) this.followPlayhead(this.player.t);
      this.paint(); return;
    }
    const [px, py] = this._xy(e), D = this.downAt;
    if (!D) return;
    if (Math.abs(px - D.px) + Math.abs(py - D.py) > 5) { this.moved = true; clearTimeout(this.lp); }
    const dr = this.drag; if (!dr) return;
    if (dr.type === 'scrub') { this._scrub(px); return; }
    if (dr.type === 'pan') {
      if (this.centerMode) {
        const t = clamp(D.pt - (px - D.px) / this.pps, 0, projectDur(this.project));
        this.player.pause(); this.player.seek(t);
      } else this.sx = Math.max(0, D.sx - (px - D.px));
      this.sy = clamp(D.sy - (py - D.py), 0, Math.max(0, (this.contentH || 0) - this.H + 8));
      this.paint(); return;
    }
    if (dr.type === 'trim') {
      const c = dr.clip, t = this._snap(this.x2t(px), dr.snap);
      const media = isSrcTimed(c) ? getMedia(c.media) : null;
      let target = t;
      if (dr.track.kind !== 'main') {
        // A free track: stop at the neighbours.
        const others = dr.track.clips.filter((k) => k !== c);
        if (dr.side === 'l') { const prev = others.filter((k) => k.start + k.dur <= c.start + 1e-3).pop(); if (prev) target = Math.max(target, prev.start + prev.dur); target = Math.max(0, target); }
        else { const next = others.find((k) => k.start >= c.start + c.dur - 1e-3); if (next) target = Math.min(target, next.start); }
      }
      trimClip(c, dr.side, Math.max(0, target), media);
      if (dr.track.kind === 'main') normalizeMain(this.project);
      this.player.invalidate(); this.paint(); editor.touch(); dr.changed = true;
      return;
    }
    if (dr.type === 'move') this._moveClip(dr, px, py);
  }
  _moveClip(dr, px, py) {
    const c = dr.clip, P = this.project;
    const row = (this.rows || []).find((r) => py >= r.y - 1 && py <= r.y + r.h + 2);
    dr.changed = true;
    if (dr.track.kind === 'main') {
      if (row && row.track.kind === 'overlay' && (c.kind === 'video' || c.kind === 'image') && py < row.y + row.h) { /* stays main until release */ }
      const main = dr.track, list = main.clips.filter((k) => k !== c), t = this.x2t(px);
      let i = 0, acc = 0;
      for (; i < list.length; i++) { if (t < acc + list[i].dur / 2) break; acc += list[i].dur; }
      list.splice(i, 0, c); main.clips = list;
      normalizeMain(P);
      dr.pos = px;
      this.player.invalidate(); this.paint(); editor.touch();
      return;
    }
    let start = Math.max(0, this.x2t(px) - dr.grabDt);
    const s1 = this._snap(start, dr.snap), s2 = this._snap(start + c.dur, dr.snap);
    if (this.guide != null) start = Math.abs(s1 - start) <= Math.abs(s2 - c.dur - start) ? s1 : s2 - c.dur;
    const kind = trackKindFor(c);
    let target = row?.track;
    const allowed = target && target.kind !== 'main' && (target.kind === kind || (['overlay', 'text'].includes(kind) && ['overlay', 'text'].includes(target.kind)));
    if (!allowed) target = dr.track;
    if (!fits(target, start, c.dur, c.id)) {
      if (target !== dr.track && !fits(dr.track, start, c.dur, c.id)) target = dr.track;
      else if (target !== dr.track) target = dr.track;
      else { this.paint(); return; }
    }
    if (target !== dr.track) { dr.track.clips = dr.track.clips.filter((k) => k !== c); target.clips.push(c); dr.track = target; }
    c.start = start; target.clips.sort((a, b) => a.start - b.start);
    this.player.invalidate(); this.paint(); editor.touch();
  }
  up(e) {
    this.pointers.delete(e.pointerId);
    clearTimeout(this.lp);
    if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
    const dr = this.drag; this.drag = null; this.guide = null;
    if (dr?.type === 'tap-trans' && !this.moved) { this.onTransition?.(dr.clip); }
    else if (dr?.type === 'pan' && !this.moved && this.tapHit) {
      if (this.tapHit.type === 'clip' || this.tapHit.type === 'trim') editor.select(this.tapHit.clip.id);
      else editor.select(null);
    } else if (dr?.changed) { dropEmptyTracks(this.project); editor.commit('timeline'); this.player.refresh(); }
    this.tapHit = null;
    this.paint();
  }
  _hover(e) {
    if (e.pointerType !== 'mouse' || !this.project) return;
    const [px, py] = this._xy(e), hit = this._hit(px, py);
    this.cv.style.cursor = hit.type === 'trim' ? 'ew-resize' : hit.type === 'clip' ? 'grab' : hit.type === 'trans' || hit.type === 'header' ? 'pointer' : 'default';
  }
  wheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) { const [px] = this._xy(e); this.zoomBy(Math.exp(-e.deltaY * 0.01), px); return; }
    if (this.centerMode) { this.player.seek(clamp(this.player.t + (e.deltaX || e.deltaY) / this.pps, 0, projectDur(this.project))); }
    else {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) this.sx = Math.max(0, this.sx + (e.deltaX || e.deltaY));
      else if ((this.contentH || 0) > this.H) this.sy = clamp(this.sy + e.deltaY, 0, this.contentH - this.H + 8);
      else this.sx = Math.max(0, this.sx + e.deltaY);
    }
    this.paint();
  }
  dbl(e) { const [px, py] = this._xy(e), hit = this._hit(px, py); if (hit.type === 'clip' && hit.clip.kind === 'text') this.onEditText?.(hit.clip); }
}
export { uid };
