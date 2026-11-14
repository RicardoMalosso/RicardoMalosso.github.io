import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createRuntimeContentStore, normalizeDocument } from '../src/runtimeContent.ts';
import { serializeSnapshot } from '../scripts/html-snapshot.mjs';

const oldId = '11111111-1111-4111-8111-111111111111';
const newId = '22222222-2222-4222-8222-222222222222';
const publication = {id: oldId, created_at: '2026-11-13T00:00:00Z'};
const latest = {id: newId, created_at: '2026-11-14T00:00:00Z'};
const entry = {locale:'en', section:'music', slug:'example', title:'Example', description:'A song', date:'2026-11-14', body:'Body-only search word: solidarity.\n\n<!-- lyrics-player -->', tags:['MPB'], player:{youtubeUrl:'https://www.youtube.com/watch?v=ixnCyOzNWx0',subtitles:{en:'lyrics/example/en.lrc','pt-br':'lyrics/example/pt-br.lrc'}}};
const doc = {section:'music',slug:'example',entries:[entry,{...entry,locale:'pt-br',title:'Exemplo'}],assets:{'lyrics/example/en.lrc':'[00:01.16] First line','lyrics/example/pt-br.lrc':'[00:01.16] Primeiro verso'}};
const summaries = doc.entries.map(e => ({...e,body:'',player:undefined}));
const response = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
const options = {enabled:true,url:'https://example.supabase.co',key:'publishable',publication};
const deferred = () => {let resolve; const promise = new Promise(r => {resolve=r;}); return {promise,resolve};};

test('embedded lyric snapshots cannot terminate their JSON script element or change user text',()=>{
  const assets={'lyrics/example/en.lrc':'[00:01] </script><script>alert("x")</script> $& < & \u2028'};
  const serialized=serializeSnapshot(assets);
  assert(!serialized.includes('<'));assert.deepEqual(JSON.parse(serialized),assets);
});

