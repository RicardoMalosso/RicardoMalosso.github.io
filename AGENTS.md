# Repository instructions

## GitHub and branches

Repository: `RicardoMalosso/RicardoMalosso.github.io`; production is GitHub Pages at
https://ricardomalosso.github.io/. Prefer connected GitHub tools for remote reads,
commits, PRs and workflow checks. Fetch current refs and inspect commits before
editing. Preserve other people's fixes. Admin/API work is on `feat/admin-api`;
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
for supported formatting, then use the admin API document format. That older recipe's
file-edit steps apply only to fixtures/offline content, not live publication.

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

Publishing commits a snapshot and queues Pages. Once the workflow is on main it
checks for new releases approximately every five minutes. Scheduled runs may be
delayed/disabled by GitHub; manual workflow dispatch is the recovery path. Database
success is not deployment success: verify the live `publication.json` release ID.
Frontend PR builds never deploy. Keep prior content snapshots and source archives.
