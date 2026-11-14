import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useLocation } from 'react-router';
import { content } from './data';
import publication from './publication.generated.json';
import config from '../supabase/project.json';
import { createRuntimeContentStore, type Publication } from './runtimeContent';

const makeStore = () => {
  let storage: Storage | undefined;
  try { if (typeof window !== 'undefined') storage = window.localStorage; } catch { /* private browsing */ }
  return createRuntimeContentStore(content, {
    url: import.meta.env.VITE_CONTENT_API_URL || config.url, key: config.publishableKey,
    enabled: import.meta.env.VITE_RUNTIME_CONTENT === 'true',
    publication: publication as Publication | null, storage,
  });
};
const ContentContext = createContext<{store: ReturnType<typeof makeStore>; snapshotAssets: Record<string, string>} | null>(null);
export function ContentProvider({ children, initialAssets = {} }: { children: React.ReactNode; initialAssets?: Record<string, string> }) {
  const [store] = useState(makeStore);
  const [snapshotAssets] = useState(initialAssets);
  const location = useLocation();
  useEffect(() => { if (!location.pathname.startsWith('/admin')) void store.refresh(); }, [store, location.pathname]);
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    const refresh = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [store, location.pathname]);
  return <ContentContext.Provider value={{store,snapshotAssets}}>{children}</ContentContext.Provider>;
}
export function useContent() {
  const context = useContext(ContentContext);
  if (!context) throw Error('ContentProvider required');
  const {store,snapshotAssets} = context;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...state, store, snapshotAssets };
}
