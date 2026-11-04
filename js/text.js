// Text rasteriser plus the catalog of fonts, ready-made styles and character animations.
import { EASE, clamp, hash } from './util.js';

const { cubicOut, cubicIn, back, bounce } = EASE;

export const FONTS = [
  ['Inter', 'Sans'], ['Poppins', 'Sans'], ['Montserrat', 'Sans'], ['Roboto', 'Sans'], ['Nunito', 'Sans'], ['Raleway', 'Sans'], ['Quicksand', 'Sans'], ['Rubik', 'Sans'],
  ['Oswald', 'Display'], ['Bebas Neue', 'Display'], ['Anton', 'Display'], ['Archivo Black', 'Display'], ['Bangers', 'Display'], ['Fredoka', 'Display'], ['Righteous', 'Display'], ['Russo One', 'Display'], ['Orbitron', 'Display'], ['Monoton', 'Display'], ['Press Start 2P', 'Display'],
  ['Playfair Display', 'Serif'], ['Merriweather', 'Serif'], ['Lora', 'Serif'], ['Cinzel', 'Serif'], ['Abril Fatface', 'Serif'], ['DM Serif Display', 'Serif'],
  ['Pacifico', 'Tulisan'], ['Dancing Script', 'Tulisan'], ['Great Vibes', 'Tulisan'], ['Caveat', 'Tulisan'], ['Lobster', 'Tulisan'], ['Permanent Marker', 'Tulisan'], ['Sacramento', 'Tulisan'], ['Satisfy', 'Tulisan'], ['Shadows Into Light', 'Tulisan'], ['Space Mono', 'Mono'],
];

const shadow = (c = 'rgba(0,0,0,.6)', b = 12, y = 4) => ({ c, b, x: 0, y });
const P = (id, name, cat, o) => ({ id, name, cat, o });

