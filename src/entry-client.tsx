import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './styles/global.css';
const root = document.getElementById('root')!;
let initialAssets: Record<string, string> = {};
try { initialAssets = JSON.parse(document.getElementById('content-lyrics-snapshot')?.textContent || '{}'); } catch { /* Keep the player fetch fallback for malformed/missing snapshots. */ }
const app = <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}><App initialAssets={initialAssets}/></BrowserRouter>;
if (root.childElementCount && !document.body.hasAttribute('data-not-found')) hydrateRoot(root, app); else createRoot(root).render(app);
