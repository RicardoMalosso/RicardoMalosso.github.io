import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import {loadContent} from './content.mjs';
import {validateDocument} from '../supabase/functions/publishing-api/validation.mjs';
import {fetchRelease} from './fetch-release.mjs';
export {fetchRelease} from './fetch-release.mjs';
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
