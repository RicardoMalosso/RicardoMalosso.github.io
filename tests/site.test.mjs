import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadContent } from '../scripts/content.mjs';
import { routes, base, alternatePath } from '../.ssr/entry-server.js';
import os from 'node:os';
const builtEntries = JSON.parse(fs.readFileSync('src/content.generated.json','utf8'));
const outputFor = route => path.join('dist', route, 'index.html');
test('music lyrics are already in the initial HTML and embedded assets match their published files',()=>{
  for(const e of builtEntries.filter(e=>e.player)){
    const html=fs.readFileSync(outputFor(`/${e.locale}/${e.section}/${e.slug}/`),'utf8');
    const json=html.match(/<script id="content-lyrics-snapshot" type="application\/json">(.*?)<\/script>/s)?.[1];
    assert(json, e.slug);const assets=JSON.parse(json);
    for(const file of Object.values(e.player.subtitles))assert.equal(assets[file],fs.readFileSync(path.join('dist',file),'utf8'));
    assert(html.includes('class="sync-en"'),e.slug);assert(html.includes('class="sync-pt'),e.slug);
  }
});
test('all declared routes contain prerendered HTML and locale metadata', () => {
  for (const route of routes) {
    const html = fs.readFileSync(outputFor(route), 'utf8');
    assert(!html.includes('<!--app-html-->'), route);
    assert(!/__LANG__|__TITLE__|__DESCRIPTION__|__SEO__/.test(html), route);
    assert(html.includes('<h1'), route);
    if (route !== '/') assert(html.includes(`lang="${route.startsWith('/en/') ? 'en' : 'pt-BR'}"`), route);
    assert(html.includes('rel="canonical"'), route);
  }
});
test('all local links and assets resolve under the configured GitHub Pages base', () => {
  for (const route of routes) {
    const html = fs.readFileSync(outputFor(route), 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!url.startsWith('/')) continue;
      assert(url.startsWith(base), `${route}: outside base ${url}`);
      const pathname = decodeURIComponent(url.split(/[?#]/)[0].slice(base.length));
      const file = path.join('dist', pathname);
      assert(fs.existsSync(file) || fs.existsSync(path.join(file, 'index.html')), `${route}: broken ${url}`);
    }
  }
});
test('each published entry is rendered in both languages and translations retain the article', () => {
  const entries = builtEntries;
  for (const entry of entries) {
    const other = entry.locale === 'en' ? 'pt-br' : 'en';
    const route = `/${entry.locale}/${entry.section}/${entry.slug}/`;
    const translated = entries.some(x => x.locale === other && x.section === entry.section && x.slug === entry.slug);
    assert.equal(alternatePath(route, other), translated ? `/${other}/${entry.section}/${entry.slug}/` : `/${other}/${entry.section}/?translation=missing`);
    assert(fs.existsSync(outputFor(alternatePath(route, other).split('?')[0])));
    assert(fs.readFileSync(outputFor(route), 'utf8').toLowerCase().includes(entry.title.toLowerCase()));
  }
  assert.equal(alternatePath('/en/blog/untranslated/', 'pt-br'), '/pt-br/blog/?translation=missing');
});
test('content validation rejects duplicate slugs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pacblog-content-'));
  try {
    fs.mkdirSync(path.join(temp, 'blog')); fs.mkdirSync(path.join(temp, 'music'));
    const data = fs.readFileSync('content/blog/welcome.en.md');
    fs.writeFileSync(path.join(temp, 'blog/a.md'), data); fs.writeFileSync(path.join(temp, 'blog/b.md'), data);
    assert.throws(() => loadContent(temp), /duplicate route/);
  } finally { fs.rmSync(temp, { recursive: true }); }
});
test('interface strings are translated, with a Canadian flag for English', () => {
  const pt = fs.readFileSync('dist/pt-br/index.html', 'utf8');
  const en = fs.readFileSync('dist/en/index.html', 'utf8');
  assert(pt.includes('projetos selecionados'));
  assert(en.includes('selected projects'));
  assert(pt.includes('🇨🇦 en'));
  assert(en.includes('🇧🇷 pt-BR'));
  assert(!pt.includes('🇺🇸')); assert(!en.includes('🇺🇸'));
});
test('static 404, sitemap and publishing artifacts exist', () => {
  assert(fs.readFileSync('dist/404.html', 'utf8').includes('noindex'));
  assert(fs.readFileSync('dist/sitemap.xml', 'utf8').includes(`${base}en/blog/`));
  assert(fs.existsSync('dist/.nojekyll'));

});

