import entries from './content.generated.json';
import type { Entry, Locale } from './types';
export const content = entries as Entry[];
export const base = import.meta.env.BASE_URL;
export const siteUrl = 'https://ricardomalosso.github.io';
export const projects = [
  { slug: 'pacttsclone', name: 'PacTTSClone', image: 'pacttsclone-studio.jpg', replay: null, repo: 'https://github.com/RicardoMalosso/PacTTSClone',
    en: { category: 'Python / AI / audio', tags: ['Python', 'OmniVoice', 'Twitch / OBS'], description: 'local voice generation, built for streamers.', detail: 'an application that runs on your computer and turns a reference MP3 and text into generated speech with OmniVoice. includes saved voices, generation monitoring, and Twitch and OBS integrations.' },
    'pt-br': { category: 'Python / IA / áudio', tags: ['Python', 'OmniVoice', 'Twitch / OBS'], description: 'geração de voz local, pensada para streamers.', detail: 'uma aplicação executada localmente que transforma um MP3 de referência e um texto em fala com o OmniVoice. inclui vozes salvas, monitoramento de geração e integrações com Twitch e OBS.' } },
  { slug: 'election-tracker', name: 'Election Tracker', image: 'election-tracker-poster.jpg', replay: 'election-tracker-replay.gif', repo: null,
    en: { category: 'data / visualization', tags: ['TSE', 'data visualization', 'caching'], description: 'making the vote count easier to follow.', detail: 'an election dashboard that collects official TSE results and presents the progress of the count. a shared cache and adaptive polling strategy reduce repeated requests as updates slow down.' },
    'pt-br': { category: 'dados / visualização', tags: ['TSE', 'visualização de dados', 'cache'], description: 'a apuração dos votos mais fácil de acompanhar.', detail: 'um painel eleitoral que coleta resultados oficiais do TSE e apresenta a evolução da apuração. um cache compartilhado e uma estratégia de consulta adaptativa reduzem requisições repetidas à medida que as atualizações ficam menos frequentes.' } },
];
export const pathFor = (locale: Locale, section = '', slug = '') => `/${locale}/${section ? `${section}/` : ''}${slug ? `${slug}/` : ''}`;
export const publicPath = (route: string) => `${base.replace(/\/$/, '')}${route}`;
export function alternatePath(pathname: string, locale: Locale, entries: Entry[] = content) {
  const parts = pathname.split('/').filter(Boolean);
  parts[0] = locale;
  if (parts.length > 2 && ['blog', 'music'].includes(parts[1]) && !entries.some(x => x.locale === locale && x.section === parts[1] && x.slug === parts[2])) return pathFor(locale, parts[1]) + '?translation=missing';
  return '/' + parts.join('/') + '/';
}
export function routeMetadata(route: string, entries: Entry[] = content) {
  const [first, section = '', slug] = route.split('/').filter(Boolean);
  const locale: Locale = first === 'en' ? 'en' : 'pt-br';
  const entry = entries.find(x => x.locale === locale && x.section === section && x.slug === slug);
  const project = section === 'portfolio' ? projects.find(x => x.slug === slug) : undefined;
  const labels = locale === 'en' ? { '': 'portfolio', portfolio: 'portfolio', blog: 'blog', music: 'music', experiments: 'experiments', resume: 'résumé', contact: 'contact' } : { '': 'portfólio', portfolio: 'portfólio', blog: 'blog', music: 'música', experiments: 'experimentos', resume: 'currículo', contact: 'contato' };
  return { locale, title: `${entry?.title || project?.name || labels[section as keyof typeof labels] || '404'} · ricardo malosso`, description: entry?.description || project?.[locale].description || (locale === 'en' ? 'Software projects, development notes, music, and experiments by Ricardo Malosso.' : 'Projetos de software, notas de desenvolvimento, música e experimentos de Ricardo Malosso.') };
}
export const routes = ['/', ...(['pt-br', 'en'] as Locale[]).flatMap(locale => [pathFor(locale), ...['blog', 'music', 'experiments', 'resume', 'contact'].map(section => pathFor(locale, section)), ...projects.map(x => pathFor(locale, 'portfolio', x.slug)), ...content.filter(x => x.locale === locale).map(x => pathFor(locale, x.section, x.slug))])];
