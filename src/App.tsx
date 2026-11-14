import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
const AdminPanel = lazy(() => import('./components/AdminPanel'));
import { Link, NavLink, Route, Routes, useLocation, useParams } from 'react-router';
import { I18nextProvider, useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PostMarkdown from './components/PostMarkdown';
import HoverHint from './components/HoverHint';
import { createI18n } from './i18n';
import { alternatePath, base, pathFor, projects, publicPath, routeMetadata, siteUrl } from './data';
import resumeEn from './resumes/en.md?raw';
import resumePt from './resumes/pt-br.md?raw';
import ContrastLab from './components/ContrastLab';
import LyricsExperiment from './components/LyricsExperiment';
import WhisperLrcExperiment from './components/WhisperLrcExperiment';
import LyricsPlayer from './components/LyricsPlayer';
import type { Entry, Locale, Section } from './types';
import { ContentProvider, useContent } from './ContentProvider';
import { entryKey } from './runtimeContent';

const sections: Section[] = ['portfolio', 'blog', 'music', 'experiments', 'resume', 'contact'];
const date = (value: string, locale: Locale) => new Intl.DateTimeFormat(locale === 'en' ? 'en-CA' : 'pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
function LocaleRoot() {
  const { locale } = useParams();
  const language: Locale = locale === 'en' ? 'en' : 'pt-br';
  const i18n = useMemo(() => createI18n(language), [language]);
  return <I18nextProvider i18n={i18n}>{locale === 'en' || locale === 'pt-br' ? <Layout locale={language}/> : <NotFound locale={language}/>}</I18nextProvider>;
}
function Layout({ locale }: { locale: Locale }) {
  const { entries: content } = useContent();
  const { t } = useTranslation(); const location = useLocation(); const [light, setLight] = useState(false);
  useEffect(() => { try { setLight(localStorage.getItem('pacblog-theme') === 'light'); } catch {} }, []);
  useEffect(() => { document.documentElement.dataset.theme = light ? 'light' : 'dark'; }, [light]);
  useEffect(() => {
    const meta = routeMetadata(location.pathname, content);
    document.documentElement.lang = locale === 'en' ? 'en' : 'pt-BR'; document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
    for (const key of ['og:title', 'og:description', 'og:url']) document.querySelector(`meta[property="${key}"]`)?.setAttribute('content', key === 'og:title' ? meta.title : key === 'og:description' ? meta.description : siteUrl + publicPath(location.pathname));
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical); }
    canonical.href = siteUrl + publicPath(location.pathname);
    document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]').forEach(el => { const lang = el.hreflang === 'en' ? 'en' : 'pt-br'; el.href = siteUrl + publicPath(alternatePath(location.pathname, lang, content).split('?')[0]); });
    try { localStorage.setItem('pacblog-locale', locale); } catch {}
  }, [locale, location.pathname, content]);
  useEffect(() => { window.scrollTo(0, 0); }, [locale, location.pathname]);
  function theme() { setLight(x => { try { localStorage.setItem('pacblog-theme', x ? 'dark' : 'light'); } catch {} return !x; }); }
  const other: Locale = locale === 'en' ? 'pt-br' : 'en';
  return <><a className="skip" href="#main">{t('skip')}</a><header className="site-header wrap"><Link className="brand" to={pathFor(locale)} aria-label={`Ricardo Malosso — ${t('portfolio')}`}><span className="brand-mark">r<span>m</span>.</span><span className="brand-name">ricardo<br/>malosso</span></Link><nav aria-label={t('menu')}>{sections.map(s => <NavLink key={s} to={pathFor(locale, s === 'portfolio' ? '' : s)} end={s === 'portfolio'}>{t(s)}</NavLink>)}</nav><div className="utilities"><Link className="locale" to={alternatePath(location.pathname, other, content)} aria-label={`${t('language')}: ${other === 'en' ? 'English' : 'Português brasileiro'}`} lang={other === 'en' ? 'en' : 'pt-BR'} hrefLang={other === 'en' ? 'en' : 'pt-BR'}>{locale === 'en' ? '🇧🇷 pt-BR' : '🇨🇦 en'} <span>↗</span></Link><button className="theme-button" onClick={theme} aria-label={t('theme')}>{light ? '◐' : '◑'}</button></div></header><main id="main" className="wrap" tabIndex={-1}><Routes><Route index element={<Portfolio locale={locale}/>}/><Route path="portfolio/:slug" element={<Project locale={locale}/>}/><Route path="blog" element={<Listing locale={locale} section="blog"/>}/><Route path="music" element={<Listing locale={locale} section="music"/>}/><Route path="blog/:slug" element={<Article locale={locale} section="blog"/>}/><Route path="music/:slug" element={<Article locale={locale} section="music"/>}/><Route path="experiments" element={<><PageHeading section="experiments"/><LyricsExperiment/><WhisperLrcExperiment/><ContrastLab/></>}/><Route path="resume" element={<Resume locale={locale}/>}/><Route path="contact" element={<Contact/>}/><Route path="*" element={<NotFound locale={locale}/>}/></Routes></main><footer className="wrap site-footer"><Link className="footer-logo" to={pathFor(locale)}>rm.</Link><p>{t('footer')}</p><a href="https://github.com/RicardoMalosso">GitHub ↗</a><span className="footer-locale">{locale === 'en' ? '🇨🇦 en' : '🇧🇷 pt-BR'}</span></footer></>;
}
function Portfolio({ locale }: { locale: Locale }) {
  const { entries: content } = useContent();
  const { t } = useTranslation(); const posts = content.filter(x => x.locale === locale && x.section === 'blog').slice(0, 2);
  return <><section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="dot"/>{t('eyebrow')}</p><p className="hello">{t('hello')}</p><h1>{t('hero')}</h1><p className="hero-intro">{t('intro')}</p><div className="hero-actions"><a className="button" href="#projects">{t('explore')} <span>↓</span></a><Link className="text-link" to={pathFor(locale, 'contact')}>{t('about')} ↗</Link></div></div></section><section id="projects" className="projects-section"><div className="section-heading"><div><p className="eyebrow">01 / {t('portfolio')}</p><h2>{t('selected')}</h2></div><p>{t('selectedIntro')}</p></div><div className="project-grid">{projects.map((p, i) => <article className="project-card" key={p.slug}><ProjectMedia project={p} locale={locale}/><div className="project-topline mono"><span>{p[locale].category}</span><span>0{i + 1}</span></div><h3><Link to={pathFor(locale, 'portfolio', p.slug)}>{p.name}</Link></h3><p>{p[locale].description}</p><div className="tags">{p[locale].tags.map(tag => <span key={tag}>{tag}</span>)}</div>{p.replay && <p className="replay-caption">{t('replayCaption')}</p>}</article>)}</div></section><section className="about-strip"><div><p className="eyebrow">{t('approach')}</p><h2>{t('approachTitle').split('\n').map(x => <span key={x}>{x}</span>)}</h2></div><div><p>{t('approachText')}</p><Link className="text-link" to={pathFor(locale, 'contact')}>{t('about')} ↗</Link></div></section><section className="notebook"><div className="section-heading"><div><p className="eyebrow">02 / {t('blog')}</p><h2>{t('latest')}</h2></div><Link className="text-link" to={pathFor(locale, 'blog')}>{t('allPosts')} ↗</Link></div>{posts.map(p => <EntryRow key={p.slug} entry={p} locale={locale}/>)}</section></>;
}
function PageHeading({ section }: { section: Exclude<Section, 'portfolio'> }) { const { t } = useTranslation(); return <header className="page-heading"><p className="eyebrow">ricardo malosso / {t(section)}</p><h1>{t(section)}<span className="accent">.</span></h1><p>{t(`${section}Intro`)}</p></header>; }
function EntryRow({ entry, locale }: { entry: Entry; locale: Locale }) { return <Link className="entry-row" to={pathFor(entry.locale, entry.section, entry.slug)} hrefLang={entry.locale !== locale ? entry.locale : undefined}><time dateTime={entry.date}>{date(entry.date, locale)}</time><div><div className="tags">{entry.tags?.map(tag => <span key={tag}>{tag}</span>)}</div>{entry.locale !== locale && <span>em inglês</span>}<h2 lang={entry.locale !== locale ? entry.locale : undefined}>{entry.title}</h2><p lang={entry.locale !== locale ? entry.locale : undefined}>{entry.description}</p></div><span className="entry-arrow" aria-hidden="true">↗</span></Link>; }
function Listing({ locale, section }: { locale: Locale; section: 'blog' | 'music' }) {
  const { entries: content, store, publication, phase } = useContent();
  const [matches, setMatches] = useState<{query: string; keys: string[]} | null>(null);
  const { t } = useTranslation(); const [query, setQuery] = useState(''); const [tag, setTag] = useState(''); const location = useLocation();
  useEffect(() => {
    let cancelled = false;
    setMatches(null);
    if (!query.trim()) return;
    const timer = setTimeout(() => {
      void store.search(query, section).then(keys => { if (!cancelled && keys) setMatches({query, keys}); }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, section, store, publication?.id, phase]);
  const localized = content.filter(p => p.locale === locale && p.section === section);
  const localizedSlugs = new Set(localized.map(p => p.slug));
  const all = locale === 'pt-br' && section === 'music'
    ? content.filter(p => p.section === section && (p.locale === locale || !localizedSlugs.has(p.slug)))
    : localized;
  const tags = [...new Set(all.flatMap(p => p.tags || []))];
  const entries = all.filter(p => (!tag || p.tags?.includes(tag)) && (matches?.query === query ? matches.keys.includes(entryKey(p)) : `${p.title} ${p.description} ${p.tags?.join(' ')} ${p.body}`.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))));
  useEffect(() => { setQuery(''); setTag(''); }, [section, locale]);
  return <><PageHeading section={section}/>{location.search.includes('translation=missing') && <p className="notice" role="status">{t('fallback')}</p>}<div className="filters"><label className="search-label"><span className="sr-only">{t('filter')}</span><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={`${t('filter')}…`}/></label><div className="tag-filters"><button onClick={() => setTag('')} aria-pressed={!tag}>{t('all')}</button>{tags.map(x => <button key={x} onClick={() => setTag(x)} aria-pressed={tag === x}>{x}</button>)}</div></div><div className="entries">{entries.length ? entries.map(p => <EntryRow key={p.slug} entry={p} locale={locale}/>) : <p className="notice">{t('noResults')}</p>}</div></>;
}
function Article({ locale, section }: { locale: Locale; section: 'blog' | 'music' }) {
  const { slug = '' } = useParams(); const { t } = useTranslation();
  const { store, publication, phase, documents, failed, entries } = useContent();
  const documentKey = `${section}/${slug}`;
  useEffect(() => { void store.loadDocument(section, slug); }, [store, section, slug, publication?.id, phase]);
  const entry = store.article(locale, section, slug);
  const assets = documents[documentKey]?.assets;
  const subtitleText = entry?.player && assets ? {en: assets[entry.player.subtitles.en], 'pt-br': assets[entry.player.subtitles['pt-br']]} : undefined;
  if (!entry) {
    const exists = entries.some(e => e.locale === locale && e.section === section && e.slug === slug);
    const unavailable = failed.includes(documentKey) || phase === 'offline';
    const loading = import.meta.env.VITE_RUNTIME_CONTENT === 'true' && (phase === 'idle' || phase === 'checking' || exists);
    if (unavailable || loading) return <section className="page-heading" role="status"><p>{locale === 'en' ? (unavailable ? 'This page could not be loaded. Please try again.' : 'Loading…') : (unavailable ? 'Não foi possível carregar esta página. Tente novamente.' : 'Carregando…')}</p>{unavailable && <button className="button" onClick={() => { void store.refresh(true).then(() => store.loadDocument(section, slug)); }}>{locale === 'en' ? 'Try again' : 'Tentar novamente'}</button>}</section>;
    return <NotFound locale={locale}/>;
  }
  return <article className="article">{failed.includes(documentKey) && <p className="notice" role="status">{locale === 'en' ? 'Showing the saved version. The latest update could not be loaded.' : 'Exibindo a versão salva. Não foi possível carregar a atualização mais recente.'} <button onClick={() => { void store.loadDocument(section, slug); }}>{locale === 'en' ? 'Try again' : 'Tentar novamente'}</button></p>}<HoverHint/><Link className="text-link back-link" to={pathFor(locale, section)}>← {t(section)}</Link><header className="article-heading"><p className="eyebrow">{t(section)} / <time dateTime={entry.date}>{date(entry.date, locale)}</time></p><h1>{entry.title}</h1><p>{entry.description}</p>{entry.artist && <p className="artist">{entry.artist}</p>}<div className="tags">{entry.tags?.map(tag => <span key={tag}>{tag}</span>)}</div></header>{entry.body.includes('<!-- lyrics-player -->') && entry.player ? entry.body.split('<!-- lyrics-player -->').map((part, i) => <div key={i}>{i > 0 && <LyricsPlayer config={{...entry.player!, subtitleText}} lyricNotes={entry.lyricNotes} originalLanguage={entry.originalLanguage}/>}<div className="prose"><PostMarkdown>{part}</PostMarkdown></div></div>) : <><div className="prose"><PostMarkdown>{entry.body}</PostMarkdown></div>{entry.player && <LyricsPlayer config={{...entry.player, subtitleText}} lyricNotes={entry.lyricNotes} originalLanguage={entry.originalLanguage}/>}</>}{entry.lyrics && <section className="lyrics" style={entry.player ? {display: 'none'} : undefined}><div className="lyrics-heading"><span/><h2>{t('original')}</h2><h2>{t('translation')}</h2></div>{entry.lyrics.map((line, i) => <div className="lyric-block" key={i}><div className="lyric-line"><span className="timestamp mono">{line.time}</span><p lang={entry.originalLanguage || 'pt-BR'}>{line.original}</p><p lang="en" className="lyric-translation">{line.translation}</p></div>{line.note && <details className="line-note"><summary>{t('notes')}</summary><p>{line.note}</p></details>}</div>)}</section>}{entry.player && entry.lyrics && <noscript><section className="lyrics">{entry.lyrics.map((line, i) => <div className="lyric-line" key={i}><span className="timestamp mono">{line.time}</span><p lang="en">{line.translation}</p><p lang="pt-BR">{line.original}</p></div>)}</section></noscript>}{entry.credits && <aside className="credits"><h2>{t('credits')}</h2><p>{entry.credits}</p></aside>}</article>;
}
function ProjectMedia({ project, locale, detail = false, alt }: { project: { slug: string; name: string; image: string; replay: string | null }; locale: Locale; detail?: boolean; alt?: string }) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!project.replay) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!preference.matches) setPlaying(true);
    const changed = () => { if (preference.matches) setPlaying(false); };
    preference.addEventListener('change', changed);
    return () => preference.removeEventListener('change', changed);
  }, [project.replay]);
  const visual = <img className={detail ? 'detail-image' : undefined} src={`${base}images/${playing && project.replay ? project.replay : project.image}`} alt={alt || (project.replay ? t('replayAlt') : `${project.name} — ${t('interfacePreview')}`)} width={1200} height={824}/>;
  return <div className={detail ? 'project-media-detail' : 'project-image'}>{detail ? visual : <Link to={pathFor(locale, 'portfolio', project.slug)}>{visual}<span className="project-open" aria-hidden="true">↗</span></Link>}{project.replay && <button className="replay-toggle" onClick={() => setPlaying(value => !value)} aria-pressed={playing}>{playing ? 'Ⅱ' : '▶'} {t(playing ? 'pauseReplay' : 'playReplay')}</button>}</div>;
}
function Project({ locale }: { locale: Locale }) {
  const { slug } = useParams();
  const { t } = useTranslation();
  const p = projects.find(x => x.slug === slug);
  if (!p) return <NotFound locale={locale}/>;
  const isElection = p.slug === 'election-tracker';
  const audioFile = locale === 'en' ? 'pacttsclone-descricao-en.mp3' : 'pacttsclone-descricao-pt-br.mp3';
  return <article className="project-detail">
    <Link className="text-link back-link" to={pathFor(locale)}>← {t('portfolio')}</Link>
    <header className="page-heading"><p className="eyebrow">{p[locale].category}</p><h1>{p.name}<span className="accent">.</span></h1><p>{p[locale].description}</p></header>
    <div className="project-description">
      <div className="tags">{p[locale].tags.map(tag => <span key={tag}>{tag}</span>)}</div>
      <p>{p[locale].detail}</p>
      {!isElection && <section className="project-audio" aria-labelledby="project-audio-heading">
        <h2 id="project-audio-heading">{t('narrationHeading')}</h2>
        <p>{t('narrationCaption')}</p>
        <audio key={locale} controls preload="metadata" aria-label={t('narrationHeading')}>
          <source src={`${base}audio/${audioFile}`} type="audio/mpeg"/>
          <a href={`${base}audio/${audioFile}`}>{t('downloadNarration')}</a>
        </audio>
      </section>}
      {p.repo && <a className="button" href={p.repo}>{t('code')} ↗</a>}
    </div>
    <section className="project-demo">
      <h2>{t(isElection ? 'fullDashboardReplay' : 'studioInterface')}</h2>
      <ProjectMedia project={p} locale={locale} detail/>
      <p className="replay-caption">{t(isElection ? 'replayCaption' : 'interfacePreviewCaption')}</p>
    </section>
    <section className="project-demo">
      <h2>{t(isElection ? 'chartReplay' : 'speechControls')}</h2>
      {isElection ? <ProjectMedia project={{...p, image: 'election-chart-poster.jpg', replay: 'election-chart-replay.gif'}} locale={locale} detail alt={t('chartReplay')}/> : <img className="detail-image" src={`${base}images/pacttsclone-controls.jpg`} alt={`${p.name} — ${t('speechControls')}`} width={1363} height={936} loading="lazy"/>}
      <p className="replay-caption">{t(isElection ? 'chartReplayCaption' : 'interfacePreviewCaption')}</p>
    </section>

  </article>;
}
function Resume({ locale }: { locale: Locale }) {
  const { t } = useTranslation();
  return <article className="resume-page"><PageHeading section="resume"/>
    <div className="resume-actions">
      <a className="button" href={`${base}resumes/${locale === 'en' ? 'Ricardo_Malosso_Resume_EN.pdf' : 'Ricardo_Malosso_CV.pdf'}`} download>{t('downloadResume')} ↓</a>
      <a className="text-link" href={`${base}resumes/${locale === 'en' ? 'Ricardo_Malosso_CV.pdf' : 'Ricardo_Malosso_Resume_EN.pdf'}`} hrefLang={locale === 'en' ? 'pt-BR' : 'en'} download>{locale === 'en' ? '🇧🇷 PDF em português' : '🇨🇦 PDF in english'} ↓</a>
      <p className="mono">{t('resumeUpdated')} <time dateTime="2026-10-26">{date('2026-10-26', locale)}</time></p>
    </div>
    <div className="prose resume-content"><ReactMarkdown remarkPlugins={[remarkGfm]}>{locale === 'en' ? resumeEn : resumePt}</ReactMarkdown></div>
  </article>;
}
function Contact() { const { t } = useTranslation(); return <><PageHeading section="contact"/><section className="contact-panel"><p className="eyebrow">{t('email')}</p><a className="email-address" href="mailto:ricardomalosso@gmail.com">ricardomalosso<br className="mobile-break"/>@gmail.com <span>↗</span></a><div className="contact-bottom"><p>{t('location')}</p><div><span className="mono">{t('elsewhere')}</span><a href="https://github.com/RicardoMalosso">GitHub ↗</a><a href="https://www.linkedin.com/in/ricardo-rodrigues-malosso-9b4848112/">LinkedIn ↗</a></div></div></section></>; }
function NotFound({ locale }: { locale: Locale }) { const { t } = useTranslation(); return <section className="page-heading not-found"><p className="eyebrow">404</p><h1>{t('notFound')}</h1><p>{t('notFoundText')}</p><Link className="button" to={pathFor(locale)}>{t('home')} ↗</Link></section>; }
function LanguageGate() {
  useEffect(() => { let locale = navigator.language.toLowerCase().startsWith('pt') ? 'pt-br' : 'en'; try { const saved = localStorage.getItem('pacblog-locale'); if (saved === 'pt-br' || saved === 'en') locale = saved; } catch {} window.location.replace(publicPath(`/${locale}/`)); }, []);
  return <main className="language-gate"><span className="brand-mark">rm.</span><h1>ricardo malosso</h1><p lang="pt-BR">software, música, cultura</p><p lang="en">software, music, culture</p><div><a className="button" href={publicPath('/pt-br/')} lang="pt-BR">🇧🇷 português brasileiro ↗</a><a className="button" href={publicPath('/en/')} lang="en">🇨🇦 english ↗</a></div></main>;
}
export default function App() { return <ContentProvider><Routes><Route path="/admin/*" element={<Suspense fallback={<main className="wrap">Loading admin…</main>}><AdminPanel/></Suspense>}/><Route path="/" element={<LanguageGate/>}/><Route path="/:locale/*" element={<LocaleRoot/>}/></Routes></ContentProvider>; }
