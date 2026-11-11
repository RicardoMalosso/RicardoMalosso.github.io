# PacBlog

Ricardo Malosso’s bilingual portfolio, blog, music pages, and browser experiments.

**Production target:** https://ricardomalosso.github.io/

## Stack

React + TypeScript, Vite, React Router, i18next / react-i18next, and Markdown with GFM. The build renders every known route to HTML with React DOM Server. React hydrates those files in the browser for client navigation and interactions. Published blog/music content is managed in Supabase and fetched during the Pages build; visitors receive static pages. See [Supabase content](docs/supabase-content.md) for import verification, access, and rollback.

## Run locally

Use Node.js 24 (the same version as CI).

```sh
npm ci
npm run dev
```

Open the printed URL with `/` appended. To check the actual static export:

```sh
npm run build
npm test
npm run preview
```

Open `/pt-br/` or `/en/`. Markdown is compiled before dev starts; after editing content, restart `npm run dev` (or run `npm run content` while Vite is running).

## Deploy on GitHub Pages

1. In **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source.
2. Push to `main`. `.github/workflows/pages.yml` installs pinned dependencies with `npm ci`, checks TypeScript, builds, runs export checks, and deploys `dist/`.
3. PRs build and test without deploying. You can also run the workflow manually from Actions.

`vite.config.ts` defaults to `/`. `BASE_PATH=/ npm run build` produces a root-hosted export for a future custom domain. Update `siteUrl` in `src/data.ts` at the same time. No SPA rewrite service is required: every published content route has its own `index.html`, and unknown routes receive GitHub Pages’ native 404.

## Structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Shared layout, navigation, page components |
| `src/i18n.ts` | PT-BR and English interface strings |
| `src/data.ts` | Portfolio projects, route helpers, SEO metadata |
| `src/components/` | Interactive components |
| `src/styles/global.css` | Responsive Gruvbox-inspired styling |
| `content/blog/*.md` | Blog posts |
| `content/music/*.md` | Music articles and optional timed lyric data |
| `public/images/` | Project thumbnails (currently labeled illustrations) |
| `scripts/content.mjs` | Frontmatter validation and content compilation |
| `scripts/prerender.mjs` | Static HTML, alternate language links, sitemap, 404 |
| `tests/site.test.mjs` | Export, internal link, translation, and content validation checks |
| `dist/` | Generated website; ignored by Git |

## Add an article

For music posts, follow [the music-post recipe](docs/music-posts.md), including YouTube/LRC inputs, bilingual titles, and formatting.

Create a Markdown file in `content/blog/` or `content/music/`:

```yaml
---
title: "Your title"
description: "A short description for the listing and search previews."
slug: "your-post"
locale: "en"
date: "2026-10-27"
tags: ["Development"]
draft: false
---
Your Markdown content.
```

Create the other language’s file with the **same section and slug**, and `locale: "pt-br"`. Filenames are for organization; the frontmatter controls the URL. Dates must be quoted ISO dates. Drafts are excluded from listings, routes, and sitemaps. Markdown accepts headings, links, images, code blocks, lists, and GFM tables. Raw HTML is disabled.

The language switch preserves the article when its translation exists. Otherwise, it links to the other language’s section with an explanatory notice. The initial language is chosen from a saved preference, then the browser language; explicit language URLs always win. Without JavaScript, the root page provides links to both languages and all prerendered content remains readable.

## Reusable lyrics player for music and blog posts

Copy `templates/lyrics-post.md` as a starting point, or add a `player` block to any Markdown post in `content/music/` or `content/blog/`:

```yaml
player:
  youtubeUrl: "https://www.youtube.com/watch?v=lU8j7lj4RdU"
  subtitles:
    en: "lyrics/demo/en.lrc"
    pt-br: "lyrics/demo/pt-br.lrc"
```

Put the two UTF-8 LRC files under `public/lyrics/`. Paths are relative to `public/`, without a leading slash. The URL and file paths are checked during the build; lyrics are loaded and paired by timestamp in the browser. Use matching timestamps in both translations for best results. The supplied Juízo Final files demonstrate this format.

The player appears after the article by default. To place it between paragraphs, put this marker on its own line in the Markdown body:

```markdown
An introduction to the song.

<!-- lyrics-player -->

More notes after the player.
```

Use at most one marker per post. Both music posts and ordinary blog posts support it. Each localized post supplies its own frontmatter, but can reference the same two LRC files. Full lyrics are shown by default; visitors can switch to three visible lines at any time. Volume, keyboard shortcuts, timing adjustment and the moving highlight work in either mode. No backend is required.

## Portfolio and contact

Edit `projects` in `src/data.ts` and put thumbnails in `public/images/`. Each project has PT-BR/English summaries and details, tags, and an optional repository URL. Omit `repo` for private source. PacTTSClone uses captured UI previews on the landing page and shows the studio and speech controls on its project page. The Portuguese page includes the supplied Bob Esponja narration, and the English page includes the supplied Optimus Prime narration. Election Tracker uses a replay captured from the actual interface with nine archived national bulletins, three seconds per update, automatic chart zoom, and no reaction media. Its filled state map shows real final state results as a clearly labeled fixed reference: historical state snapshots were not archived. The full-dashboard replay appears on the landing page. Project details show both the full-dashboard and chart-focused GIFs, each with its own pause control and a static poster for reduced-motion preferences.

Contact links are in `Contact` in `src/App.tsx`. Email uses `mailto:`; it does not submit a form to a server. Google Fonts is optional: the site falls back to system fonts if it is unavailable. No analytics or tracking code is included.

### Résumé PDFs

The localized résumé pages use Markdown in `src/resumes/` and downloads in `public/resumes/`. After replacing either PDF, run `python3 scripts/link-resume-pdfs.py` (requires PyMuPDF) to add a clickable portfolio link to every page. The script is safe to run repeatedly. Keep the portfolio contact link in both Markdown sources when updating the résumé.

### LRCLIB lyrics experiment

The Experiments page lets visitors enter a song search and YouTube URL. It queries LRCLIB directly in the browser and ranks timed-lyrics results by their duration's distance from the embedded video, when YouTube exposes that duration. Visitors can choose another result and adjust lyric timing. Search results and lyrics are not saved or exported; the experiment is an interactive YouTube player, not an MP4 renderer. Some videos cannot be embedded, some songs lack timed lyrics, and LRCLIB or YouTube may be unavailable.

## Markdown panels and hover notes

Blog and music articles support normal Markdown plus expandable sections:

```markdown
:::panel More about this song
Write **Markdown**, lists, images and links inside this section.
:::
```

Sections start open, can collapse, and can expand into a larger reading dialog. Escape closes the dialog. Use one panel level (no nested panels). Keep the lyrics-player marker outside a panel.

For a text note that fades in on hover, keyboard focus or tap:

```markdown
This is a [word with context](#note "This explanation appears in a floating text box.").
```

Hover notes also accept full Markdown, paragraphs and balanced parentheses:

```markdown
[term](# **Bold explanation**, including (parentheses).

- A list item
- Another item)
```

For longer notes, use a reference:

```markdown
[term](#note-context)

:::note context
A **Markdown** explanation with paragraphs and lists.
:::
```

Keep reference definitions outside fenced code blocks. Notes fade in on hover/focus and can be scrolled or opened by tapping. Everything works on GitHub Pages without a backend.

Use `:::panel-collapsed Title` instead of `:::panel Title` for a section that starts collapsed. On desktop, a small supplied SVG hints at the first hover note once it reaches the middle 30% of the viewport. Hovering or focusing any note dismisses the hint and remembers that discovery in the visitor's browser.
