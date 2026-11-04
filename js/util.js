// Small helpers shared by every module: DOM builder, maths, formatting, icons, toasts and dialogs.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, p) => a + (b - a) * p;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
export const isPhone = () => matchMedia('(max-width: 820px)').matches;
export const coarse = () => matchMedia('(pointer: coarse)').matches;

/** Deterministic random numbers, so a template or a song comes out the same on every device. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export function fmtTime(t, frames = 0) {
  t = Math.max(0, t || 0);
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  const base = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  if (!frames) return base;
  return base + ':' + String(Math.floor((t % 1) * frames + 1e-6)).padStart(2, '0');
}
export const fmtSize = (n) => (n >= 1e9 ? (n / 1e9).toFixed(2) + ' GB' : n >= 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB');
export const fmtDur = (t) => (t < 60 ? t.toFixed(1) + ' dtk' : Math.floor(t / 60) + ' mnt ' + Math.round(t % 60) + ' dtk');

export function debounce(fn, ms) {
  let id = 0;
  const d = (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
  d.cancel = () => clearTimeout(id);
  return d;
}

/** h('div.a.b', {onclick}, child, child) */
export function h(sel, props, ...kids) {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props && (props instanceof Node || typeof props !== 'object' || Array.isArray(props))) { kids.unshift(props); props = null; }
  if (props) {
    for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el && k !== 'list' && k !== 'form') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return el;
}