test('shared interface copy stays localized across every published page', () => {
  const leakedEnglish = /Skip to content|selected projects|DATA \/ VISUALIZATION|PYTHON \/ AI \/ AUDIO|Data visualization|Caching|Speech controls|Hear this project description/;
  const leakedPortuguese = /Pular para o conteúdo|projetos selecionados|DADOS \/ VISUALIZAÇÃO|PYTHON \/ IA \/ ÁUDIO|Visualização de dados|Controles de fala|Ouça a descrição deste projeto/;
  for (const route of routes.filter(route => /^\/(en|pt-br)\//.test(route))) {
    const html = fs.readFileSync(outputFor(route), 'utf8');
    const english = route.startsWith('/en/');
    assert(!((english ? leakedPortuguese : leakedEnglish).test(html)), `Mixed interface language at ${route}`);
    assert(html.includes(`aria-label="Ricardo Malosso — ${english ? 'portfolio' : 'portfólio'}"`), route);
  }
  assert(fs.readFileSync(outputFor('/pt-br/experiments/'), 'utf8').includes('6,34'));
  assert(fs.readFileSync(outputFor('/en/experiments/'), 'utf8').includes('6.34'));
});

test('résumé routes include localized content and both downloadable PDFs', () => {
  for (const [locale, title, summary] of [['en', 'Résumé', 'Professional Summary'], ['pt-br', 'Currículo', 'Resumo profissional']]) {
    const route = `/${locale}/resume/`;
    assert(routes.includes(route));
    const html = fs.readFileSync(outputFor(route), 'utf8');
    assert(html.includes(`${title.toLowerCase()} · ricardo malosso`));
    assert(html.includes(summary));
    assert(html.includes('Wipro'));
    assert(html.includes('CGI Group'));
    assert(html.includes('PacTTSClone'));
    assert.equal(alternatePath(route, locale === 'en' ? 'pt-br' : 'en'), `/${locale === 'en' ? 'pt-br' : 'en'}/resume/`);
    for (const file of ['Ricardo_Malosso_Resume_EN.pdf', 'Ricardo_Malosso_CV.pdf']) {
      assert(html.includes(`${base}resumes/${file}`));
      const pdf = fs.readFileSync(`dist/resumes/${file}`);
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert(pdf.equals(fs.readFileSync(`public/resumes/${file}`)));
    }
  }
});

test('SRT parsing, bilingual alignment and playback gaps', async () => {
  const { parseSrt, alignLyrics, activeRow, selectedRow, nearbyRow, formatTime, lyricTime, videoTimeForLyric } = await import('../.ssr/entry-server.js');
  const pt = parseSrt('\uFEFF1\r\n00:00:01,000 --> 00:00:03,000\r\nPrimeira linha\r\nsegunda linha\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,000\r\nOutra');
  const en = parseSrt('1\n00:00:01.200 --> 00:00:02.800\nFirst line\n\n2\n00:00:07,000 --> 00:00:08,000\nUnmatched');
  assert.equal(pt[0].text, 'Primeira linha\nsegunda linha');
  const rows = alignLyrics(pt, en);
  assert.equal(rows.length, 3); assert.equal(rows[0].en.text, 'First line');
  assert.equal(rows[1].en, undefined); assert.equal(rows[2].pt, undefined);
  assert.equal(activeRow(rows, 1.5), 0); assert.equal(activeRow(rows, 4), -1);
  assert.equal(selectedRow(rows, 0), -1); assert.equal(selectedRow(rows, 4), 0);
  assert.equal(selectedRow(rows, 6.5), 1); assert.equal(selectedRow(rows, 20), 2);
  assert.equal(selectedRow(rows, 1.5), 0); assert.equal(selectedRow(rows, 5.5), 1);
  assert.equal(activeRow(rows, 5.5), 1); assert.equal(activeRow(rows, 7.5), 2);
  assert.equal(nearbyRow(rows, 4), 0); assert.equal(nearbyRow(rows, 20), 2);
  assert.equal(formatTime(3661), '1:01:01');
  assert.equal(selectedRow(rows, lyricTime(1.05, 100)), -1);
  assert.equal(selectedRow(rows, lyricTime(0.95, -100)), 0);
  assert.equal(videoTimeForLyric(1, 100), 1.1);
  assert.equal(videoTimeForLyric(0.05, -100), 0);
  assert.throws(() => parseSrt('1\n00:00:03,000 --> 00:00:01,000\nbroken'), /Invalid SRT cue/);
});

test('music demo config links published subtitle files and localized post', () => {
  const entries = builtEntries.filter(x => x.slug === 'lyric-page-demo');

  for (const entry of entries) {
    assert.equal(entry.player.youtubeId, 'lU8j7lj4RdU');
    for (const file of Object.values(entry.player.subtitles)) assert(fs.existsSync(path.join('dist', file)));
    const html = fs.readFileSync(outputFor(`/${entry.locale}/music/${entry.slug}/`), 'utf8');
    assert(html.includes(entry.locale === 'en' ? 'show three lines' : 'mostrar três versos'));
  }
});

test('per-song lyric sync defaults are configured in both Naquela Mesa locales', async () => {
  const entries = builtEntries;
  const pages = entries.filter(x => x.section === 'music' && x.slug === 'naquela-mesa');

  for (const page of pages) {
    assert(Number.isInteger(page.player.offsetMs??0));
    assert(fs.readFileSync(outputFor(`/${page.locale}/music/naquela-mesa/`), 'utf8').includes(`<h1>${page.title}</h1>`));
  }


  const { lyricTime, videoTimeForLyric } = await import('../.ssr/entry-server.js');
  assert.equal(lyricTime(9.16, 1000), 8.16);
  assert.equal(videoTimeForLyric(8.16, 1000), 9.16);
});

test('YouTube URLs, LRC timing and duration-ranked matches', async () => {
  const { youtubeId, parseLrc, rankedTracks } = await import('../.ssr/entry-server.js');
  assert.equal(youtubeId('https://www.youtube.com/watch?v=lU8j7lj4RdU&t=5'), 'lU8j7lj4RdU');
  assert.equal(youtubeId('https://youtu.be/lU8j7lj4RdU'), 'lU8j7lj4RdU');
  assert.equal(youtubeId('https://youtube.com/shorts/lU8j7lj4RdU'), 'lU8j7lj4RdU');
  assert.equal(youtubeId('https://youtube.com.evil.test/watch?v=lU8j7lj4RdU'), null);
  const cues = parseLrc('[ar:Artist]\n[00:01.10]First\n[00:04.20][00:08.00]Repeated\n[00:09.50]');
  assert.deepEqual(cues.map(x=>x.start), [1.1,4.2,8]);
  assert.equal(cues[0].end,4.2); assert.equal(cues[2].text,'Repeated');
  const tracks = [{id:1,duration:200,syncedLyrics:'a'}, {id:2,duration:182,syncedLyrics:'b'}, {id:3,duration:180,syncedLyrics:null}];
  assert.deepEqual(rankedTracks(tracks,180).map(x=>x.id),[2,1,3]);
  assert.deepEqual(rankedTracks(tracks,0).map(x=>x.id),[1,2,3]);
});

test('lyrics template is accepted in blog posts and normalizes YouTube URLs', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pacblog-template-'));
  try {
    fs.mkdirSync(path.join(temp, 'blog')); fs.mkdirSync(path.join(temp, 'music'));
    fs.writeFileSync(path.join(temp, 'blog/song.md'), fs.readFileSync('content/music/lyric-demo.en.md'));
    const [post] = loadContent(temp);
    assert.equal(post.section, 'blog');
    assert.equal(post.player.youtubeId, 'lU8j7lj4RdU');
    assert(post.body.includes('<!-- lyrics-player -->'));
    assert(post.player.subtitles.en.endsWith('.lrc'));
  } finally { fs.rmSync(temp, {recursive:true}); }
});

 test('Markdown notes preserve nested parentheses, paragraphs, emphasis and lists', async () => {
 const {prepareNotes}=await import('../.ssr/entry-server.js');
 const source='A [word](# **Bold** explanation (with (nested) parentheses).\n\n- One (*example*)\n- Two). End.';
 const result=prepareNotes(source);
 assert.equal(result.text,'A [word](#note-inline-0). End.');
 assert(result.notes['#note-inline-0'].includes('(nested)'));
 assert(result.notes['#note-inline-0'].includes('\n\n- One'));
 const reference=prepareNotes('[word](#note-example)\n\n:::note example\n**Content** (example).\n:::');
 assert.equal(reference.notes['#note-example'],'**Content** (example).');
 });
