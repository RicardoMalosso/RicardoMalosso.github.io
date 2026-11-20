# Adding a music post

Use this recipe for “create a new post for this YouTube video”. Read this guide once; it contains the template and supported syntax. Read one existing post only if needed: `cais.en.md` for a minimal page or `construcao.en.md` for article formatting, both under `content/music/`. Read implementation files (`.ts`, `.tsx`, `.mjs`) only to diagnose a failure or implement new behavior. Avoid repeated repository scans and unrelated research.

## Inputs and defaults

- **YouTube link only:** identify artist, song title, and duration; fetch synchronized lyrics from LRCLIB; translate to the other language; create the page.
- **Link + one LRC:** preserve it and translate its text, keeping timestamps identical.
- **Link + both LRCs:** use them directly after checking their language and alignment.
- **Article supplied:** use it as the body, editing only as requested. If none is supplied, write a brief, factual introduction and use the body pattern below. Do not invent personal experiences.

Default to English and Portuguese pages unless a specific locale is requested. Both pages use the same two LRC files. English titles must include both original and translated titles: `Construção (Construction) — Chico Buarque`. For an English original, include its Portuguese title translation. Preserve existing slugs and dates when updating a post.

## Body pattern for context-heavy music posts

Use this order:

1. **Introduction:** one concise paragraph with the essential context. For a reaction-oriented post, identify the artist or group and explain why the song matters to the setting or story.
2. **Player:** put `<!-- lyrics-player -->` on its own line immediately after the introduction.
3. **Context paragraphs:** write a few short paragraphs in a natural order. Explain the place, people, circumstances, or lyrics only where they help someone understand the song. Weave facts into the prose instead of making a data table, fact dump, or academic essay.
4. **Optional ending:** add a short song/narrative explanation when useful, then optional further reading, then sources.

Keep the post brief and useful to someone reacting to the song. Use headings only when they help navigation. Keep essential comparisons in the main text; move only supplementary detail into a collapsed panel. Do not add a separate section just to hold facts that fit naturally into a paragraph. Put citations and source links at the end in the compact `:::sources` block shown below; do not pepper the prose with citation markers.

## Fetch missing lyrics

Identify the song from the actual YouTube recording; the uploader is not necessarily the artist. Normalize its URL to `https://www.youtube.com/watch?v=VIDEO_ID`.

Query LRCLIB with URL-encoded values:

```text
https://lrclib.net/api/get?artist_name=ARTIST&track_name=TITLE&duration=SECONDS
```

If no suitable result is returned, search:

```text
https://lrclib.net/api/search?track_name=TITLE&artist_name=ARTIST
```

Album is optional. Select a matching recording with nonempty `syncedLyrics`. Save that decoded string as UTF-8 LRC, not JSON. `plainLyrics` has no timing. Video intros/outros and live versions can affect the duration match; check synchronization near the beginning, middle, and end. If no suitable timed lyrics exist, report that and request an LRC; never invent timestamps. Honor API retry instructions. Reference: https://lrclib.net/docs

Each file contains only its own language. Translate faithfully, preserving cue order, repetition, and every timestamp. Example: `[00:12.34]Lyric text`. The current parser ignores `[offset:...]` metadata. Save assets locally; published posts need no LRCLIB requests.

## Files and complete template

Create `content/music/<slug>.en.md` and, when applicable, `<slug>.pt-br.md`. Put lyrics at `public/lyrics/<slug>/en.lrc` and `public/lyrics/<slug>/pt-br.lrc`.

```markdown
---
title: "Original Title (English Title) — Artist"
description: "Artist — Original Title, with synchronized Portuguese and English lyrics."
slug: "song-slug"
locale: "en"
date: "YYYY-MM-DD"
tags: ["Lyrics"]
draft: false
artist: "Artist"
originalLanguage: "pt-BR"
player:
  youtubeUrl: "https://www.youtube.com/watch?v=VIDEO_ID"
  subtitles:
    en: "lyrics/song-slug/en.lrc"
    pt-br: "lyrics/song-slug/pt-br.lrc"
---
Original Title by Artist, with Portuguese lyrics and an English translation.

<!-- lyrics-player -->
```

