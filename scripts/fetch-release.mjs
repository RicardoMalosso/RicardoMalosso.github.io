import fs from 'node:fs';
const config=JSON.parse(fs.readFileSync(new URL('../supabase/project.json',import.meta.url),'utf8'));
export async function fetchRelease(id=process.env.PUBLICATION_ID, columns="*"){
 if(id&&!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid publication ID');
 const url=new URL('/rest/v1/content_releases',process.env.SUPABASE_URL||config.url);
 url.searchParams.set('select',columns);url.searchParams.set('limit','1');url.searchParams.set('order','created_at.desc,id.desc');if(id)url.searchParams.set('id','eq.'+id);
 const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY||config.publishableKey},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Cannot fetch release (${r.status})`);
 const [release]=await r.json();if(!release)throw Error('No published content release');return release;
}
