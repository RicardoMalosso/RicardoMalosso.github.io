import type { Entry } from './types';
import { validateDocument } from '../supabase/functions/publishing-api/validation.mjs';

export type Publication = { id: string; created_at: string };
export type PublishedDocument = { section: 'blog' | 'music'; slug: string; entries: Entry[]; assets: Record<string, string> };
type Manifest = Publication & { unchanged?: boolean; entries?: Entry[] };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;
type Options = { url: string; key: string; enabled: boolean; publication: Publication | null; fetch?: typeof fetch; storage?: StorageLike; now?: () => number };
export type RuntimeState = { entries: Entry[]; publication: Publication | null; phase: 'idle' | 'checking' | 'ready' | 'offline'; documents: Record<string, PublishedDocument>; failed: string[] };
export const entryKey = (e: Pick<Entry, 'locale' | 'section' | 'slug'>) => `${e.locale}/${e.section}/${e.slug}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const routePart = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
function checkEntries(entries: Entry[]) {
  if (!Array.isArray(entries)) throw Error('Invalid entries');
  const keys = new Set<string>();
  for (const e of entries) {
    if (!e || !['en', 'pt-br'].includes(e.locale) || !['blog', 'music'].includes(e.section) || !routePart.test(e.slug) ||
      typeof e.title !== 'string' || typeof e.description !== 'string' || typeof e.body !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || (e.tags && (!Array.isArray(e.tags) || e.tags.some(t => typeof t !== 'string'))) || keys.has(entryKey(e))) throw Error('Invalid published entry');
    keys.add(entryKey(e));
  }
}
export function normalizeDocument(value: unknown, section: string, slug: string): PublishedDocument {
  const doc = structuredClone(value) as PublishedDocument;
  if (!doc || doc.section !== section || doc.slug !== slug || !doc.assets || typeof doc.assets !== 'object' || Array.isArray(doc.assets)) throw Error('Invalid published document');
  const errors = validateDocument(doc);
  if (errors.length) throw Error(`Invalid published document: ${errors.join('; ')}`);
  checkEntries(doc.entries);
  if (!doc.entries.length || doc.entries.length > 2) throw Error('Invalid translations');
  for (const e of doc.entries) {
    if (e.section !== section || e.slug !== slug) throw Error('Mismatched document route');
    if (e.player) {
      const p = e.player as Entry['player'] & { youtubeUrl?: string };
      const url = new URL(p!.youtubeUrl || `https://www.youtube.com/watch?v=${p!.youtubeId}`);
      if (!['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) throw Error('Invalid video');
      const id = url.hostname === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v') ?? url.pathname.split('/').pop();
      if (!/^[\w-]{11}$/.test(id ?? '')) throw Error('Invalid video');
      p!.youtubeId = id!;
      for (const lang of ['en', 'pt-br'] as const) {
        const file = p!.subtitles?.[lang];
        if (!/^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(file ?? '') || typeof doc.assets[file] !== 'string') throw Error('Missing published lyrics');
      }
    }
  }
  for (const [file, text] of Object.entries(doc.assets)) if (!/^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(file) || typeof text !== 'string') throw Error('Invalid asset');
  return doc;
}

