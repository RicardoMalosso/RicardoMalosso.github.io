export function validateDocument(doc) {
 const errors=[];const need=(ok,msg)=>{if(!ok)errors.push(msg);};
 need(doc&&['blog','music'].includes(doc.section),'section must be blog or music');
 need(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc?.slug??''),'invalid slug');
 need(Array.isArray(doc?.entries)&&doc.entries.length>0&&doc.entries.length<=2,'one or two translations required');
 need(doc?.assets&&typeof doc.assets==='object'&&!Array.isArray(doc.assets),'assets must be an object');
 if(errors.length)return errors;
 const locales=new Set();
 for(const e of doc?.entries??[]){
 need(['en','pt-br'].includes(e.locale)&&!locales.has(e.locale),'unique en/pt-br locales required');locales.add(e.locale);
 need(e.section===doc.section&&e.slug===doc.slug,'entry route must match document');
 for(const k of ['title','description','body'])need(typeof e[k]==='string'&&(k==='body'||e[k].trim()),`${e.locale}: ${k} required`);
 need(/^\d{4}-\d{2}-\d{2}$/.test(e.date)&&!Number.isNaN(Date.parse(e.date)),'ISO date required');
 need(e.draft!==true,'omit unpublished translations from this document');
 need(!e.tags||(Array.isArray(e.tags)&&e.tags.every(t=>typeof t==='string')),'invalid tags');
 need((e.body?.match(/<!-- lyrics-player -->/g)??[]).length<=1,'only one player marker allowed');
 if(e.player){
 let id;try{const u=new URL(e.player.youtubeUrl);if(['youtube.com','www.youtube.com','youtu.be','www.youtube-nocookie.com'].includes(u.hostname))id=u.hostname==='youtu.be'?u.pathname.slice(1):u.searchParams.get('v')??u.pathname.split('/').pop();}catch{}
 need(/^[\w-]{11}$/.test(id??''),'invalid YouTube URL');
 need(e.player.offsetMs===undefined||(Number.isInteger(e.player.offsetMs)&&Math.abs(e.player.offsetMs)<=60000),'offset must be within ±60000 ms');
 for(const lang of ['en','pt-br']){const file=e.player.subtitles?.[lang];need(/^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(file??''),'invalid lyric path');need(typeof doc.assets?.[file]==='string','missing LRC asset');}
 }
 for(const n of e.lyricNotes??[]){
 need(/^\d{2}:[0-5]\d(?:\.\d{1,3})?$/.test(n.time??''),'invalid note time');need(['en','pt-br'].includes(n.language)&&typeof n.text==='string'&&n.text.length>0&&typeof n.explanation==='string','invalid lyric note');
 const lrc=doc.assets?.[e.player?.subtitles?.[n.language]]??'';
 const seconds=t=>{const [m,s]=t.split(':');return Math.round((+m*60 + +s)*1000);};
 need(lrc.split('\n').some(line=>{const m=line.match(/^\[(\d{2}:[0-5]\d(?:\.\d{1,3})?)\](.*)$/);return m&&seconds(m[1])===seconds(n.time??'0:0')&&m[2].includes(n.text);}),`note no longer matches lyric: ${n.text}`);
 }
 }
 for(const [file,value]of Object.entries(doc?.assets??{})){need(/^lyrics\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.lrc$/.test(file),'unsafe asset path');need(typeof value==='string','asset must be text');}
 return errors;
}
export function routeScope(method,path){if(path.startsWith('/tokens')||path==='/me')return 'session';if(/\/(publish|archive|retry)$/.test(path))return 'posts:publish';return method==='GET'?'posts:read':'posts:write';}
