// Voice-over: records from the microphone while the project plays, then lands the take at the spot where it began.
import { h, icon, modal, toast, fmtTime } from './util.js';
import { importFile } from './media.js';
import * as A from './actions.js';

export async function recordVoice() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Browser ini tidak mendukung perekaman suara.', 'bad');
  const player = A.getPlayer();
  let stream = null, rec = null, chunks = [], started = 0, tickId = 0, startAt = 0;
  const time = h('div.rec-time', '00:00');
  const meter = h('div.meter', h('i'));
  const btn = h('button.rec-btn', { title: 'Mulai rekam', 'aria-label': 'Mulai rekam', onclick: () => (rec ? stop() : begin()) }, icon('rec', 34));
  const note = h('p.muted.center', 'Video ikut diputar saat merekam, supaya suara Anda pas dengan gambar.');
  let ac = null, an = null;
  const m = modal({ title: 'Rekam suara', onclose: cleanup, body: h('div.rec', time, meter, btn, note) });
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    ac = new AudioContext(); an = ac.createAnalyser(); an.fftSize = 512; ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize), bar = meter.firstChild;
    const loop = () => { if (!an) return; an.getByteTimeDomainData(buf); let mx = 0; for (const v of buf) mx = Math.max(mx, Math.abs(v - 128)); bar.style.width = Math.min(100, (mx / 110) * 100) + '%'; requestAnimationFrame(loop); };
    loop();
  } catch (e) {
    m.close();
    toast('Izin mikrofon ditolak atau mikrofon tidak ada.', 'bad', 4000);
    return;
  }
  function begin() {
    chunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t)) || '';
    rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = finish;
    startAt = player.t;
    rec.start(250);
    if (player.duration > player.t + .1) player.play();
    started = performance.now();
    btn.classList.add('on'); btn.replaceChildren(h('i.stop-sq'));
    tickId = setInterval(() => { time.textContent = fmtTime((performance.now() - started) / 1000); }, 200);
  }
  function stop() { rec.stop(); player.pause(); clearInterval(tickId); }
  async function finish() {
    const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
    rec = null;
    const ext = (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm');
    const file = new File([blob], `Rekaman ${new Date().toLocaleTimeString('id-ID').replace(/\./g, '-')}.${ext}`, { type: blob.type, lastModified: Date.now() });
    note.textContent = 'Menyimpan rekaman…';
    try {
      const media = await importFile(file, { type: 'audio', tag: 'voice' });
      const c = await A.addAudio(media, startAt);
      c.tag = 'voice';
      m.close();
      toast('Rekaman masuk ke trek audio');
    } catch (e) { toast(e.message, 'bad'); m.close(); }
  }
  function cleanup() { clearInterval(tickId); if (rec) { rec.onstop = null; rec.stop(); } stream?.getTracks().forEach((t) => t.stop()); an = null; ac?.close(); }
}
