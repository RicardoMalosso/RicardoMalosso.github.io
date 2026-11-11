import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateDocument,routeScope} from '../supabase/functions/publishing-api/validation.mjs';
import {loadContent} from '../scripts/content.mjs';
import {PGlite} from '@electric-sql/pglite';
const doc={section:'blog',slug:'example',entries:[{section:'blog',slug:'example',locale:'en',date:'2026-11-11',title:'Example',description:'Example',body:'Draft body'}],assets:{}};
test('all preserved posts pass publishing validation',()=>{
 for(const entries of Map.groupBy(loadContent(),e=>e.section+'/'+e.slug).values()){
 const assets={};for(const e of entries)for(const p of Object.values(e.player?.subtitles??{}))assets[p]=fs.readFileSync('public/'+p,'utf8');
 assert.deepEqual(validateDocument({section:entries[0].section,slug:entries[0].slug,entries,assets}),[],entries[0].slug);
 }
});
test('reject unsafe paths, mismatched routes and detached lyric notes',()=>{
 assert.deepEqual(validateDocument(doc),[]);
 assert(validateDocument({...doc,slug:'../escape'}).length);
 assert(validateDocument({...doc,assets:{'../secret':'x'}}).length);
 const changed=structuredClone(doc);changed.entries[0].lyricNotes=[{time:'00:10',language:'en',text:'absent',explanation:'context'}];assert(validateDocument(changed).length);
 assert.equal(routeScope('POST','/posts/id/publish'),'posts:publish');assert.equal(routeScope('POST','/tokens'),'session');assert.equal(routeScope('GET','/posts'),'posts:read');
});
test('database restricts identity, isolates drafts, rejects stale writes, deduplicates publish and revokes tokens',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create table auth.identities(user_id uuid,provider text,identity_data jsonb); create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
 await db.exec(fs.readFileSync('supabase/schema.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261111034436_admin_publishing.sql','utf8'));
 const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
 await db.query("insert into auth.users values($1,'ricardomalosso@gmail.com',now()),($2,'someone@example.com',now())",[owner,other]);
 await db.query("insert into auth.identities values($1,'google','{\"email\":\"ricardomalosso@gmail.com\",\"email_verified\":true}'),($2,'google','{\"email\":\"someone@example.com\",\"email_verified\":true}')",[owner,other]);
 await db.exec('set role service_role');
 await assert.rejects(db.query('select public.editor_identity($1)',[other]),/Forbidden/);
 await db.query('select public.editor_identity($1)',[owner]);
 async function command(command,payload={}){return (await db.query('select public.editor_command($1,$2,$3::jsonb) as data',[owner,command,JSON.stringify(payload)])).rows[0].data;}
 const created=await command('create',{document:doc,idempotency_key:'create-001'});
 assert.equal((await command('create',{document:doc,idempotency_key:'create-001'})).id,created.id);
 assert.equal((await db.query('select count(*)::int as n from public.content_releases')).rows[0].n,0);
 const pub=await command('publish',{id:created.id,revision:1,idempotency_key:'publish-001'});
 assert.equal((await command('publish',{id:created.id,revision:1,idempotency_key:'publish-001'})).id,pub.id);
 const next=structuredClone(doc);next.entries[0].body='Unpublished edit';
 await command('save',{id:created.id,revision:1,document:next});
 await assert.rejects(command('save',{id:created.id,revision:1,document:doc}),/Revision conflict/);
 await assert.rejects(command('archive',{id:created.id,revision:1,idempotency_key:'publish-001'}),/Idempotency conflict/);
 const release=(await db.query('select documents from public.content_releases where id=$1',[pub.id])).rows[0].documents;
 assert.equal(release[0].entries[0].body,'Draft body');
 const token=await command('token_create',{name:'test',hash:'hash-test',scopes:['posts:read'],expires_at:'2099-01-01T00:00:00Z'});
 assert.equal((await db.query("select public.editor_token_resolve('hash-test','posts:read') as id")).rows[0].id,owner);
 await assert.rejects(db.query("select public.editor_token_resolve('hash-test','posts:publish')"),/Invalid/);
 await command('token_revoke',{id:token.id});await assert.rejects(db.query("select public.editor_token_resolve('hash-test','posts:read')"),/Invalid/);
 await db.exec('set role anon');
 assert.equal((await db.query('select count(*)::int as n from public.content_releases')).rows[0].n,1);
 await assert.rejects(db.query('select * from private.editor_documents'),/permission denied/);
 await assert.rejects(db.query('select public.editor_identity($1)',[owner]),/permission denied/);
 await db.exec('set role authenticated');
 await assert.rejects(db.query('select public.editor_command($1,$2,$3)',[owner,'list','{}']),/permission denied/);
 }finally{await db.close();}
});
