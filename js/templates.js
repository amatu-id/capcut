// Video templates: a song, a cutting rhythm, a look, and titles. Pick one, bring media, and the edit is done.
import { newProject, makeVideoClip, makeImageClip, makeAudioClip, makeTextClip, makeFilterClip, makeFxClip, makeStickerClip, placeClip, mainTrack, normalizeMain, makeColorClip } from './model.js';
import { TEXT_PRESETS } from './text.js';
import { trackById } from './music.js';
import { filterById } from './filters.js';
import { effectById } from './effects.js';
import { getMedia, getAudio } from './media.js';
import { clone, rng } from './util.js';
import { pickWindow } from './autoedit.js';

const T = (id, name, cat, ratio, track, cut, trans, opts = {}) => ({ id, name, cat, ratio, track, cut, trans, ...opts });
const KB = ['kenburnsin', 'kenburnsout', 'panl', 'panr', 'drift'];

export const TEMPLATES = [
  // Populer
  T('viral-beat', 'Potongan Viral', 'Populer', '9:16', 'edm1', [2, 2, 1, 1, 2], ['punch', 'whip', 'zoomin', 'glitch'], { filter: 'vivid', fx: [['beatflash', .4, { p1: .3 }], ['zoompulse', .6, { p1: .3 }]], title: ['captok', 'POV: HARI TERBAIK', 'popchar'], desc: 'Potongan cepat tepat di ketukan, untuk TikTok dan Reels.', min: 8 }),
  T('aesthetic', 'Estetik Lembut', 'Populer', '9:16', 'lofi1', [4, 4], ['fade', 'lens', 'leak'], { filter: 'soft', loop: KB, title: ['hand', 'hari yang tenang', 'fadechar'], fx: [['filmgrain', .3]], desc: 'Tenang dan hangat, ada bintik film halus.', min: 6 }),
  T('photo-dump', 'Photo Dump', 'Populer', '9:16', 'pop1', [1, 1, 1, 1, 2, 2], [null, null, 'shake', null, 'flash'], { filter: 'kodak', loop: ['pulse', 'kenburnsin'], title: ['marker', 'bulan ini', 'wordpop'], desc: 'Banyak foto bergantian cepat seperti album kamera.', min: 12 }),
  T('glow-up', 'Sebelum & Sesudah', 'Populer', '9:16', 'trap1', [8, 8], ['glitch', 'flash'], { filter: 'clean', title: ['outline', 'glow up!', 'zoomchar'], fx: [['glow', .5]], desc: 'Dua bagian besar dengan perubahan tajam.', min: 4 }),
  T('story-quote', 'Kata Hari Ini', 'Populer', '9:16', 'rom3', [8], ['fade'], { filter: 'moody', loop: ['kenburnsin'], title: ['elegant', 'Pelan-pelan,\nsemua akan sampai.', 'fadechar'], titleHold: true, desc: 'Satu kalimat besar di atas gambar yang bergerak pelan.', min: 3 }),
  // Vlog
  T('vlog-day', 'Vlog Harian', 'Vlog', '16:9', 'pop4', [8, 8, 4], ['pushl', 'pushr', 'fade'], { filter: 'natural', title: ['bold', 'Satu Hari Bersama Saya', 'slideup'], sub: ['plain', 'vlog #01'], end: ['bold', 'Terima kasih sudah menonton'], desc: 'Santai untuk YouTube, ada judul dan penutup.', min: 6 }),
  T('vlog-city', 'Jalan di Kota', 'Vlog', '9:16', 'funk1', [4, 2, 2], ['pushu', 'pushd', 'whipv'], { filter: 'cross', title: ['impact', 'JALAN-JALAN', 'dropchar'], desc: 'Bergeser naik turun mengikuti langkah.', min: 6 }),
  T('morning', 'Rutinitas Pagi', 'Vlog', '9:16', 'aco1', [4, 4, 2, 2], ['fade', 'wiper', 'fade'], { filter: 'honey', loop: ['kenburnsout'], title: ['script', 'selamat pagi', 'fadechar'], desc: 'Hangat dan berwarna madu.', min: 6 }),
  T('dayinlife', 'Sehari Penuh', 'Vlog', '16:9', 'corp1', [4, 4], ['slideover', 'pushl'], { filter: 'clean', title: ['minimal', 'A Day in My Life', 'spread'], desc: 'Bersih dengan judul minimal.', min: 8 }),
  // Perjalanan
  T('travel-epic', 'Petualangan Epik', 'Perjalanan', '16:9', 'cine2', [4, 4, 2, 2, 4], ['zoomin', 'whip', 'crosszoom', 'black'], { filter: 'teal', loop: KB, fx: [['letterbox', .55]], title: ['trailer', 'SANG PENJELAJAH', 'spread'], sub: ['cinema', 'sebuah perjalanan'], desc: 'Warna teal-oranye dan bar sinematik.', min: 6 }),
  T('travel-reel', 'Liburan Pantai', 'Perjalanan', '9:16', 'house2', [2, 2, 4], ['whip', 'pushl', 'ripple'], { filter: 'ocean', loop: ['panl', 'panr'], title: ['sunset', 'liburan!', 'bounce'], fx: [['lightleak', .5]], desc: 'Cerah dengan kesan matahari pantai.', min: 8 }),
  T('roadtrip', 'Road Trip', 'Perjalanan', '16:9', 'rock3', [4, 2, 2], ['pushr', 'whip'], { filter: 'dune', title: ['epic', 'ROAD TRIP', 'fromleft'], desc: 'Kencang dan berdebu, cocok untuk video mobil.', min: 8 }),
  T('nusantara', 'Pesona Nusantara', 'Perjalanan', '16:9', 'nus1', [4, 4], ['fade', 'leak', 'dissolve'], { filter: 'golden', loop: KB, title: ['gold', 'Pesona Nusantara', 'fadechar'], sub: ['cinema', 'indonesia'], desc: 'Nuansa gamelan dan warna emas.', min: 6 }),
  T('mountain', 'Gunung & Kabut', 'Perjalanan', '9:16', 'amb3', [8, 8], ['dissolve', 'fade'], { filter: 'mist', loop: ['panu', 'kenburnsin'], title: ['minimal', 'ketinggian', 'fadechar'], desc: 'Pelan, berkabut dan luas.', min: 4 }),
  // Sinematik
  T('film-trailer', 'Trailer Film', 'Sinematik', '21:9', 'cine1', [4, 2, 2, 4], ['black', 'flash', 'black'], { filter: 'blockbuster', fx: [['filmgrain', .3]], title: ['trailer', 'SEGERA TAYANG', 'fadechar'], sub: ['cinema', 'musim panas ini'], desc: 'Gelap-terang seperti cuplikan bioskop.', min: 6 }),
  T('noir', 'Hitam Putih', 'Sinematik', '16:9', 'cine3', [8, 4], ['black', 'fade'], { filter: 'noir', loop: KB, fx: [['filmgrain', .5]], title: ['serif', 'Kenangan', 'fadechar'], desc: 'Hitam putih dan pelan.', min: 4 }),
  T('dream', 'Mimpi', 'Sinematik', '9:16', 'amb1', [8], ['lens', 'leak'], { filter: 'pastel', loop: ['drift'], fx: [['dream', .8]], title: ['elegant', 'seperti mimpi', 'fadechar'], desc: 'Bercahaya lembut dan melayang.', min: 4 }),
  T('oldfilm', 'Film Lama', 'Sinematik', '4:3', 'lofi3', [4, 4], ['film', 'black'], { filter: 'sepia', fx: [['oldfilm', .8]], loop: ['kenburnsout'], title: ['hand', 'dulu sekali...', 'typewriter'], desc: 'Seperti rekaman 8 mm.', min: 4 }),
  T('moody', 'Moody Malam', 'Sinematik', '9:16', 'trap3', [4, 2, 2], ['fade', 'blur', 'black'], { filter: 'moody', fx: [['vignette', .7]], title: ['cinema', 'malam', 'spread'], desc: 'Gelap dan dingin untuk klip malam.', min: 6 }),
  // Beat Sync
  T('beat-flash', 'Kilat Ketukan', 'Beat Sync', '9:16', 'edm2', [1, 1, 1, 1], ['flash', 'punch'], { filter: 'neon', fx: [['strobe', .28, { p1: .1 }], ['rgbsplit', .55]], title: ['neonblue', 'DROP', 'popchar'], desc: 'Setiap ketukan berganti gambar.', min: 12 }),
  T('phonk-drift', 'Drift Phonk', 'Beat Sync', '9:16', 'phonk1', [2, 1, 1], ['whip', 'shake', 'glitch'], { filter: 'dark', fx: [['shake', .35], ['rgbsplit', .4]], title: ['sport', 'NO LIMIT', 'dropchar'], desc: 'Gelap dan bergetar untuk klip mobil atau motor.', min: 10 }),
  T('hype', 'Hype Sport', 'Beat Sync', '9:16', 'trap2', [2, 2, 1, 1], ['zoomin', 'whipv', 'punch'], { filter: 'epic', fx: [['zoompulse', .7, { p1: .34 }]], title: ['sport', 'SIAP MENANG', 'zoomchar'], desc: 'Kuat untuk olahraga dan highlight.', min: 10 }),
  T('house-party', 'Pesta Malam', 'Beat Sync', '9:16', 'house1', [2, 2], ['crosszoom', 'circle', 'rgb'], { filter: 'cyber', fx: [['beatflash', .3, { p1: .3 }]], title: ['neonpink', 'pesta dimulai', 'wave'], desc: 'Warna neon yang berdenyut mengikuti kick.', min: 8 }),
  T('koplo', 'Goyang Koplo', 'Beat Sync', '9:16', 'kop1', [2, 2, 4], ['shake', 'zoomin', 'flash'], { filter: 'vivid', title: ['comic', 'GAS KELUD!', 'bounce'], desc: 'Kendang koplo dan warna cerah.', min: 8 }),
  // Pesta & Momen
  T('birthday', 'Ulang Tahun', 'Momen', '9:16', 'kid2', [2, 2, 4], ['circle', 'heart', 'star'], { filter: 'vivid', loop: ['pulse', 'kenburnsin'], fx: [['confetti', .75]], title: ['candy', 'Selamat Ulang Tahun!', 'bounce'], sub: ['script', 'semoga panjang umur'], stickers: ['🎂', '🎉', '🎈'], desc: 'Konfeti, warna ceria dan banyak stiker.', min: 8 }),
  T('wedding', 'Pernikahan', 'Momen', '16:9', 'rom1', [8, 4, 4], ['fade', 'heart', 'lens'], { filter: 'porcelain', loop: KB, fx: [['sparkle', .5]], title: ['wedding', 'Rina & Adit', 'fadechar'], sub: ['cinema', 'dua hati satu janji'], desc: 'Elegan dengan kilau halus dan nama pengantin.', min: 6 }),
  T('wedding-story', 'Undangan Digital', 'Momen', '9:16', 'rom2', [4, 4], ['fade', 'dissolve'], { filter: 'peach', loop: ['kenburnsin', 'panu'], fx: [['hearts', .5]], title: ['gold', 'The Wedding of', 'fadechar'], sub: ['wedding', 'Rina & Adit'], desc: 'Undangan vertikal yang mudah dibagikan.', min: 5 }),
  T('love', 'Kisah Kita', 'Momen', '9:16', 'rom3', [4, 4, 8], ['heart', 'fade'], { filter: 'rose', fx: [['hearts', .6]], loop: ['float', 'kenburnsin'], title: ['script', 'untukmu', 'fadechar'], desc: 'Romantis dengan hati yang melayang.', min: 5 }),
  T('graduation', 'Wisuda', 'Momen', '9:16', 'cine2', [4, 4, 2, 2], ['flash', 'zoomin'], { filter: 'golden', fx: [['confetti', .5]], title: ['gold', 'Selamat Wisuda', 'popchar'], sub: ['plain', 'kerja keras terbayar'], desc: 'Bangga dan megah untuk momen kelulusan.', min: 6 }),
  T('memories', 'Kenangan Keluarga', 'Momen', '16:9', 'aco2', [8, 8], ['fade', 'leak'], { filter: 'polaroid', loop: KB, title: ['hand', 'kenangan kita', 'fadechar'], end: ['hand', 'selalu di hati'], desc: 'Slideshow hangat untuk foto keluarga.', min: 6 }),
  T('ramadan', 'Berkah Ramadan', 'Momen', '9:16', 'nus2', [4, 4], ['fade', 'dissolve'], { filter: 'golden', loop: KB, fx: [['fireflies', .6]], title: ['gold', 'Ramadan Kareem', 'fadechar'], sub: ['elegant', 'selamat menunaikan ibadah puasa'], desc: 'Tenang dengan cahaya kunang-kunang.', min: 5 }),
  // Bisnis
  T('promo-sale', 'Promo Besar', 'Bisnis', '9:16', 'house3', [2, 2], ['pushu', 'flash', 'zoomin'], { filter: 'vivid', title: ['sale', 'DISKON 50%', 'popchar'], sub: ['bold', 'hanya minggu ini'], stickers: ['svg:sale', 'svg:order'], desc: 'Harga menonjol dan tombol pesan.', min: 5 }),
  T('product', 'Produk Elegan', 'Bisnis', '1:1', 'corp3', [4, 4], ['fade', 'wiper'], { filter: 'clean', loop: ['kenburnsin', 'panl'], title: ['editorial', 'Koleksi Baru', 'slideup'], sub: ['minimal', 'tersedia sekarang'], desc: 'Bersih untuk feed Instagram toko.', min: 4 }),
  T('company', 'Profil Perusahaan', 'Bisnis', '16:9', 'corp2', [4, 4, 4], ['pushl', 'fade', 'slideover'], { filter: 'natural', title: ['bold', 'Tentang Kami', 'slideup'], sub: ['plain', 'tumbuh bersama pelanggan'], end: ['bold', 'Hubungi kami hari ini'], desc: 'Rapi untuk presentasi dan profil usaha.', min: 6 }),
  T('reklame', 'Iklan 15 Detik', 'Bisnis', '9:16', 'pop2', [2, 2, 2, 2], ['whip', 'pushl'], { filter: 'crispy', title: ['price', 'Rp 99.000', 'bounce'], sub: ['capbox', 'stok terbatas, pesan sekarang'], stickers: ['svg:free'], maxSec: 15, desc: 'Pas 15 detik dengan harga besar.', min: 6 }),
  T('realestate', 'Properti', 'Bisnis', '16:9', 'corp3', [8, 4], ['fade', 'slideover'], { filter: 'alpine', loop: ['panl', 'panr'], title: ['serif', 'Rumah Impian', 'fadechar'], sub: ['minimal', 'lokasi strategis'], desc: 'Gerakan lambat melewati setiap ruangan.', min: 5 }),
  T('fnb', 'Menu Kuliner', 'Bisnis', '9:16', 'funk3', [2, 2, 4], ['pushu', 'whip'], { filter: 'tasty', loop: ['kenburnsin'], title: ['lobster', 'Menu Spesial', 'popchar'], sub: ['capyellow', 'enak dan terjangkau'], stickers: ['🔥'], desc: 'Warna hangat yang menggugah selera.', min: 6 }),
  // Gaya
  T('fashion', 'Lookbook', 'Gaya', '9:16', 'house1', [2, 2, 4], ['split', 'whip', 'splith'], { filter: 'rose', title: ['editorial', 'Lookbook', 'spread'], sub: ['minimal', 'koleksi musim ini'], desc: 'Terasa seperti majalah fesyen.', min: 8 }),
  T('makeup', 'Tutorial Makeup', 'Gaya', '9:16', 'pop3', [4, 4], ['fade', 'wiper'], { filter: 'glow', title: ['sunset', 'tutorial mudah', 'wave'], desc: 'Lembut dan bercahaya untuk konten kecantikan.', min: 5 }),
  T('retro', 'Retro VHS', 'Gaya', '4:3', 'syn1', [4, 2, 2], ['tv', 'glitch', 'rgb'], { filter: 'vhs', fx: [['vhs', .8]], title: ['pixel', 'PLAY > 1996', 'typewriter'], stickers: ['svg:rec'], desc: 'Kaset lama, garis layar dan warna geser.', min: 6 }),
  T('synthwave', 'Neon 80-an', 'Gaya', '16:9', 'syn2', [4, 4], ['rgb', 'glitch', 'wiper'], { filter: 'vapor', fx: [['scan', .5]], title: ['cyber', 'NIGHT DRIVE', 'glitchin'], desc: 'Warna ungu-biru khas retrowave.', min: 6 }),
  T('comic', 'Komik', 'Gaya', '1:1', 'kid3', [2, 2], ['hex', 'mosaic', 'checker'], { filter: 'comic', fx: [['halftone', .7, { p1: .3 }]], title: ['comic', 'WOW!', 'popchar'], stickers: ['svg:burst'], desc: 'Titik halftone dan warna tajam.', min: 6 }),
  T('gaming', 'Highlight Game', 'Gaya', '16:9', 'rock1', [2, 2, 1, 1], ['glitch', 'whip', 'shake'], { filter: 'cyber', fx: [['rgbsplit', .3]], title: ['impact', 'EPIC WIN', 'dropchar'], desc: 'Keras dan cepat untuk klip game.', min: 8 }),
  T('split-screen', 'Layar Terbagi', 'Gaya', '9:16', 'funk2', [4, 4], ['split', 'splith'], { filter: 'natural', fx: [['split2', 1]], title: ['outline', 'dua sisi', 'slideup'], desc: 'Klip muncul berlapis dalam dua bidang.', min: 5 }),
  // Anak & Hewan
  T('kids', 'Si Kecil', 'Keluarga', '9:16', 'kid1', [4, 2, 2], ['circle', 'star', 'heart'], { filter: 'pastel', loop: ['pulse', 'float'], title: ['bubble', 'si kecil', 'bounce'], stickers: ['🧸', '⭐'], desc: 'Lucu dengan transisi berbentuk.', min: 6 }),
  T('pet', 'Hewan Peliharaan', 'Keluarga', '9:16', 'kid3', [2, 2, 4], ['heart', 'pushu', 'circle'], { filter: 'peach', loop: ['kenburnsin'], title: ['hand', 'si meong', 'bounce'], stickers: ['🐾', '❤️'], desc: 'Hangat untuk video kucing atau anjing.', min: 6 }),
];
export const TEMPLATE_CATS = [...new Set(TEMPLATES.map((t) => t.cat))];
export const templateById = (id) => TEMPLATES.find((t) => t.id === id);

