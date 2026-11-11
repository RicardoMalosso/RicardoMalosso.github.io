# Admin panel and publishing API

## Local development (Windows PowerShell)

Work on `feat/admin-api`, with Node 24 installed:

```powershell
npm ci
npm run dev
```

Open http://localhost:5173/admin/. The site content defaults to preserved files for
local work. The admin panel connects to the hosted Supabase backend. Add
`http://localhost:5173/admin/` to Supabase Authentication → URL Configuration →
Redirect URLs before testing Google login locally. For production keep
`https://ricardomalosso.github.io/admin/` allowed. Google itself always redirects to
`https://gsuagfvgtoyuwfljsusw.supabase.co/auth/v1/callback`.

The Google provider is enabled. Successful first login with the provider-verified
email `ricardomalosso@gmail.com` binds its Supabase UUID as the only owner. No user
can self-grant access using editable profile fields. An owner removed from
`site_admins` stays denied and does not automatically regain access. The owner
binding must only be changed through trusted database administration.

The working branch is not production until merged. The hosted API/migration can be
prepared independently; publishing a release on this branch will not update Pages
until the release-based workflow reaches main. For local release builds:

```powershell
$env:CONTENT_SOURCE = 'release'
npm run build
npm test
npm run preview
```

Remove the override using `Remove-Item Env:CONTENT_SOURCE` to return to file mode.

## API

Base URL: `https://gsuagfvgtoyuwfljsusw.supabase.co/functions/v1/publishing-api/v1`

The panel uses the current Supabase access token. External scripts use a personal
token generated under **api access**. Send `Authorization: Bearer <token>`.
The public Supabase publishable key alone grants no admin rights.
Token scopes are `posts:read`, `posts:write`, `posts:publish`. Expiry is 1–365 days;
token management requires a Google session, so a personal token cannot mint others.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/me` | Verify interactive owner session |
| GET / POST | `/posts` | List / create a draft |
| GET / PATCH | `/posts/{id}` | Read / save complete draft document |
| POST | `/posts/{id}/validate` | Validate saved content |
| POST | `/posts/{id}/publish` | Freeze published content and queue deployment |
| POST | `/posts/{id}/archive` | Exclude post from the next snapshot |
| GET | `/posts/{id}/history` | Read revisions |
| POST | `/posts/{id}/restore` | Restore historical content into a new draft |
| GET | `/publications/{id}` | Compare job to live deployment marker |
| POST | `/publications/{id}/retry` | Retry dispatch, or report scheduled mode |
| GET / POST | `/tokens` | List / create tokens (interactive login only) |
| DELETE | `/tokens/{id}` | Revoke a token immediately |

Create, publish and archive require an `Idempotency-Key` header (8–128 characters).
Repeat the exact request with the same key after an uncertain network result.
Reusing a key for different content returns a conflict. PATCH, restore, publish and
archive require the current `revision`; stale writes return HTTP 409.

Example create body (the route/locale names preserve the existing renderer format):

```json
{
  "document": {
    "section": "blog",
    "slug": "my-new-post",
    "entries": [{
      "section": "blog",
      "slug": "my-new-post",
      "locale": "en",
      "date": "2026-11-11",
      "title": "My new post",
      "description": "A short summary.",
      "body": "Article in **Markdown**.",
      "tags": ["Development"]
    }],
    "assets": {}
  }
}
```

Add a second entry with locale `pt-br` for Portuguese. Each document is the complete
post; PATCH replaces the document, not individual fields. For music use section
`music`; each entry can include `artist`, `originalLanguage`, `credits`, `player`
and `lyricNotes`. The player has `youtubeUrl`, `offsetMs`, and
`subtitles: {"en":"lyrics/song/en.lrc","pt-br":"lyrics/song/pt-br.lrc"}`.
Put each LRC's UTF-8 text in `assets` under its path. Notes use `time`, `language`,
`text`, `explanation` and are validated against the corresponding LRC cue.
GET an existing music post for a complete working example. The payload is limited
to 1.5 million characters. Raw HTML remains disabled by the renderer.

Example shell invocation (store the token in your own environment):

```sh
curl "$PORTFOLIO_API/posts" \
  -H "Authorization: Bearer $PORTFOLIO_API_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: create-my-post-001' \
  --data-binary @post.json
```

Publish the returned ID with `{"revision":1}` and a new idempotency key. Restore
uses `{"revision":3,"restore_revision":1}`. Validation errors return 422; missing
or invalid sessions return 401; disallowed identities/scopes return 403.

## Publication architecture

`private.editor_documents` holds working and published copies; revisions, tokens,
owner binding, audit events and jobs are private. Every publication atomically
creates an immutable `public.content_releases` snapshot of all published documents.
Saving drafts never changes a public snapshot. Old published snapshots remain
public historical content; archiving removes a post from future deployments and
is not a confidential-data erasure operation. The original 82 source files and old
normalized content tables remain available as migration archives.

GitHub Actions checks the latest release on a five-minute schedule and skips the
build when its ID already matches the deployed marker. It pins the chosen ID for
the whole build. Failed builds leave the previous deployment online. GitHub may
delay scheduled runs or disable them after repository inactivity. Recovery: run
**Build and deploy GitHub Pages** manually in Actions. Optional `publication_id`
selects a specific published snapshot; leave blank to choose latest.

No separate GitHub secret is required. Optionally configure an Actions-write,
repository-scoped token as the Edge Function secret `PORTFOLIO_GITHUB_TOKEN` for
immediate workflow dispatch. Otherwise the API returns queued/scheduled. Publication
status uses the live `publication.json`; a newer deployed release marks older jobs
superseded, never falsely live. GitHub Actions is linked for detailed failure logs.

## Deploying / maintaining the backend

Apply `supabase/migrations/20261111034436_admin_publishing.sql` once. The API uses
Supabase-provided server environment variables. Deploy `publishing-api` including
`validation.mjs`, with gateway JWT verification disabled because the handler
performs its own session/PAT authentication before every route. Missing, forged,
expired and unscoped tokens must be rejected. CORS allows only production and the
explicit localhost origin; CORS is not used as authorization.

`node scripts/editor-seed.mjs` prepares an initial seed from the old normalized
content; it does not execute SQL. Its output uses the OS temporary directory.
Never rerun the seed against populated editor tables. Run database tests using
PGlite (`npm test`): these use isolated fake identities, never production users.
The production archive/private-table informational RLS advisories are intentional:
no browser grants or policies exist; only service-role API commands access them.
