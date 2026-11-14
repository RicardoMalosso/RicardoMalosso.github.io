import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';

const entries = JSON.parse(fs.readFileSync('src/content.generated.json','utf8'));
const built = JSON.parse(fs.readFileSync('src/publication.generated.json','utf8'));
const latest = {id:'99999999-9999-4999-8999-999999999999',created_at:'2099-01-01T00:00:00Z'};
const subtitles = {en:'lyrics/runtime-song/en.lrc','pt-br':'lyrics/runtime-song/pt-br.lrc'};
const doc = {section:'music',slug:'runtime-song',entries:['en','pt-br'].map(locale=>({section:'music',slug:'runtime-song',locale,date:'2026-11-14',title:locale==='en'?'Runtime song':'Música dinâmica',description:locale==='en'?'Published without a frontend build.':'Publicada sem rebuild do frontend.',body:'A newly published song. Search-only word: solidarity.\n\n<!-- lyrics-player -->',tags:['MPB'],player:{youtubeUrl:'https://www.youtube.com/watch?v=ixnCyOzNWx0',subtitles},lyricNotes:[{time:'00:01.16',language:'en',text:'Loving',explanation:'A contextual note.'}]})),assets:{[subtitles.en]:'[00:01.16] Loving and changing things\n[00:03.27] Interests me more',[subtitles['pt-br']]:'[00:01.16] Amar e mudar as coisas\n[00:03.27] Me interessa mais'}};
const summaries = [...entries,...doc.entries].map(({body,player,lyricNotes,lyrics,...e})=>({...e,body:''}));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.lrc':'text/plain','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
let server,browser,origin;
before(async()=>{
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=path.resolve('dist','.'+pathname);
    if(!file.startsWith(path.resolve('dist')+path.sep)&&file!==path.resolve('dist')){res.writeHead(400);res.end();return;}
    if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    if(!fs.existsSync(file)){file=path.resolve('dist/404.html');res.statusCode=404;}
    res.setHeader('Content-Type',mime[path.extname(file)]??'application/octet-stream');res.end(fs.readFileSync(file));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function setup({offline=false,manifest={...latest,entries:summaries},document=doc,denyStorage=false,mobile=false}={}){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  if(denyStorage)await context.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied');};Storage.prototype.setItem=()=>{throw Error('denied');};});
  // Playback is unrelated to content loading; keep tests deterministic without contacting YouTube.
  await context.route('**/www.youtube.com/iframe_api',route=>route.fulfill({contentType:'application/javascript',body:'window.YT={Player:function(){this.destroy=function(){}}};window.onYouTubeIframeAPIReady?.();'}));
  const requests=[];
  await context.route('**/rest/v1/rpc/*',async route=>{
    const name=route.request().url().split('/').pop();const payload=route.request().postDataJSON();requests.push({name,payload});
    if(offline)return route.fulfill({status:503,body:'unavailable'});
    const data=name==='content_manifest'?manifest:name==='content_document'?document:name==='content_search'?['en/music/runtime-song','pt-br/music/runtime-song']:null;
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  return {context,page,requests,errors};
}
async function until(check){for(let n=0;n<100;n++){if(await check())return;await new Promise(r=>setTimeout(r,50));}assert.fail('Condition did not become true');}

test('new song loads through a real HTTP 404 shell with pinned bilingual lyrics, notes and locale metadata',async()=>{
  const {context,page,requests,errors}=await setup();
  try{
    const response=await page.goto(origin+'/en/music/runtime-song/');assert.equal(response.status(),404);
    await page.getByRole('heading',{name:'Runtime song',exact:true}).waitFor();
    await page.getByText('Loving and changing things',{exact:false}).first().waitFor();
    assert.equal(await page.locator('.sync-pt').first().innerText(),'Amar e mudar as coisas');
    assert.equal(await page.title(),'Runtime song · ricardo malosso');
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),'https://ricardomalosso.github.io/en/music/runtime-song/');
    assert.equal(requests.filter(r=>r.name==='content_document').length,1);
    assert.equal(requests.find(r=>r.name==='content_document').payload.release_id,latest.id);
    assert.equal(await page.locator('.sync-en a,.sync-en button').count()>0,true);
    await page.locator('header a.locale').click();
    await page.getByRole('heading',{name:'Música dinâmica',exact:true}).waitFor();
    assert.equal(await page.locator('html').getAttribute('lang'),'pt-BR');
    assert.equal(requests.filter(r=>r.name==='content_document').length,1);
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('listing discovers new publication, body search works and mobile layout does not overflow',async()=>{
  const {context,page,requests,errors}=await setup({mobile:true});
  try{
    await page.goto(origin+'/pt-br/music/');await page.getByRole('heading',{name:'Música dinâmica',exact:true}).waitFor();
    await page.getByRole('searchbox').fill('solidarity');
    await until(()=>requests.some(r=>r.name==='content_search'));
    await page.getByRole('heading',{name:'Música dinâmica',exact:true}).waitFor();
    await page.locator('a.entry-row').filter({hasText:'Música dinâmica'}).click();
    await page.locator('.sync-en').first().waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    assert.deepEqual(errors,[]);
  }finally{await context.close();}
});

test('paused database preserves static pages without hydration errors or content flashes',async()=>{
  const entry=entries.find(e=>e.section==='music'&&e.locale==='en');
  const {context,page,requests,errors}=await setup({offline:true});
  try{
    const response=await page.goto(`${origin}/en/music/${entry.slug}/`);assert.equal(response.status(),200);
    await page.getByRole('heading',{name:entry.title,exact:true}).waitFor();
    await until(()=>requests.length>0);assert.deepEqual(errors,[]);
    assert.equal(await page.title(),`${entry.title} · ricardo malosso`);
  }finally{await context.close();}
});

test('blocked browser storage does not prevent loading a new post',async()=>{
  const {context,page,errors}=await setup({denyStorage:true});
  try{await page.goto(origin+'/en/music/runtime-song/');await page.getByRole('heading',{name:'Runtime song',exact:true}).waitFor();await page.locator('.sync-en').first().waitFor();assert.deepEqual(errors,[]);}finally{await context.close();}
});

test('confirmed archive replaces a stale static article with not-found content',async()=>{
  const entry=entries.find(e=>e.section==='music'&&e.locale==='en');
  const {context,page}=await setup({manifest:{...latest,entries:[]}});
  try{await page.goto(`${origin}/en/music/${entry.slug}/`);await until(async()=>await page.locator('h1').innerText()!==entry.title);assert.equal(await page.locator('.article').count(),0);}finally{await context.close();}
});

test('unchanged snapshot avoids document downloads',async()=>{
  if(!built)return;
  const entry=entries.find(e=>e.section==='music'&&e.locale==='en');
  const {context,page,requests,errors}=await setup({manifest:{...built,unchanged:true}});
  try{await page.goto(`${origin}/en/music/${entry.slug}/`);await until(()=>requests.length>0);assert.equal(requests.length,1);assert.equal(requests[0].payload.known_id,built.id);assert.deepEqual(errors,[]);}finally{await context.close();}
});
