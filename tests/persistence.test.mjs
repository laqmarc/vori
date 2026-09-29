import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {apiRequest} from '../server/api.mjs';
import {PRESETS} from '../dist/audio.js';
const sqlite=new DatabaseSync(':memory:');
for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
const DB={prepare(sql){return {bind(...values){return {async all(){return {results:sqlite.prepare(sql).all(...values)};},async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};}};}};}};
const sound={name:'Piano nocturn',patch:{preset:'grand',settings:PRESETS[0].settings}};
const request=(path,method='GET',owner='alice',body,extra={})=>new Request('https://vori.example/api/sounds'+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),'Content-Type':'application/json','X-Vori-Request':'1',Origin:'https://vori.example',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
const send=(...args)=>apiRequest(request(...args),{DB});

test('Identity is required and untrusted cross-origin writes are rejected',async()=>{
  assert.equal((await send('','GET',null)).status,401);
  assert.equal((await send('/one','PUT','alice',sound,{Origin:'https://other.example'})).status,403);
  assert.equal((await send('/one','PUT','alice',sound,{'X-Vori-Request':''})).status,403);
});
test('A saved sound is durable and isolated by owner',async()=>{
  assert.equal((await send('/saved','PUT','alice',sound)).status,201);
  const rows=(await (await send('','GET','alice')).json()).sounds;assert.equal(rows.length,1);assert.deepEqual(rows[0].patch,sound.patch);
  assert.equal((await (await send('','GET','bob')).json()).sounds.length,0);
  await send('/saved','DELETE','bob');assert.equal((await (await send('','GET','alice')).json()).sounds.length,1);
});
test('Retries are idempotent and never create duplicate records',async()=>{
  await send('/retry','PUT','retry-user',sound);await send('/retry','PUT','retry-user',{...sound,name:'Actualitzat'});
  const rows=(await (await send('','GET','retry-user')).json()).sounds;assert.equal(rows.length,1);assert.equal(rows[0].name,'Actualitzat');
});
test('Invalid patches cannot overwrite a saved sound',async()=>{
  assert.equal((await send('/saved','PUT','alice',{...sound,patch:{preset:'organ',settings:{...sound.patch.settings,cutoff:101}}})).status,400);
  assert.equal((await send('/saved','PUT','alice',{...sound,name:'   '})).status,400);
  assert.equal((await (await send('','GET','alice')).json()).sounds[0].patch.preset,'grand');
});
test('The 64-sound cap is atomic; updating an existing record is still allowed',async()=>{
  for(let i=0;i<64;i++)assert.equal((await send('/s'+i,'PUT','cap-user',sound)).status,201);
  assert.equal((await send('/overflow','PUT','cap-user',sound)).status,409);
  assert.equal((await send('/s0','PUT','cap-user',{...sound,name:'Editat'})).status,201);
  assert.equal((await (await send('','GET','cap-user')).json()).sounds.length,64);
});
test('Deleting only the requested owner record preserves the rest',async()=>{
  await send('/retry','DELETE','retry-user');assert.equal((await (await send('','GET','retry-user')).json()).sounds.length,0);
  assert.equal((await (await send('','GET','alice')).json()).sounds.length,1);
});
test('Unavailable storage returns a recoverable error',async()=>{
  assert.equal((await apiRequest(request(''),{})).status,503);
});
