// Sticker catalog: emoji drawn from the system font and vector labels of our own.
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" font-family="Arial Black,Arial,sans-serif" font-weight="900">${body}</svg>`;

export const STICKER_SVG = [
  ['subscribe', 'Subscribe', svg(200, 60, '<rect width="200" height="60" rx="14" fill="#ef2b2d"/><path d="M22 18v24l20-12z" fill="#fff"/><text x="52" y="39" font-size="22" fill="#fff">SUBSCRIBE</text>')],
  ['follow', 'Ikuti', svg(160, 60, '<rect width="160" height="60" rx="30" fill="#fff"/><path d="M34 18v24M22 30h24" stroke="#e11d74" stroke-width="7" stroke-linecap="round"/><text x="58" y="39" font-size="24" fill="#111">IKUTI</text>')],
  ['like', 'Suka', svg(90, 90, '<circle cx="45" cy="45" r="44" fill="#2f7bf6"/><path d="M26 42h10v28H26zM40 70h22a6 6 0 0 0 6-5l4-18a6 6 0 0 0-6-7H52l2-11a6 6 0 0 0-11-3L36 42v28z" fill="#fff"/>')],
  ['heart', 'Hati', svg(100, 92, '<path d="M50 90S4 60 4 28C4 12 16 3 28 3c9 0 17 5 22 14C55 8 63 3 72 3c12 0 24 9 24 25 0 32-46 62-46 62z" fill="#f43f5e"/><path d="M26 15c-7 1-11 7-11 14" stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none" opacity=".75"/>')],
  ['comment', 'Komentar', svg(100, 92, '<path d="M50 4c26 0 46 16 46 36S76 76 50 76c-7 0-13-1-19-3L8 88l6-24C8 57 4 49 4 40 4 20 24 4 50 4z" fill="#fff"/><circle cx="30" cy="40" r="6" fill="#111"/><circle cx="50" cy="40" r="6" fill="#111"/><circle cx="70" cy="40" r="6" fill="#111"/>')],
  ['share', 'Bagikan', svg(90, 90, '<circle cx="45" cy="45" r="44" fill="#10b981"/><path d="M50 22l24 21-24 21V51c-14 0-24 4-32 16 2-18 12-32 32-34z" fill="#fff"/>')],
  ['arrowr', 'Panah', svg(120, 70, '<path d="M4 24h68V6l44 29-44 29V46H4z" fill="#facc15" stroke="#111" stroke-width="4" stroke-linejoin="round"/>')],
  ['arrowc', 'Panah Lengkung', svg(110, 110, '<path d="M14 18c52-8 78 18 74 66" fill="none" stroke="#ef4444" stroke-width="11" stroke-linecap="round"/><path d="M68 72l20 22 16-26" fill="none" stroke="#ef4444" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>')],
  ['circlemark', 'Lingkaran', svg(140, 90, '<path d="M28 18C60 0 122 4 132 38c9 34-46 50-82 46C20 80-2 62 10 38 20 20 58 8 96 12" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>')],
  ['underline', 'Garis Bawah', svg(200, 30, '<path d="M6 18c40-12 70 6 100-2s60-8 88 0" fill="none" stroke="#fde047" stroke-width="9" stroke-linecap="round"/>')],
  ['sale', 'Diskon', svg(120, 120, '<path d="M60 3l14 12 18-4 6 18 18 6-4 18 12 14-12 14 4 18-18 6-6 18-18-4-14 12-14-12-18 4-6-18-18-6 4-18L-1 67l12-14-4-18 18-6 6-18 18 4z" transform="translate(1)" fill="#dc2626"/><text x="60" y="58" text-anchor="middle" font-size="22" fill="#fff">DISKON</text><text x="60" y="88" text-anchor="middle" font-size="30" fill="#fde047">50%</text>')],
  ['new', 'Baru', svg(120, 120, '<path d="M60 4l15 14 20-5 5 20 20 5-5 20 14 15-14 15 5 20-20 5-5 20-20-5-15 14-15-14-20 5-5-20-20-5 5-20L-1 73l14-15-5-20 20-5 5-20 20 5z" transform="translate(1 -7)" fill="#facc15"/><text x="60" y="68" text-anchor="middle" font-size="30" fill="#111">BARU</text>')],
  ['best', 'Terlaris', svg(180, 60, '<path d="M0 6h180l-16 24 16 24H0l16-24z" fill="#f97316"/><text x="90" y="39" text-anchor="middle" font-size="24" fill="#fff">TERLARIS</text>')],
  ['promo', 'Promo', svg(160, 60, '<rect width="160" height="60" rx="8" fill="#111"/><rect x="5" y="5" width="150" height="50" rx="5" fill="none" stroke="#fde047" stroke-width="3" stroke-dasharray="7 5"/><text x="80" y="40" text-anchor="middle" font-size="26" fill="#fde047">PROMO</text>')],
  ['free', 'Gratis Ongkir', svg(220, 60, '<rect width="220" height="60" rx="30" fill="#059669"/><text x="110" y="39" text-anchor="middle" font-size="22" fill="#fff">GRATIS ONGKIR</text>')],
  ['order', 'Pesan', svg(200, 64, '<rect width="200" height="64" rx="32" fill="#2563eb"/><text x="100" y="41" text-anchor="middle" font-size="24" fill="#fff">PESAN SEKARANG</text>')],
  ['live', 'Live', svg(100, 44, '<rect width="100" height="44" rx="8" fill="#ef2b2d"/><circle cx="22" cy="22" r="7" fill="#fff"/><text x="60" y="31" text-anchor="middle" font-size="22" fill="#fff">LIVE</text>')],
  ['rec', 'REC', svg(100, 44, '<circle cx="18" cy="22" r="11" fill="#ef2b2d"/><text x="62" y="32" text-anchor="middle" font-size="24" fill="#fff" stroke="#000" stroke-width=".8">REC</text>')],
  ['bubbleb', 'Balon Kata', svg(160, 120, '<path d="M80 6c41 0 74 20 74 46S121 98 80 98c-8 0-15-1-22-2l-30 20 6-32C16 75 6 64 6 52 6 26 39 6 80 6z" fill="#fff" stroke="#111" stroke-width="4"/>')],
  ['burst', 'Ledakan Kata', svg(160, 130, '<path d="M80 4l15 26 26-16-4 30 34-4-22 25 28 16-33 7 14 30-30-14-8 23-20-26-20 26-8-23-30 14 14-30-33-7 28-16L9 40l34 4-4-30 26 16z" fill="#fde047" stroke="#111" stroke-width="4" stroke-linejoin="round"/>')],
  ['wow', 'WOW', svg(160, 130, '<path d="M80 4l15 26 26-16-4 30 34-4-22 25 28 16-33 7 14 30-30-14-8 23-20-26-20 26-8-23-30 14 14-30-33-7 28-16L9 40l34 4-4-30 26 16z" fill="#ef4444" stroke="#fff" stroke-width="4" stroke-linejoin="round"/><text x="80" y="78" text-anchor="middle" font-size="32" fill="#fff">WOW!</text>')],
  ['star', 'Bintang', svg(100, 96, '<path d="M50 3l14 31 34 4-25 23 7 33-30-17-30 17 7-33L2 38l34-4z" fill="#facc15" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>')],
  ['stars5', 'Rating 5', svg(220, 44, [0, 1, 2, 3, 4].map((i) => `<path transform="translate(${i * 44} 0) scale(.44)" d="M50 3l14 31 34 4-25 23 7 33-30-17-30 17 7-33L2 38l34-4z" fill="#facc15"/>`).join(''))],
  ['pin', 'Lokasi', svg(70, 100, '<path d="M35 2C17 2 3 16 3 34c0 24 32 64 32 64s32-40 32-64C67 16 53 2 35 2z" fill="#ef4444"/><circle cx="35" cy="34" r="13" fill="#fff"/>')],
  ['check', 'Centang', svg(100, 100, '<circle cx="50" cy="50" r="48" fill="#10b981"/><path d="M26 52l16 16 32-34" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>')],
  ['cross', 'Silang', svg(100, 100, '<circle cx="50" cy="50" r="48" fill="#ef4444"/><path d="M32 32l36 36M68 32L32 68" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round"/>')],
  ['music', 'Not', svg(90, 100, '<path d="M30 80V18l48-12v60" fill="none" stroke="#a855f7" stroke-width="8"/><ellipse cx="18" cy="80" rx="15" ry="12" fill="#a855f7"/><ellipse cx="66" cy="68" rx="15" ry="12" fill="#a855f7"/>')],
  ['crown', 'Mahkota', svg(120, 90, '<path d="M8 80L2 22l32 24L60 6l26 40 32-24-6 58z" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="58" r="7" fill="#dc2626"/>')],
  ['fire', 'Api', svg(80, 100, '<path d="M40 2c6 20 32 30 32 60 0 20-15 36-32 36S8 82 8 62c0-16 10-24 14-36 4 8 8 12 12 12 4-12 2-24 6-36z" fill="#f97316"/><path d="M40 50c3 10 16 15 16 28 0 10-7 18-16 18s-16-8-16-18c0-8 6-12 8-18 2 3 4 5 5 5 2-5 1-10 3-15z" fill="#fde047"/>')],
  ['flag', 'Merah Putih', svg(120, 80, '<rect width="120" height="40" fill="#e11d2e"/><rect y="40" width="120" height="40" fill="#fff"/>')],
];

