-- Read published snapshots only. No draft access, write privileges or definer functions.
-- The existing content_releases RLS policy remains the authorization boundary.
create function public.content_manifest(known_id uuid default null)
returns jsonb language sql stable security invoker set search_path = '' as $$
  with latest as (
    select id, created_at, documents from public.content_releases
    order by created_at desc, id desc limit 1
  )
  select jsonb_build_object('id', id, 'created_at', created_at) ||
    case when id = known_id then jsonb_build_object('unchanged', true)
    else jsonb_build_object('entries', coalesce((
      select jsonb_agg(
        (e - array['body','lyrics','lyricNotes','player','credits']) || jsonb_build_object('body', '')
        order by e->>'date' desc, e->>'section', e->>'slug', e->>'locale'
      ) from jsonb_array_elements(documents) d
      cross join lateral jsonb_array_elements(d->'entries') e
    ), '[]'::jsonb)) end
  from latest;
$$;

create function public.content_document(release_id uuid, post_section text, post_slug text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select d from public.content_releases r
  cross join lateral jsonb_array_elements(r.documents) d
  where r.id = release_id and post_section in ('blog','music')
    and d->>'section' = post_section and d->>'slug' = post_slug
  limit 1;
$$;

-- Search body text on the server without transferring every article/lyric to the browser.
-- Return both locales; the UI applies its existing translation-fallback policy.
create function public.content_search(release_id uuid, post_section text, search_query text)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg((e->>'locale') || '/' || (e->>'section') || '/' || (e->>'slug')), '[]'::jsonb)
  from public.content_releases r
  cross join lateral jsonb_array_elements(r.documents) d
  cross join lateral jsonb_array_elements(d->'entries') e
  where r.id = release_id and post_section in ('blog','music') and e->>'section' = post_section
    and length(search_query) between 1 and 200
    and strpos(lower(concat_ws(' ', e->>'title', e->>'description', e->>'body', e->>'tags')), lower(search_query)) > 0;
$$;

revoke all on function public.content_manifest(uuid), public.content_document(uuid,text,text), public.content_search(uuid,text,text) from public, anon, authenticated;
grant execute on function public.content_manifest(uuid), public.content_document(uuid,text,text), public.content_search(uuid,text,text) to anon, authenticated, service_role;
