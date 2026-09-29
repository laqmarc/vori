const soundIds = ['grand','soft','electric','organ','synth','pad'];
const numericParams = ['cutoff','resonance','reverb','delay','attack','release'];
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
export function validateSound(value){
  if(!value||typeof value!=='object'||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>40)throw new Error('Escriu un nom d’entre 1 i 40 caràcters.');
  const p=value.patch;if(!p||!soundIds.includes(p.preset)||!p.settings||!['lowpass','highpass','bandpass','off'].includes(p.settings.filter))throw new Error('El so no és vàlid.');
  const settings={filter:p.settings.filter};for(const key of numericParams){const n=p.settings[key];if(!Number.isFinite(n)||n<0||n>100)throw new Error('Un ajust del so no és vàlid.');settings[key]=n;}
  return {name:value.name.trim(),patch:{preset:p.preset,settings}};
}
export async function apiRequest(request,env){
  const url=new URL(request.url),owner=request.headers.get('oai-authenticated-user-id');
  if(!owner)return json({error:'Cal iniciar sessió per recuperar els teus sons.'},401);
  if(!env.DB)return json({error:'La biblioteca no està disponible. Pots continuar tocant i tornar-ho a provar.'},503);
  const match=url.pathname.match(/^\/api\/sounds(?:\/([a-zA-Z0-9-]{1,64}))?$/);if(!match)return json({error:'No trobat'},404);
  const id=match[1];
  if(request.method!=='GET'){
    const origin=request.headers.get('Origin');
    if((origin&&origin!==url.origin)||request.headers.get('X-Vori-Request')!=='1')return json({error:'Petició no vàlida.'},403);
  }
  try{
    if(request.method==='GET'&&!id){const rows=await env.DB.prepare('SELECT id, name, payload, created_at FROM sounds WHERE owner_id = ? ORDER BY created_at DESC').bind(owner).all();return json({sounds:rows.results.map(row=>({id:row.id,name:row.name,patch:JSON.parse(row.payload),createdAt:row.created_at}))});}
    if(request.method==='PUT'&&id){
      if(!request.headers.get('Content-Type')?.includes('application/json'))return json({error:'Format no vàlid.'},415);
      if(Number(request.headers.get('Content-Length')||0)>4096)return json({error:'El so és massa gran.'},413);
      const body=await request.text();if(body.length>4096)return json({error:'El so és massa gran.'},413);
      let data;try{data=validateSound(JSON.parse(body));}catch(e){return json({error:e.message||'El so no és vàlid.'},400);}
      const createdAt=Date.now();
      // One atomic statement enforces the per-owner cap even across tabs.
      const result=await env.DB.prepare('INSERT INTO sounds (owner_id, id, name, payload, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM sounds WHERE owner_id = ?) < 64 OR EXISTS (SELECT 1 FROM sounds WHERE owner_id = ? AND id = ?) ON CONFLICT(owner_id, id) DO UPDATE SET name = excluded.name, payload = excluded.payload').bind(owner,id,data.name,JSON.stringify(data.patch),createdAt,owner,owner,id).run();
      if(!result.meta?.changes)return json({error:'Ja tens 64 sons. Esborra’n un per fer espai.'},409);
      return json({sound:{id,...data,createdAt}},201);
    }
    if(request.method==='DELETE'&&id){await env.DB.prepare('DELETE FROM sounds WHERE owner_id = ? AND id = ?').bind(owner,id).run();return json({deleted:true});}
    return json({error:'Acció no disponible.'},405);
  }catch(error){console.error('Vori sound storage failed',error.message);return json({error:'No s’ha pogut accedir als sons. Els teus ajustos continuen aquí; torna-ho a provar.'},503);}
}
