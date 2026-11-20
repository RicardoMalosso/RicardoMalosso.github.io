import { useEffect, useRef, useState } from 'react';
import { base } from '../data';

export type PronunciationClip = {
  term: string;
  respelling: string;
  audio: string;
};

export default function PronunciationGuide({ clips }: { clips: PronunciationClip[] }) {
  const player = useRef<HTMLAudioElement | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => () => {
    player.current?.pause();
    if (player.current) player.current.src = '';
  }, []);

  async function play(index: number) {
    const audio = player.current ?? new Audio();
    player.current = audio;

    if (active === index && !audio.paused) {
      audio.pause();
      setActive(null);
      return;
    }

    audio.pause();
    audio.onended = () => setActive(null);
    audio.onerror = () => { setActive(null); setError(true); };
    if (active !== index || audio.error) audio.src = `${base}${clips[index].audio}`;
    setError(false);
    try {
      await audio.play();
      setActive(index);
    } catch {
      setError(true);
      setActive(null);
    }
  }

  return <details className="pronunciation-guide">
    <summary><span className="pronunciation-icon" aria-hidden="true">♫</span><span><strong>Pronunciation guide</strong><small>Hear the Portuguese names and titles</small></span><span className="pronunciation-count">{clips.length} clips</span></summary>
    <div className="pronunciation-content">
      <div className="pronunciation-list">
        {clips.map((clip, index) => <button type="button" className={`pronunciation-item${active === index ? ' is-playing' : ''}`} key={clip.audio} onClick={() => { void play(index); }} aria-label={`${active === index ? 'Pause' : 'Play'} pronunciation of ${clip.term}`} aria-pressed={active === index}>
          <span className="pronunciation-play" aria-hidden="true">{active === index ? 'Ⅱ' : '▶'}</span>
          <span className="pronunciation-name"><strong>{clip.term}</strong><small>{clip.respelling}</small></span>
        </button>)}
      </div>
      <p className="pronunciation-help">English-friendly respellings are approximate. Listen to the recordings for the actual pronunciation.</p>
      {error && <p className="pronunciation-error" role="alert">The recording could not be played. Please try again.</p>}
    </div>
  </details>;
}
