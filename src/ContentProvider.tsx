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
const ContentContext = createContext<ReturnType<typeof makeStore> | null>(null);
export function ContentProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  const location = useLocation();
  useEffect(() => { if (!location.pathname.startsWith('/admin')) void store.refresh(); }, [store, location.pathname]);
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    const refresh = () => { if (document.visibilityState === 'visible') void store.refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); };
  }, [store, location.pathname]);
  return <ContentContext.Provider value={store}>{children}</ContentContext.Provider>;
}
export function useContent() {
  const store = useContext(ContentContext);
  if (!store) throw Error('ContentProvider required');
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...state, store };
}