test('public RPCs read only published releases, omit bodies/assets from manifests and pin document reads', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema private;
      create table private.editor_documents(document jsonb);
      create table public.content_releases(id uuid primary key, documents jsonb not null, created_at timestamptz not null);
      create index on public.content_releases(created_at desc,id desc);
      alter table public.content_releases enable row level security;
      grant usage on schema public to anon,authenticated;
      grant select on public.content_releases to anon,authenticated;
      create policy published_releases on public.content_releases for select to anon,authenticated using(true);`);
    await db.exec(fs.readFileSync('supabase/migrations/20261114074736_runtime_content_reads.sql','utf8'));
    await db.query('insert into public.content_releases values($1,$2,$3),($4,$5,$6)',[oldId,JSON.stringify([{...doc,entries:doc.entries.map(e=>({...e,title:'Old title'}))}]),publication.created_at,newId,JSON.stringify([doc]),latest.created_at]);
    await db.query('insert into private.editor_documents values($1)',[JSON.stringify({...doc,slug:'draft-secret'})]);
    await db.exec('set role anon');
    const rpc = async (sql,args=[]) => (await db.query(sql,args)).rows[0].result;
    const manifest = await rpc('select public.content_manifest() result');
    assert.equal(manifest.id,newId); assert.equal(manifest.entries.length,2);
    assert.equal(manifest.entries[0].body,''); assert(!JSON.stringify(manifest).includes('solidarity'));
    assert(!JSON.stringify(manifest).includes('lyrics/example')); assert(!JSON.stringify(manifest).includes('draft-secret'));
    assert.equal((await rpc('select public.content_manifest($1) result',[newId])).unchanged,true);
    assert.equal((await rpc("select public.content_document($1,'music','example') result",[oldId])).entries[0].title,'Old title');
    assert.equal(await rpc("select public.content_document($1,'music','draft-secret') result",[newId]),null);
    assert.deepEqual(await rpc("select public.content_search($1,'music','solidarity') result",[newId]),['en/music/example','pt-br/music/example']);
    assert.deepEqual(await rpc("select public.content_search($1,'music','%') result",[newId]),[]);
    await assert.rejects(db.query('select * from private.editor_documents'),/permission denied/);
    await assert.rejects(db.query('delete from public.content_releases'),/permission denied/);
    const flags = await db.query("select prosecdef from pg_proc where proname in ('content_manifest','content_document','content_search')");
    assert(flags.rows.every(r => !r.prosecdef));
    await db.exec('reset role');
    await db.query('insert into public.content_releases values($1,\'[]\',\'2026-11-15\')',['33333333-3333-4333-8333-333333333333']);
    await db.exec('set role authenticated');
    assert.deepEqual((await rpc('select public.content_manifest() result')).entries,[]);
  } finally {await db.close();}
});

test('unchanged release makes one small request and preserves the immediate static snapshot', async () => {
  let calls=0;
  const store = createRuntimeContentStore([entry],{...options,fetch:async()=>{calls++;return response({...publication,unchanged:true});}});
  assert.equal(store.article('en','music','example').title,'Example');
  await store.refresh(); await store.refresh(); await store.loadDocument('music','example');
  assert.equal(calls,1); assert.equal(store.getSnapshot().phase,'ready');
});

test('new publication loads a single document atomically with both timed lyrics and deduplicates concurrent reads', async () => {
  const requests=[]; const gate=deferred();
  const store=createRuntimeContentStore([],{...options,fetch:async(url,request)=>{
    requests.push({url,body:JSON.parse(request.body)});
    if(url.endsWith('content_manifest'))return response({...latest,entries:summaries});
    await gate.promise;return response(doc);
  }});
  await store.refresh();
  const first=store.loadDocument('music','example'),second=store.loadDocument('music','example');
  assert.equal(store.article('en','music','example'),undefined);
  gate.resolve(); await Promise.all([first,second]);
  assert.equal(requests.length,2); assert.equal(requests[1].body.release_id,newId);
  assert.equal(store.article('en','music','example').player.youtubeId,'ixnCyOzNWx0');
  assert.deepEqual(store.getSnapshot().documents['music/example'].assets,doc.assets);
  assert.equal(store.article('pt-br','music','example').title,'Exemplo');
});

test('failed, paused or malformed API leaves deployed content readable; disabled mode makes no requests', async () => {
  for(const fetch of [async()=>{throw Error('offline');},async()=>new Response('',{status:402}),async()=>response({id:'invalid',entries:[]})]){
    const store=createRuntimeContentStore([entry],{...options,fetch});await store.refresh();
    assert.equal(store.getSnapshot().phase,'offline');assert.equal(store.article('en','music','example').title,'Example');
  }
  const store=createRuntimeContentStore([entry],{...options,enabled:false,fetch:async()=>{assert.fail('network');}});
  await store.refresh();await store.loadDocument('music','example');assert.equal(store.getSnapshot().phase,'idle');
});

test('intentional archive does not resurrect the deployed post, even if the next check fails', async () => {
  let calls=0;
  const store=createRuntimeContentStore([entry],{...options,fetch:async()=>{if(calls++)throw Error('offline');return response({...latest,entries:[]});}});
  await store.refresh();assert.equal(store.article('en','music','example'),undefined);
  await store.refresh(true);assert.equal(store.article('en','music','example'),undefined);
});

test('a late old document cannot overwrite a newer publication', async () => {
  let manifestCalls=0;const gate=deferred();
  const store=createRuntimeContentStore([],{...options,fetch:async url=>{
    if(url.endsWith('content_manifest'))return response(manifestCalls++?{id:'33333333-3333-4333-8333-333333333333',created_at:'2026-11-15',entries:[]}:{...latest,entries:summaries});
    await gate.promise;return response(doc);
  }});
  await store.refresh();const loading=store.loadDocument('music','example');await store.refresh(true);gate.resolve();await loading;
  assert.deepEqual(store.getSnapshot().documents,{});assert.equal(store.article('en','music','example'),undefined);
});

test('document cache is version-scoped and storage denial cannot break loading', async () => {
  let stored=null,calls=0;
  const storage={getItem:()=>stored,setItem:(_,v)=>{stored=v;}};
  const fetch=async url=>{if(url.endsWith('content_manifest'))return response({...latest,entries:summaries});calls++;return response(doc);};
  for(let i=0;i<2;i++){
    const store=createRuntimeContentStore([],{...options,storage,fetch});await store.refresh();await store.loadDocument('music','example');assert(store.article('en','music','example'));
  }
  assert.equal(calls,1);
  const store=createRuntimeContentStore([],{...options,fetch,storage:{getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('quota');}}});
  await store.refresh();await store.loadDocument('music','example');assert(store.article('en','music','example'));
});

test('invalid documents and missing translation assets are rejected as a whole',()=>{
  assert.throws(()=>normalizeDocument({...doc,assets:{}},'music','example'),/missing LRC/);
  assert.throws(()=>normalizeDocument({...doc,slug:'other'},'music','example'),/document/);
  const bad=structuredClone(doc);bad.entries[0].player.youtubeUrl='https://youtube.com.evil.test/watch?v=ixnCyOzNWx0';
  assert.throws(()=>normalizeDocument(bad,'music','example'),/YouTube|video/);
});
