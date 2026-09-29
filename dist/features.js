import {PRESETS} from './audio.js';
import {LoopStation,mixWav} from './looper.js';
const $=s=>document.querySelector(s);
const STORE='vori.preferences.v2';
export function validatePatch(patch){
  if(!patch||!PRESETS.some(p=>p.id===patch.preset)||!patch.settings||!['off','lowpass','highpass','bandpass'].includes(patch.settings.filter))throw new Error('El so no és vàlid.');
  const settings={filter:patch.settings.filter};for(const key of ['cutoff','resonance','reverb','delay','attack','release']){const n=patch.settings[key];if(!Number.isFinite(n)||n<0||n>100)throw new Error('El so no és vàlid.');settings[key]=n;}
  return {preset:patch.preset,settings};
}
async function api(path,options={}){
  const r=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-Vori-Request':'1'},signal:AbortSignal.timeout(12000)});
  let value;try{value=await r.json();}catch{throw new Error('La biblioteca no està disponible. Torna-ho a provar.');}
  if(!r.ok)throw new Error(value.error||'No s’ha pogut desar. Torna-ho a provar.');return value;
}
export function setupFeatures({engine,state,unlock,silence,selectPreset,syncParameters}){
  let mode='play',library=[],saveId=null,starting=false,storageTimer;
  const message=(text,error=false)=>{$('#feature-message').textContent=text;$('#feature-message').classList.toggle('error',error);};
  const station=new LoopStation(engine,{onchange:update,onmessage:message});
  const patch=()=>({preset:state.preset,settings:{...engine.settings}});
  const snapshot=()=>({mode,patch:patch(),loop:{stage:station.stage,playing:station.playing,bpm:station.bpm,bars:station.bars,layers:station.layers.map(l=>({id:l.id,name:l.name,muted:l.muted,noteCount:l.noteCount}))}});
  function assertEditable(){if(station.busy)throw new Error('Acaba la presa abans de canviar de so.');}
  function flushPreferences(){clearTimeout(storageTimer);try{localStorage.setItem(STORE,JSON.stringify({mode,patch:patch(),volume:engine.volume}));}catch{/* UI preferences are optional; saved sounds use the server. */}}
  function remember(){clearTimeout(storageTimer);storageTimer=setTimeout(flushPreferences,120);}
  window.addEventListener('pagehide',flushPreferences);document.addEventListener('visibilitychange',()=>{if(document.hidden)flushPreferences();});
  function setMode(value){mode=value;document.body.classList.toggle('performance',mode==='play');document.body.classList.toggle('editing',mode==='edit');$('#mode-play').setAttribute('aria-pressed',String(mode==='play'));$('#mode-edit').setAttribute('aria-pressed',String(mode==='edit'));$('#sound-editor').inert=mode==='play';remember();}
  function applyPatch(value,name){assertEditable();const p=validatePatch(value);selectPreset(p.preset);engine.settings=p.settings;engine.applySettings();syncParameters();if(name){$('#sound-name').textContent=name;$('#sound-description').textContent='So personal · '+engine.preset.name;}remember();}
  function update(){
    const busy=station.busy,has=station.layers.length>0;
    $('#layer-count').textContent=`${station.layers.length} / 8 capes`;
    $('#record-loop').disabled=starting||station.stage==='rendering'||(!busy&&station.layers.length>=8);
    $('#record-loop').innerHTML=`<span aria-hidden="true">${busy?'■':'●'}</span> ${station.stage==='countin'?'Cancel·la':station.stage==='recording'?'Acaba':station.stage==='rendering'?'Preparant…':has?'Afegeix capa':'Grava'}`;
    $('#record-loop').dataset.recording=String(busy);$('#play-loop').disabled=(!has&&!busy)||station.stage==='rendering';$('#play-loop').textContent=station.playing?'Atura':'Reprodueix';
    $('#undo-loop').disabled=!has||busy;$('#new-loop').disabled=!has||busy;$('#export-loop').disabled=!has||busy||station.layers.every(l=>l.muted);
    $('#loop-bpm').disabled=has||busy||station.playing;$('#loop-bars').disabled=has||busy||station.playing;
    $('#loop-click').setAttribute('aria-pressed',String(station.metronome));
    for(const el of document.querySelectorAll('[data-preset],#filter-type,#cutoff,#resonance,#reverb,#delay,#attack,#release,#reset,#save-sound'))el.disabled=busy;
    if(!busy&&engine.settings.filter==='off'){$('#cutoff').disabled=true;$('#resonance').disabled=true;}
    $('#sound-editor').classList.toggle('sound-locked',busy);$('.loop-station').classList.toggle('recording',busy);$('.loop-station').classList.toggle('has-layers',has);
    $('#loop-hint').textContent=busy?'Cada capa conserva el so triat en començar.':has?'Toca una capa per silenciar-la · Canvia de so i afegeix-ne una altra':'4 pulsacions d’entrada · Grava una frase i afegeix-hi capes';
    $('#loop-layers').replaceChildren();station.layers.forEach((layer,i)=>{const b=document.createElement('button');b.className='layer';b.textContent=`${i+1} · ${layer.name}`;b.setAttribute('aria-label',`${layer.muted?'Activa':'Silencia'} la capa ${i+1}: ${layer.name}`);b.setAttribute('aria-pressed',String(!layer.muted));b.addEventListener('click',()=>station.mute(layer.id));$('#loop-layers').append(b);});
    if(station.stage==='rendering')$('#loop-status').textContent='Preparant la capa…';else if(station.stage==='idle')$('#loop-status').textContent=station.playing?'Bucle en marxa':has?'A punt per continuar':'A punt per gravar';
  }
  async function loadLibrary(){
    $('#library-status').textContent='Carregant els teus sons…';$('#reload-library').disabled=true;
    try{const result=await api('/api/sounds');if(!Array.isArray(result.sounds))throw new Error('Resposta no vàlida.');library=result.sounds.filter(s=>{try{validatePatch(s.patch);return typeof s.id==='string'&&typeof s.name==='string';}catch{return false;}});renderLibrary();$('#library-status').textContent=library.length?`${library.length} sons desats`:'Encara no tens cap so desat. Ajusta’n un i desa’l amb un nom.';}
    catch(error){$('#library-status').textContent=error.message;}finally{$('#reload-library').disabled=false;}
  }
  function renderLibrary(){
    $('#saved-sounds').replaceChildren();
    for(const sound of library){const row=document.createElement('div');row.className='saved-sound';const info=document.createElement('div'),name=document.createElement('strong'),description=document.createElement('small');name.textContent=sound.name;description.textContent=PRESETS.find(p=>p.id===sound.patch.preset)?.name||'';info.append(name,description);const actions=document.createElement('div');actions.className='saved-actions';const use=document.createElement('button'),remove=document.createElement('button');use.textContent='Carrega';use.setAttribute('aria-label','Carrega '+sound.name);use.disabled=station.busy;use.addEventListener('click',()=>{try{applyPatch(sound.patch,sound.name);$('#sound-library').close();message('So carregat: '+sound.name);}catch(error){$('#library-status').textContent=error.message;}});remove.textContent='Esborra';remove.setAttribute('aria-label','Esborra '+sound.name);remove.addEventListener('click',async()=>{remove.disabled=true;try{await api('/api/sounds/'+encodeURIComponent(sound.id),{method:'DELETE'});library=library.filter(s=>s.id!==sound.id);renderLibrary();$('#library-status').textContent='So esborrat.';}catch(error){$('#library-status').textContent=error.message;remove.disabled=false;}});actions.append(use,remove);row.append(info,actions);$('#saved-sounds').append(row);}
  }
  async function saveSound(name,id=crypto.randomUUID()){
    assertEditable();const trimmed=name.trim();if(!trimmed||trimmed.length>40)throw new Error('Escriu un nom d’entre 1 i 40 caràcters.');
    const result=await api('/api/sounds/'+id,{method:'PUT',body:JSON.stringify({name:trimmed,patch:patch()})});return result.sound;
  }
  function openSave(){if(station.busy){message('Acaba la presa abans de desar el so.');return;}$('#sound-library').close();silence();saveId=crypto.randomUUID();$('#sound-title').value=$('#sound-name').textContent;$('#save-status').textContent='';$('#save-dialog').showModal();$('#sound-title').select();}
  $('#mode-play').addEventListener('click',()=>setMode('play'));$('#mode-edit').addEventListener('click',()=>setMode('edit'));
  $('#save-sound').addEventListener('click',openSave);
  const saveFromLibrary=document.createElement('button');saveFromLibrary.textContent='Desa el so actual';saveFromLibrary.id='save-from-library';saveFromLibrary.addEventListener('click',openSave);$('#sound-library').insertBefore(saveFromLibrary,$('#library-status'));
  $('#library-button').addEventListener('click',()=>{silence();$('#sound-library').showModal();void loadLibrary();});$('#reload-library').addEventListener('click',loadLibrary);
  for(const b of document.querySelectorAll('[data-close]'))b.addEventListener('click',()=>document.getElementById(b.dataset.close).close());
  $('#save-form').addEventListener('submit',async e=>{e.preventDefault();const button=$('#confirm-save');if(button.disabled)return;button.disabled=true;$('#save-status').textContent='Desant…';try{const sound=await saveSound($('#sound-title').value,saveId);$('#save-dialog').close();$('#sound-name').textContent=sound.name;message('So desat: '+sound.name);}catch(error){$('#save-status').textContent=error.message;}finally{button.disabled=false;}});
  $('#record-loop').addEventListener('click',async()=>{
    if(starting)return;if(station.stage==='countin'){station.cancelTake();return;}if(station.stage==='recording'){await station.finish();return;}if(station.busy)return;
    starting=true;update();try{if(!await unlock())return;silence();station.arm(patch(),$('#sound-name').textContent);message('');}catch(error){message(error.message,true);}finally{starting=false;update();}
  });
  $('#play-loop').addEventListener('click',async()=>{if(station.playing){if(station.stage==='recording')await station.finish();station.stop();silence();return;}if(await unlock())station.play();});
  $('#undo-loop').addEventListener('click',()=>{station.undo();message('Última capa desfeta.');});
  $('#loop-click').addEventListener('click',()=>{station.metronome=!station.metronome;update();});
  function configure(){try{station.configure(Number($('#loop-bpm').value),Number($('#loop-bars').value));}catch(error){message(error.message,true);$('#loop-bpm').value=station.bpm;$('#loop-bars').value=station.bars;}}
  $('#loop-bpm').addEventListener('change',configure);$('#loop-bars').addEventListener('change',configure);
  $('#new-loop').addEventListener('click',()=>$('#clear-dialog').showModal());$('#confirm-clear').addEventListener('click',()=>{station.clear();silence();$('#clear-dialog').close();message('Bucle nou. Tria el tempo i comença a gravar.');});
  $('#export-loop').addEventListener('click',()=>{try{const blob=mixWav(station.layers,engine.volume),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`vori-${station.bpm}bpm-${station.bars}compassos.wav`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);message('WAV preparat: un cicle amb les capes actives, sense metrònom.');}catch(error){message(error.message,true);}});
  $('#panic').addEventListener('click',()=>station.stop());
  document.addEventListener('keydown',e=>{if(e.code==='Escape')station.stop();});
  const pause=()=>{if(station.playing||station.busy){station.stop();message('Bucle aturat en sortir de la pantalla. Les capes acabades es conserven.');}};
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>station.stop());
  window.addEventListener('beforeunload',e=>{if(station.layers.length||station.busy){e.preventDefault();e.returnValue='';}});
  $('#presets').addEventListener('click',remember);$('#sound-editor').addEventListener('input',remember);$('#sound-editor').addEventListener('change',remember);$('#volume').addEventListener('input',remember);
  try{const stored=JSON.parse(localStorage.getItem(STORE)||'null');if(stored){applyPatch(stored.patch);mode=stored.mode==='edit'?'edit':'play';if(Number.isFinite(stored.volume)&&stored.volume>=0&&stored.volume<=1){engine.setVolume(stored.volume);$('#volume').value=Math.round(stored.volume*100);$('#volume-value').textContent=Math.round(stored.volume*100)+'%';}}}catch{}
  setMode(mode);update();
  let last=0,lastStatus='';function animate(t){requestAnimationFrame(animate);if(document.hidden||t-last<50)return;last=t;$('#loop-progress').style.width=(station.position*100)+'%';if(station.stage==='countin'){const n=Math.max(1,Math.ceil((station.recordAt-engine.context.currentTime)/(60/station.bpm))),text=`Entra d’aquí a ${n} pulsacions`;if(text!==lastStatus){$('#loop-status').textContent=text;lastStatus=text;}}else if(station.stage==='recording'){const text=`Gravant · compàs ${Math.min(station.bars,Math.floor((engine.context.currentTime-station.recordAt)/(240/station.bpm))+1)} / ${station.bars}`;if(text!==lastStatus){$('#loop-status').textContent=text;lastStatus=text;}}else lastStatus='';}requestAnimationFrame(animate);
  return {assertEditable,remember,applyPatch,station,snapshot,saveSound,loadLibrary};
}