const I = {
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke-linejoin="round"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M6 5v14M19 5l-10 7 10 7z"/>', next: '<path d="M18 5v14M5 5l10 7-10 7z"/>',
  undo: '<path d="M8 6 4 10l4 4"/><path d="M4 10h10a5 5 0 0 1 0 10h-3"/>', redo: '<path d="m16 6 4 4-4 4"/><path d="M20 10H10a5 5 0 0 0 0 10h3"/>',
  split: '<path d="M12 3v18"/><path d="m5 8-2 4 2 4M19 8l2 4-2 4"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>', plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>', chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  media: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-4 3.5 3 3-2.5L20 17"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', sticker: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8l-6 6H6a2 2 0 0 1-2-2z"/><path d="M14 20v-4a2 2 0 0 1 2-2h4"/>',
  effect: '<path d="m12 3 1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.500 9.5l4.700-1.800zM18.500 15l.9 2.300 2.300.9-2.300.9-.9 2.300-.9-2.300-2.300-.9 2.300-.9zM5 15.500l.6 1.500 1.500.6-1.500.6-.6 1.500-.6-1.500-1.500-.6 1.500-.6z"/>',
  transition: '<path d="M4 5h7v14H4zM13 5h7v14h-7z"/><path d="m9.500 9.500 2.500 2.500-2.500 2.500" />', filter: '<circle cx="9" cy="10" r="5.500"/><circle cx="15" cy="10" r="5.500"/><circle cx="12" cy="15" r="5.500"/>',
  adjust: '<path d="M5 21v-7M5 10V3M12 21v-9M12 8V3M19 21v-5M19 12V3M2.500 14h5M9.500 8h5M16.500 16h5"/>', template: '<rect x="3" y="3" width="8" height="10" rx="1.500"/><rect x="13" y="3" width="8" height="6" rx="1.500"/><rect x="13" y="11" width="8" height="10" rx="1.500"/><rect x="3" y="15" width="8" height="6" rx="1.500"/>',
  wand: '<path d="m4 20 11-11M15 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM19.500 12l.6 1.400 1.400.6-1.400.6-.6 1.400-.6-1.400-1.400-.6 1.400-.6zM9 3l.6 1.400L11 5l-1.400.6L9 7l-.6-1.400L7 5l1.400-.6z"/>',
  speed: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="m12 15 4-5"/><circle cx="12" cy="15" r="1.300" fill="currentColor"/>', volume: '<path d="M4 9.500v5h3.500L12 18.500v-13l-4.500 4z"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9.500v5h3.500L12 18.500v-13l-4.500 4z"/><path d="m16 9.500 5 5M21 9.500l-5 5"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>', unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.500-2"/>',
  eye: '<path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12z"/><circle cx="12" cy="12" r="2.800"/>', eyeoff: '<path d="M4 4l16 16M9.500 5.800A9 9 0 0 1 12 5.500c6 0 9.500 6.500 9.500 6.500a15 15 0 0 1-3 3.700M6.300 7.500A15 15 0 0 0 2.500 12S6 18.500 12 18.500a9 9 0 0 0 3.500-.7"/>',
  freeze: '<path d="M12 2.500v19M3.800 7.200l16.400 9.600M20.200 7.200 3.800 16.800M9.500 4.500 12 7l2.500-2.500M9.500 19.500 12 17l2.500 2.500"/>', reverse: '<path d="M7 7h11v6"/><path d="M10 4 7 7l3 3M17 17H6v-6"/><path d="m14 20 3-3-3-3"/>',
  crop: '<path d="M7 2.500V17h14.500M2.500 7H17v14.500"/>', flip: '<path d="M12 3v18M8 7l-4 5 4 5zM16 7l4 5-4 5z"/>', rotate: '<path d="M20 11a8 8 0 1 0-2.300 6.300"/><path d="M20 5v6h-6"/>', mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  export: '<path d="M12 16V4M7.500 8.500 12 4l4.500 4.500"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>', upload: '<path d="M12 16V5M7.500 9.500 12 5l4.500 4.500"/><path d="M4 19h16"/>', download: '<path d="M12 4v11M7.500 10.500 12 15l4.500-4.500"/><path d="M4 19h16"/>',
  keyframe: '<path d="m12 4 8 8-8 8-8-8z"/>', zoomin: '<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200M11 8.500v5M8.500 11h5"/>', zoomout: '<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200M8.500 11h5"/>', magnet: '<path d="M5 4h4v8a3 3 0 0 0 6 0V4h4v8a7 7 0 0 1-14 0zM5 8h4M15 8h4"/>',
  full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.2-1.700l2-1.500-2-3.400-2.300 1a7 7 0 0 0-3-1.700L13 2.500H9.500L9 5a7 7 0 0 0-3 1.700l-2.300-1-2 3.400 2 1.500A7 7 0 0 0 3.500 12c0 .6.1 1.200.2 1.700l-2 1.500 2 3.400 2.300-1a7 7 0 0 0 3 1.700l.5 2.500H13l.5-2.500a7 7 0 0 0 3-1.700l2.300 1 2-3.400-2-1.500c.1-.5.2-1.100.2-1.700z" transform="translate(.8)"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>', mask: '<rect x="3" y="4" width="18" height="16" rx="2.500"/><circle cx="12" cy="12" r="4.500"/>', drop: '<path d="M12 3s6.500 6.800 6.500 11a6.500 6.500 0 0 1-13 0C5.500 9.800 12 3 12 3z"/>', chroma: '<path d="m14 4 6 6-9 9-6 1 1-6zM12 6l6 6"/>',
  anim: '<circle cx="15" cy="12" r="6"/><path d="M3 8h4M2 12h3M3 16h4"/>', caption: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M7 11h6M15 11h2M7 15h3M12 15h5"/>', beat: '<path d="M2 12h3l2-6 3 12 3-15 3 12 2-3h4"/>', scissors: '<circle cx="6" cy="7" r="2.700"/><circle cx="6" cy="17" r="2.700"/><path d="M8 8.500 20 18M8 15.500 20 6"/>', hd: '<rect x="3" y="5" width="18" height="14" rx="2.500"/><path d="M7 9.500v5M11 9.500v5M7 12h4M14 9.500v5h1.500a2.500 2.500 0 0 0 0-5z"/>',
  logo: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 16V8l4 5 4-5v8"/>', drip: '<path d="M4 18h16M6.500 18V8h11v10M9.500 8V5h5v3"/>', extract: '<path d="M5 20V9l7-5 7 5v11"/><path d="M9 14c1-2 2-2 3 0s2 2 3 0"/>', sparkle: '<path d="M12 3l2.200 6.800L21 12l-6.800 2.200L12 21l-2.200-6.800L3 12l6.800-2.200z"/>', folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2.500h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>', search: '<circle cx="11" cy="11" r="6.500"/><path d="m20 20-4.200-4.200"/>', dots: '<circle cx="5" cy="12" r="1.500" fill="currentColor"/><circle cx="12" cy="12" r="1.500" fill="currentColor"/><circle cx="19" cy="12" r="1.500" fill="currentColor"/>', home: '<path d="m3 11 9-7.500 9 7.500M5.500 9.500V20h13V9.500"/>', marker: '<path d="M6 3h12v18l-6-4.500L6 21z"/>', replace: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>', rec: '<circle cx="12" cy="12" r="6" fill="currentColor" stroke="none"/>', sfx: '<path d="M3 12c2-6 4-6 6 0s4 6 6 0 4-6 6 0"/>',
};
export const icon = (n, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('class', 'ic');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  s.innerHTML = I[n] || '';
  return s;
};

