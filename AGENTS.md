# Repository instructions

## GitHub and branches

Repository: `RicardoMalosso/RicardoMalosso.github.io`; production is GitHub Pages at
https://ricardomalosso.github.io/. Prefer connected GitHub tools for remote reads,
commits, PRs and workflow checks. Fetch current refs and inspect commits before
editing. Preserve other people's fixes. Base new work on current `main`;
do not merge or deploy the frontend until the user requests it.

## Database access and content

Supabase project: `portfolio`, ref `gsuagfvgtoyuwfljsusw`, region `sa-east-1`.
Use the connected Supabase tools for authorized SQL, migrations, function deployment
and advisors. Inspect live tables before schema changes. SQL runs on the database
server; local files must be read locally and sent as data. See
[Supabase content](docs/supabase-content.md) and [admin/API guide](docs/admin-api.md).

Published content originates in Supabase. Repository Markdown and lyric files are
preserved migration/rollback fixtures, not the current editing source. With the
admin migration, working documents/revisions live in `private`; immutable published
snapshots live in `public.content_releases`. Do not edit the old normalized tables
expecting the release-based build to change. Never rerun initial imports on a
populated database. Preserve every locale, timestamp, note, slug and music asset.

Before creating or editing music content, read [docs/music-posts.md](docs/music-posts.md)
for supported formatting, then use the admin API document format. For
context-heavy music posts, use the latest [Racionais post](https://ricardomalosso.github.io/en/music/to-ouvindo-alguem-me-chamar/)
as the layout example: a concise introduction, then the player, then short paragraphs
that weave in relevant details. End with optional further reading and compact sources.

## Authentication and secrets

Only the verified Google identity `ricardomalosso@gmail.com` may bootstrap the owner;
its UUID is then bound permanently. Server authorization must check this binding on
every session/token request. Never authorize with editable `user_metadata` or a
browser-only email check. Browser publishable keys are intentionally public.
Service-role keys, OAuth client secrets and optional GitHub tokens must never enter
source, logs, chat, or generated assets. Personal API tokens are shown once and
stored only as hashes. Token management requires an interactive Google session.

## Validation and publishing

Use Node 24 and `npm ci`. `npm run dev` starts the local portfolio/admin interface;
see the admin guide for the exact OAuth localhost redirect and backend configuration.
Run `npm run build` and `npm test` after code changes. Test a cloud publication with
`CONTENT_SOURCE=release npm run build` (PowerShell: set `$env:CONTENT_SOURCE` first).
The build pins a single release so related post/lyric records cannot drift mid-build.
Tests must use generated entries for live routes and portable temporary directories.

For new posts and edits, follow [Publish or update a post](docs/admin-api.md#publish-or-update-a-post). Fetch the current draft before editing, save the complete document with its revision, validate, then publish when requested. Archive through the owner API. Verify the latest public content_manifest and
content_document RPCs, including localized entries and lyric assets. The live browser
refreshes from those RPCs. A Pages build is unnecessary for a content correction.
New URLs gain static HTTP 200 responses, social metadata and sitemap entries at the
next hourly snapshot refresh. Run the Pages workflow explicitly if these are needed
immediately. Frontend releases still require a Pages deployment.
