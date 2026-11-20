# Admin panel and publishing API

## Local development (Windows PowerShell)

Use Node 24 on a branch based on current `main`.

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

Local admin actions use the hosted database. To preview a published snapshot locally:

```powershell
$env:CONTENT_SOURCE = 'release'
npm run build
npm test
npm run preview
```

Remove the override using `Remove-Item Env:CONTENT_SOURCE` to return to file mode.

## Publish or update a post

In the [content studio](https://ricardomalosso.github.io/admin/), create or select a post, save the draft, then select **publish** when publication is requested. For scripts, use the authenticated endpoints below.

1. **Create** with `POST /posts` and a complete document. **Update** by finding the section and slug in `GET /posts`, then reading `GET /posts/{id}`. Edit the returned working document and send `PATCH /posts/{id}` with `{document, revision}`. Preserve other edits, locales, notes and lyric assets. On HTTP 409, reread and reapply your change.
2. Use `POST /posts/{id}/validate` and check that `errors` is empty. A saved draft is private. To publish, send `POST /posts/{id}/publish` with the revision returned by the save. Use a fresh idempotency key for each create or publish operation and reuse that key when retrying the same request.
3. Keep the release ID returned by publish. Using the public Supabase API, call `content_manifest({known_id: null})`, check the requested locales, then call `content_document({release_id, post_section, post_slug})` with that manifest's ID. Verify the edited fields and any affected lyrics against the request. If a later release is current, verify the change in that release.
4. Reload the public article and check the edited text. For a new song, also check both language listings and links. GitHub Pages refreshes static HTML, social previews and the sitemap hourly. Trigger a Pages build only if an immediate static refresh is required. A new direct URL can render in the browser while still returning HTTP 404 until that refresh.

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
| POST | `/posts/{id}/publish` | Commit a published release |
| POST | `/posts/{id}/archive` | Exclude post from the next snapshot |
| GET | `/posts/{id}/history` | Read revisions |
| POST | `/posts/{id}/restore` | Restore historical content into a new draft |
| GET | `/publications/{id}` | Check whether the release is current or superseded |
| POST | `/publications/{id}/retry` | Explicitly request a static refresh, or report scheduled mode |
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

Publish and archive return HTTP 200 once the database commits. Readers check the
release manifest on page load and navigation. GitHub Actions checks the release ID
hourly and batches static HTML, link previews and sitemap updates. To refresh HTML
immediately, run **Build and deploy GitHub Pages** on main. Existing API clients may
also request an explicit static refresh with the retry endpoint when the optional
GitHub dispatch token is configured.

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