let toastBox;
export function toast(msg, kind = '', ms = 2600) {
  toastBox ||= document.body.appendChild(h('div.toasts'));
  const t = h('div.toast' + (kind ? '.' + kind : ''), msg);
  toastBox.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, ms);
  return t;
}

/** A centred dialog on desktop, a bottom sheet on a phone. Returns {el, body, close}. */
export function modal({ title, cls = '', onclose, body, foot, wide } = {}) {
  const box = h('div.modal' + (wide ? '.wide' : '') + (cls ? '.' + cls : ''));
  const bg = h('div.modal-bg', { onpointerdown: (e) => { if (e.target === bg) close(); } }, box);
  const bodyEl = h('div.modal-body');
  const close = () => { if (!bg.isConnected) return; bg.remove(); document.removeEventListener('keydown', esc, true); onclose?.(); };
  const esc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  if (title !== undefined) box.append(h('header.modal-head', h('b', title), h('button.ib', { onclick: close, title: 'Tutup', 'aria-label': 'Tutup' }, icon('x'))));
  box.append(bodyEl);
  if (body) bodyEl.append(body);
  if (foot) box.append(h('footer.modal-foot', foot));
  document.body.append(bg);
  document.addEventListener('keydown', esc, true);
  return { el: box, body: bodyEl, close };
}

export function confirmBox(title, text, okLabel = 'Lanjut', danger = false) {
  return new Promise((res) => {
    let ok = false;
    const m = modal({
      title, onclose: () => res(ok),
      body: h('p.muted', text),
      foot: [h('button.btn', { onclick: () => m.close() }, 'Batal'), h('button.btn' + (danger ? '.danger' : '.primary'), { onclick: () => { ok = true; m.close(); } }, okLabel)],
    });
  });
}

export function promptBox(title, value = '', ph = '') {
  return new Promise((res) => {
    let out = null;
    const inp = h('input.input', { value, placeholder: ph, onkeydown: (e) => { if (e.key === 'Enter') { out = inp.value; m.close(); } } });
    const m = modal({ title, onclose: () => res(out), body: inp, foot: [h('button.btn', { onclick: () => m.close() }, 'Batal'), h('button.btn.primary', { onclick: () => { out = inp.value; m.close(); } }, 'Simpan')] });
    setTimeout(() => { inp.focus(); inp.select(); }, 30);
  });
}

export function pickFiles(accept, multiple = true) {
  return new Promise((res) => {
    const i = h('input', { type: 'file', accept, multiple, style: { position: 'fixed', left: '-99px', opacity: 0 } });
    document.body.append(i);
    i.addEventListener('change', () => { res([...i.files]); i.remove(); });
    i.addEventListener('cancel', () => { res([]); i.remove(); });
    i.click();
  });
}

export function download(blob, name) {
  const u = URL.createObjectURL(blob);
  const a = h('a', { href: u, download: name, style: { display: 'none' } });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 60000);
}

export class Emitter {
  constructor() { this.m = new Map(); }
  on(ev, fn) { (this.m.get(ev) || this.m.set(ev, new Set()).get(ev)).add(fn); return () => this.m.get(ev)?.delete(fn); }
  emit(ev, ...a) { this.m.get(ev)?.forEach((f) => f(...a)); }
}

export const EASE = {
  linear: (p) => p,
  in: (p) => p * p,
  out: (p) => 1 - (1 - p) * (1 - p),
  inout: (p) => (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)),
  cubicOut: (p) => 1 - (1 - p) ** 3,
  cubicIn: (p) => p ** 3,
  back: (p) => { const c = 1.70158; return 1 + (c + 1) * (p - 1) ** 3 + c * (p - 1) ** 2; },
  elastic: (p) => (p === 0 || p === 1 ? p : 2 ** (-10 * p) * Math.sin(((p * 10 - 0.75) * 2 * Math.PI) / 3) + 1),
  bounce: (p) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
  hold: (p) => (p >= 1 ? 1 : 0),
};
