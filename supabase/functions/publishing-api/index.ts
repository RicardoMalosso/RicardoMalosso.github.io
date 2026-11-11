import {createClient} from 'npm:@supabase/supabase-js@2.119.0';
import {validateDocument,routeScope} from './validation.mjs';
const repo='RicardoMalosso/RicardoMalosso.github.io';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const sha=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
async function rpc(name:string,args:object){const {data,error}=await db.rpc(name,args);if(error){const e=new Error(error.message);Object.assign(e,{status:error.code==='42501'?403:error.code==='40001'?409:error.code==='P0002'?404:400});throw e;}return data;}
async function github(path:string,options:RequestInit={}){const token=Deno.env.get('PORTFOLIO_GITHUB_TOKEN');if(!token)throw Error('GitHub deployment credential is not configured');return fetch(`https://api.github.com/repos/${repo}/${path}`,{...options,headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28',...options.headers},signal:AbortSignal.timeout(15000)});}
async function dispatch(job:any){if(!Deno.env.get('PORTFOLIO_GITHUB_TOKEN'))return {...job,status:'queued',dispatch:'scheduled',message:'Saved for the next automatic GitHub Pages check. Checks run about every five minutes; GitHub may delay scheduled runs.'};try{const r=await github('actions/workflows/pages.yml/dispatches',{method:'POST',body:JSON.stringify({ref:'main',inputs:{publication_id:job.id}})});if(!r.ok)throw Error(`GitHub dispatch failed (${r.status})`);return {...job,status:'queued',dispatch:'accepted'};}catch(e){return {...job,status:'queued',dispatch:'retry_required',message:(e as Error).message};}}
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');const allowed=['https://ricardomalosso.github.io','http://localhost:5173'];
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, idempotency-key','Access-Control-Allow-Methods':'GET,POST,PATCH,DELETE,OPTIONS'};
 if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'Origin denied'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
 const path=new URL(req.url).pathname.split('/publishing-api/v1')[1]||'';const scope=routeScope(req.method,path);
 const token=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');if(!token)return reply({error:'Authentication required'},401);
 let actor:string;
 if(token.startsWith('pat_')){if(scope==='session')return reply({error:'Google session required'},403);actor=await rpc('editor_token_resolve',{hash:await sha(token),required_scope:scope});}
 else{const {data,error}=await db.auth.getUser(token);if(error||!data.user)return reply({error:'Invalid session'},401);actor=data.user.id;await rpc('editor_identity',{actor});}
 const command=(command:string,payload:object={})=>rpc('editor_command',{actor,command,payload});
 let body:any={};if(!['GET','DELETE'].includes(req.method)){const text=await req.text();if(text.length>1500000)return reply({error:'Payload too large'},413);body=text?JSON.parse(text):{};}
 if(path==='/me'&&req.method==='GET')return reply({id:actor,email:'ricardomalosso@gmail.com',deploymentMode:Deno.env.get('PORTFOLIO_GITHUB_TOKEN')?'immediate':'scheduled'});
 if(path==='/tokens'){
 if(req.method==='GET')return reply(await command('tokens'));
 if(req.method==='POST'){
 if(typeof body.name!=='string'||!body.name.trim()||!Array.isArray(body.scopes)||!body.scopes.length||body.scopes.some((s:string)=>!['posts:read','posts:write','posts:publish'].includes(s)))return reply({error:'Name and valid scopes required'},400);
 const days=Number(body.days??30);if(!Number.isInteger(days)||days<1||days>365)return reply({error:'Expiry must be 1–365 days'},400);
 const raw='pat_'+Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
 const record=await command('token_create',{name:body.name,hash:await sha(raw),scopes:body.scopes,expires_at:new Date(Date.now()+days*86400000).toISOString()});return reply({...record,token:raw},201);
 }}
 const revoke=path.match(/^\/tokens\/([\w-]+)$/);if(revoke&&req.method==='DELETE')return reply(await command('token_revoke',{id:revoke[1]}));
 if(path==='/posts'){
 if(req.method==='GET')return reply(await command('list'));
 if(req.method==='POST'){const key=req.headers.get('idempotency-key');if(!key||key.length<8||key.length>128)return reply({error:'Idempotency-Key required (8–128 characters)'},400);const errors=validateDocument(body.document);if(errors.length)return reply({errors},422);return reply(await command('create',{document:body.document,idempotency_key:key}),201);}
 }
 const match=path.match(/^\/posts\/([\w-]+)(?:\/(validate|publish|archive|history|restore))?$/);
 if(match){const id=match[1],action=match[2];const current=await command('get',{id});if(!current)return reply({error:'Not found'},404);
 if(req.method==='GET'&&!action)return reply(current);
 if(req.method==='GET'&&action==='history')return reply(await command('history',{id}));
 if(req.method==='PATCH'&&!action){const errors=validateDocument(body.document);if(errors.length)return reply({errors},422);if(!Number.isInteger(body.revision))return reply({error:'revision required'},400);return reply(await command('save',{id,document:body.document,revision:body.revision}));}
 if(req.method==='POST'&&action==='validate')return reply({errors:validateDocument(current.document)});
 if(req.method==='POST'&&action==='restore'){const history=await command('history',{id});const saved=history.find((r:any)=>r.revision===body.restore_revision);if(!saved)return reply({error:'Revision not found'},404);if(!Number.isInteger(body.revision))return reply({error:'revision required'},400);return reply(await command('save',{id,document:saved.document,revision:body.revision}));}
 if(req.method==='POST'&&['publish','archive'].includes(action??'')){
 if(!Number.isInteger(body.revision))return reply({error:'revision required'},400);
 if(action==='publish'){const errors=validateDocument(current.document);if(errors.length)return reply({errors},422);}
 const key=req.headers.get('idempotency-key');if(!key||key.length<8||key.length>128)return reply({error:'Idempotency-Key required (8–128 characters)'},400);
 const job=await command(action!,{id,revision:body.revision,idempotency_key:key});return reply(await dispatch(job),202);
 }}
 const jobPath=path.match(/^\/publications\/([\w-]+)(?:\/(retry))?$/);
 if(jobPath){const job=await command('job',{id:jobPath[1]});if(!job)return reply({error:'Not found'},404);
 if(req.method==='POST'&&jobPath[2]==='retry')return reply(await dispatch(job),202);
 if(req.method==='GET'){
 const marker=await fetch('https://ricardomalosso.github.io/publication.json?check='+Date.now(),{signal:AbortSignal.timeout(10000)}).then(async r=>r.ok?await r.json():null).catch(()=>null);
 const live=marker?.id===job.id; const superseded=marker?.created_at && Date.parse(marker.created_at)>Date.parse(job.created_at);
 return reply({...job,status:live?'live':superseded?'superseded':'queued',site_url:live?'https://ricardomalosso.github.io/':undefined,run_url:'https://github.com/'+repo+'/actions/workflows/pages.yml',message:live?'Deployed successfully.':superseded?'A newer publication is live.':'Waiting for a successful deployment. Check GitHub Actions for build progress or failures.'});
 }

 }
 return reply({error:'Not found'},404);
 }catch(e){return reply({error:(e as Error).message},(e as any).status??400);}
});
