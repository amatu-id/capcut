// Heavy audio maths off the main thread: pitch without speed change, speed without pitch change, reverse, noise reduction, beat detection.

function fft(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inv ? 1 : -1), wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

const hann = (n) => { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n); return w; };

/** Phase vocoder with identity phase locking: stretches time by factor alpha, keeps pitch. */
function stretch(x, alpha, N = 2048) {
  if (Math.abs(alpha - 1) < 1e-3) return x;
  const Hs = N / 4, Ha = Hs / alpha, win = hann(N), half = N / 2;
  const frames = Math.max(1, Math.ceil((x.length - N) / Ha) + 1);
  const out = new Float32Array(Math.ceil(x.length * alpha) + N * 2), norm = new Float32Array(out.length);
  const re = new Float64Array(N), im = new Float64Array(N);
  const lastPhase = new Float64Array(half + 1), sumPhase = new Float64Array(half + 1), mag = new Float64Array(half + 1), phase = new Float64Array(half + 1), outPh = new Float64Array(half + 1);
  const expect = new Float64Array(half + 1); for (let k = 0; k <= half; k++) expect[k] = (2 * Math.PI * k) / N;
  let first = true;
  for (let f = 0; f < frames; f++) {
    const pos = f * Ha, ip = Math.floor(pos), fr = pos - ip;
    for (let i = 0; i < N; i++) {
      const a = x[ip + i] || 0, b = x[ip + i + 1] || 0;
      re[i] = (a + (b - a) * fr) * win[i]; im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= half; k++) { mag[k] = Math.hypot(re[k], im[k]); phase[k] = Math.atan2(im[k], re[k]); }
    if (first) { outPh.set(phase); sumPhase.set(phase); first = false; } else {
      // Peaks carry the phase, the bins around each peak stay locked to it. This is what removes the "phasey" sound.
      let prevPeak = -1;
      for (let k = 2; k < half - 1; k++) {
        if (mag[k] > mag[k - 1] && mag[k] > mag[k - 2] && mag[k] > mag[k + 1] && mag[k] > mag[k + 2]) {
          let dp = phase[k] - lastPhase[k] - expect[k] * Ha;
          dp -= 2 * Math.PI * Math.round(dp / (2 * Math.PI));
          const inst = expect[k] + dp / Ha;
          sumPhase[k] += inst * Hs;
          const rot = sumPhase[k] - phase[k];
          const start = prevPeak < 0 ? 0 : Math.ceil((prevPeak + k) / 2);
          for (let j = start; j <= k; j++) outPh[j] = phase[j] + rot;
          for (let j = k + 1; j <= half; j++) outPh[j] = phase[j] + rot;
          prevPeak = k;
        }
      }
      if (prevPeak < 0) for (let k = 0; k <= half; k++) { let dp = phase[k] - lastPhase[k] - expect[k] * Ha; dp -= 2 * Math.PI * Math.round(dp / (2 * Math.PI)); sumPhase[k] += (expect[k] + dp / Ha) * Hs; outPh[k] = sumPhase[k]; }
      else for (let k = 0; k <= half; k++) sumPhase[k] = outPh[k];
    }
    lastPhase.set(phase);
    for (let k = 0; k <= half; k++) { re[k] = mag[k] * Math.cos(outPh[k]); im[k] = mag[k] * Math.sin(outPh[k]); }
    for (let k = 1; k < half; k++) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    fft(re, im, true);
    const o = Math.round(f * Hs);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
  }
  const len = Math.round(x.length * alpha), res = new Float32Array(len);
  for (let i = 0; i < len; i++) res[i] = norm[i] > 1e-4 ? out[i] / norm[i] : out[i];
  return res;
}

/** Changes length by linear interpolation: both pitch and speed move, like tape. */
function resample(x, newLen) {
  const out = new Float32Array(newLen), r = (x.length - 1) / Math.max(1, newLen - 1);
  for (let i = 0; i < newLen; i++) { const p = i * r, a = Math.floor(p), f = p - a; out[i] = x[a] + ((x[a + 1] ?? x[a]) - x[a]) * f; }
  return out;
}

/** Follows a speed curve: table[] gives, for each output position 0..1, the source position 0..1. */
function curveResample(x, table, newLen) {
  const out = new Float32Array(newLen), n = table.length - 1;
  for (let i = 0; i < newLen; i++) {
    const u = (i / Math.max(1, newLen - 1)) * n, a = Math.min(n - 1, Math.floor(u)), f = u - a;
    const p = (table[a] + (table[a + 1] - table[a]) * f) * (x.length - 1), s = Math.floor(p), g = p - s;
    out[i] = x[s] + ((x[s + 1] ?? x[s]) - x[s]) * g;
  }
  return out;
}

