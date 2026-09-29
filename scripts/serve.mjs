import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {apiRequest} from '../server/api.mjs';
import {localDatabase} from './local-db.mjs';
const root=resolve(import.meta.dirname,'../dist');
const DB=localDatabase(resolve(import.meta.dirname,'../.local'));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{
  const url=new URL(req.url,'http://127.0.0.1:4175'),pathname=decodeURIComponent(url.pathname);
  if(pathname.startsWith('/api/')){
    let body='';for await(const chunk of req){body+=chunk;if(body.length>4096){res.writeHead(413).end('Massa dades');return;}}
    const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-user');
    const request=new Request(url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});
    const response=await apiRequest(request,{DB});res.writeHead(response.status,Object.fromEntries(response.headers)).end(Buffer.from(await response.arrayBuffer()));return;
  }
  const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+sep)||pathname.startsWith('/server/')){res.writeHead(403).end();return;}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);
}catch(error){console.error(error.message);res.writeHead(404).end('No trobat');}}).listen(4175,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4175/'));
