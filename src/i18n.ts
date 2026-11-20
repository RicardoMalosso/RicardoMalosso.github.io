import { createInstance } from 'i18next';
import type { Locale } from './types';
export const locales: Locale[] = ['pt-br', 'en'];
const en = {
  maximizeSection: 'expand section', restoreSection: 'close expanded view',
  downloadLrc: 'download selected lyrics (.lrc)',
  lyricExperiment: 'lyrics player', lyricExperimentIntro: 'choose a YouTube video and search LRCLIB for timed lyrics. compare the results and choose the recording that fits.', songSearch: 'song and artist', songPlaceholder: 'e.g. Nelson Cavaquinho Juízo Final', youtubeLink: 'YouTube URL', findLyrics: 'find lyrics', searchingLyrics: 'searching LRCLIB…', invalidYoutube: 'enter a valid YouTube video URL.', missingSong: 'enter a song name.', lrclibError: 'could not reach LRCLIB. please try again.', candidateMatches: 'lyrics matches', videoDuration: 'video duration', durationHint: 'results with synced lyrics are ordered by closest duration; recordings can differ.', durationPending: 'waiting for YouTube video duration. play the video if needed; results are in search order until then.', noLyricMatches: 'no results found. try another song or artist name.', syncedAvailable: 'timed lyrics', noSyncedLyrics: 'no timed lyrics', lyricsSource: 'lyrics supplied by', chooseSyncedLyrics: 'choose a result with timed lyrics above.', durationDifference_one: '{{count}} second difference', durationDifference_other: '{{count}} seconds difference',

  syncPrompt: 'lyrics out of sync?', lyricsEarly: 'lyrics are early', lyricsLate: 'lyrics are late', syncReset: 'reset', syncOffset: 'lyrics timing adjustment',
  volume: 'volume', mute: 'mute', unmute: 'unmute', pauseOnLyricHover: 'pause on lyric explanation hover',
  lyricsPlayer: 'listen & read', smallerVideo: 'smaller video', largerVideo: 'expand video', expandLyrics: 'show full lyrics', compactLyrics: 'show three lines', followLine: 'follow current line', timestamp: 'time', lyricsLoadError: 'some lyrics could not be loaded. check the subtitle files.', loadingLyrics: 'loading lyrics…', loadingPlayer: 'loading YouTube player…', videoError: 'the video could not be played here.', watchOnYoutube: 'watch on YouTube', videoPlayback: 'YouTube playback', playAudio: 'play video', pauseAudio: 'pause video', seek: 'playback position', keyboardHelp: 'Space / K: play or pause · ← / → / H: seek 5s · J / L: seek 10s', keyboardDetails: 'keyboard details', keyboardExplanation: 'Shortcuts work while focus is on this page. Text fields and the seek slider keep their normal keyboard controls; the embedded YouTube player handles its own keys.',

  resume: 'résumé', resumeIntro: 'my experience, skills, and recent projects.', downloadResume: 'download résumé (PDF)', resumeUpdated: 'updated',
  fullDashboardReplay: 'full dashboard replay', chartReplay: 'chart replay with automatic zoom',
  chartReplayCaption: 'the same nine archived national bulletins, with a three-second countdown between updates and automatic chart zoom. the recorded interface is in portuguese.',
  studioInterface: 'the voice studio', speechControls: 'speech controls', interfacePreview: 'interface preview',
  interfacePreviewCaption: 'screenshots of the actual interface with sample text. no speech was being generated when these screenshots were taken. the captured interface is in portuguese.',
  narrationHeading: 'hear this project description in the voice of optimus prime',
  narrationCaption: 'a voice demo generated with PacTTSClone.', downloadNarration: 'download the audio description',

  playReplay: 'play replay', pauseReplay: 'pause replay', replayAlt: 'archived vote-count replay with chart and state map', replayCaption: 'replay of nine archived national bulletins, with updates every three seconds. the state map shows actual final results as a fixed reference. the recorded interface is in portuguese.',
  portfolio: 'portfolio', blog: 'blog', music: 'music', experiments: 'experiments', contact: 'contact',
  skip: 'skip to content', menu: 'navigation', language: 'language', theme: 'change colour theme',
  eyebrow: 'software, music, culture', hello: 'hi, i’m ricardo.', hero: 'software, music, culture',
  intro: 'software developer based in brazil. a collection of projects, notes, music, and ideas worth exploring.',
  explore: 'explore my work', about: 'let’s talk', selected: 'selected projects', selectedIntro: 'some things i’ve been working on.',
  project: 'view project', code: 'source on GitHub', illustration: 'project illustration', latest: 'from the notebook', allPosts: 'all posts',
  blogIntro: 'development notes, things i learn, and ideas that need more than a few lines.',
  musicIntro: 'listening closely. lyrics, translations, and the stories around the music.',
  experimentsIntro: 'small ideas you can play with. everything here runs in your browser.',
  contactIntro: 'have a project in mind, a question, or a song i should hear? get in touch.',
  email: 'send an email', elsewhere: 'find me elsewhere', location: 'mogi das cruzes, são paulo · brazil',
  footer: 'made by ricardo malosso. always a work in progress.', back: 'back', read: 'read article',
  notFound: 'page not found.', notFoundText: 'the link may have changed, or the page does not exist yet.', home: 'back to the portfolio',
  original: 'original', translation: 'english translation', notes: 'line note', credits: 'credits',
  filter: 'search articles', noResults: 'no articles found. try another search.', all: 'all',
  contrast: 'the contrast lab', contrastIntro: 'move the sliders and see how a colour affects readability.', hue: 'hue', lightness: 'lightness', sample: 'make something worth sharing.', ratio: 'contrast ratio', accessible: 'passes WCAG AA for normal text', inaccessible: 'does not meet WCAG AA for normal text', reset: 'reset',
  approach: 'about my work', approachTitle: 'useful software.\nroom to explore.', approachText: 'my work spans C#/.NET, JavaScript, Python, and AI integrations. this site brings that work together with the other things i care about.',
  fallback: 'this page is not available in the other language yet. here are the available entries.',
};
const pt: typeof en = {
  maximizeSection: 'ampliar seção', restoreSection: 'fechar visualização ampliada',
  downloadLrc: 'baixar letra selecionada (.lrc)',
  lyricExperiment: 'player de letras', lyricExperimentIntro: 'escolha um vídeo do YouTube e busque letras sincronizadas no LRCLIB. compare os resultados e escolha a gravação correspondente.', songSearch: 'música e artista', songPlaceholder: 'ex.: Nelson Cavaquinho Juízo Final', youtubeLink: 'link do YouTube', findLyrics: 'buscar letra', searchingLyrics: 'buscando no LRCLIB…', invalidYoutube: 'insira um link válido de vídeo do YouTube.', missingSong: 'digite o nome da música.', lrclibError: 'não foi possível acessar o LRCLIB. tente novamente.', candidateMatches: 'letras encontradas', videoDuration: 'duração do vídeo', durationHint: 'os resultados sincronizados são ordenados pela duração mais próxima; as gravações podem ser diferentes.', durationPending: 'aguardando a duração do vídeo. se necessário, dê play; até lá, os resultados seguem a ordem da busca.', noLyricMatches: 'nenhum resultado encontrado. tente outro nome de música ou artista.', syncedAvailable: 'letra sincronizada', noSyncedLyrics: 'sem letra sincronizada', lyricsSource: 'letras fornecidas por', chooseSyncedLyrics: 'escolha acima um resultado com letra sincronizada.', durationDifference_one: '{{count}} segundo de diferença', durationDifference_other: '{{count}} segundos de diferença',

  syncPrompt: 'letra fora de sincronia?', lyricsEarly: 'letra adiantada', lyricsLate: 'letra atrasada', syncReset: 'restaurar', syncOffset: 'ajuste de tempo da letra',
  volume: 'volume', mute: 'silenciar', unmute: 'ativar som', pauseOnLyricHover: 'pausar ao passar o mouse sobre explicações na letra',
  lyricsPlayer: 'ouvir e ler', smallerVideo: 'reduzir vídeo', largerVideo: 'ampliar vídeo', expandLyrics: 'mostrar letra completa', compactLyrics: 'mostrar três versos', followLine: 'acompanhar verso atual', timestamp: 'tempo', lyricsLoadError: 'não foi possível carregar todas as letras. verifique os arquivos de legenda.', loadingLyrics: 'carregando letras…', loadingPlayer: 'carregando player do YouTube…', videoError: 'não foi possível reproduzir o vídeo aqui.', watchOnYoutube: 'assistir no YouTube', videoPlayback: 'reprodução do YouTube', playAudio: 'reproduzir vídeo', pauseAudio: 'pausar vídeo', seek: 'posição da reprodução', keyboardHelp: 'Espaço / K: reproduzir ou pausar · ← / → / H: avançar ou voltar 5s · J / L: voltar ou avançar 10s', keyboardDetails: 'detalhes dos atalhos', keyboardExplanation: 'Os atalhos funcionam com o foco nesta página. Campos de texto e o controle de posição mantêm seus atalhos normais; o player do YouTube tem seus próprios comandos.',

  resume: 'currículo', resumeIntro: 'minha experiência, competências e projetos recentes.', downloadResume: 'baixar currículo (PDF)', resumeUpdated: 'atualizado em',
  fullDashboardReplay: 'replay do painel completo', chartReplay: 'replay do gráfico com zoom automático',
  chartReplayCaption: 'os mesmos 9 boletins nacionais arquivados, com contagem regressiva de três segundos entre atualizações e zoom automático no gráfico.',
  studioInterface: 'o estúdio de voz', speechControls: 'controles de fala', interfacePreview: 'prévia da interface',
  interfacePreviewCaption: 'capturas da interface real com texto de exemplo. não havia geração de voz em execução durante as capturas.',
  narrationHeading: 'ouça a descrição deste projeto na voz do bob esponja',
  narrationCaption: 'uma demonstração de voz gerada com o PacTTSClone.', downloadNarration: 'baixar a descrição em áudio',

  playReplay: 'reproduzir animação', pauseReplay: 'pausar animação', replayAlt: 'replay da apuração arquivada com gráfico e mapa dos estados', replayCaption: 'replay de 9 boletins nacionais arquivados, com atualização a cada 3 segundos. mapa estadual: resultados finais reais, como referência fixa.',
  portfolio: 'portfólio', blog: 'blog', music: 'música', experiments: 'experimentos', contact: 'contato',
  skip: 'pular para o conteúdo', menu: 'navegação', language: 'idioma', theme: 'mudar tema de cores',
  eyebrow: 'software, música, cultura', hello: 'oi, eu sou o ricardo.', hero: 'software, música, cultura',
  intro: 'desenvolvedor de software no brasil. uma coleção de projetos, notas, músicas e ideias que valem explorar.',
  explore: 'conheça meu trabalho', about: 'vamos conversar', selected: 'projetos selecionados', selectedIntro: 'algumas coisas em que tenho trabalhado.',
  project: 'ver projeto', code: 'código no GitHub', illustration: 'ilustração do projeto', latest: 'do caderno', allPosts: 'todos os textos',
  blogIntro: 'notas de desenvolvimento, aprendizados e ideias que precisam de mais de algumas linhas.',
  musicIntro: 'escutando com atenção. letras, traduções e as histórias ao redor da música.',
  experimentsIntro: 'pequenas ideias para testar. tudo aqui funciona no seu navegador.',
  contactIntro: 'tem um projeto em mente, uma pergunta ou uma música que eu preciso ouvir? entre em contato.',
  email: 'enviar um e-mail', elsewhere: 'me encontre também', location: 'mogi das cruzes, são paulo · brasil',
  footer: 'feito por ricardo malosso. sempre em construção.', back: 'voltar', read: 'ler texto',
  notFound: 'página não encontrada.', notFoundText: 'o endereço pode ter mudado, ou a página ainda não existe.', home: 'voltar ao portfólio',
  original: 'original', translation: 'tradução em inglês', notes: 'nota do verso', credits: 'créditos',
  filter: 'buscar textos', noResults: 'nenhum texto encontrado. tente outra busca.', all: 'todos',
  contrast: 'laboratório de contraste', contrastIntro: 'mova os controles e veja como uma cor muda a legibilidade.', hue: 'matiz', lightness: 'luminosidade', sample: 'faça algo que valha compartilhar.', ratio: 'razão de contraste', accessible: 'atende ao nível AA da WCAG para texto normal', inaccessible: 'não atende ao nível AA da WCAG para texto normal', reset: 'restaurar',
  approach: 'sobre meu trabalho', approachTitle: 'software útil.\nespaço para explorar.', approachText: 'meu trabalho passa por C#/.NET, JavaScript, Python e integrações com IA. este site reúne esses projetos e as outras coisas que me interessam.',
  fallback: 'esta página ainda não está disponível no outro idioma. veja os textos disponíveis.',
};
export function createI18n(locale: Locale) {
  const instance = createInstance();
  void instance.init({ lng: locale, fallbackLng: 'pt-br', resources: { en: { translation: en }, 'pt-br': { translation: pt } }, initAsync: false, lowerCaseLng: true, load: 'currentOnly', showSupportNotice: false, interpolation: { escapeValue: false } });
  return instance;
}
