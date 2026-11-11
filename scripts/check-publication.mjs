import fs from 'node:fs';
import {fetchRelease} from './content-release.mjs';
const latest=await fetchRelease();
const deployed=await fetch('https://ricardomalosso.github.io/publication.json?check='+Date.now(),{signal:AbortSignal.timeout(15000)}).then(async r=>r.ok?r.json():null).catch(()=>null);
const changed=deployed?.id!==latest.id;
if(process.env.GITHUB_OUTPUT)fs.appendFileSync(process.env.GITHUB_OUTPUT,`id=${latest.id}\nchanged=${changed}\n`);
console.log(JSON.stringify({id:latest.id,changed}));
