import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {loadSupabaseContent} from './supabase-content.mjs';
import {validateDocument} from '../supabase/functions/publishing-api/validation.mjs';
const entries=await loadSupabaseContent();const docs=[];
for(const group of Map.groupBy(entries,e=>e.section+'/'+e.slug).values()){
 const assets={};for(const e of group)for(const p of Object.values(e.player?.subtitles??{}))assets[p]=fs.readFileSync('public/'+p,'utf8');
 const doc={section:group[0].section,slug:group[0].slug,entries:group,assets};
 const errors=validateDocument(doc);if(errors.length)console.log(doc.slug,errors);docs.push(doc);
}
const quote=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const sql=['begin;',...docs.map(d=>`insert into private.editor_documents(document,published_document) values(${quote(d)},${quote(d)});`),'insert into private.editor_revisions(document_id,revision,document) select id,revision,document from private.editor_documents;','insert into public.content_releases(documents) select jsonb_agg(published_document order by id) from private.editor_documents;','commit;'];
fs.writeFileSync(path.join(os.tmpdir(),'editor-seed.sql'),sql.join('\n'));
console.log('Prepared',docs.length,'documents',entries.length,'translations');
