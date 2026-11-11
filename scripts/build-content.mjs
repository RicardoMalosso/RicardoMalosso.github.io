import fs from 'node:fs';
import {loadContent} from './content.mjs';
import {loadSupabaseContent} from './supabase-content.mjs';
const source=process.env.CONTENT_SOURCE||'files';
if(!['files','supabase'].includes(source))throw Error('Unsupported CONTENT_SOURCE');
const entries=source==='supabase'?await loadSupabaseContent():loadContent();
fs.writeFileSync('src/content.generated.json',JSON.stringify(entries,null,2)+'\n');
console.log(`Validated ${entries.length} content entries from ${source}.`);