Replace all placeholders. For Portuguese, localize title, description, body, and tags as appropriate; set `locale: "pt-br"`. Keep slug, date, video, and lyric paths shared.

- Required fields: `title`, `description`, `slug`, `locale`, and quoted publication `date`. Use today's Brazilian date for a new post unless specified.
- Slugs use lowercase ASCII letters/numbers and hyphens. Routes are `/<locale>/music/<slug>/`; no manual route registration is needed.
- `description` appears in the header, listing, and SEO metadata. Keep it concise.
- `tags` drive visible labels and filters. Reuse relevant existing spelling/capitalization, e.g. `MPB`, `Lyrics`, `Brazilian music`.
- `artist` displays the performer. `originalLanguage` records the source language; it does not change the player's supported EN/PT pair.
- Optional `credits: "Verified songwriting, performance, or translation credits."` displays plain text after the player/article.
- `draft: true` excludes the page from publication. Both subtitle paths must exist, relative to `public/`, without a leading slash.
- Use one player marker, outside panels/notes/code. Without it, the player follows the body. Existing controls and responsive styling apply automatically.
- Optional `player.offsetMs` sets the starting lyrics timing offset in milliseconds (integer, from -60000 to 60000; default `0`). Positive values display lyrics later than the video's playback, negative values earlier. Put it alongside `youtubeUrl` when a recording needs adjustment, in both locale posts (e.g. `offsetMs: 1000` delays the lyrics by one second). Viewers can still adjust timing manually; **Reset** restores this configured default. Do not modify LRC timestamps to achieve a per-recording sync adjustment.
- Legacy inline `lyrics` metadata is unnecessary for normal new posts. There are no supported per-post cover or player-layout fields; don't invent them.

## Article formatting, only when needed

Use normal Markdown: `##` headings, emphasis, lists, tables, links, images, and code. Raw HTML is disabled.

Short mouseover:

```markdown
A [term](#note "Short explanation.").
A [term](# An explanation with **Markdown** and (balanced parentheses)).
```

Long mouseover:

```markdown
A [term](#note-context).

:::note context
A **Markdown** explanation, with paragraphs or lists.
:::
```

Use unique note IDs. Keep the reference and definition on the same side of the player marker. Define notes outside panels. Inline `(# ...)` syntax requires whitespace after `#` and balanced parentheses. Dotted underlines, positioning, keyboard/tap behavior, and the desktop arrow hint are automatic.

Compact sources section (small font, visible by default):

```markdown
:::sources
### Sources

- [Statistical source](https://example.org) — what it supports.
:::
```

Collapsed supplementary section:

```markdown
:::panel-collapsed More about this song
Additional **Markdown** content.
:::
```

Use `:::panel Title` to start open. Do not nest panels or place the player inside one. The expand dialog is automatic.

Images belong in `public/images/`, referenced as `![Useful alt text](/images/file.ext)`. Internal links include the base and locale: `[Related song](/en/music/apesar-de-voce/)`. Add sources, related songs, or contextual sections only when supplied or requested.

## Validate

Run `npm run build` then `npm test` with dependencies installed. Check both requested routes, titles, lyric languages/timing, and any formatting used. Inspect the diff for placeholders and unrelated edits. Do not modify player code for ordinary content additions.

During development, run `npm run content` or restart `npm run dev` after Markdown edits. Never edit generated JSON or `dist/` directly. Commit source Markdown and lyrics; follow the user's publishing instructions. Summarize changed pages and checks briefly.

Optional lyric mouseovers: add a top-level `lyricNotes` array with `time: "00:24.57"`, `language: "en"` (or `pt-br`), exact `text: "Eating"`, and `explanation: "Your note"`. Use the original LRC timestamp. Repeat in each localized post; keep multiple notes on a cue in text order. LRC files remain plain text.

The player’s “Fullscreen with lyrics” control expands the video with a compact bilingual lyric overlay. YouTube’s iframe fullscreen button is disabled so lyrics remain visible. Exit via the page control or the browser’s fullscreen exit; the normal lyric layout is preserved. This requires browser support for element fullscreen.
