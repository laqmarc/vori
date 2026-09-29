import {PianoEngine,releaseSeconds} from './audio.js';

export async function renderTake(take,samples,sampleRate=44100){
  const length=Math.round(take.duration*sampleRate),tail=Math.ceil((releaseSeconds(take.patch.settings.release)+3)*sampleRate);
  const context=new OfflineAudioContext(2,length+tail,sampleRate),synth=new PianoEngine(context);
  synth.setPreset(take.patch.preset);synth.samples=samples;synth.settings={...take.patch.settings};synth.applySettings();synth.setVolume(1);
  for(const [i,note] of take.notes.entries()){
    const id='render-'+i;synth.noteOn(id,note.midi,note.velocity,note.start);
    synth.release(id,releaseSeconds(take.patch.settings.release),note.end);
  }
  const rendered=await context.startRendering(),buffer=new AudioBuffer({length,numberOfChannels:2,sampleRate});
  // Wrap effect and release tails into the beginning, preserving a continuous loop.
  for(let ch=0;ch<2;ch++){const source=rendered.getChannelData(ch),target=buffer.getChannelData(ch);for(let i=0;i<source.length;i++)target[i%length]+=source[i];}
  return buffer;
}

export function mixWav(layers,volume=1){
  const audible=layers.filter(l=>!l.muted);if(!audible.length)throw new Error('Activa almenys una capa abans d’exportar.');
  const {length,sampleRate}=audible[0].buffer,channels=[new Float32Array(length),new Float32Array(length)];let peak=0;
  for(const layer of audible)for(let ch=0;ch<2;ch++){const data=layer.buffer.getChannelData(ch);for(let i=0;i<length;i++)channels[ch][i]+=data[i]*volume;}
  for(const channel of channels)for(const n of channel)peak=Math.max(peak,Math.abs(n));const gain=peak>.97?.97/peak:1;
  const bytes=new ArrayBuffer(44+length*4),view=new DataView(bytes);const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,36+length*4,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,2,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*4,true);view.setUint16(32,4,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,length*4,true);
  for(let i=0;i<length;i++)for(let ch=0;ch<2;ch++){const n=Math.max(-1,Math.min(1,channels[ch][i]*gain));view.setInt16(44+i*4+ch*2,Math.round(n*(n<0?32768:32767)),true);}
  return new Blob([bytes],{type:'audio/wav'});
}

