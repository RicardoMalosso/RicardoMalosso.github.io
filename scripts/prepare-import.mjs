import fs from 'node:fs';
import crypto from 'node:crypto';
import matter from 'gray-matter';
import {execFileSync} from 'node:child_process';
const files=[];
for(const dir of ['content/blog','content/music','public/lyrics']) {
 for(const name of fs.readdirSync(dir,{recursive:true})) {
  const path=`${dir}/${name}`;
  if(fs.statSync(path).isFile()) {const text=fs.readFileSync(path,'utf8');files.push({path,text,sha256:crypto.createHash('sha256').update(text).digest('hex')});}
 }
}
const entries=files.filter(f=>f.path.startsWith('content/')).map(f=>{const {data,content}=matter(f.text);return {path:f.path,section:f.path.split('/')[1],metadata:data,body:content};});
const groups=Map.groupBy(entries,e=>`${e.section}/${e.metadata.slug}`);
for(const [key,rows] of groups){for(const field of ['player','artist','originalLanguage']){const values=new Set(rows.map(r=>JSON.stringify(r.metadata[field]??null)));if(values.size>1) console.error('Localized metadata differs:',key,field);}}
const payload={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files,entries};
fs.writeFileSync('/tmp/portfolio-import.json',JSON.stringify(payload));
console.log(JSON.stringify({files:files.length,entries:entries.length,posts:groups.size,music:entries.filter(e=>e.section==='music').length,lrc:files.filter(f=>f.path.endsWith('.lrc')).length}));
