> Admin/API update: see [admin-api.md](admin-api.md). Once enabled, release builds use immutable `content_releases`; normalized tables below are preserved migration archives.

# Supabase content

Project: portfolio, São Paulo (`gsuagfvgtoyuwfljsusw`).

The database was seeded before changing the website build. Source commit:
`df8b3320535ef715ec3f779ab1a692e11e6892bd`.

Imported 21 posts, 40 localized articles (38 music, 2 blog), 20 players,
40 lyric tracks and 132 lyric notes. All 82 original Markdown/LRC/SRT files
are preserved verbatim in `private.source_files`, with SHA-256 hashes.
There are 21 initial revision snapshots. Original repository files remain intact.
`supabase/import-manifest.json` records every source path and hash.

## Build

`CONTENT_SOURCE=supabase npm run build` fetches published rows with the public
publishable key, writes lyric assets and uses the existing content validator,
renderer and prerenderer. GitHub Actions uses this mode. No privileged key is
present in the repository or browser. A failed fetch or invalid export fails the
build, leaving the existing deployment in place. Public reading stays static;
database changes appear after the next successful Pages build.

`npm run build` defaults to repository content for offline development and
rollback. Set `CONTENT_SOURCE=files` in Pages to return to the preserved source
snapshot. After new database edits, export the latest content before using this
rollback if those edits need to be retained.

`TEST_SUPABASE=1 node --test tests/supabase-content.test.mjs` checks initial
migration parity against the original files, including players and hover notes.
It is a migration check, not a permanent requirement that future database
content remain identical to the archived source.

## Access

RLS allows public reads only of published translations and their related data.
Only users explicitly added to `site_admins` can edit. No administrator account
has been invented or provisioned. After signing in with Supabase Auth, a trusted
project administrator must add the intended user's UUID to `site_admins` in the
SQL editor. Signup or authentication alone does not grant editing rights.

`private.source_files` deliberately has no client policies: it is an archival
backup accessible to the database owner only. The corresponding informational
advisor notice is expected. Revisions are administrator-only. A published
translation makes its post's shared lyric tracks public; draft-only posts and
all their player/track data are hidden.

Editing a published row affects the next build. Separate unpublished working
copies of published articles and an admin UI are future work.

## Schema and import

`supabase/schema.sql` is the exact initial hosted schema, recorded in hosted
migration history as `portfolio_content_schema`. Apply only to an empty target.
`node scripts/prepare-import.mjs` captures all original files, including drafts
and unreferenced lyric assets, and reports shared player metadata conflicts.
`node scripts/import-sql.mjs` prepares an atomic initial import transaction in
`/tmp/portfolio-import.sql`. Review conflicts before executing. These scripts
prepare SQL; they never connect to or overwrite a database themselves. Re-running
SQL against a populated database fails on uniqueness constraints and rolls back.

Verification completed: zero source hash mismatches, zero lyric mismatches,
zero article body/title/description mismatches; complete frontend content parity;
rolled-back draft fixtures were invisible under the anonymous database role.