/** Spectral noise reduction: learns the noise floor from the quietest frames, then attenuates what stays near it. */
function denoise(x, amount) {
  const N = 2048, H = N / 4, half = N / 2, win = hann(N), frames = Math.max(1, Math.ceil((x.length - N) / H) + 1);
  const re = new Float64Array(N), im = new Float64Array(N);
  const energy = new Float32Array(frames), spec = [];
  const stride = Math.max(1, Math.floor(frames / 400));
  for (let f = 0; f < frames; f += stride) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float32Array(half + 1); let e = 0;
    for (let k = 0; k <= half; k++) { m[k] = Math.hypot(re[k], im[k]); e += m[k]; }
    energy[f] = e; spec.push({ e, m });
  }
  spec.sort((a, b) => a.e - b.e);
  const q = spec.slice(0, Math.max(1, Math.floor(spec.length * 0.15))), floor = new Float32Array(half + 1);
  for (const s of q) for (let k = 0; k <= half; k++) floor[k] += s.m[k] / q.length;
  const over = 1 + amount * 3, minGain = 1 - amount * 0.92;
  const out = new Float32Array(x.length + N), norm = new Float32Array(x.length + N), prev = new Float32Array(half + 1).fill(1);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k <= half; k++) {
      const m = Math.hypot(re[k], im[k]) + 1e-9;
      let g = Math.max(minGain, 1 - (floor[k] * over) / m);
      g = prev[k] * 0.55 + g * 0.45; prev[k] = g;
      re[k] *= g; im[k] *= g;
      if (k && k < half) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
  }
  const res = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) res[i] = norm[i] > 1e-4 ? out[i] / norm[i] : x[i];
  return res;
}

function process(ch, o) {
  let x = ch;
  if (o.denoise) x = denoise(x, o.denoise);
  if (o.table) x = curveResample(x, o.table, o.outLen);
  const ratio = 2 ** ((o.pitch || 0) / 12);
  const speed = o.table ? 1 : o.speed || 1;
  const timeAlpha = o.keepPitch || o.table ? 1 / speed : 1;
  if (ratio !== 1 || timeAlpha !== 1) {
    x = stretch(x, timeAlpha * ratio);
    if (ratio !== 1) x = resample(x, Math.round(x.length / ratio));
  } else if (!o.table && speed !== 1) x = resample(x, Math.round(x.length / speed));
  if (o.reverse) { x = x === ch ? x.slice() : x; x.reverse(); }
  return x;
}

function beats(mono, sr) {
  // Energy flux in low and mid bands, then the tempo that best explains it, then the beat phase.
  const dec = Math.max(1, Math.round(sr / 11025)), rate = sr / dec, x = new Float32Array(Math.floor(mono.length / dec));
  for (let i = 0; i < x.length; i++) x[i] = mono[i * dec];
  const N = 1024, H = 256, win = hann(N), frames = Math.max(1, Math.floor((x.length - N) / H)), flux = new Float32Array(frames);
  const re = new Float64Array(N), im = new Float64Array(N); let prev = new Float32Array(N / 2);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * H + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const m = new Float32Array(N / 2); let s = 0;
    for (let k = 0; k < N / 2; k++) { m[k] = Math.log1p(Math.hypot(re[k], im[k]) * 10); const d = m[k] - prev[k]; if (d > 0) s += d * (k < 40 ? 2 : 1); }
    flux[f] = s; prev = m;
  }
  const fps = rate / H;
  const w = Math.round(fps * 0.5);
  const on = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let a = 0, c = 0; for (let j = Math.max(0, f - w); j < Math.min(frames, f + w); j++) { a += flux[j]; c++; } on[f] = Math.max(0, flux[f] - (a / c) * 1.05); }
  let best = 0, bestLag = 0;
  const minLag = Math.floor((60 / 180) * fps), maxLag = Math.ceil((60 / 60) * fps);
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0; for (let f = lag; f < frames; f++) s += on[f] * on[f - lag];
    const bpm = (60 * fps) / lag, weight = Math.exp(-((bpm - 118) ** 2) / (2 * 55 * 55));
    s *= weight;
    if (s > best) { best = s; bestLag = lag; }
  }
  if (!bestLag) return { bpm: 0, beats: [], onsets: [] };
  let bestPh = 0, bs = -1;
  for (let ph = 0; ph < bestLag; ph++) { let s = 0; for (let f = ph; f < frames; f += bestLag) s += on[f]; if (s > bs) { bs = s; bestPh = ph; } }
  const out = []; let cur = bestPh;
  while (cur < frames) {
    let pk = Math.round(cur), mx = -1;
    for (let j = Math.max(0, Math.round(cur - bestLag * 0.1)); j <= Math.min(frames - 1, Math.round(cur + bestLag * 0.1)); j++) if (on[j] > mx) { mx = on[j]; pk = j; }
    out.push((pk * H) / rate);
    cur = pk + bestLag;
  }
  let mean = 0; for (const v of on) mean += v; mean /= frames;
  const onsets = [];
  for (let f = 1; f < frames - 1; f++) if (on[f] > mean * 3 && on[f] > on[f - 1] && on[f] >= on[f + 1]) { const t = (f * H) / rate; if (!onsets.length || t - onsets[onsets.length - 1] > 0.12) onsets.push(t); }
  return { bpm: Math.round((60 * fps) / bestLag), beats: out, onsets };
}

self.onmessage = (e) => {
  const { id, op, channels, opts, mono, sr } = e.data;
  try {
    if (op === 'process') {
      const out = channels.map((c) => process(c, opts));
      self.postMessage({ id, channels: out }, out.map((c) => c.buffer));
    } else if (op === 'beats') {
      self.postMessage({ id, result: beats(mono, sr) });
    }
  } catch (err) { self.postMessage({ id, error: String(err) }); }
};
