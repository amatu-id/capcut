// On-device AI: speech to text, picture upscaling and background removal. Models come from public mirrors and stay in the Cache API.
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/';
const TF = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/dist/transformers.min.js';
const SITE = 'https://amatu-id.github.io';
const CACHE = 'amatu-cut-models-v1';
const post = (m, t) => self.postMessage(m, t || []);

async function gpu() { try { return !!(await navigator.gpu?.requestAdapter()); } catch { return false; } }

/* ---- captions ---- */
let asr = null, asrKey = '';
/** Models are mirrored on our own site (Hugging Face's download servers are unreachable from some networks) and Hugging Face stays as the backup. */
async function loadAsr(model, mirror) {
  const { pipeline, env } = await import(TF);
  const gpuOk = await gpu();
  const seen = {};
  env.allowRemoteModels = !mirror; env.allowLocalModels = mirror; env.localModelPath = SITE + '/capcut/models/';
  return pipeline('automatic-speech-recognition', `onnx-community/whisper-${model}_timestamped`, {
    // The encoder runs well on the GPU. The small integer decoder only runs reliably on the CPU.
    device: gpuOk ? { encoder_model: 'webgpu', decoder_model_merged: 'wasm' } : 'wasm',
    dtype: gpuOk ? { encoder_model: 'fp32', decoder_model_merged: 'q8' } : 'q8',
    progress_callback: (p) => {
      if (p.status === 'progress' && p.total > 1e6) {
        seen[p.file] = [p.loaded, p.total];
        const v = Object.values(seen), a = v.reduce((s, x) => s + x[0], 0), c = v.reduce((s, x) => s + x[1], 0);
        post({ type: 'progress', p: 0.45 * (a / c), text: 'Mengunduh model suara ' + Math.round(a / 1e6) + ' / ' + Math.round(c / 1e6) + ' MB' });
      }
    },
  });
}
async function captions({ pcm, language, model }) {
  if (!asr || asrKey !== model) {
    try { asr = await loadAsr(model, true); } catch (e) { console.warn('mirror', e); asr = await loadAsr(model, false); }
    asrKey = model;
  }
  post({ type: 'progress', p: 0.5, text: 'Mendengarkan…' });
  const r = await asr(pcm, { language: language || null, task: 'transcribe', chunk_length_s: 28, stride_length_s: 4, return_timestamps: 'word' });
  post({ type: 'captions', chunks: r.chunks || [] });
}

/* ---- onnxruntime helpers ---- */
let ort = null, ortGpu = false;
const sessions = new Map();
async function runtime() {
  if (ort) return ort;
  const useGpu = await gpu();
  ort = await import(ORT + (useGpu ? 'ort.webgpu.bundle.min.mjs' : 'ort.wasm.bundle.min.mjs'));
  ortGpu = useGpu;
  ort.env.wasm.wasmPaths = ORT; ort.env.logLevel = 'error'; ort.env.wasm.numThreads = self.crossOriginIsolated ? 8 : 1;
  return ort;
}
async function modelBytes(url, label) {
  const c = await caches.open(CACHE);
  let r = await c.match(url);
  if (!r) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Model tidak bisa diunduh (' + res.status + ').');
    const total = +res.headers.get('content-length') || 0, rd = res.body.getReader(), parts = [];
    let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (total) post({ type: 'progress', p: got / total, text: label + ' ' + Math.round(got / 1e6) + ' / ' + Math.round(total / 1e6) + ' MB' }); }
    const blob = new Blob(parts);
    await c.put(url, new Response(blob));
    return new Uint8Array(await blob.arrayBuffer());
  }
  return new Uint8Array(await r.arrayBuffer());
}
async function session(url, label) {
  if (sessions.has(url)) return sessions.get(url);
  const o = await runtime();
  const s = await o.InferenceSession.create(await modelBytes(url, label), { executionProviders: ortGpu ? ['webgpu', 'wasm'] : ['wasm'], graphOptimizationLevel: 'all' });
  sessions.set(url, s);
  return s;
}

