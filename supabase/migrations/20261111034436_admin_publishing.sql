-- API-only working documents. Existing normalized tables remain a migration archive.
create table private.owner_binding(singleton boolean primary key default true check(singleton), user_id uuid unique references auth.users(id));
insert into private.owner_binding(singleton) values(true);
create table private.editor_documents(id uuid primary key default gen_random_uuid(), document jsonb not null, revision integer not null default 1, published_document jsonb, updated_at timestamptz not null default now());
create unique index editor_document_route on private.editor_documents((document->>'section'),(document->>'slug'));
create table private.editor_revisions(id uuid primary key default gen_random_uuid(), document_id uuid not null references private.editor_documents(id), revision integer not null, document jsonb not null, created_at timestamptz not null default now(), unique(document_id,revision));
create table private.api_tokens(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), name text not null, token_hash text not null unique, scopes text[] not null, expires_at timestamptz not null, revoked_at timestamptz, last_used_at timestamptz, created_at timestamptz not null default now());
create table private.audit_events(id bigint generated always as identity primary key, user_id uuid, action text not null, target_id uuid, created_at timestamptz not null default now());
create table public.content_releases(id uuid primary key default gen_random_uuid(), documents jsonb not null, created_at timestamptz not null default now());
create table private.api_requests(user_id uuid not null, request_key text not null, request jsonb not null, response jsonb not null, primary key(user_id,request_key));
alter table private.api_requests enable row level security;
create table private.publication_jobs(id uuid primary key references public.content_releases(id), user_id uuid, idempotency_key text not null unique, request jsonb not null, created_at timestamptz not null default now());
create index editor_revisions_document on private.editor_revisions(document_id);
create index api_tokens_owner on private.api_tokens(user_id);
create index content_releases_time on public.content_releases(created_at desc,id);
alter table public.content_releases enable row level security;
revoke all on public.content_releases from anon,authenticated;
grant select on public.content_releases to anon,authenticated;
create policy published_releases on public.content_releases for select to anon,authenticated using(true);
-- Default deny: private tables have no browser grants or policies.
alter table private.owner_binding enable row level security;
alter table private.editor_documents enable row level security;
alter table private.editor_revisions enable row level security;
alter table private.api_tokens enable row level security;
alter table private.audit_events enable row level security;
alter table private.publication_jobs enable row level security;
create function private.verified_owner(actor uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from auth.identities i join auth.users u on u.id=i.user_id where i.user_id=actor and i.provider='google' and lower(i.identity_data->>'email')='ricardomalosso@gmail.com' and i.identity_data->>'email_verified'='true' and lower(u.email)='ricardomalosso@gmail.com' and u.email_confirmed_at is not null); $$;
revoke all on function private.verified_owner(uuid) from public,anon,authenticated;
grant execute on function private.verified_owner(uuid) to service_role;
create function public.editor_identity(actor uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare bound uuid;
begin
 if not private.verified_owner(actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 select user_id into bound from private.owner_binding where singleton for update;
 if bound is null then update private.owner_binding set user_id=actor where singleton; insert into public.site_admins(user_id) values(actor) on conflict do nothing;
 elsif bound<>actor or not exists(select 1 from public.site_admins where user_id=actor) then raise exception 'Forbidden' using errcode='42501'; end if;
 return jsonb_build_object('id',actor,'email','ricardomalosso@gmail.com');
end $$;
create function public.editor_token_resolve(hash text, required_scope text) returns uuid language plpgsql security invoker set search_path='' as $$
declare t private.api_tokens;
begin
 select * into t from private.api_tokens where token_hash=hash and revoked_at is null and expires_at>now() and required_scope=any(scopes);
 if t.id is null then raise exception 'Invalid or insufficient token' using errcode='42501'; end if;
 perform public.editor_identity(t.user_id);
 update private.api_tokens set last_used_at=now() where id=t.id;
 return t.user_id;
end $$;
create function public.editor_command(actor uuid, command text, payload jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare d private.editor_documents; result jsonb; target uuid; release_id uuid; existing private.publication_jobs; previous private.api_requests;
begin
 perform public.editor_identity(actor);
 payload=payload || jsonb_build_object('action',command);
 if command='create' then
 if length(coalesce(payload->>'idempotency_key',''))<8 then raise exception 'Idempotency-Key required'; end if;
 perform pg_advisory_xact_lock(71304722);
 select * into previous from private.api_requests where user_id=actor and request_key=payload->>'idempotency_key';
 if previous.user_id is not null then
 if previous.request<>payload then raise exception 'Idempotency conflict' using errcode='40001'; end if;
 return previous.response; end if; end if;
 target=nullif(payload->>'id','')::uuid;
 if command='list' then select coalesce(jsonb_agg(jsonb_build_object('id',id,'revision',revision,'section',document->>'section','slug',document->>'slug','published',published_document is not null,'updated_at',updated_at) order by updated_at desc),'[]') into result from private.editor_documents; return result;
 elsif command='get' then select to_jsonb(x) into result from private.editor_documents x where id=target; return result;
 elsif command='history' then select coalesce(jsonb_agg(to_jsonb(x) order by revision desc),'[]') into result from private.editor_revisions x where document_id=target; return result;
 elsif command='tokens' then select coalesce(jsonb_agg(to_jsonb(x)-'token_hash'),'[]') into result from private.api_tokens x where user_id=actor; return result;
 elsif command='token_create' then
 insert into private.api_tokens(user_id,name,token_hash,scopes,expires_at) values(actor,payload->>'name',payload->>'hash',array(select jsonb_array_elements_text(payload->'scopes')),(payload->>'expires_at')::timestamptz) returning to_jsonb(api_tokens)-'token_hash' into result;
 elsif command='token_revoke' then update private.api_tokens set revoked_at=now() where id=target and user_id=actor; result='{"revoked":true}';
 elsif command='job' then select to_jsonb(x) into result from private.publication_jobs x where id=target; return result;
 elsif command='create' then
 insert into private.editor_documents(document) values(payload->'document') returning * into d;
 insert into private.editor_revisions(document_id,revision,document) values(d.id,d.revision,d.document); result=to_jsonb(d);
 insert into private.api_requests values(actor,payload->>'idempotency_key',payload,result);
 elsif command in ('save','publish','archive') then
 -- Serialize publications so each release includes every preceding publication.
 if command in ('publish','archive') then
 perform pg_advisory_xact_lock(71304721);
 if length(coalesce(payload->>'idempotency_key',''))<8 then raise exception 'Idempotency-Key required'; end if;
 select * into existing from private.publication_jobs where idempotency_key=payload->>'idempotency_key';
 if existing.id is not null then
 if existing.request<>payload or existing.user_id<>actor then raise exception 'Idempotency conflict' using errcode='40001'; end if;
 return jsonb_build_object('id',existing.id,'status','queued'); end if;
 end if;
 select * into d from private.editor_documents where id=target for update;
 if d.id is null then raise exception 'Not found' using errcode='P0002'; end if;
 if d.revision is distinct from (payload->>'revision')::integer then raise exception 'Revision conflict' using errcode='40001'; end if;
 if command='save' then
 if d.published_document is not null and (payload->'document'->>'slug'<>d.document->>'slug' or payload->'document'->>'section'<>d.document->>'section') then raise exception 'Published routes cannot be renamed'; end if;
 update private.editor_documents set document=payload->'document',revision=revision+1,updated_at=now() where id=target returning * into d;
 insert into private.editor_revisions(document_id,revision,document) values(d.id,d.revision,d.document);result=to_jsonb(d);
 else
 update private.editor_documents set published_document=case when command='publish' then document else null end where id=target;
 if exists(select asset.key from private.editor_documents x cross join lateral jsonb_each(x.published_document->'assets') asset where x.published_document is not null group by asset.key having count(distinct asset.value)>1) then raise exception 'Conflicting lyric assets across posts'; end if;
 insert into public.content_releases(documents) select coalesce(jsonb_agg(published_document order by id),'[]') from private.editor_documents where published_document is not null returning id into release_id;
 insert into private.publication_jobs(id,user_id,idempotency_key,request) values(release_id,actor,payload->>'idempotency_key',payload);
 result=jsonb_build_object('id',release_id,'status','queued');
 end if;
 else raise exception 'Unknown command'; end if;
 insert into private.audit_events(user_id,action,target_id) values(actor,command,target);
 return result;
end $$;
revoke all on function public.editor_identity(uuid),public.editor_token_resolve(text,text),public.editor_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.editor_identity(uuid),public.editor_token_resolve(text,text),public.editor_command(uuid,text,jsonb) to service_role;

-- Only the server API may access working documents and mutate publication state.
grant usage on schema private to service_role;
grant select,insert,update,delete on private.owner_binding,private.editor_documents,private.editor_revisions,private.api_tokens,private.audit_events,private.publication_jobs,private.api_requests to service_role;
grant usage,select on sequence private.audit_events_id_seq to service_role;
grant select,insert on public.content_releases to service_role;
grant select,insert on public.site_admins to service_role;
