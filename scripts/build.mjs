import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const project=resolve(import.meta.dirname,'..'),root=resolve(project,'dist');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(dir){for(const file of await readdir(dir,{withFileTypes:true})){if(file.name==='server'||file.name==='.openai')continue;const p=resolve(dir,file.name);if(file.isDirectory())await walk(p);else{const route='/'+relative(root,p).replaceAll('\\','/');assets[route]={type:types[extname(p)]||'application/octet-stream',base64:(await readFile(p)).toString('base64')};}}}
await walk(root);
const api=await readFile(resolve(project,'server/api.mjs'),'utf8');
const worker=api+'\nconst assets='+JSON.stringify(assets)+';\n'+`export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return apiRequest(request,env);if(!['GET','HEAD'].includes(request.method))return new Response('Mètode no admès',{status:405});const asset=assets[url.pathname==='/'?'/index.html':url.pathname];if(!asset)return new Response('No trobat',{status:404});return new Response(request.method==='HEAD'?null:Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0)),{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.endsWith('.mp3')?'private, max-age=86400':'no-cache','X-Content-Type-Options':'nosniff'}});}};`;
await mkdir(resolve(root,'server'),{recursive:true});await writeFile(resolve(root,'server/index.js'),worker);
console.log('Worker ready: '+Object.keys(assets).length+' assets, '+Buffer.byteLength(worker)+' bytes.');
