// Stock pictures drawn from code. Template previews and effect thumbnails use these until the user brings their own media.
import { registerSample, getMedia } from './media.js';
import { rng } from './util.js';

const W = 720, H = 1080;
function mk(fn, w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
const grad = (x, y0, y1, ...stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s)); return g; };
function ridge(x, r, w, base, amp, color, steps = 34) {
  x.fillStyle = color; x.beginPath(); x.moveTo(0, base + r() * amp);
  for (let i = 1; i <= steps; i++) x.lineTo((i / steps) * w, base + (Math.sin(i * .4 + r() * 2) + r()) * amp * .6);
  x.lineTo(w, 9999); x.lineTo(0, 9999); x.closePath(); x.fill();
}
function sun(x, cx, cy, r, c1, c2) { const g = x.createRadialGradient(cx, cy, r * .1, cx, cy, r * 3); g.addColorStop(0, c1); g.addColorStop(.28, c2); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6); x.fillStyle = c1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }

const SCENES = [
  (x, w, h) => { const r = rng(3); x.fillStyle = grad(x, 0, h * .75, '#1b1a4b', '#7a2e7e', '#f0695a', '#ffc36e'); x.fillRect(0, 0, w, h); sun(x, w * .55, h * .54, 70, '#fff3c4', '#ffb35c'); ridge(x, r, w, h * .63, 70, '#4a2a5e'); ridge(x, r, w, h * .72, 80, '#2d1c40'); ridge(x, r, w, h * .84, 90, '#160f26'); },
  (x, w, h) => { const r = rng(9); x.fillStyle = grad(x, 0, h * .6, '#8fd3ff', '#dff4ff'); x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(255,255,255,.85)'; const cx = r() * w, cy = r() * h * .3 + 60; for (let j = 0; j < 5; j++) { x.beginPath(); x.arc(cx + j * 34 - 70, cy + r() * 16, 26 + r() * 26, 0, 7); x.fill(); } } x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(w * .12, h * .62); x.lineTo(w * .44, h * .27); x.lineTo(w * .78, h * .62); x.fill(); x.fillStyle = '#7790a8'; x.beginPath(); x.moveTo(w * .28, h * .46); x.lineTo(w * .44, h * .27); x.lineTo(w * .56, h * .4); x.lineTo(w * .5, h * .44); x.lineTo(w * .44, h * .4); x.lineTo(w * .38, h * .47); x.fill(); ridge(x, r, w, h * .6, 45, '#4f8a57'); ridge(x, r, w, h * .72, 40, '#2d6a44'); x.fillStyle = grad(x, h * .84, h, '#1a7fb5', '#0e4a78'); x.fillRect(0, h * .84, w, h * .16); },
  (x, w, h) => { const r = rng(5); x.fillStyle = grad(x, 0, h, '#050514', '#121b45', '#3a1f6b', '#ff5c9b'); x.fillRect(0, 0, w, h); for (let i = 0; i < 140; i++) { x.fillStyle = `rgba(255,255,255,${r() * .8})`; x.fillRect(r() * w, r() * h * .55, 1.5, 1.5); } for (let i = 0; i < 16; i++) { const bw = 40 + r() * 70, bh = 180 + r() * 420, bx = i * (w / 14) - 20; x.fillStyle = `rgb(${12 + r() * 12},${12 + r() * 12},${32 + r() * 30})`; x.fillRect(bx, h - bh, bw, bh); for (let yy = h - bh + 12; yy < h - 10; yy += 18) for (let xx = bx + 6; xx < bx + bw - 8; xx += 13) if (r() > .55) { x.fillStyle = r() > .5 ? '#ffd76a' : '#6fe7ff'; x.fillRect(xx, yy, 6, 9); } } },
  (x, w, h) => { const r = rng(11); x.fillStyle = grad(x, 0, h * .55, '#66d2f0', '#c7f0f5'); x.fillRect(0, 0, w, h); sun(x, w * .78, h * .16, 50, '#fffbe0', '#fff0a8'); x.fillStyle = grad(x, h * .5, h * .74, '#0fb4c9', '#0a7fa8'); x.fillRect(0, h * .5, w, h * .24); x.fillStyle = '#ffe2b2'; x.beginPath(); x.moveTo(0, h * .68); x.quadraticCurveTo(w * .5, h * .62, w, h * .76); x.lineTo(w, h); x.lineTo(0, h); x.fill(); const palm = (px, py, s) => { x.strokeStyle = '#6b4a2b'; x.lineWidth = 12 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 50 * s, py - 200 * s, px + 20 * s, py - 340 * s); x.stroke(); x.strokeStyle = '#1f8a4c'; x.lineWidth = 16 * s; for (let a = 0; a < 7; a++) { const an = -Math.PI + a * .52; x.beginPath(); x.moveTo(px + 20 * s, py - 340 * s); x.quadraticCurveTo(px + 20 * s + Math.cos(an) * 90 * s, py - 370 * s + Math.sin(an) * 70 * s, px + 20 * s + Math.cos(an) * 180 * s, py - 280 * s + Math.sin(an) * 60 * s); x.stroke(); } }; palm(w * .18, h * .9, 1.2); palm(w * .84, h * .94, .9); for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(255,255,255,${r() * .5})`; x.fillRect(r() * w, h * .52 + r() * h * .18, 20 + r() * 50, 2); } },
  (x, w, h) => { const r = rng(21); x.fillStyle = grad(x, 0, h, '#f9d7c2', '#f4b6c2', '#cf9bd8'); x.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { const px = r() * w, py = r() * h, s = 14 + r() * 40; x.fillStyle = `hsla(${330 + r() * 40},85%,${72 + r() * 18}%,.75)`; for (let k = 0; k < 5; k++) { const a = k * 1.256; x.beginPath(); x.ellipse(px + Math.cos(a) * s * .6, py + Math.sin(a) * s * .6, s * .5, s * .32, a, 0, 7); x.fill(); } x.fillStyle = '#ffe48a'; x.beginPath(); x.arc(px, py, s * .2, 0, 7); x.fill(); } },
  (x, w, h) => { const r = rng(31); x.fillStyle = grad(x, 0, h, '#0d2a23', '#17553f', '#2f8a58'); x.fillRect(0, 0, w, h); for (let i = 0; i < 120; i++) { const px = r() * w, py = r() * h * .8; x.strokeStyle = `hsla(${110 + r() * 40},60%,${22 + r() * 30}%,.9)`; x.lineWidth = 4 + r() * 12; x.beginPath(); x.moveTo(px, py + 260 * r()); x.quadraticCurveTo(px + (r() - .5) * 80, py, px + (r() - .5) * 150, py - 60); x.stroke(); } for (let i = 0; i < 6; i++) { const g = x.createLinearGradient(0, 0, 80, h); g.addColorStop(0, 'rgba(255,250,200,.5)'); g.addColorStop(1, 'transparent'); x.fillStyle = g; const bx = i * 140 - 70; x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + 60, 0); x.lineTo(bx + 240, h); x.lineTo(bx + 90, h); x.fill(); } },
  (x, w, h) => { x.fillStyle = grad(x, 0, h, '#2a2230', '#4e3a3a', '#8a5a3a'); x.fillRect(0, 0, w, h); x.fillStyle = '#c98b52'; x.fillRect(0, h * .7, w, h * .3); x.fillStyle = '#fff8ea'; x.beginPath(); x.ellipse(w * .5, h * .62, 245, 165, 0, 0, 7); x.fill(); x.fillStyle = '#d6dadf'; x.beginPath(); x.ellipse(w * .5, h * .62, 190, 124, 0, 0, 7); x.fill(); const r = rng(44); for (let i = 0; i < 130; i++) { const a = r() * 7, d = r() * 150, px = w * .5 + Math.cos(a) * d, py = h * .62 + Math.sin(a) * d * .62; x.fillStyle = r() > .6 ? '#e65a2b' : r() > .5 ? '#f7c948' : '#3d9e4a'; x.beginPath(); x.ellipse(px, py, 7 + r() * 12, 5 + r() * 7, r() * 3, 0, 7); x.fill(); } x.fillStyle = 'rgba(255,255,255,.12)'; x.beginPath(); x.ellipse(w * .36, h * .52, 90, 40, -.5, 0, 7); x.fill(); },
  (x, w, h) => { const r = rng(52); x.fillStyle = '#10121c'; x.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { const cx = r() * w, cy = r() * h, rad = 90 + r() * 240, g = x.createRadialGradient(cx, cy, 0, cx, cy, rad), c = r() > .5 ? '255,76,130' : r() > .5 ? '70,180,255' : '255,196,70'; g.addColorStop(0, `rgba(${c},.55)`); g.addColorStop(1, 'transparent'); x.fillStyle = g; x.fillRect(0, 0, w, h); } x.fillStyle = '#0b0c13'; x.beginPath(); x.arc(w * .5, h * .46, 92, 0, 7); x.fill(); x.beginPath(); x.moveTo(w * .22, h); x.quadraticCurveTo(w * .28, h * .58, w * .5, h * .58); x.quadraticCurveTo(w * .72, h * .58, w * .78, h); x.fill(); },
];

const made = [];
/** Registers the stock pictures once and returns them as media. */
export function sampleMedia() {
  if (made.length) return made;
  SCENES.forEach((fn, i) => {
    const cv = mk(fn);
    cv.__key = 'sample:' + i;
    const m = { id: 'sample:' + i, type: 'image', name: 'Contoh ' + (i + 1), w: W, h: H, bitmap: cv, sample: true, thumbs: [cv], thumbStep: Infinity };
    registerSample(m); made.push(m);
  });
  return made;
}
export const sampleThumb = (i = 0) => sampleMedia()[i % SCENES.length];
export { getMedia };
