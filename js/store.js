// Saved projects, and the editor's single source of truth.
// Projects are small JSON in IndexedDB, so the portal syncs them across devices. Media stays on the device (see media.js).
import { Emitter, debounce, clone } from './util.js';
import { History, findClip, usedMediaIds } from './model.js';
import { getMedia, metaOf, collectGarbage, allMedia, mediaBus } from './media.js';

const DB = 'amatu-cut', ST = 'projects';
let dbp = null;
function db() {
  dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(ST, mode); const out = fn(t.objectStore(ST)); t.oncomplete = () => res(out?.result); t.onerror = () => rej(t.error); }); };
export const listProjects = async () => ((await tx('readonly', (s) => s.getAll())) || []).sort((a, b) => b.updated - a.updated);
export const getProject = (id) => tx('readonly', (s) => s.get(id));
export const putProject = (p) => tx('readwrite', (s) => s.put(p));
export const removeProject = (id) => tx('readwrite', (s) => s.delete(id));
/** Deletes on-disk media that no saved project uses. */
export async function sweepMedia(graceMs = 0) {
  const keep = new Set(), all = await listProjects();
  for (const p of all) { for (const id of usedMediaIds(p)) keep.add(id); for (const m of p.media || []) keep.add(m.id); }
  if (editor.project) for (const id of usedMediaIds(editor.project)) keep.add(id);
  await collectGarbage(keep, graceMs);
}

export class Editor extends Emitter {
  constructor() {
    super();
    this.project = null; this.sel = null; this.history = new History();
    this.save = debounce(() => this.saveNow(), 500);
    this.clipboard = null; this.imported = new Set();
    mediaBus.on('added', (m) => { if (this.project) { this.imported.add(m.id); this.save(); } });
  }
  open(p) {
    this.project = p; this.sel = null; this.history.reset(p); this.imported = new Set();
    this.emit('open', p); this.emit('change');
  }
  async saveNow() {
    if (!this.project) return;
    const p = this.project;
    p.updated = Date.now();
    const ids = usedMediaIds(p);
    const known = new Map((p.media || []).filter((m) => !getMedia(m.id)?.sample).map((m) => [m.id, m]));
    for (const id of ids) { const m = getMedia(id); if (m && !m.virtual && !m.sample) known.set(id, metaOf(m)); }
    // Files imported while this project is open stay in its library, even before they reach the timeline.
    for (const m of allMedia()) if (this.imported.has(m.id)) known.set(m.id, metaOf(m));
    p.media = [...known.values()];
    await putProject(clone(p)).catch((e) => console.warn('save', e));
    this.emit('saved');
  }
  /** Records an edit: one undo step, an autosave, and a redraw. */
  commit(label) {
    if (!this.project) return;
    this.history.push(this.project);
    this.save();
    this.emit('change', label);
  }
  /** A change in progress (slider being dragged): redraw only. */
  touch() { this.emit('touch'); }
  undo() { const p = this.history.undo(); if (p) this._restore(p); }
  redo() { const p = this.history.redo(); if (p) this._restore(p); }
  _restore(p) {
    p.media = this.project.media; p.thumb = this.project.thumb; p.updated = this.project.updated;
    this.project = p;
    if (this.sel && !findClip(p, this.sel)) this.sel = null;
    this.save();
    this.emit('change', 'history');
    this.emit('select');
  }
  select(id) { if (this.sel === id) return; this.sel = id; this.emit('select'); }
  get selected() { return this.sel && this.project ? findClip(this.project, this.sel) : null; }
}
export const editor = new Editor();
