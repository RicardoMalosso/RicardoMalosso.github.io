import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export function loadContent(root = 'content', publicRoot = 'public') {
  const entries = [];
  for (const section of ['blog', 'music']) {
    for (const file of fs.readdirSync(path.join(root, section)).filter(f => f.endsWith('.md'))) {
      const { data, content } = matter(fs.readFileSync(path.join(root, section, file), 'utf8'));
      if (data.draft === true) continue;
      for (const key of ['title', 'description', 'slug', 'locale', 'date']) {
        if (typeof data[key] !== 'string' || !data[key].trim()) throw Error(`${file}: ${key} must be a quoted, nonempty string`);
      }
      if (!['pt-br', 'en'].includes(data.locale)) throw Error(`${file}: unsupported locale`);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug)) throw Error(`${file}: invalid slug`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(data.date))) throw Error(`${file}: invalid date`);
      if (data.tags && (!Array.isArray(data.tags) || data.tags.some(x => typeof x !== 'string'))) throw Error(`${file}: tags must be strings`);
      if (data.lyricNotes && (!Array.isArray(data.lyricNotes) || data.lyricNotes.some(n => !n || !/^\d{2}:[0-5]\d(?:\.\d{1,3})?$/.test(n.time) || !['en', 'pt-br'].includes(n.language) || typeof n.text !== 'string' || !n.text.trim() || typeof n.explanation !== 'string' || !n.explanation.trim()))) throw Error(`${file}: invalid lyricNotes`);
      if (data.player) {
        const validPath = value => typeof value === 'string' && /^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(value);
        let id;
        try {
          const url = new URL(data.player.youtubeUrl);
          const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
          if (['https:', 'http:'].includes(url.protocol)) {
            if (host === 'youtu.be') id = url.pathname.split('/')[1];
            else if (['youtube.com', 'youtube-nocookie.com'].includes(host)) id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(embed|shorts|live)\//.test(url.pathname) ? url.pathname.split('/')[2] : undefined;
          }
        } catch {}
        data.player.youtubeId = id;
        if (!/^[a-zA-Z0-9_-]{11}$/.test(id || '') || !validPath(data.player.subtitles?.en) || !validPath(data.player.subtitles?.['pt-br'])) throw Error(`${file}: invalid player configuration`);
        if (data.player.offsetMs !== undefined && (!Number.isInteger(data.player.offsetMs) || Math.abs(data.player.offsetMs) > 60000)) throw Error(`${file}: player offsetMs must be an integer between -60000 and 60000`);
        for (const subtitle of Object.values(data.player.subtitles)) if (!fs.existsSync(path.join(publicRoot, subtitle))) throw Error(`${file}: missing subtitle ${subtitle}`);
      }
      if ((content.match(/<!-- lyrics-player -->/g) || []).length > 1) throw Error(`${file}: only one lyrics-player marker is supported`);
      if (data.lyrics && (!Array.isArray(data.lyrics) || data.lyrics.some(x => !/^\d{2}:\d{2}$/.test(x.time) || typeof x.original !== 'string' || typeof x.translation !== 'string'))) throw Error(`${file}: invalid timed lyrics`);
      if (entries.some(x => x.section === section && x.locale === data.locale && x.slug === data.slug)) throw Error(`${file}: duplicate route`);
      entries.push({ ...data, section, body: content });
    }
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const entries = loadContent();
  fs.writeFileSync('src/content.generated.json', JSON.stringify(entries, null, 2) + '\n');
  console.log(`Validated ${entries.length} content entries.`);
}
