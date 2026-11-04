// Live preview: audio is the master clock, muted video elements follow it, the compositor draws what they show.
import { getMedia, mediaBus } from './media.js';
import { projectDur, srcAt, speedAt, transitionAt, activeClips } from './model.js';
import { LiveAudio } from './audio.js';
import { clamp, coarse } from './util.js';

const MAX_VIDEOS = coarse() ? 4 : 8;

class VideoPool {
  constructor(onframe) { this.els = new Map(); this.onframe = onframe; this.tick = 0; }
  get(c) {
    const srcMedia = c.up?.media && getMedia(c.up.media)?.url ? getMedia(c.up.media) : getMedia(c.media);
    if (!srcMedia?.url) return null;
    let e = this.els.get(c.id);
    if (e && e.url !== srcMedia.url) { this.drop(c.id); e = null; }
    if (!e) {
      const v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.disableRemotePlayback = true;
      v.setAttribute('playsinline', '');
      v.src = srcMedia.url;
      e = { v, url: srcMedia.url, used: 0, seeking: false, want: -1, media: srcMedia };
      v.addEventListener('seeked', () => { e.seeking = false; this.onframe(); });
      v.addEventListener('loadeddata', () => this.onframe());
      this.els.set(c.id, e);
      this._trim();
    }
    e.used = ++this.tick;
    return e;
  }
  _trim() {
    if (this.els.size <= MAX_VIDEOS) return;
    const old = [...this.els.entries()].sort((a, b) => a[1].used - b[1].used);
    while (this.els.size > MAX_VIDEOS) { const [id] = old.shift(); this.drop(id); }
  }
  drop(id) { const e = this.els.get(id); if (!e) return; e.v.pause(); e.v.removeAttribute('src'); e.v.load(); this.els.delete(id); }
  pauseAll(except) { for (const [id, e] of this.els) if (!except?.has(id) && !e.v.paused) e.v.pause(); }
  clear() { for (const id of [...this.els.keys()]) this.drop(id); }
}

export const srcTimeFor = (c, t) => {
  let s = srcAt(c, t);
  if (c.up?.media) s -= c.up.offset || 0;
  return s;
};

export class Player {
  constructor({ getProject, draw, onTime, onState }) {
    this.getProject = getProject; this.draw = draw; this.onTime = onTime; this.onState = onState;
    this.t = 0; this.playing = false; this.audio = new LiveAudio();
    this.pool = new VideoPool(() => this.invalidate());
    this.dirty = true;
    this.loop = this.loop.bind(this);
    this.lastSeek = 0;
    mediaBus.on('audio', () => { if (this.playing) this.audio.schedule(this.t); });
    mediaBus.on('audio-processed', () => { if (this.playing) { this.audio.schedule(this.t); } });
    requestAnimationFrame(this.loop);
  }
  invalidate() { this.dirty = true; }
  get duration() { return projectDur(this.getProject()); }

  /** What the compositor asks for each video clip. */
  video(c, t) {
    const e = this.pool.get(c);
    if (!e || e.v.readyState < 2) return null;
    return { src: e.v, w: e.v.videoWidth, h: e.v.videoHeight, rot: 0, stamp: undefined };
  }
  image(c) { const id = c.cut?.media || c.up?.media || c.media; return getMedia(id)?.bitmap || getMedia(c.media)?.bitmap || null; }
  bgImage(id) { return getMedia(id)?.bitmap || null; }

  _visibleVideos(P, t) {
    const out = activeClips(P, t).filter((c) => c.kind === 'video');
    const tr = transitionAt(P, t);
    if (tr) { for (const c of [tr.a, tr.b]) if (c.kind === 'video' && !out.includes(c)) out.push(c); }
    return out;
  }

  _sync(t) {
    const P = this.getProject();
    const vis = this._visibleVideos(P, t), keep = new Set();
    for (const c of vis) {
      const e = this.pool.get(c); if (!e) continue;
      keep.add(c.id);
      const dur = e.media.dur || 1e9;
      const want = clamp(srcTimeFor(c, t), 0, Math.max(0, dur - 0.04));
      const rate = speedAt(c, t);
      if (this.playing && !c.reverse) {
        if (Math.abs(e.v.playbackRate - rate) > 0.01) e.v.playbackRate = clamp(rate, 0.0625, 16);
        if (Math.abs(e.v.currentTime - want) > Math.max(0.2, rate * 0.12) && !e.seeking) { e.seeking = true; e.v.currentTime = want; }
        if (e.v.paused) e.v.play().catch(() => {});
      } else {
        if (!e.v.paused) e.v.pause();
        // Scrubbing and reverse clips: one seek at a time, or the element falls behind and never shows a frame.
        if (Math.abs(e.v.currentTime - want) > 0.012 && !e.seeking) { e.seeking = true; e.v.currentTime = want; }
      }
    }
    // Prepare what comes next, so a cut lands without a blank frame.
    const pre = t + (this.playing ? 1.4 : 0.4);
    for (const tr of P.tracks) for (const c of tr.clips) {
      if (c.kind !== 'video' || keep.has(c.id)) continue;
      if (c.start > t && c.start < pre) {
        const e = this.pool.get(c); if (!e) continue;
        keep.add(c.id);
        const want = clamp(srcTimeFor(c, c.start), 0, Math.max(0, (e.media.dur || 1e9) - 0.04));
        if (!e.v.paused) e.v.pause();
        if (Math.abs(e.v.currentTime - want) > 0.03 && !e.seeking) { e.seeking = true; e.v.currentTime = want; }
      }
    }
    this.pool.pauseAll(keep);
  }

  destroy() { this.destroyed = true; this.pause(); this.pool.clear(); this.audio.stopAudition(); this.audio.ctx?.close().catch(() => {}); }
  loop() {
    if (this.destroyed) return;
    requestAnimationFrame(this.loop);
    const P = this.getProject();
    if (!P) return;
    if (this.playing) {
      const nt = this.audio.timeAt();
      const end = this.duration;
      this.t = Math.max(0, nt);
      if (this.t >= end) { this.t = end; this.pause(); this.onTime?.(this.t); }
      else { this.audio.schedule(this.t); this.onTime?.(this.t); this.dirty = true; }
    }
    if (this.dirty) {
      this.dirty = false;
      this._sync(Math.min(this.t, Math.max(0, this.duration - 1e-3)));
      this.draw(Math.min(this.t, Math.max(0, this.duration - 1e-3)));
    }
  }

  play() {
    const P = this.getProject(); if (!P) return;
    if (this.t >= this.duration - 0.01) this.t = 0;
    this.playing = true;
    this.audio.start(P, this.t);
    this.dirty = true;
    this.onState?.(true);
  }
  pause() {
    this.playing = false;
    this.audio.stop();
    this.pool.pauseAll();
    this.dirty = true;
    this.onState?.(false);
  }
  toggle() { this.playing ? this.pause() : this.play(); }
  seek(t) {
    this.t = clamp(t, 0, this.duration);
    if (this.playing) this.audio.start(this.getProject(), this.t);
    this.dirty = true;
    this.onTime?.(this.t);
  }
  /** After an edit: new clips, new sound. */
  refresh() {
    if (this.playing) this.audio.start(this.getProject(), this.t);
    this.dirty = true;
  }
  reset() { this.pause(); this.pool.clear(); this.t = 0; }
}
