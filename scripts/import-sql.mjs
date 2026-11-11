import fs from 'node:fs';
const p=JSON.parse(fs.readFileSync('/tmp/portfolio-import.json','utf8'));
const q=x=>x==null?'NULL':"'"+String(x).replaceAll("'","''")+"'";
const j=x=>q(JSON.stringify(x))+'::jsonb';
const post=e=>`(select id from public.posts where section=${q(e.section)} and slug=${q(e.metadata.slug)})`;
const locale=x=>x==='pt-br'?'pt-BR':x;
const sql=['begin;'];
for(const f of p.files)sql.push(`insert into private.source_files values(${q(f.path)},${q(f.text)},${q(f.sha256)},${q(p.commit)});`);
for(const rows of Map.groupBy(p.entries,e=>e.section+'/'+e.metadata.slug).values()){
 const e=rows[0],m=e.metadata;
 sql.push(`insert into public.posts(section,slug,display_date) values(${q(e.section)},${q(m.slug)},${q(m.date)});`);
 if(m.player){const u=new URL(m.player.youtubeUrl);const id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v');
 sql.push(`insert into public.post_players(post_id,youtube_id,artist,original_language,offset_ms,extra_metadata) values(${post(e)},${q(id)},${q(m.artist)},${q(m.originalLanguage)},${m.player.offsetMs??0},${j(m.player)});`);
 for(const [lang,path]of Object.entries(m.player.subtitles)){
 const f=p.files.find(f=>f.path==='public/'+path);if(!f)throw Error(path);
 sql.push(`insert into public.lyric_tracks(player_id,locale,source_path,lrc_text) values((select id from public.post_players where post_id=${post(e)}),${q(locale(lang))},${q(path)},${q(f.text)});`);
 }}
 for(const e of rows){const m=e.metadata;const extra={...m};for(const k of ['title','description','slug','locale','date','tags','credits','draft','player','lyricNotes'])delete extra[k];
 sql.push(`insert into public.post_translations(post_id,locale,title,description,body_markdown,tags,credits,status,published_at,extra_metadata) values(${post(e)},${q(locale(m.locale))},${q(m.title)},${q(m.description)},${q(e.body)},ARRAY[${(m.tags??[]).map(q).join(',')}]::text[],${q(m.credits)},${q(m.draft?'draft':'published')},${m.draft?'NULL':q(m.date)+'::timestamptz'},${j(extra)});`);
 for(const [i,n]of (m.lyricNotes??[]).entries()){const [min,sec]=n.time.split(':');const ms=Math.round((+min*60 + +sec)*1000);
 sql.push(`insert into public.lyric_notes(post_translation_id,track_id,time_ms,selected_text,explanation_markdown,sort_order,source_time) values((select id from public.post_translations where post_id=${post(e)} and locale=${q(locale(m.locale))}),(select l.id from public.lyric_tracks l join public.post_players p on p.id=l.player_id where p.post_id=${post(e)} and l.locale=${q(locale(n.language))}),${ms},${q(n.text)},${q(n.explanation)},${i},${q(n.time)});`);
 }}
 sql.push(`insert into public.post_revisions(post_id,snapshot) values(${post(e)},${j({source_commit:p.commit,entries:rows})});`);
}
sql.push('commit;');fs.writeFileSync('/tmp/portfolio-import.sql',sql.join('\n'));
console.log('Prepared transaction:',sql.length,'statements');
