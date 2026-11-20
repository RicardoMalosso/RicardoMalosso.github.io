// Local-only Pages emulator and isolated Postgres API. Never deployed or connected to live writes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
const entries = JSON.parse(fs.readFileSync('src/content.generated.json','utf8'));
const grouped = Map.groupBy(entries, e => `${e.section}/${e.slug}`);
const documents = [...grouped.values()].map(entries => {
  const assets = {};
  for (const e of entries) for (const file of Object.values(e.player?.subtitles ?? {})) {
    const fromRelease = path.join('.content-release', file);
    assets[file] = fs.readFileSync(fs.existsSync(fromRelease) ? fromRelease : path.join('public',file),'utf8');
  }
  return {section:entries[0].section,slug:entries[0].slug,entries,assets};
});
const subtitles = {en:'lyrics/runtime-song/en.lrc','pt-br':'lyrics/runtime-song/pt-br.lrc'};
documents.push({section:'music',slug:'runtime-song',entries:['en','pt-br'].map(locale=>({section:'music',slug:'runtime-song',locale,date:'2026-11-14',title:locale==='en'?'Runtime song':'Música dinâmica',description:locale==='en'?'Published without a frontend build.':'Publicada sem rebuild do frontend.',body:'A local test song. Search-only word: solidarity.\n\n<!-- lyrics-player -->',tags:['MPB'],player:{youtubeUrl:'https://www.youtube.com/watch?v=ixnCyOzNWx0',subtitles},lyricNotes:[{time:'00:01.16',language:'en',text:'Loving',explanation:'A contextual note.'}]})),assets:{[subtitles.en]:'[00:01.16] Loving and changing things\n[00:03.27] Interests me more',[subtitles['pt-br']]:'[00:01.16] Amar e mudar as coisas\n[00:03.27] Me interessa mais'}});
await db.exec(`create role anon; create role authenticated; create role service_role;
create table public.content_releases(id uuid primary key,documents jsonb,created_at timestamptz);
create index on public.content_releases(created_at desc,id desc);
alter table public.content_releases enable row level security;
grant usage on schema public to anon,authenticated;
grant select on public.content_releases to anon,authenticated;
create policy published_releases on public.content_releases for select to anon,authenticated using(true);`);
await db.exec(fs.readFileSync('supabase/migrations/20261114074736_runtime_content_reads.sql','utf8'));
await db.query("insert into public.content_releases values('99999999-9999-4999-8999-999999999999',$1,'2099-01-01')",[JSON.stringify(documents)]);
await db.exec('set role anon');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.lrc':'text/plain','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
let offline = false;
const server = http.createServer(async(req,res)=>{
  try {
    const url = new URL(req.url,'http://localhost');
    if(url.pathname==='/__runtime-test/offline'&&req.method==='POST'){offline=!offline;res.end(JSON.stringify({offline}));return;}
    if(url.pathname.startsWith('/__runtime-test/rest/v1/rpc/')){
      if(offline){res.writeHead(503);res.end('Offline test');return;}
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>10000)throw Error('Request too large');}
      const p=JSON.parse(raw||'{}'); const name=url.pathname.split('/').pop(); let result;
      if(name==='content_manifest') result=await db.query('select public.content_manifest($1) data',[p.known_id]);
      else if(name==='content_document') result=await db.query('select public.content_document($1,$2,$3) data',[p.release_id,p.post_section,p.post_slug]);
      else if(name==='content_search') result=await db.query('select public.content_search($1,$2,$3) data',[p.release_id,p.post_section,p.search_query]);
      else {res.writeHead(404);res.end();return;}
      const body=JSON.stringify(result.rows[0].data); console.log(`${name}: ${Buffer.byteLength(body)} bytes`);
      res.setHeader('Content-Type','application/json');res.end(body);return;
    }
    let file=path.resolve('dist','.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(path.resolve('dist')+path.sep)&&file!==path.resolve('dist')){res.writeHead(400);res.end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)){file=path.resolve('dist/404.html');res.statusCode=404;}
    res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));
  }catch(error){res.writeHead(500);res.end('Local test API failed');console.error(error.message);}
});
server.listen(Number(process.env.PORT)||5173,'0.0.0.0',()=>console.log('Local runtime preview: http://localhost:5173/en/music/runtime-song/'));
process.on('SIGINT',()=>server.close(async()=>{await db.close();process.exit(0);}));
