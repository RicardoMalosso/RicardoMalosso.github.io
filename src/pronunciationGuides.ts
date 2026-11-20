import type { PronunciationClip } from './components/PronunciationGuide';

/** Adding a new article's guide only requires another key and its public audio clips. */
export const pronunciationGuides: Record<string, PronunciationClip[]> = {
  'music/to-ouvindo-alguem-me-chamar/en': [
    { term: "Racionais MC's", respelling: 'hah-syoh-NAYS eh-meh-SEHS', audio: 'audio/pronunciation/racionais-mcs.mp3' },
    { term: 'Tô Ouvindo Alguém Me Chamar', respelling: 'TOH oh-VEEN-doo ow-GENG mee shah-MAHR', audio: 'audio/pronunciation/to-ouvindo-alguem-me-chamar.mp3' },
    { term: 'Sobrevivendo no Inferno', respelling: 'soh-breh-vee-VEHN-doo noo een-FEHR-noo', audio: 'audio/pronunciation/sobrevivendo-no-inferno.mp3' },
    { term: 'Mano Brown', respelling: 'MAH-noh BROWN', audio: 'audio/pronunciation/mano-brown.mp3' },
    { term: 'Ice Blue', respelling: 'ICE BLOO', audio: 'audio/pronunciation/ice-blue.mp3' },
    { term: 'Edi Rock', respelling: 'ED-ee ROCK', audio: 'audio/pronunciation/edi-rock.mp3' },
    { term: 'DJ KL Jay', respelling: 'DEE-JAY KAH EH-lee JAY', audio: 'audio/pronunciation/dj-kl-jay.mp3' },
  ],
};