/** Ready-made text looks. Their fonts come from the list above. */
export const TEXT_PRESETS = [
  P('plain', 'Polos', 'Dasar', { font: 'Inter', weight: 700, color: '#ffffff', shadow: shadow() }),
  P('bold', 'Tebal', 'Dasar', { font: 'Poppins', weight: 800, color: '#ffffff', shadow: shadow() }),
  P('outline', 'Garis Tepi', 'Dasar', { font: 'Montserrat', weight: 800, color: '#ffffff', stroke: { c: '#000000', w: 8 }, shadow: null }),
  P('outlinecol', 'Tepi Kuning', 'Dasar', { font: 'Poppins', weight: 800, color: '#fde047', stroke: { c: '#111111', w: 9 }, shadow: null }),
  P('box', 'Kotak Hitam', 'Dasar', { font: 'Inter', weight: 700, color: '#ffffff', shadow: null, box: { c: '#000000', op: .75, r: .22, px: .36, py: .18, line: false } }),
  P('boxline', 'Per Baris', 'Dasar', { font: 'Poppins', weight: 700, color: '#111111', shadow: null, box: { c: '#ffffff', op: 1, r: .18, px: .32, py: .1, line: true } }),
  P('caption', 'Subtitel', 'Subtitel', { font: 'Inter', weight: 700, size: 58, color: '#ffffff', stroke: { c: '#000000', w: 5 }, shadow: null }),
  P('capbox', 'Subtitel Kotak', 'Subtitel', { font: 'Inter', weight: 600, size: 52, color: '#ffffff', shadow: null, box: { c: '#000000', op: .6, r: .16, px: .3, py: .12, line: true } }),
  P('capyellow', 'Subtitel Kuning', 'Subtitel', { font: 'Poppins', weight: 800, size: 60, color: '#fde047', stroke: { c: '#000000', w: 6 }, shadow: null }),
  P('captok', 'Subtitel Viral', 'Subtitel', { font: 'Montserrat', weight: 900, size: 68, color: '#ffffff', upper: true, stroke: { c: '#000000', w: 8 }, shadow: shadow('rgba(0,0,0,.7)', 0, 5) }),
  P('capgreen', 'Subtitel Hijau', 'Subtitel', { font: 'Rubik', weight: 800, size: 62, color: '#4ade80', stroke: { c: '#052e16', w: 6 }, shadow: null }),
  P('neonpink', 'Neon Merah Muda', 'Neon', { font: 'Righteous', weight: 400, color: '#fff1f7', glow: { c: '#ff2d95', b: 34 }, shadow: null }),
  P('neonblue', 'Neon Biru', 'Neon', { font: 'Righteous', weight: 400, color: '#ecfeff', glow: { c: '#22d3ee', b: 34 }, shadow: null }),
  P('neongreen', 'Neon Hijau', 'Neon', { font: 'Orbitron', weight: 700, color: '#ecfdf5', glow: { c: '#34d399', b: 30 }, shadow: null }),
  P('neontube', 'Neon Tabung', 'Neon', { font: 'Monoton', weight: 400, color: '#ffffff', glow: { c: '#a855f7', b: 26 }, shadow: null }),
  P('cyber', 'Cyber', 'Neon', { font: 'Orbitron', weight: 800, color: '#22d3ee', stroke: { c: '#ec4899', w: 3 }, glow: { c: '#ec4899', b: 16 }, shadow: null }),
  P('gold', 'Emas', 'Mewah', { font: 'Cinzel', weight: 700, grad: ['#fff3b0', '#c4901a'], shadow: shadow('rgba(0,0,0,.6)', 10, 3) }),
  P('silver', 'Perak', 'Mewah', { font: 'Cinzel', weight: 700, grad: ['#ffffff', '#8f98a3'], shadow: shadow('rgba(0,0,0,.6)', 10, 3) }),
  P('wedding', 'Undangan', 'Mewah', { font: 'Great Vibes', weight: 400, size: 130, color: '#fff7ed', shadow: shadow('rgba(0,0,0,.45)', 10, 2) }),
  P('elegant', 'Elegan', 'Mewah', { font: 'Playfair Display', weight: 700, italic: true, color: '#ffffff', shadow: shadow('rgba(0,0,0,.5)', 14, 3) }),
  P('serif', 'Majalah', 'Mewah', { font: 'DM Serif Display', weight: 400, size: 110, color: '#ffffff', shadow: null }),
  P('editorial', 'Editorial', 'Mewah', { font: 'Abril Fatface', weight: 400, size: 110, color: '#fef3c7', shadow: null }),
  P('cinema', 'Sinema', 'Sinematik', { font: 'Cinzel', weight: 600, size: 76, color: '#f3f4f6', spacing: .22, upper: true, shadow: shadow('rgba(0,0,0,.8)', 18, 0) }),
  P('trailer', 'Trailer', 'Sinematik', { font: 'Bebas Neue', weight: 400, size: 150, color: '#ffffff', spacing: .1, shadow: shadow('rgba(0,0,0,.7)', 22, 0) }),
  P('epic', 'Epik', 'Sinematik', { font: 'Anton', weight: 400, size: 130, grad: ['#ffffff', '#a8b4c4'], spacing: .04, upper: true, shadow: shadow('rgba(0,0,0,.8)', 18, 4) }),
  P('minimal', 'Minimal', 'Sinematik', { font: 'Raleway', weight: 300, size: 72, color: '#ffffff', spacing: .34, upper: true, shadow: null }),
  P('sport', 'Olahraga', 'Tebal', { font: 'Anton', weight: 400, size: 130, color: '#ffffff', italic: true, upper: true, stroke: { c: '#dc2626', w: 7 }, shadow: null }),
  P('impact', 'Impak', 'Tebal', { font: 'Archivo Black', weight: 400, size: 110, color: '#fde047', upper: true, shadow: shadow('#000000', 0, 7) }),
  P('sale', 'Promo', 'Tebal', { font: 'Archivo Black', weight: 400, size: 110, color: '#ffffff', upper: true, shadow: null, box: { c: '#dc2626', op: 1, r: .14, px: .36, py: .16, line: false } }),
  P('price', 'Harga', 'Tebal', { font: 'Russo One', weight: 400, size: 120, color: '#111827', shadow: null, box: { c: '#fde047', op: 1, r: .2, px: .34, py: .14, line: false } }),
  P('comic', 'Komik', 'Lucu', { font: 'Bangers', weight: 400, size: 130, color: '#fef08a', stroke: { c: '#111111', w: 8 }, shadow: shadow('#ef4444', 0, 8) }),
  P('bubble', 'Gelembung', 'Lucu', { font: 'Fredoka', weight: 700, size: 104, color: '#ffffff', stroke: { c: '#ec4899', w: 10 }, shadow: null }),
  P('candy', 'Permen', 'Lucu', { font: 'Fredoka', weight: 700, size: 104, grad: ['#fda4af', '#a78bfa'], stroke: { c: '#ffffff', w: 8 }, shadow: null }),
  P('pixel', 'Piksel', 'Lucu', { font: 'Press Start 2P', weight: 400, size: 66, color: '#a3e635', shadow: shadow('#14532d', 0, 6) }),
  P('hand', 'Tulisan Tangan', 'Tulisan', { font: 'Caveat', weight: 700, size: 116, color: '#ffffff', shadow: shadow('rgba(0,0,0,.45)', 8, 2) }),
  P('marker', 'Spidol', 'Tulisan', { font: 'Permanent Marker', weight: 400, size: 100, color: '#fde047', shadow: null }),
  P('script', 'Sambung', 'Tulisan', { font: 'Pacifico', weight: 400, size: 100, color: '#ffffff', shadow: shadow('rgba(0,0,0,.45)', 10, 3) }),
  P('lobster', 'Retro', 'Tulisan', { font: 'Lobster', weight: 400, size: 110, color: '#fb923c', stroke: { c: '#ffffff', w: 5 }, shadow: null }),
  P('sunset', 'Senja', 'Gradasi', { font: 'Poppins', weight: 800, grad: ['#fde68a', '#f43f5e'], shadow: shadow('rgba(0,0,0,.4)', 10, 3) }),
  P('ocean', 'Samudra', 'Gradasi', { font: 'Poppins', weight: 800, grad: ['#67e8f9', '#2563eb'], shadow: shadow('rgba(0,0,0,.4)', 10, 3) }),
  P('aurora', 'Aurora', 'Gradasi', { font: 'Montserrat', weight: 900, grad: ['#a7f3d0', '#8b5cf6'], shadow: shadow('rgba(0,0,0,.4)', 10, 3) }),
  P('lava', 'Lava', 'Gradasi', { font: 'Anton', weight: 400, size: 130, grad: ['#fef08a', '#dc2626'], stroke: { c: '#111111', w: 5 }, shadow: null }),
];
export const TEXT_CATS = [...new Set(TEXT_PRESETS.map((p) => p.cat))];

