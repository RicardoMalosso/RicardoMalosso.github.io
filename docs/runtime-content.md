# Runtime content experiment

Branch: `feat/supabase-runtime-content`. This is an opt-in experiment. It does not
change production hosting, publish test documents, apply a hosted migration, or
enable runtime reads on the deployed site.

## Behavior

The deployed HTML and generated content remain the immediate first render. React
hydrates that exact snapshot before contacting the database. With
`VITE_RUNTIME_CONTENT=true`, the application checks a compact publication manifest
at mount, navigation, focus or reconnection, at most once per minute. There is no
timer, Realtime subscription or complete-release download in the browser.

Music pages also render both lyric columns into the initial HTML. Their two lyric
assets are embedded as escaped inert JSON and reused for hydration. This makes the
lyrics available to no-JavaScript readers and crawlers and removes two initial LRC
requests. Only the current page's lyrics are embedded; other pages are loaded when
visited. Runtime publications still replace an article and both lyric assets as one
versioned document.

The server returns only the version when unchanged. For a newer version it returns
route/listing metadata, excluding article bodies, players, notes and lyrics. An
article fetch then requests one immutable document, pinned to that version. Both
translations, notes, player configuration and lyric texts are installed together.
The player uses those texts directly; a newly published song never requests lyric
paths that do not exist in the deployed site. Language switches reuse the document.

Metadata, language links, music/blog lists and recent blog posts use the current
manifest. Body search runs on the server with a 250 ms debounce and returns only
matching route keys. Local title/description filtering still works during outages.
Full-body search of newly published content requires the API to be available.

In-flight reads are deduplicated and responses from superseded versions are ignored.
Up to eight fetched documents are persisted in browser storage under their release
ID. Invalid JSON, disabled storage, quota failures and API timeouts are handled
without breaking the static fallback. A confirmed archive removes the article from
the runtime interface; subsequent API errors do not resurrect it from that fallback.
An unavailable API cannot reveal an archive that the browser has never learned about.
Previously deployed copies remain public until the next static deployment.

## Database changes

The additive migration `20261114074736_runtime_content_reads.sql` provides three
read-only RPCs: `content_manifest`, `content_document` and `content_search`. All use
`SECURITY INVOKER`, an empty search path and explicit execute grants. They read only
`public.content_releases` under its existing RLS policy. They neither access private
working documents nor modify publication/authentication state.

The experiment uses the current release format deliberately. The manifest has all
listing metadata, not paginated metadata. Search scans the selected release on the
server. This suits the present small portfolio but is not a claim of unbounded
scale. Measure metadata payload and query time before introducing pagination or a
separate indexed published-content projection. Full snapshot duplication in the
existing publisher is also unchanged: document deduplication/history retention
requires a separate, compatibility-tested migration. Never delete source archives
or historical releases just to reduce storage.

## GitHub Pages limits

Existing pages retain their HTML, canonical URLs, hreflang, descriptions and sitemap.
Unknown direct URLs use the existing Pages 404 shell and can display fetched
content. **The HTTP response is still 404 until Pages deploys a generated file.**
Runtime JavaScript does not fix that status or provide initial social-preview tags.
The background static build and deployment remain necessary for new route indexing,
current link previews, sitemap changes and no-JavaScript readers. This experiment
does not promise immediate search-engine indexing or remove the existing publishing
workflow. The scheduled workflow still has no guaranteed delivery time.

## Reproduce locally

Use Node 24 and `npm ci`. The normal `npm run build && npm test` keeps runtime reads
disabled. For a build based on the current published content:

```sh
CONTENT_SOURCE=release VITE_RUNTIME_CONTENT=true npm run build
npm test
```

The hosted RPC migration must exist before this configuration can fetch runtime
updates. Without it the site falls back to the deployed snapshot; this is not proof
that runtime mode is working.

For fully isolated testing without applying that migration to production:

```sh
CONTENT_SOURCE=release VITE_RUNTIME_CONTENT=true VITE_CONTENT_API_URL=/__runtime-test npm run build
node scripts/runtime-preview.mjs
```

The preview reconstructs published documents from the generated snapshot and lyric
files, adds a synthetic `runtime-song`, and serves the exact RPC SQL through an
in-memory PGlite database under the anonymous role. It emulates Pages' HTTP 404 for
missing files. It never writes to Supabase. Open
`http://localhost:5173/en/music/runtime-song/`, switch languages, search for
`solidarity`, and check both lyric columns. A POST to
`http://localhost:5173/__runtime-test/offline` toggles the simulated API outage.
This server and its control endpoint are development tools, not deployable services.

PowerShell equivalents: set `$env:CONTENT_SOURCE='release'`,
`$env:VITE_RUNTIME_CONTENT='true'`, and optionally
`$env:VITE_CONTENT_API_URL='/__runtime-test'` before building. Remove those variables
afterward. The API URL override is public configuration, not a place for secrets.

Browser automation:

```sh
npx playwright install chromium
CONTENT_SOURCE=release npm run test:runtime-browser
```

The runner builds with runtime mode enabled, starts a temporary Pages emulator and
intercepts the public RPC requests with deterministic published fixtures. Database
authorization and SQL are exercised separately with PGlite by `npm test`.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` can select a preinstalled Chromium executable.
The dedicated **Test runtime content** PR workflow runs browser and unit/database
tests with both offline repository fixtures and the current public release. The
release variant uses only the public publishable key already in the repository;
neither variant has deployment or privileged database credentials. The
unchanged-build browser case runs in the release variant; files mode has no release
ID and explicitly skips that one case.

`node scripts/verify-runtime-release.mjs` additionally fetches the current public
release read-only and runs every document through the proposed SQL and runtime
validator in an isolated database. It reports payload sizes without changing hosted
tables. The first check covered 24 documents, 46 translations and 46 lyric assets:
194,144 bytes for the whole release, 15,967 bytes for the listing manifest, 110 bytes
for an unchanged-version response, and at most 26,226 bytes for one document. These
are JSON payload sizes, not measured end-to-end latency or compressed transfer sizes.

## Activation after review

1. Pass file-source and current-release builds, SQL isolation tests and browser CI.
2. Review payload sizes and limitations above. Preserve current database history.
3. Apply the additive hosted RPC migration and run anonymous read/write-denial checks.
4. Enable `VITE_RUNTIME_CONTENT=true` in the frontend build and deploy the approved
   code once. Never deploy `VITE_CONTENT_API_URL=/__runtime-test`.
5. Publish through the existing owner-only API; confirm runtime visibility before
   the background static deployment, then verify static metadata/status afterward.

Rollback: rebuild with runtime mode disabled. The existing static publishing path
is preserved; the read-only RPC migration can remain unused.
