import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {loadContent} from './content.mjs';
import {validateDocument} from '../supabase/functions/publishing-api/validation.mjs';
const config=JSON.parse(fs.readFileSync(new URL('../supabase/project.json',import.meta.url),'utf8'));
export async function fetchRelease(id=process.env.PUBLICATION_ID){
 if(id&&!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid publication ID');
 const url=new URL('/rest/v1/content_releases',process.env.SUPABASE_URL||config.url);
 url.searchParams.set('select','*');url.searchParams.set('limit','1');url.searchParams.set('order','created_at.desc,id.desc');if(id)url.searchParams.set('id','eq.'+id);
 const r=await fetch(url,{headers:{apikey:process.env.SUPABASE_PUBLISHABLE_KEY||config.publishableKey},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Cannot fetch release (${r.status})`);
 const [release]=await r.json();if(!release)throw Error('No published content release');return release;
}
export function compileRelease(release){
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'portfolio-release-'));const assets=new Map();const routes=new Set();
 try{
 for(const section of ['blog','music'])fs.mkdirSync(path.join(temp,section));
 for(const doc of release.documents){const errors=validateDocument(doc);if(errors.length)throw Error(doc.slug+': '+errors.join('; '));
 for(const [file,text]of Object.entries(doc.assets)){if(assets.has(file)&&assets.get(file)!==text)throw Error('Conflicting lyric asset: '+file);assets.set(file,text);}
 for(const e of doc.entries){const route=e.section+'/'+e.slug+'.'+e.locale;if(routes.has(route))throw Error('Duplicate route: '+route);routes.add(route);const {body,section,...metadata}=e;fs.writeFileSync(path.join(temp,route+'.md'),matter.stringify(body,metadata));}
 }
 // Stage only the lyric assets belonging to the publication, including intentional archives.
 fs.rmSync('.content-release',{recursive:true,force:true});
 fs.mkdirSync('.content-release/lyrics',{recursive:true});
 for(const [file,text]of assets){fs.mkdirSync(path.dirname(path.join('.content-release',file)),{recursive:true});fs.writeFileSync(path.join('.content-release',file),text);}
 const entries=loadContent(temp,'.content-release');
 fs.writeFileSync('.content-release/publication.json',JSON.stringify({id:release.id,created_at:release.created_at}));
 return entries;
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
export async function loadRelease(){return compileRelease(await fetchRelease());}