const C = (id, name, f, d = 0.7) => ({ id, name, f, d });
/** Character motion: f(i, n, p, t) gives {dx, dy (in em), s, rot, op} for character i of n. */
const stag = (i, n, p, spread = 0.65) => clamp((p - (i / Math.max(1, n)) * spread) / (1 - spread));

export const TEXT_IN = [
  C('typewriter', 'Mesin Tik', (i, n, p) => ({ op: p * n >= i + 1 ? 1 : 0 }), 1),
  C('fadechar', 'Pudar Per Huruf', (i, n, p) => ({ op: stag(i, n, p) })),
  C('popchar', 'Letup Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { s: back(q), op: clamp(q * 4) }; }),
  C('slideup', 'Naik Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { dy: 0.7 * (1 - cubicOut(q)), op: q }; }),
  C('dropchar', 'Jatuh Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { dy: -1 * (1 - bounce(q)), op: clamp(q * 4) }; }, .9),
  C('zoomchar', 'Zoom Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { s: 2.4 - 1.4 * cubicOut(q), op: q }; }),
  C('spinchar', 'Putar Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { rot: -180 * (1 - cubicOut(q)), s: cubicOut(q), op: q }; }, .8),
  C('wavein', 'Ombak Masuk', (i, n, p) => { const q = stag(i, n, p, .5); return { dy: Math.sin(q * Math.PI) * -0.5, op: clamp(q * 3) }; }, .8),
  C('wordpop', 'Per Kata', (i, n, p, t, w, nw) => { const q = stag(w, nw, p, .75); return { s: back(q), op: clamp(q * 5) }; }, .9),
  C('glitchin', 'Glitch Masuk', (i, n, p) => { const on = p > Math.abs(Math.sin(i * 91.7)) * 0.8; return { op: on ? 1 : 0, dx: on ? (1 - p) * Math.sin(i * 7 + p * 40) * 0.3 : 0 }; }, .6),
  C('spread', 'Rapat Merenggang', (i, n, p) => ({ dx: ((i - (n - 1) / 2) * -0.6) * (1 - cubicOut(p)), op: p })),
  C('fromleft', 'Dari Kiri', (i, n, p) => { const q = stag(i, n, p); return { dx: -1.1 * (1 - cubicOut(q)), op: q }; }),
];
export const TEXT_OUT = [
  C('fadechar', 'Pudar Per Huruf', (i, n, p) => ({ op: 1 - stag(i, n, p) })),
  C('popchar', 'Mengecil Per Huruf', (i, n, p) => { const q = stag(i, n, p); return { s: 1 - cubicIn(q), op: 1 - q }; }),
  C('riseout', 'Naik Keluar', (i, n, p) => { const q = stag(i, n, p); return { dy: -0.8 * cubicIn(q), op: 1 - q }; }),
  C('dropout', 'Jatuh Keluar', (i, n, p) => { const q = stag(i, n, p); return { dy: 1.4 * cubicIn(q), rot: 30 * q, op: 1 - q }; }),
  C('backspace', 'Hapus', (i, n, p) => ({ op: (1 - p) * n >= i + 1 ? 1 : 0 }), 1),
  C('blowout', 'Tertiup', (i, n, p) => { const q = stag(i, n, p); return { dx: 1.5 * cubicIn(q), dy: -0.7 * q * Math.sin(i * 9), rot: 90 * q, op: 1 - q }; }),
];
export const TEXT_LOOP = [
  C('wave', 'Ombak', (i, n, p, t) => ({ dy: Math.sin(t * 5 - i * 0.55) * 0.14 }), 0),
  C('bounce', 'Melompat', (i, n, p, t) => ({ dy: -Math.abs(Math.sin(t * 4 - i * 0.4)) * 0.2 }), 0),
  C('jitter', 'Bergetar', (i, n, p, t) => ({ dx: Math.sin(t * 37 + i * 3) * 0.022, dy: Math.cos(t * 43 + i * 5) * 0.022 }), 0),
  C('pulsechar', 'Denyut Huruf', (i, n, p, t) => ({ s: 1 + Math.sin(t * 5 - i * 0.5) * 0.12 }), 0),
  C('swaychar', 'Goyang Huruf', (i, n, p, t) => ({ rot: Math.sin(t * 4 + i * 0.7) * 8 }), 0),
  C('blink', 'Berkedip', (i, n, p, t) => ({ op: Math.sin(t * 8) > -0.2 ? 1 : 0.15 }), 0),
  C('rainbow', 'Pelangi', (i, n, p, t) => ({ color: `hsl(${(t * 70 + i * 24) % 360} 90% 65%)` }), 0),
  C('flickchar', 'Neon Rusak', (i, n, p, t) => ({ op: Math.sin(t * 31 + i * 19) * Math.sin(t * 13 + i * 7) > 0.55 ? 0.25 : 1 }), 0),
];
const findA = (l, id) => l.find((a) => a.id === id);

const cache = new Map();
const shared = document.createElement('canvas');
const mctx = shared.getContext('2d');

const fontStr = (c, px) => `${c.italic ? 'italic ' : ''}${c.weight || 400} ${px}px "${c.font || 'Inter'}", "Noto Sans", system-ui, sans-serif`;

export function ensureFont(c, cb) {
  const k = `${c.italic ? 'italic ' : ''}${c.weight || 400} 40px "${c.font}"`;
  try {
    if (!document.fonts.check(k)) return document.fonts.load(k, c.text?.slice(0, 40) || 'A').then(() => cb?.());
  } catch { /* an odd font name falls back to the system font */ }
  return Promise.resolve();
}

function wrap(ctx, text, maxW, spacing) {
  const lines = [];
  for (const raw of text.split('\n')) {
    const words = raw.split(/(\s+)/);
    let cur = '';
    for (const w of words) {
      const test = cur + w;
      if (ctx.measureText(test).width + spacing * test.length > maxW && cur.trim()) { lines.push(cur.trimEnd()); cur = w.trimStart(); } else cur = test;
    }
    lines.push(cur);
  }
  return lines;
}

function roundRect(x, X, Y, W, H, R) {
  x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath();
}

/**
 * Draws a text clip. k = output pixels per project pixel, u = seconds into the clip.
 * Returns {canvas, w, h, key}, w/h in project pixels. Static text is cached; animated characters redraw per frame.
 */
export function renderText(c, k, u = 0, pw = 1080) {
  const ta = c.tanim;
  const inA = ta?.in && findA(TEXT_IN, ta.in.id), outA = ta?.out && findA(TEXT_OUT, ta.out.id), loopA = ta?.loop && findA(TEXT_LOOP, ta.loop.id);
  const dur = c.dur || 1;
  const inD = inA ? Math.min(ta.in.d ?? inA.d, dur) : 0, outD = outA ? Math.min(ta.out.d ?? outA.d, dur) : 0;
  const animating = loopA || (inA && u < inD) || (outA && u > dur - outD);
  const ppx = Math.max(.25, k);
  const styleKey = hash(JSON.stringify([c.text, c.font, c.size, c.weight, c.italic, c.color, c.grad, c.align, c.lineH, c.spacing, c.upper, c.stroke, c.shadow, c.glow, c.box, c.maxW, ppx.toFixed(3), pw]));
  const stKey = animating ? styleKey + ':' + u.toFixed(3) : styleKey;
  const hitId = c.id;
  const hit = cache.get(hitId);
  if (hit && hit.key === stKey) return hit;

  const size = (c.size || 90) * ppx;
  const text = (c.upper ? (c.text || '').toUpperCase() : c.text || '') || ' ';
  mctx.font = fontStr(c, size);
  const sp = (c.spacing || 0) * size;
  const maxW = pw * (c.maxW || 0.88) * ppx;
  const lines = wrap(mctx, text, maxW, sp);
  const lh = size * (c.lineH || 1.15);
  const widths = lines.map((l) => mctx.measureText(l).width + sp * Math.max(0, l.length - 1));
  const tw = Math.max(1, ...widths), th = lh * lines.length;
  const st = c.stroke ? c.stroke.w * ppx : 0;
  const pad = Math.ceil(size * (inA || outA || loopA ? 1.3 : .35) + st + (c.shadow ? (c.shadow.b + Math.abs(c.shadow.y || 0)) * ppx : 0) + (c.glow ? c.glow.b * 1.6 * ppx : 0));
  const boxPadX = c.box ? c.box.px * size : 0, boxPadY = c.box ? c.box.py * size : 0;
  const W = Math.min(4096, Math.ceil(tw + (pad + boxPadX) * 2)), H = Math.min(4096, Math.ceil(th + (pad + boxPadY) * 2));

  const cv = hit?.canvas && hit.canvas.width === W && hit.canvas.height === H ? hit.canvas : document.createElement('canvas');
  cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.font = fontStr(c, size); x.textBaseline = 'alphabetic'; x.lineJoin = 'round'; x.miterLimit = 2;
  const asc = size * 0.8 + (lh - size) / 2 * 1.0;

  const lineX = (w) => (c.align === 'left' ? pad + boxPadX : c.align === 'right' ? W - pad - boxPadX - w : (W - w) / 2);
  const topY = pad + boxPadY;

  if (c.box) {
    x.save(); x.globalAlpha = c.box.op ?? 1; x.fillStyle = c.box.c;
    const r = (c.box.r ?? 0.2) * size;
    if (c.box.line) lines.forEach((l, i) => { if (!l.trim()) return; const w = widths[i]; roundRect(x, lineX(w) - boxPadX, topY + i * lh - boxPadY * 0.2, w + boxPadX * 2, lh + boxPadY * 0.4, r); x.fill(); });
    else { roundRect(x, lineX(tw) - boxPadX, topY - boxPadY, tw + boxPadX * 2, th + boxPadY * 2, r); x.fill(); }
    x.restore();
  }

  let fill = c.color || '#ffffff';
  if (c.grad) { const g = x.createLinearGradient(0, topY, 0, topY + th); g.addColorStop(0, c.grad[0]); g.addColorStop(1, c.grad[1]); fill = g; }

  const drawGlyph = (s, gx, gy, col) => {
    if (c.glow) {
      x.save(); x.shadowColor = c.glow.c; x.shadowBlur = c.glow.b * ppx;
      x.fillStyle = col || fill;
      x.fillText(s, gx, gy); x.fillText(s, gx, gy);
      x.restore();
    }
    if (c.shadow && (c.shadow.b || c.shadow.y || c.shadow.x)) {
      x.save(); x.shadowColor = c.shadow.c; x.shadowBlur = c.shadow.b * ppx; x.shadowOffsetX = (c.shadow.x || 0) * ppx; x.shadowOffsetY = (c.shadow.y || 0) * ppx;
      x.fillStyle = col || fill;
      x.fillText(s, gx, gy);
      x.restore();
    }
    if (st) { x.strokeStyle = c.stroke.c; x.lineWidth = st * 2; x.strokeText(s, gx, gy); }
    x.fillStyle = col || fill;
    x.fillText(s, gx, gy);
  };

  const perChar = inA || outA || loopA || sp;
  if (!perChar) lines.forEach((l, i) => drawGlyph(l, lineX(widths[i]), topY + i * lh + asc));
  else {
    const total = lines.reduce((a, l) => a + l.length, 0);
    const words = text.split(/\s+/).filter(Boolean).length;
    let idx = 0, wi = 0;
    const pIn = inA && u < inD ? clamp(u / (inD || 1)) : 1;
    const pOut = outA && u > dur - outD ? clamp((u - (dur - outD)) / (outD || 1)) : 0;
    lines.forEach((l, li) => {
      const lx = lineX(widths[li]), ly = topY + li * lh + asc;
      for (let i = 0; i < l.length; i++, idx++) {
        const ch = l[i];
        if (/\s/.test(ch)) { wi++; continue; }
        const px = mctx.measureText(l.slice(0, i)).width + sp * i;
        const cw = mctx.measureText(ch).width;
        const m = { dx: 0, dy: 0, s: 1, rot: 0, op: 1, color: null };
        const add = (d) => { if (!d) return; m.dx += d.dx || 0; m.dy += d.dy || 0; if (d.s != null) m.s *= d.s; m.rot += d.rot || 0; if (d.op != null) m.op *= d.op; if (d.color) m.color = d.color; };
        if (inA && pIn < 1) add(inA.f(idx, total, pIn, u, wi, words));
        if (outA && pOut > 0) add(outA.f(idx, total, pOut, u, wi, words));
        if (loopA) add(loopA.f(idx, total, 0, u, wi, words));
        if (m.op <= 0.003 || m.s <= 0.003) continue;
        x.save();
        x.globalAlpha = clamp(m.op);
        x.translate(lx + px + cw / 2 + m.dx * size, ly - size * 0.35 + m.dy * size);
        if (m.rot) x.rotate(m.rot * Math.PI / 180);
        if (m.s !== 1) x.scale(m.s, m.s);
        drawGlyph(ch, -cw / 2, size * 0.35, m.color);
        x.restore();
      }
      wi++;
    });
  }
  const r = { canvas: cv, w: W / ppx, h: H / ppx, key: stKey };
  cache.set(hitId, r);
  if (cache.size > 80) cache.delete(cache.keys().next().value);
  return r;
}