export const EMOJI_GROUPS = [
  ['Wajah', '😀 😂 🤣 😍 🥰 😘 😎 🤩 🥳 😇 🤔 🤫 🤯 😱 😭 😡 🥺 😴 🤤 🤪 😜 🙄 😏 😬 🤗 🤑 🤠 👻 💀 🤖 👽 🙈'.split(' ')],
  ['Tangan', '👍 👎 👏 🙏 💪 🤝 ✌️ 🤞 🤟 🤘 👌 👉 👈 👆 👇 ✋ 👋 🫶 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 💕 💖 💯'.split(' ')],
  ['Perayaan', '🎉 🎊 🎈 🎁 🎂 🍰 🏆 🥇 👑 💍 💐 🌹 ✨ ⭐ 🌟 🔥 💥 💫 ⚡ 🌈 ☀️ 🌙 ❄️ 🎵 🎶 🎬 📸 🎥 📣 🔔'.split(' ')],
  ['Bisnis', '💰 💵 💳 🛒 🛍️ 📦 🏷️ 📈 📉 ✅ ❌ ⚠️ ❗ ❓ 🔝 🆕 🆓 🔒 📍 📱 💻 ⏰ 🚀 🎯 💡 🏠 🚗 ✈️ 🍔 ☕'.split(' ')],
  ['Alam', '🐶 🐱 🐰 🦊 🐻 🐼 🦁 🐯 🐵 🦄 🐝 🦋 🌸 🌺 🌻 🌴 🌊 🏔️ 🍕 🍟 🍜 🍣 🍦 🍩 🍓 🍉 🥑 🌶️ ⚽ 🏀'.split(' ')],
];

