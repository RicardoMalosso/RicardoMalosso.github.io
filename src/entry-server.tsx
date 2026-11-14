import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import App from './App';
import { alternatePath, base, content, publicPath, routeMetadata, routes, siteUrl } from './data';
export { youtubeId, parseLrc, rankedTracks } from './lrclib';
export { parseSrt, alignLyrics, activeRow, selectedRow, nearbyRow, formatTime, lyricTime, videoTimeForLyric } from './lyrics';
export { routes, alternatePath, publicPath, routeMetadata, siteUrl, base, content };
export function render(route: string, initialAssets: Record<string, string> = {}) { return renderToString(<StaticRouter location={publicPath(route)} basename={base.replace(/\/$/, '')}><App initialAssets={initialAssets}/></StaticRouter>); }

export { prepareNotes } from './postNotes';
