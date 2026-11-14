// Read the existing public release and exercise the proposed SQL against an isolated database.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { fetchRelease } from './content-release.mjs';
import { normalizeDocument } from '../src/runtimeContent.ts';
const release = await fetchRelease();
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table public.content_releases(id uuid primary key,documents jsonb not null,created_at timestamptz not null);
    create index on public.content_releases(created_at desc,id desc);
    alter table public.content_releases enable row level security;
    grant usage on schema public to anon,authenticated;
    grant select on public.content_releases to anon,authenticated;
    create policy published_releases on public.content_releases for select to anon,authenticated using(true);`);
  await db.exec(fs.readFileSync('supabase/migrations/20261114074736_runtime_content_reads.sql','utf8'));
  await db.query('insert into public.content_releases values($1,$2,$3)',[release.id,JSON.stringify(release.documents),release.created_at]);
  await db.exec('set role anon');
  const rpc = async (sql,args=[]) => (await db.query(sql,args)).rows[0].data;
  const manifest = await rpc('select public.content_manifest() data');
  const unchanged = await rpc('select public.content_manifest($1) data',[release.id]);
  assert.equal(manifest.entries.length,release.documents.flatMap(d=>d.entries).length);
  assert.equal(unchanged.unchanged,true);assert.equal(unchanged.entries,undefined);
  for(const e of manifest.entries){assert.equal(e.body,'');assert.equal(e.player,undefined);assert.equal(e.lyricNotes,undefined);}
  let assets=0,documents=0,largestDocument=0;
  for(const expected of release.documents){
    const doc=await rpc('select public.content_document($1,$2,$3) data',[release.id,expected.section,expected.slug]);
    assert.deepEqual(doc,expected);
    const normalized=normalizeDocument(doc,expected.section,expected.slug);
    assert.deepEqual(normalized.assets,expected.assets);
    assets+=Object.keys(doc.assets).length;documents++;
    largestDocument=Math.max(largestDocument,Buffer.byteLength(JSON.stringify(doc)));
  }
  console.log(JSON.stringify({release:release.id,documents,translations:manifest.entries.length,lyricAssets:assets,
    completeReleaseBytes:Buffer.byteLength(JSON.stringify(release)),manifestBytes:Buffer.byteLength(JSON.stringify(manifest)),
    unchangedBytes:Buffer.byteLength(JSON.stringify(unchanged)),largestDocumentBytes:largestDocument},null,2));
}finally{await db.close();}