// A store belongs to one mounted application. SSR and hydration start from the same snapshot.
export function createRuntimeContentStore(fallback: Entry[], options: Options) {
  let state: RuntimeState = { entries: fallback, publication: options.publication, phase: 'idle', documents: {}, failed: [] };
  const initial = state;
  const listeners = new Set<() => void>();
  const pending = new Map<string, Promise<void>>();
  let checking: Promise<void> | undefined;
  let lastCheck = -Infinity;
  const now = options.now ?? Date.now;
  const request = options.fetch ?? globalThis.fetch;
  const cacheKey = 'portfolio-published-documents-v1';
  const emit = (patch: Partial<RuntimeState>) => { state = { ...state, ...patch }; for (const listener of listeners) listener(); };
  const rpc = async (name: string, payload: object) => {
    const response = await request(`${options.url}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { apikey: options.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error(`Published content unavailable (${response.status})`);
    return response.json();
  };
  function cachedDocument(id: string, key: string) {
    try { const cache = JSON.parse(options.storage?.getItem(cacheKey) ?? 'null'); return cache?.id === id ? cache.documents?.[key] : undefined; } catch { return undefined; }
  }
  function persist() {
    try { options.storage?.setItem(cacheKey, JSON.stringify({ id: state.publication?.id, documents: Object.fromEntries(Object.entries(state.documents).slice(-8)) })); } catch { /* Storage denial/quota must not prevent reading. */ }
  }
  async function refresh(force = false) {
    if (!options.enabled || (!force && now() - lastCheck < 60000)) return;
    if (checking) return checking;
    lastCheck = now(); emit({ phase: 'checking' });
    checking = (async () => {
      try {
        const manifest = await rpc('content_manifest', { known_id: state.publication?.id ?? null }) as Manifest;
        if (!manifest || !uuid.test(manifest.id) || !Number.isFinite(Date.parse(manifest.created_at))) throw Error('Invalid publication');
        if (manifest.unchanged) {
          if (manifest.id !== state.publication?.id) throw Error('Invalid unchanged publication');
          emit({ phase: 'ready' }); return;
        }
        checkEntries(manifest.entries!);
        const publication = { id: manifest.id, created_at: manifest.created_at };
        if (state.publication && Date.parse(publication.created_at) < Date.parse(state.publication.created_at)) throw Error('Publication moved backwards');
        emit({ entries: manifest.entries!, publication, phase: 'ready', documents: {}, failed: [] });
      } catch { emit({ phase: 'offline' }); }
      finally { checking = undefined; }
    })();
    return checking;
  }
  function article(locale: string, section: string, slug: string) {
    const key = `${locale}/${section}/${slug}`;
    // A successful manifest is authoritative, including intentional removals.
    if (!state.entries.some(e => entryKey(e) === key)) return undefined;
    return state.documents[`${section}/${slug}`]?.entries.find(e => e.locale === locale) ?? fallback.find(e => entryKey(e) === key);
  }
  async function loadDocument(section: string, slug: string) {
    if (!options.enabled || !['blog', 'music'].includes(section) || !routePart.test(slug)) return;
    if (checking) await checking;
    const publication = state.publication;
    if (!publication || state.phase !== 'ready') return;
    const key = `${section}/${slug}`;
    if (state.documents[key] || (publication.id === options.publication?.id && fallback.some(e => e.section === section && e.slug === slug))) return;
    if (!state.entries.some(e => e.section === section && e.slug === slug)) return;
    const requestKey = `${publication.id}/${key}`;
    if (pending.has(requestKey)) return pending.get(requestKey);
    const job = (async () => {
      try {
        let doc: PublishedDocument | undefined;
        try {
          const cached = cachedDocument(publication.id, key);
          if (cached) doc = normalizeDocument(cached, section, slug);
        } catch { /* Ignore a damaged browser cache and retry the published endpoint. */ }
        doc ??= normalizeDocument(await rpc('content_document', { release_id: publication.id, post_section: section, post_slug: slug }), section, slug);
        if (state.publication?.id !== publication.id) return;
        emit({ documents: { ...state.documents, [key]: doc }, failed: state.failed.filter(x => x !== key) }); persist();
      } catch { if (state.publication?.id === publication.id) emit({ failed: [...new Set([...state.failed, key])] }); }
      finally { pending.delete(requestKey); }
    })();
    pending.set(requestKey, job); return job;
  }
  async function search(query: string, section: string): Promise<string[] | null> {
    if (!options.enabled || state.phase !== 'ready' || !state.publication) return null;
    const id = state.publication.id;
    const keys = await rpc('content_search', { release_id: id, post_section: section, search_query: query.slice(0, 200) });
    if (!Array.isArray(keys) || keys.some(k => typeof k !== 'string') || state.publication?.id !== id) return null;
    return keys;
  }
  return { subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }, getSnapshot: () => state, getServerSnapshot: () => initial, refresh, article, loadDocument, search };
}
