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

Publishing is complete only after the requested release is deployed and verified.
Creating a database snapshot or returning a queued job is not completion. When the
user asks to publish content, carry the deployment through before ending the task.

1. Validate and publish the document, retaining the immutable release ID.
2. Trigger **Build and deploy GitHub Pages** on main. Use workflow dispatch when
   available. If the connector lacks dispatch and the CLI is unauthenticated,
   use the connected GitHub tools to rerun the latest eligible workflow's build
   job; its publication-selection step fetches the current release and its
   dependent deploy job runs afterward. Check the workflow revision first.
   Do not rerun only the deploy job: that can redeploy an old artifact.
3. Follow build, tests and deployment to completion. Investigate failures rather
   than leaving the publication queued.
4. Fetch live `publication.json` with a cache-busting query and verify that its ID
   matches the requested release. Check both localized pages and music listings
   for new music. If a newer release superseded it, verify that release still
   contains the requested content.
5. Return the live page links. If blocked, state the specific blocker and what
   actually completed; never call a queued publication deployed.

The scheduled workflow is a fallback only. Its five-minute cron expression is
not a delivery guarantee: observed GitHub delays were several hours. The admin
API can dispatch immediately only when `PORTFOLIO_GITHUB_TOKEN` is configured;
without it, publishing through the panel remains scheduled. Direct SQL publication
does not call the Edge Function's dispatch helper and always needs an explicit
deployment trigger. Do not promise automatic immediate deployment without testing
that path.

Frontend PR builds never deploy. Keep prior content snapshots and source archives.