export class LoopStation {
  constructor(engine,{onchange=()=>{},onmessage=()=>{}}={}){
    this.engine=engine;this.onchange=onchange;this.onmessage=onmessage;this.layers=[];this.bpm=100;this.bars=2;this.metronome=true;this.playing=false;this.stage='idle';this.pending=new Map();this.notes=[];this.tickNodes=new Set();this.generation=0;this.timer=null;
    engine.onattack=note=>this.captureOn(note);engine.onrelease=(id,time)=>this.captureOff(id,time);
  }
  get duration(){return this.bars*4*60/this.bpm;}
  get busy(){return this.stage!=='idle';}
  get position(){if(!this.playing||!this.engine.context)return 0;return Math.max(0,(this.engine.context.currentTime-this.epoch)%this.duration)/this.duration;}
  configure(bpm,bars){if(this.layers.length||this.busy||this.playing)throw new Error('Crea un bucle nou per canviar el tempo o els compassos.');if(!Number.isInteger(bpm)||bpm<60||bpm>180||![1,2,4].includes(bars))throw new Error('Tempo o compassos no vàlids.');this.bpm=bpm;this.bars=bars;this.onchange();}
  arm(patch,name){
    if(this.busy)return;if(this.layers.length>=8)throw new Error('El bucle ja té 8 capes. Desfés una capa per fer espai.');
    const now=this.engine.context.currentTime,beat=60/this.bpm;
    if(!this.playing){this.epoch=now+4*beat+.08;this.playing=true;this.startLayers(this.epoch);this.nextBeat=-4;}
    this.recordAt=Math.max(this.epoch,this.epoch+Math.ceil((now+.08-this.epoch)/this.duration)*this.duration);
    this.endAt=this.recordAt+this.duration;this.patch=structuredClone(patch);this.name=name;this.notes=[];this.pending.clear();this.stage='countin';this.ensureTimer();this.onchange();
  }
  captureOn(note){
    if(!['countin','recording'].includes(this.stage)||note.time<this.recordAt||note.time>=this.endAt)return;
    if(this.notes.length+this.pending.size>=512){this.onmessage('Límit de 512 notes per capa. Acaba aquesta presa per continuar.');return;}
    if(this.pending.has(note.id))this.captureOff(note.id,note.time);
    this.pending.set(note.id,{midi:note.midi,velocity:note.velocity,start:Math.max(0,note.time-this.recordAt)});
  }
  captureOff(id,time){const note=this.pending.get(id);if(!note)return;this.pending.delete(id);const end=Math.max(note.start+.005,Math.min(this.duration,time-this.recordAt));this.notes.push({...note,end:Math.min(this.duration,end)});}
  ensureTimer(){if(!this.timer)this.timer=setInterval(()=>this.update(),25);this.update();}
  update(){
    const now=this.engine.context.currentTime,beat=60/this.bpm;
    if(this.playing){
      if(this.nextBeat===undefined)this.nextBeat=Math.ceil((now-this.epoch)/beat);
      while(this.epoch+this.nextBeat*beat<now+.12){const t=this.epoch+this.nextBeat*beat;if(t>=now-.01&&(this.metronome||this.stage==='countin'))this.click(Math.max(t,now),((this.nextBeat%4)+4)%4===0);this.nextBeat++;}
    }
    if(this.stage==='countin'&&now>=this.recordAt){this.stage='recording';this.onchange();}
    if(this.stage==='recording'&&now>=this.endAt)void this.finish();
  }
  click(time,accent){const c=this.engine.context,o=c.createOscillator(),g=c.createGain();o.frequency.value=accent?1400:950;g.gain.setValueAtTime(.09,time);g.gain.exponentialRampToValueAtTime(.0001,time+.04);o.connect(g).connect(this.engine.master);o.start(time);o.stop(time+.045);const entry={o,g};this.tickNodes.add(entry);o.onended=()=>{o.disconnect();g.disconnect();this.tickNodes.delete(entry);};}
  async finish(){
    if(!['countin','recording'].includes(this.stage))return;
    if(this.stage==='countin'&&this.engine.context.currentTime<this.recordAt){this.cancelTake();return;}
    const end=Math.min(this.endAt,this.engine.context.currentTime);for(const id of [...this.pending.keys()])this.captureOff(id,end);
    const token=this.generation;this.stage='rendering';this.onchange();
    if(!this.notes.length){this.stage='idle';this.onmessage('No s’ha gravat cap nota. Torna a prémer Grava.');if(!this.layers.length)this.stop();this.onchange();return;}
    const take={duration:this.duration,patch:this.patch,notes:this.notes.map(n=>({...n}))};
    try{const buffer=await renderTake(take,this.engine.samples);if(token!==this.generation)return;const layer={id:crypto.randomUUID(),name:this.name,buffer,muted:false,noteCount:take.notes.length};this.layers.push(layer);this.stage='idle';if(this.playing){const now=this.engine.context.currentTime;this.startLayer(layer,this.epoch+Math.ceil((now+.04-this.epoch)/this.duration)*this.duration);}this.onmessage(`Capa ${this.layers.length} gravada · ${layer.name}`);this.onchange();}
    catch(error){if(token!==this.generation)return;this.stage='idle';this.onmessage('No s’ha pogut preparar la capa. Les capes anteriors es conserven.');console.error(error);this.onchange();}
  }
  cancelTake(){this.generation++;this.stage='idle';this.pending.clear();this.notes=[];if(!this.layers.length)this.stop();this.onmessage('Presa cancel·lada.');this.onchange();}
  startLayer(layer,when,offset=0){const c=this.engine.context;if(layer.source){try{layer.source.stop();}catch{}layer.gain.disconnect();}const source=c.createBufferSource(),gain=c.createGain();source.buffer=layer.buffer;source.loop=true;source.loopEnd=layer.buffer.duration;gain.gain.value=layer.muted?0:1;source.connect(gain).connect(this.engine.mix);source.start(when,offset);layer.source=source;layer.gain=gain;source.onended=()=>source.disconnect();}
  startLayers(when){for(const l of this.layers)this.startLayer(l,when);}
  play(){if(this.playing||!this.layers.length)return;this.epoch=this.engine.context.currentTime+.06;this.playing=true;this.nextBeat=0;this.startLayers(this.epoch);this.ensureTimer();this.onchange();}
  stop(){this.generation++;this.stage='idle';this.pending.clear();this.notes=[];this.playing=false;for(const l of this.layers){if(l.source){try{l.source.stop();}catch{}l.gain.disconnect();l.source=null;l.gain=null;}}for(const {o,g} of this.tickNodes){try{o.stop();}catch{}g.disconnect();}this.tickNodes.clear();clearInterval(this.timer);this.timer=null;this.onchange();}
  undo(){if(this.busy)return;const layer=this.layers.pop();if(layer?.source){try{layer.source.stop();}catch{}layer.gain.disconnect();}if(!this.layers.length)this.stop();this.onchange();}
  mute(id){const layer=this.layers.find(l=>l.id===id);if(!layer)return;layer.muted=!layer.muted;if(layer.gain)layer.gain.gain.setTargetAtTime(layer.muted?0:1,this.engine.context.currentTime,.015);this.onchange();}
  clear(){this.stop();this.layers=[];this.onchange();}
}