const presetOf = (id) => TEXT_PRESETS.find((p) => p.id === id)?.o || {};

function addText(P, spec, start, dur, y = -0.08, scale = 1, inAnim = null) {
  const [preset, text, anim] = spec;
  const o = clone(presetOf(preset));
  const portrait = P.h > P.w, base = (o.size || 90) * (portrait ? 1 : 0.95) * scale;
  const c = makeTextClip(start, dur, { ...o, text, size: Math.round(base), name: text.split('\n')[0].slice(0, 22) });
  c.tf.y = y;
  c.tanim = { in: { id: anim || inAnim || 'fadechar' }, out: { id: 'fadechar', d: .4 }, loop: null };
  placeClip(P, c, 'text');
  return c;
}

/**
 * Builds a finished project. media = list of media objects, opts = {title, sub, ratio, music: media id}.
 * Bad or empty inputs still give a usable project, since the user can edit everything afterwards.
 */
export async function applyTemplate(tpl, media, opts = {}) {
  const P = newProject(tpl.name, opts.ratio || tpl.ratio);
  const r = rng(hashSeed(tpl.id));
  const musicId = opts.music || 'music:' + tpl.track;
  const audio = opts.previewOnly ? null : await getAudio(musicId);
  const mm = getMedia(musicId);
  const bpm = opts.bpm || trackById(tpl.track)?.bpm || 110;
  const beat = 60 / bpm;
  const songEnd = audio ? audio.duration : mm?.dur || 60;
  const list = media.filter(Boolean);
  if (!list.length) throw new Error('Pilih minimal satu foto atau video.');

  const slots = Math.max(tpl.min || 6, list.length);
  const maxSec = Math.min(opts.maxSec || tpl.maxSec || 180, songEnd - 0.5);
  const main = mainTrack(P);
  const used = new Map();
  let t = 0;
  for (let i = 0; i < slots; i++) {
    const beats = tpl.cut[i % tpl.cut.length];
    let d = beats * beat;
    while (d < 0.45) d *= 2;   // very fast songs: a cut under half a second just flickers
    if (t + d > maxSec) break;
    const m = list[i % list.length];
    let c;
    if (m.type === 'video') {
      c = makeVideoClip(m, t);
      const win = pickWindow(m, d, used.get(m.id) || 0);
      used.set(m.id, win.next);
      c.in = win.start; c.len = Math.min(win.len, m.dur - win.start);
      c.dur = d;
      c.speed = c.len / d;
      c.keepPitch = true;
      c.vol = opts.keepVoice ? 1 : 0; c.muted = !opts.keepVoice;
    } else {
      c = makeImageClip(m, t, d);
      if (tpl.loop) c.anim.loop = { id: r.pick(tpl.loop) };
    }
    c.fit = 'cover';
    if (tpl.trans) { const id = tpl.trans[i % tpl.trans.length]; if (id) c.trans = { id, d: Math.min(.9, d * .55) }; }
    main.clips.push(c);
    t += d;
  }
  normalizeMain(P);
  const total = main.clips.reduce((a, c) => a + c.dur, 0);
  if (main.clips.length) main.clips[main.clips.length - 1].trans = null;

  if (tpl.filter && filterById(tpl.filter)) placeClip(P, makeFilterClip(filterById(tpl.filter), 0, total), 'fx');
  for (const [id, amt, extra] of tpl.fx || []) {
    const def = effectById(id); if (!def) continue;
    const c = makeFxClip(def, 0, total); c.amt = amt; Object.assign(c, extra || {});
    placeClip(P, c, 'fx');
  }

  const titleDur = tpl.titleHold ? total : Math.min(3.2, total * 0.5);
  const small = Math.min(P.w, P.h) < 1080 ? .9 : 1;
  if (tpl.title) {
    const text = opts.title || tpl.title[1];
    addText(P, [tpl.title[0], text, tpl.title[2]], 0.15, titleDur, tpl.sub ? -0.06 : 0, small);
    if (tpl.sub) addText(P, [tpl.sub[0], opts.sub || tpl.sub[1], 'fadechar'], 0.55, Math.max(.8, titleDur - .4), 0.06, small * .62);
  }
  if (tpl.end) addText(P, [tpl.end[0], tpl.end[1], 'fadechar'], Math.max(0, total - 2.6), 2.5, 0, small * .8);
  if (tpl.stickers) tpl.stickers.forEach((s, i) => {
    const sticker = s.startsWith('svg:') ? { type: 'svg', v: s.slice(4) } : { type: 'emoji', v: s };
    const c = makeStickerClip(sticker, 0.4, Math.max(1, total - 0.8));
    const corner = [[-.3, -.32], [.3, .28], [.28, -.3]][i % 3];
    c.tf.x = corner[0]; c.tf.y = corner[1]; c.tf.s = s.startsWith('svg:') ? 1.1 : .6;
    c.anim = { in: { id: 'pop' }, out: { id: 'fade' }, loop: { id: 'float' } };
    placeClip(P, c, 'text');
  });
  if (mm) {
    const a = makeAudioClip(mm, 0);
    a.len = Math.min(total, mm.dur); a.dur = a.len; a.fadeOut = Math.min(2, total * .15); a.tag = 'music'; a.duck = opts.keepVoice ? .6 : 0;
    placeClip(P, a, 'audio');
  }
  P.markers = [];
  for (let x = 0; x < total; x += beat) P.markers.push(+x.toFixed(3));
  P.bg = { type: 'blur', color: '#000000', blur: .6 };
  P.templateId = tpl.id;
  return P;
}
const hashSeed = (s) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
export { makeColorClip };
