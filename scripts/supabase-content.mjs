import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {loadContent} from './content.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../supabase/project.json',import.meta.url),'utf8'));
export async function readTable(table) {
 const result=[];
 for(let offset=0;;offset+=500){
  const url=new URL(`/rest/v1/${table}`,process.env.SUPABASE_URL||config.url);
  url.searchParams.set('select','*');url.searchParams.set('order','id');url.searchParams.set('offset',offset);url.searchParams.set('limit',500);
  const response=await fetch(url,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY||config.publishableKey},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Supabase ${table}: HTTP ${response.status}`);
  const rows=await response.json();result.push(...rows);if(rows.length<500)return result;
 }
}
export async function loadSupabaseContent(){
 const [posts,translations,players,tracks,notes]=await Promise.all(['posts','post_translations','post_players','lyric_tracks','lyric_notes'].map(readTable));
 if(!posts.length||!translations.length)throw Error('Refusing to build an empty content export');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-content-'));
 for(const section of ['blog','music'])fs.mkdirSync(path.join(temp,section));
 const locale=x=>x==='pt-BR'?'pt-br':x;
 const assets=new Map();
 try{
 for(const t of translations){
  if(t.status!=='published')continue;
  const p=posts.find(p=>p.id===t.post_id);if(!p)throw Error('Missing parent post');
  const metadata={...t.extra_metadata,title:t.title,description:t.description,slug:p.slug,locale:locale(t.locale),date:p.display_date,tags:t.tags,draft:false};
  if(t.credits!=null)metadata.credits=t.credits;
  const player=players.find(x=>x.post_id===p.id);
  if(player){
   const lyrics=tracks.filter(x=>x.player_id===player.id);const subtitles={};
   for(const l of lyrics){
    if(!/^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(l.source_path))throw Error('Unsafe lyric path');
    if(assets.has(l.source_path)&&assets.get(l.source_path)!==l.lrc_text)throw Error('Conflicting lyric assets');
    assets.set(l.source_path,l.lrc_text);subtitles[locale(l.locale)]=l.source_path;
   }
   metadata.player={...player.extra_metadata,youtubeUrl:`https://www.youtube.com/watch?v=${player.youtube_id}`,subtitles};
   if(player.offset_ms||'offsetMs' in player.extra_metadata)metadata.player.offsetMs=player.offset_ms;
   if(player.artist!=null)metadata.artist=player.artist;
   if(player.original_language!=null)metadata.originalLanguage=player.original_language;
  }
  const nn=notes.filter(n=>n.post_translation_id===t.id).sort((a,b)=>a.sort_order-b.sort_order);
  if(nn.length)metadata.lyricNotes=nn.map(n=>{const track=tracks.find(l=>l.id===n.track_id);if(!track)throw Error('Missing note track');return {time:n.source_time,language:locale(track.locale),text:n.selected_text,explanation:n.explanation_markdown};});
  fs.writeFileSync(path.join(temp,p.section,`${p.slug}.${metadata.locale}.md`),matter.stringify(t.body_markdown,metadata));
 }
 for(const [file,text]of assets){fs.mkdirSync(path.dirname(path.join('public',file)),{recursive:true});fs.writeFileSync(path.join('public',file),text);}
 return loadContent(temp);
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
