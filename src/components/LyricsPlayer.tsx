import { Note } from './PostMarkdown';
import type { LyricNote } from '../types';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { base } from '../data';
import { selectedRow, alignLyrics, formatTime, nearbyRow, lyricTime, videoTimeForLyric } from '../lyrics';
import type { Cue, LyricRow } from '../lyrics';
import { parseLrc } from '../lrclib';

type Player = { getCurrentTime(): number; getDuration(): number; getPlayerState(): number; playVideo(): void; pauseVideo(): void; seekTo(seconds: number, allowSeekAhead: boolean): void; setVolume(value: number): void; getVolume(): number; mute(): void; unMute(): void; isMuted(): boolean; destroy(): void };
type YTNamespace = { Player: new (element: HTMLElement, options: object) => Player };
declare global { interface Window { YT?: YTNamespace; onYouTubeIframeAPIReady?: () => void } }
let apiPromise: Promise<YTNamespace> | undefined;
function youtubeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); if (window.YT?.Player) resolve(window.YT); else reject(Error('YouTube API unavailable')); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.onerror = () => reject(Error('YouTube API unavailable')); document.head.appendChild(script);
  }).catch(error => { apiPromise = undefined; throw error; });
  return apiPromise!;
}
export type MusicPlayerConfig = { youtubeId: string; subtitles?: { en: string; 'pt-br': string }; subtitleText?: { en: string; 'pt-br': string }; lrc?: string; lyricLabel?: string; offsetMs?: number };
export default function LyricsPlayer({ config, onDuration, lyricNotes = [], originalLanguage = 'pt-BR' }: { lyricNotes?: LyricNote[]; originalLanguage?: string; config: MusicPlayerConfig; onDuration?: (duration: number) => void }) {
  const annotated = (text: string, start: number, language: 'en' | 'pt-br') => {
    const notes = lyricNotes.filter(n => n.language === language && Math.abs(n.time.split(':').reduce((a, v) => a * 60 + Number(v), 0) - start) < 0.005);
    const parts: React.ReactNode[] = []; let cursor = 0;
    for (const note of notes) {
      const at = text.indexOf(note.text, cursor);
      if (at < 0) continue;
      parts.push(text.slice(cursor, at), <span key={at} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}><Note label={note.text} text={note.explanation} onOpenChange={onLyricNoteOpenChange}/></span>);
      cursor = at + note.text.length;
    }
    parts.push(text.slice(cursor)); return parts;
  };
  const { t, i18n } = useTranslation();
  const videoShell = useRef<HTMLDivElement>(null);
  const fullscreenButton = useRef<HTMLButtonElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const ptLocale = i18n.language.toLowerCase().startsWith('pt');
  const fullscreenLabel = fullscreen ? (ptLocale ? 'Sair da tela cheia' : 'Exit fullscreen') : (ptLocale ? 'Tela cheia com letras' : 'Fullscreen with lyrics');
  useEffect(() => {
    const changed = () => {
      const active = document.fullscreenElement === videoShell.current;
      setFullscreen(active);
      if (!active) fullscreenButton.current?.focus({preventScroll: true});
    };
    document.addEventListener('fullscreenchange', changed);
    return () => document.removeEventListener('fullscreenchange', changed);
  }, []);
  const toggleFullscreen = async () => {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === videoShell.current) await document.exitFullscreen();
      else if (videoShell.current?.requestFullscreen) await videoShell.current.requestFullscreen();
      else setFullscreenError(true);
    } catch { setFullscreenError(true); }
  };
  const mount = useRef<HTMLDivElement>(null); const player = useRef<Player | null>(null); const lyricsRef = useRef<HTMLDivElement>(null); const lyricsHeader = useRef<HTMLDivElement>(null); const started = useRef(false); const volumeLockUntil = useRef(0);
  // Only resume playback when the first hovered explanation actually paused a playing video.
  // Count open explanations so moving between overlapping tooltips does not resume prematurely.
  const notePlayback = useRef({open: 0, resume: false});
  const [pauseOnLyricHover, setPauseOnLyricHover] = useState(false);
  const onLyricNoteOpenChange = (open: boolean) => {
    const state = notePlayback.current;
    const video = player.current;
    if (open) {
      if (state.open++ > 0) return;
      state.resume = false;
      if (!pauseOnLyricHover || !video) return;
      try {
        if (video.getPlayerState() === 1) {
          state.resume = true;
          video.pauseVideo();
        }
      } catch { state.resume = false; }
      return;
    }
    if (state.open === 0 || --state.open > 0) return;
    const shouldResume = state.resume;
    state.resume = false;
    if (shouldResume && video) {
      try { if (video.getPlayerState() === 2) video.playVideo(); } catch { /* player no longer ready */ }
    }
  };
  const changePauseOnLyricHover = (enabled: boolean) => {
    setPauseOnLyricHover(enabled);
    const state = notePlayback.current;
    const video = player.current;
    if (!enabled) {
      // Switching the option off cancels auto-pause and restores only playback we paused.
      const shouldResume = state.resume;
      state.resume = false;
      if (shouldResume && video) {
        try { if (video.getPlayerState() === 2) video.playVideo(); } catch { /* player no longer ready */ }
      }
    } else if (state.open > 0 && video) {
      // Turning it on with an explanation already open applies the same rule.
      try {
        if (video.getPlayerState() === 1) {
          state.resume = true;
          video.pauseVideo();
        }
      } catch { state.resume = false; }
    }
  };
  const [rows, setRows] = useState<LyricRow[]>([]); const [loadError, setLoadError] = useState('');
  const [playerError, setPlayerError] = useState(false); const [ready, setReady] = useState(false);
  const [time, setTime] = useState(0); const [duration, setDuration] = useState(0); const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(100); const [muted, setMuted] = useState(false);
  const [highlight, setHighlight] = useState<{top: number; height: number} | null>(null);
  const [expanded, setExpanded] = useState(true); const [following, setFollowing] = useState(true);
  const [scrubbing, setScrubbing] = useState(false); const [scrubTime, setScrubTime] = useState(0);
  const [scriptMessage, setScriptMessage] = useState(false);
  const defaultOffsetMs = config.offsetMs ?? 0;
  const [offsetMs, setOffsetMs] = useState(defaultOffsetMs);
  useEffect(() => { setOffsetMs(defaultOffsetMs); }, [defaultOffsetMs, config.youtubeId]);

  useEffect(() => {
    const controller = new AbortController(); setRows([]); setLoadError('');
    if (config.lrc !== undefined) { setRows(parseLrc(config.lrc).map(cue => ({ start: cue.start, end: cue.end, pt: cue }))); return () => controller.abort(); }
    if (config.subtitleText) {
      const pt = parseLrc(config.subtitleText['pt-br']); const en = parseLrc(config.subtitleText.en);
      setRows(alignLyrics(pt, en));
      if (!pt.length || !en.length) setLoadError('lyricsLoadError');
      return () => controller.abort();
    }
    if (!config.subtitles) return () => controller.abort();
    const subtitles = config.subtitles;
    const read = async (path: string): Promise<Cue[]> => {
      const result = await fetch(`${base}${path}`, { signal: controller.signal });
      if (!result.ok) throw Error('subtitle unavailable');
      const cues = parseLrc(await result.text());
      if (!cues.length) throw Error('no timed lyrics');
      return cues;
    };
    Promise.allSettled([read(subtitles['pt-br']), read(subtitles.en)]).then(results => {
      if (controller.signal.aborted) return;
      const pt = results[0].status === 'fulfilled' ? results[0].value : [];
      const en = results[1].status === 'fulfilled' ? results[1].value : [];
      setRows(alignLyrics(pt, en));
      if (results.some(r => r.status === 'rejected') || !pt.length || !en.length) setLoadError('lyricsLoadError');
    });
    return () => controller.abort();
  }, [config.subtitles?.en, config.subtitles?.['pt-br'], config.subtitleText?.en, config.subtitleText?.['pt-br'], config.lrc]);

  useEffect(() => {
    let cancelled = false; let instance: Player | null = null; setPlayerError(false); setReady(false);
    youtubeApi().then(YT => {
      if (cancelled || !mount.current) return;
      const node = document.createElement('div'); mount.current.replaceChildren(node);
      instance = new YT.Player(node, {
        videoId: config.youtubeId, playerVars: { playsinline: 1, fs: 0, origin: window.location.origin },
        events: {
          onReady: () => { if (!cancelled) setReady(true); },
          onStateChange: (event: { data: number }) => {
            if (cancelled) return;
            setPlaying(event.data === 1);
            // An explicit play while a note is open overrides its pending auto-resume.
            if (event.data === 1 && notePlayback.current.open > 0) notePlayback.current.resume = false;
            if (event.data === 1 && !started.current) { started.current = true; if (document.fullscreenElement !== videoShell.current) lyricsHeader.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); }
          },
          onError: () => { if (!cancelled) setPlayerError(true); },
        },
      });
      player.current = instance;
    }).catch(() => { if (!cancelled) setPlayerError(true); });
    return () => { cancelled = true; instance?.destroy(); if (player.current === instance) player.current = null; };
  }, [config.youtubeId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const p = player.current; if (!p || !ready) return;
      try { const current = p.getCurrentTime(); const length = p.getDuration(); if (Number.isFinite(current)) setTime(current); if (Number.isFinite(length)) { setDuration(length); if (length > 0) onDuration?.(length); } if (Date.now() >= volumeLockUntil.current) { const v = p.getVolume(); if (Number.isFinite(v)) setVolume(v); setMuted(p.isMuted()); } } catch { /* player is loading */ }
    }, 150);
    return () => window.clearInterval(timer);
  }, [ready, onDuration]);
  const shownTime = scrubbing ? scrubTime : time;
  const adjustedTime = lyricTime(shownTime, offsetMs);
  const current = useMemo(() => selectedRow(rows, adjustedTime), [rows, adjustedTime]);
  const center = useMemo(() => nearbyRow(rows, adjustedTime), [rows, adjustedTime]);
  const displayed = expanded ? rows.map((row, index) => ({row, index})) : rows.map((row, index) => ({row, index})).filter(({index}) => index >= center - 1 && index <= center + 1);
  const seek = (seconds: number) => { const p = player.current; if (!p || !ready) return; const next = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, seconds)); p.seekTo(next, true); setTime(next); };
  const toggle = () => { const p = player.current; if (!p || !ready) return; if (notePlayback.current.open > 0) notePlayback.current.resume = false; if (p.getPlayerState() === 1) p.pauseVideo(); else p.playVideo(); };
  const seekRef = useRef(seek), toggleRef = useRef(toggle); seekRef.current = seek; toggleRef.current = toggle;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.repeat || target?.isContentEditable || ['INPUT','TEXTAREA','SELECT','BUTTON'].includes(target?.tagName || '')) return;
      const k = e.key.toLowerCase();
      if (![' ', 'arrowleft', 'arrowright', 'h', 'j', 'k', 'l'].includes(k)) return;
      e.preventDefault();
      if (k === ' ' || k === 'k') toggleRef.current();
      else { const p = player.current; if (!p) return; const delta = k === 'j' ? -10 : k === 'l' ? 10 : k === 'h' || k === 'arrowleft' ? -5 : 5; seekRef.current(p.getCurrentTime() + delta); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!expanded || !following || current < 0) return;
    const container = lyricsRef.current; const row = container?.querySelector<HTMLElement>('[data-current="true"]');
    if (!container || !row) return;
    container.scrollTo({top: row.offsetTop - container.clientHeight / 2 + row.clientHeight / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
  }, [current, expanded, following]);
  useLayoutEffect(() => {
    const container = lyricsRef.current;
    if (!container) return;
    const update = () => {
      const row = container.querySelector<HTMLElement>('[data-current="true"]');
      setHighlight(row ? { top: row.offsetTop, height: row.offsetHeight } : null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    for (const row of container.querySelectorAll('.sync-row')) observer.observe(row);
    return () => observer.disconnect();
  }, [current, center, expanded, rows]);
  const stopFollowing = () => { if (expanded) setFollowing(false); };
  const draggingLyrics = useRef(false);
  const startLyricSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !(event.target instanceof Element)) return;
    draggingLyrics.current = false;
    const column = event.target.closest('.sync-en, .sync-pt');
    const lyrics = event.currentTarget;
    if (column && lyrics.contains(column)) {
      lyrics.dataset.selectionColumn = column.classList.contains('sync-en') ? 'en' : 'pt';
    } else {
      delete lyrics.dataset.selectionColumn;
    }
  };
  const copyLyrics = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const lyrics = event.currentTarget;
    const selection = window.getSelection();
    const column = lyrics.dataset.selectionColumn;
    if (!column || !selection || selection.isCollapsed || !lyrics.contains(selection.anchorNode)) return;

    const selected = selection.getRangeAt(0);
    const lines = [];
    for (const cell of lyrics.querySelectorAll(`.sync-${column}`)) {
      if (!selected.intersectsNode(cell)) continue;
      const line = document.createRange();
      line.selectNodeContents(cell);
      if (line.compareBoundaryPoints(Range.START_TO_START, selected) < 0) {
        line.setStart(selected.startContainer, selected.startOffset);
      }
      if (line.compareBoundaryPoints(Range.END_TO_END, selected) > 0) {
        line.setEnd(selected.endContainer, selected.endOffset);
      }
      const text = line.toString();
      if (text) lines.push(text);
    }
    event.clipboardData.setData('text/plain', lines.join('\n'));
    event.preventDefault();
  };
  const changeVolume = (value: number) => { const p = player.current; if (!p || !ready) return; volumeLockUntil.current = Date.now() + 1000; p.setVolume(value); if (value > 0 && p.isMuted()) p.unMute(); setVolume(value); setMuted(value === 0); };
  const toggleMute = () => { const p = player.current; if (!p || !ready) return; volumeLockUntil.current = Date.now() + 1000; if (p.isMuted() || p.getVolume() === 0) { if (p.getVolume() === 0) { p.setVolume(50); setVolume(50); } p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); } };
  return <section className="music-player" aria-label={t('lyricsPlayer')}>
    <div className="music-player-header"><div><p className="eyebrow">{t('listenRead')}</p><h2>{t('lyricsPlayer')}</h2></div><div className="player-actions"><button onClick={() => {setExpanded(x => !x); setFollowing(true);}} aria-expanded={expanded}>{t(expanded ? 'compactLyrics' : 'expandLyrics')}</button></div></div>
    <div className="player-layout">
      <div ref={videoShell} className="youtube-shell"><div ref={mount} className="youtube-mount"/>
        <button ref={fullscreenButton} className="lyrics-fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={fullscreenLabel} aria-pressed={fullscreen}>{fullscreen ? '⤡' : '⤢'} {fullscreenLabel}</button>
        {fullscreenError && <p className="fullscreen-error" role="status">{ptLocale ? 'Tela cheia indisponível neste navegador.' : 'Fullscreen is unavailable in this browser.'}</p>}
        {fullscreen && <div className="fullscreen-lyrics" aria-label={t('lyricsPlayer')}>
          {rows.slice(Math.max(0, center - 1), center + 2).map((row) => <div key={row.start} className={rows[current] === row ? 'fullscreen-lyric is-current' : 'fullscreen-lyric'}>
            {config.lrc === undefined && <span lang="en">{row.en?.text || ''}</span>}
            <span lang={config.lrc === undefined ? originalLanguage : undefined}>{row.pt?.text || ''}</span>
          </div>)}
          {loadError && <p role="status">{t(loadError)}</p>}
        </div>}<noscript><a href={`https://www.youtube.com/watch?v=${config.youtubeId}`}>{t('watchOnYoutube')} ↗</a></noscript>{playerError && <p className="player-error">{t('videoError')} <a href={`https://www.youtube.com/watch?v=${config.youtubeId}`}>{t('watchOnYoutube')} ↗</a></p>}</div>
      <div className="music-controls"><div className="control-top"><button className="play-control" onClick={toggle} disabled={!ready || playerError} aria-label={t(playing ? 'pauseAudio' : 'playAudio')}>{playing ? 'Ⅱ' : '▶'}</button><div><strong>{t('videoPlayback')}</strong><p>{t('keyboardHelp')}</p></div></div><label className="sr-only" htmlFor="music-seek">{t('seek')}</label><input id="music-seek" className="music-seek" type="range" min={0} max={duration || 0} step="0.1" disabled={!ready || !duration} value={Math.min(shownTime, duration || 0)} onPointerDown={() => {setScrubTime(time);setScrubbing(true);}} onChange={e => { const value = Number(e.target.value); setScrubTime(value); if (!scrubbing) seek(value); }} onPointerUp={e => { seek(Number(e.currentTarget.value));setScrubbing(false); }} onPointerCancel={() => setScrubbing(false)}/><div className="player-times mono"><span>{formatTime(shownTime)}</span><span>{formatTime(duration)}</span></div><div className="volume-controls"><button type="button" className="volume-mute" onClick={toggleMute} disabled={!ready || playerError} aria-label={t(muted || volume === 0 ? 'unmute' : 'mute')} aria-pressed={muted || volume === 0}>{muted || volume === 0 ? '🔇' : '🔊'}</button><label htmlFor="music-volume">{t('volume')}</label><input id="music-volume" type="range" min={0} max={100} step={1} value={muted ? 0 : volume} disabled={!ready || playerError} onChange={e => changeVolume(Number(e.target.value))}/><span className="mono">{muted ? 0 : volume}%</span></div>
        <label className="pause-on-hover-toggle"><input type="checkbox" checked={pauseOnLyricHover} onChange={e => changePauseOnLyricHover(e.target.checked)}/>{t('pauseOnLyricHover')}</label>
        {!ready && !playerError && <p className="player-status">{t('loadingPlayer')}</p>}</div>
    </div>
    <div ref={lyricsHeader} className="lyric-controls"><div className="lyric-column-headings"><span>{t('timestamp')}</span>{config.lrc !== undefined ? <><span></span><span>{config.lyricLabel || t('lyricsPlayer')}</span></> : <><span>🇨🇦 English</span>{originalLanguage === 'es-PR' ? <span className="mixed-lyrics-heading">🇵🇷/🇧🇷 Español/Portuguese</span> : <span>🇧🇷 Português</span>}</>}</div>{expanded && !following && <button onClick={() => setFollowing(true)}>{t('followLine')}</button>}</div>
    {loadError && <p className="notice" role="status">{t(loadError)}</p>}
    <div ref={lyricsRef} className={`synced-lyrics ${expanded ? 'is-expanded' : 'is-compact'}`} onMouseDown={startLyricSelection} onMouseMove={e => {
      const selection = window.getSelection();
      if (e.buttons === 1 && selection && !selection.isCollapsed && e.currentTarget.contains(selection.anchorNode)) {
        draggingLyrics.current = true;
      }
    }} onCopy={copyLyrics} onWheel={stopFollowing} onTouchMove={stopFollowing} onKeyDown={e => {if (['PageUp','PageDown','Home','End'].includes(e.key)) stopFollowing();}} tabIndex={expanded ? 0 : undefined} aria-label={t('lyricsPlayer')}>
      <span aria-hidden="true" className="lyric-highlight" style={highlight ? { transform: `translateY(${highlight.top}px)`, height: highlight.height, opacity: 1 } : { opacity: 0 }}/>{displayed.map(({row, index}) => <div role="button" tabIndex={0} onKeyDown={e => {if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {e.preventDefault(); e.stopPropagation(); seek(videoTimeForLyric(row.start, offsetMs));setFollowing(true);}}} className={`sync-row ${current === index ? 'is-current' : ''}`} data-current={current === index} key={`${row.start}-${index}`} onClick={e => {
        if (e.detail && draggingLyrics.current) return;
        seek(videoTimeForLyric(row.start, offsetMs));
        setFollowing(true);
      }} aria-label={`${formatTime(videoTimeForLyric(row.start, offsetMs))} ${row.en?.text || ''} ${row.pt?.text || ''}`}><span className="sync-time mono">{formatTime(videoTimeForLyric(row.start, offsetMs))}</span><span className="sync-en" lang="en">{annotated(row.en?.text || '', row.en?.start ?? row.start, 'en')}</span><span className={originalLanguage === 'es-PR' ? 'sync-pt mixed-lyrics-text' : 'sync-pt'} lang={config.lrc === undefined ? originalLanguage : undefined}>{annotated(row.pt?.text || '', row.pt?.start ?? row.start, 'pt-br')}</span></div>)}
      {!rows.length && !loadError && <p className="player-status">{t(config.lrc !== undefined ? 'chooseSyncedLyrics' : 'loadingLyrics')}</p>}
    </div>
    <div className="lyrics-sync" role="group" aria-label={t('syncPrompt')}>
      <span>{t('syncPrompt')}</span>
      <button type="button" onClick={() => setOffsetMs(value => value + 100)}>{t('lyricsEarly')}</button>
      <button type="button" onClick={() => setOffsetMs(value => value - 100)}>{t('lyricsLate')}</button>
      <output className="mono" aria-label={t('syncOffset')} aria-live="polite">{offsetMs > 0 ? '+' : ''}{offsetMs} ms</output>
      {offsetMs !== defaultOffsetMs && <button type="button" onClick={() => setOffsetMs(defaultOffsetMs)}>{t('syncReset')}</button>}
    </div>
    <p className="player-caption">{t('keyboardHelp')} <button className="inline-button" onClick={() => setScriptMessage(x => !x)} aria-expanded={scriptMessage}>{t('keyboardDetails')}</button></p>
    {scriptMessage && <p className="player-caption">{t('keyboardExplanation')}</p>}
  </section>;
}
