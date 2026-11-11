create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table private.source_files (path text primary key, content text not null, sha256 text not null, source_commit text not null);
create table public.site_admins (user_id uuid primary key references auth.users(id), created_at timestamptz not null default now());
create table public.posts (
 id uuid primary key default gen_random_uuid(), section text not null check(section in ('blog','music')),
 slug text not null check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), display_date date not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(section,slug));
create table public.post_translations (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
 locale text not null check(locale in ('pt-BR','en')), title text not null, description text not null,
 body_markdown text not null, tags text[] not null default '{}', credits text,
 status text not null default 'draft' check(status in ('draft','published','archived')), published_at timestamptz,
 extra_metadata jsonb not null default '{}', unique(post_id,locale));
create table public.post_players (
 id uuid primary key default gen_random_uuid(), post_id uuid not null unique references public.posts(id) on delete cascade,
 youtube_id text not null check(youtube_id ~ '^[a-zA-Z0-9_-]{11}$'), artist text, original_title text,
 original_language text, offset_ms integer not null default 0 check(offset_ms between -60000 and 60000),
 extra_metadata jsonb not null default '{}');
create table public.lyric_tracks (
 id uuid primary key default gen_random_uuid(), player_id uuid not null references public.post_players(id) on delete cascade,
 locale text not null, source_path text not null, lrc_text text not null, source_url text,
 updated_at timestamptz not null default now(), unique(player_id,locale));
create table public.lyric_notes (
 id uuid primary key default gen_random_uuid(), post_translation_id uuid not null references public.post_translations(id) on delete cascade,
 track_id uuid not null references public.lyric_tracks(id), time_ms integer not null check(time_ms>=0),
 selected_text text not null, occurrence integer not null default 1 check(occurrence>0),
 explanation_markdown text not null, sort_order integer not null, source_time text not null);
create table public.post_revisions (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.posts(id) on delete cascade,
 snapshot jsonb not null, created_by uuid references auth.users(id), created_at timestamptz not null default now());
create index translations_listing on public.post_translations(locale,status,post_id);
create index notes_translation on public.lyric_notes(post_translation_id);
create index notes_track on public.lyric_notes(track_id);
create index revisions_post on public.post_revisions(post_id);
create index revisions_author on public.post_revisions(created_by);
create index posts_date on public.posts(display_date desc,id);
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.site_admins where user_id=(select auth.uid()));
$$;
revoke all on function private.is_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;
create function private.touch_post() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at=now(); return new; end $$;
create trigger touch_post before update on public.posts for each row execute function private.touch_post();
create function private.validate_note() returns trigger language plpgsql set search_path = '' as $$
begin
 if not exists(select 1 from public.post_translations t join public.post_players p on p.post_id=t.post_id join public.lyric_tracks l on l.player_id=p.id where t.id=new.post_translation_id and l.id=new.track_id) then raise exception 'Note and track must belong to the same post'; end if;
 return new;
end $$;
create trigger validate_note before insert or update on public.lyric_notes for each row execute function private.validate_note();
alter table private.source_files enable row level security;

alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select on public.posts to anon, authenticated;
create policy published_read on public.posts for select to anon, authenticated using (exists(select 1 from public.post_translations t where t.post_id=posts.id and t.status='published'));
grant select, insert, update, delete on public.posts to authenticated;
create policy admin_manage on public.posts for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.post_translations enable row level security;
revoke all on public.post_translations from anon, authenticated;
grant select on public.post_translations to anon, authenticated;
create policy published_read on public.post_translations for select to anon, authenticated using (status='published');
grant select, insert, update, delete on public.post_translations to authenticated;
create policy admin_manage on public.post_translations for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.post_players enable row level security;
revoke all on public.post_players from anon, authenticated;
grant select on public.post_players to anon, authenticated;
create policy published_read on public.post_players for select to anon, authenticated using (exists(select 1 from public.post_translations t where t.post_id=post_players.post_id and t.status='published'));
grant select, insert, update, delete on public.post_players to authenticated;
create policy admin_manage on public.post_players for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.lyric_tracks enable row level security;
revoke all on public.lyric_tracks from anon, authenticated;
grant select on public.lyric_tracks to anon, authenticated;
create policy published_read on public.lyric_tracks for select to anon, authenticated using (exists(select 1 from public.post_players p join public.post_translations t on t.post_id=p.post_id where p.id=lyric_tracks.player_id and t.status='published'));
grant select, insert, update, delete on public.lyric_tracks to authenticated;
create policy admin_manage on public.lyric_tracks for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.lyric_notes enable row level security;
revoke all on public.lyric_notes from anon, authenticated;
grant select on public.lyric_notes to anon, authenticated;
create policy published_read on public.lyric_notes for select to anon, authenticated using (exists(select 1 from public.post_translations t where t.id=lyric_notes.post_translation_id and t.status='published'));
grant select, insert, update, delete on public.lyric_notes to authenticated;
create policy admin_manage on public.lyric_notes for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.post_revisions enable row level security;
revoke all on public.post_revisions from anon, authenticated;
grant select, insert, update, delete on public.post_revisions to authenticated;
create policy admin_manage on public.post_revisions for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;
grant select on public.site_admins to authenticated;
create policy own_admin on public.site_admins for select to authenticated using(user_id=(select auth.uid()));