/* ---- upscale: compact Real-ESRGAN, ×4, cut in overlapping tiles ---- */
const TILE = 384, OVER = 16;
async function upscale({ id, data, w, h }) {
  const s = await session(SITE + '/enhance/models/gen_d50_h.onnx', 'Mengunduh model AI');
  const S = 4, ow = w * S, oh = h * S, out = new Uint8ClampedArray(ow * oh * 4);
  const src = new Uint8ClampedArray(data);
  const stepX = Math.max(1, TILE - OVER * 2);
  for (let ty = 0; ty < h; ty += stepX) {
    for (let tx = 0; tx < w; tx += stepX) {
      const x0 = Math.max(0, tx - OVER), y0 = Math.max(0, ty - OVER), x1 = Math.min(w, tx + stepX + OVER), y1 = Math.min(h, ty + stepX + OVER), tw = x1 - x0, th = y1 - y0;
      const inp = new Float32Array(3 * tw * th);
      for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
        const p = ((y0 + y) * w + (x0 + x)) * 4, q = y * tw + x;
        inp[q] = src[p] / 255; inp[tw * th + q] = src[p + 1] / 255; inp[2 * tw * th + q] = src[p + 2] / 255;
      }
      const r = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, th, tw]) });
      const o = r[s.outputNames[0]], od = await (o.getData ? o.getData(true) : o.data);
      const dh = o.dims[2], dw = o.dims[3], n = dw * dh;
      const cx0 = (tx - x0) * S, cy0 = (ty - y0) * S, cx1 = Math.min(dw, cx0 + stepX * S), cy1 = Math.min(dh, cy0 + stepX * S);
      for (let y = cy0; y < cy1; y++) for (let x = cx0; x < cx1; x++) {
        const q = y * dw + x, p = ((y - cy0 + ty * S) * ow + (x - cx0 + tx * S)) * 4;
        out[p] = od[q] * 255; out[p + 1] = od[n + q] * 255; out[p + 2] = od[2 * n + q] * 255; out[p + 3] = 255;
      }
      o.dispose?.();
    }
  }
  post({ type: 'upscaled', id, data: out.buffer, w: ow, h: oh }, [out.buffer]);
}

/* ---- background removal: IS-Net at 1024 ---- */
async function matte({ id, data, w, h }) {
  await runtime();
  const url = SITE + (ortGpu ? '/background/models/isnet_fp16.onnx' : '/background/models/isnet_quantized.onnx');
  const s = await session(url, 'Mengunduh model AI');
  const SZ = 1024, cv = new OffscreenCanvas(SZ, SZ), x = cv.getContext('2d', { willReadFrequently: true });
  const src = new OffscreenCanvas(w, h);
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data), w, h), 0, 0);
  x.drawImage(src, 0, 0, SZ, SZ);
  const d = x.getImageData(0, 0, SZ, SZ).data, inp = new Float32Array(3 * SZ * SZ);
  for (let i = 0; i < SZ * SZ; i++) { inp[i] = d[i * 4] / 255 - .5; inp[SZ * SZ + i] = d[i * 4 + 1] / 255 - .5; inp[2 * SZ * SZ + i] = d[i * 4 + 2] / 255 - .5; }
  const r = await s.run({ [s.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, SZ, SZ]) });
  const o = r[s.outputNames[0]], od = await (o.getData ? o.getData(true) : o.data);
  let mn = Infinity, mx = -Infinity;
  for (const v of od) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const mask = new OffscreenCanvas(SZ, SZ), mx2 = mask.getContext('2d'), mi = mx2.createImageData(SZ, SZ);
  for (let i = 0; i < SZ * SZ; i++) { const a = (od[i] - mn) / (mx - mn || 1); mi.data[i * 4 + 3] = Math.min(255, Math.max(0, (a - .08) * 1.2 * 255)); }
  mx2.putImageData(mi, 0, 0);
  const res = new OffscreenCanvas(w, h), rx = res.getContext('2d');
  rx.drawImage(src, 0, 0);
  rx.globalCompositeOperation = 'destination-in';
  rx.imageSmoothingQuality = 'high';
  rx.drawImage(mask, 0, 0, w, h);
  const blob = await res.convertToBlob({ type: 'image/png' });
  post({ type: 'matted', id, blob });
}

self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (d.op === 'captions') await captions(d);
    else if (d.op === 'upscale') await upscale(d);
    else if (d.op === 'matte') await matte(d);
  } catch (err) { post({ type: 'error', id: d.id, error: err.message || String(err) }); }
};