const cache = new Map();

/** Returns {canvas, aspect, key} once ready. A vector sticker needs a moment to decode, so the first call may return null. */
export function stickerSource(st) {
  const key = st.type + ':' + st.v;
  const hit = cache.get(key);
  if (hit) return hit === 'wait' ? null : hit;
  if (st.type === 'emoji') {
    const cv = document.createElement('canvas'); cv.width = cv.height = 320;
    const x = cv.getContext('2d');
    x.font = '250px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(st.v, 160, 172);
    const r = { canvas: cv, aspect: 1, key };
    cache.set(key, r);
    return r;
  }
  const def = STICKER_SVG.find((s) => s[0] === st.v);
  if (!def) return null;
  cache.set(key, 'wait');
  const im = new Image();
  im.onload = () => {
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth || 512; cv.height = im.naturalHeight || 512;
    cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
    cache.set(key, { canvas: cv, aspect: cv.width / cv.height, key });
    onStickerReady?.();
  };
  im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(def[2]);
  return null;
}
let onStickerReady = null;
export const setStickerReady = (f) => { onStickerReady = f; };
export const stickerSvgUrl = (id) => { const d = STICKER_SVG.find((s) => s[0] === id); return d ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(d[2]) : ''; };
/** Waits until a vector sticker is decoded (export must not start without it). */
export function loadSticker(st) {
  return new Promise((res) => {
    const tick = () => { const r = stickerSource(st); if (r) res(r); else setTimeout(tick, 30); };
    tick();
  });
}
