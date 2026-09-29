export const PRESETS = [
  {id:'grand',name:'Piano de cua',family:'PIANO ACÚSTIC',description:'Clar, càlid i ple de matisos.',settings:{filter:'lowpass',cutoff:89,resonance:3,reverb:20,delay:0,attack:0,release:21}},
  {id:'soft',name:'Piano suau',family:'PIANO ÍNTIM',description:'Un so delicat, molt a prop teu.',settings:{filter:'lowpass',cutoff:62,resonance:0,reverb:34,delay:0,attack:4,release:31}},
  {id:'electric',name:'Elèctric',family:'PIANO ELÈCTRIC',description:'Rodó, brillant, amb ànima de soul.',settings:{filter:'lowpass',cutoff:83,resonance:5,reverb:16,delay:16,attack:0,release:27}},
  {id:'organ',name:'Orgue',family:'ORGUE CLÀSSIC',description:'Harmònics vius i notes que respiren.',settings:{filter:'lowpass',cutoff:87,resonance:0,reverb:28,delay:0,attack:1,release:6}},
  {id:'synth',name:'Sintetitzador',family:'SÍNTESI ANALÒGICA',description:'Dues ones, una mica d’electricitat.',settings:{filter:'lowpass',cutoff:58,resonance:22,reverb:16,delay:23,attack:3,release:21}},
  {id:'pad',name:'Ambient',family:'TEXTURA ATMOSFÈRICA',description:'Acords que floten sense pressa.',settings:{filter:'lowpass',cutoff:53,resonance:8,reverb:58,delay:28,attack:53,release:75}}
];
export const SAMPLE_NOTES = {C2:36,Fs2:42,C3:48,Fs3:54,C4:60,Ds4:63,Fs4:66,A4:69,C5:72,Fs5:78,C6:84,Fs6:90,C7:96};
export const frequency = v => 80 * (18000 / 80) ** (v / 100);
export const attackSeconds = v => .005 + (v / 100) ** 2 * 2;
export const releaseSeconds = v => .06 + (v / 100) ** 1.6 * 5;
const smooth=(param,value,t)=>param.setTargetAtTime(value,t,.018);

export class PianoEngine {
  constructor(context){this.context=context;this.voices=new Map();this.allVoices=new Set();this.samples=new Map();this.preset=PRESETS[0];this.settings={...this.preset.settings};this.volume=.65;this.sustain=false;this.onchange=()=>{};this.onstatus=()=>{};if(context)this.build();}
  build(){
    const c=this.context;
    this.input=c.createGain();this.filter=c.createBiquadFilter();this.trim=c.createGain();this.trim.gain.value=.48;
    this.mix=c.createGain();this.compressor=c.createDynamicsCompressor();this.compressor.threshold.value=-9;this.compressor.knee.value=9;this.compressor.ratio.value=8;this.compressor.attack.value=.003;this.compressor.release.value=.18;
    this.master=c.createGain();this.master.gain.value=this.volume;this.analyser=c.createAnalyser();this.analyser.fftSize=1024;
    this.input.connect(this.filter).connect(this.trim);this.mix.connect(this.compressor).connect(this.master).connect(this.analyser).connect(c.destination);
    this.impulse=c.createBuffer(2,Math.floor(c.sampleRate*2.2),c.sampleRate);
    let seed=37;for(let ch=0;ch<2;ch++){const d=this.impulse.getChannelData(ch);for(let i=0;i<d.length;i++){seed=(seed*16807)%2147483647;d[i]=(seed/1073741823.5-1)*Math.pow(1-i/d.length,3);}}
    this.buildEffects();this.applySettings();
  }
  buildEffects(){
    const c=this.context;if(this.fx){this.trim.disconnect();for(const n of this.fx)n.disconnect();}
    this.dry=c.createGain();this.dry.gain.value=.86;this.trim.connect(this.dry).connect(this.mix);
    this.reverbSend=c.createGain();this.reverbSend.gain.value=0;this.convolver=c.createConvolver();this.convolver.buffer=this.impulse;this.trim.connect(this.reverbSend).connect(this.convolver).connect(this.mix);
    this.delaySend=c.createGain();this.delaySend.gain.value=0;this.delay=c.createDelay(1);this.delay.delayTime.value=.32;this.feedback=c.createGain();this.feedback.gain.value=.32;this.delayFilter=c.createBiquadFilter();this.delayFilter.frequency.value=3200;
    this.trim.connect(this.delaySend).connect(this.delay).connect(this.delayFilter);this.delayFilter.connect(this.mix);this.delayFilter.connect(this.feedback).connect(this.delay);
    this.fx=[this.dry,this.reverbSend,this.convolver,this.delaySend,this.delay,this.feedback,this.delayFilter];
  }
  async start(){
    if(!this.context){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;if(!AC)throw new Error('Aquest navegador no admet àudio. Prova un navegador actualitzat.');this.context=new AC({latencyHint:'interactive'});this.build();}
    const resumed=this.context.state==='running'?Promise.resolve():this.context.resume();
    if(!this.loading)this.loading=this.loadSamples();
    await resumed;await this.loading;return this.context.state==='running';
  }
  async loadSamples(){
    this.onstatus('Carregant el piano…');let failed=0;const jobs=Object.entries(SAMPLE_NOTES);let cursor=0;
    const worker=async()=>{while(cursor<jobs.length){const [name,midi]=jobs[cursor++];try{const response=await fetch(new URL(`samples/${name}.mp3`,import.meta.url),{signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error('Mostra no disponible');const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.samples.set(midi,buffer);}catch{failed++;}}};
    await Promise.all([worker(),worker(),worker()]);
    this.onstatus(failed===jobs.length?'Piano sintetitzat · mostres no disponibles':failed?'Piano a punt · algunes mostres no disponibles':'A punt per tocar');
  }
  setPreset(id){const p=PRESETS.find(x=>x.id===id);if(!p)throw new Error('So desconegut');this.panic();this.preset=p;this.settings={...p.settings};this.applySettings();}
  setParameter(name,value){if(name==='filter'){if(!['lowpass','highpass','bandpass','off'].includes(value))throw new Error('Filtre no vàlid');}else if(!['cutoff','resonance','reverb','delay','attack','release'].includes(name)||!Number.isFinite(value)||value<0||value>100)throw new Error('Valor no vàlid');this.settings[name]=value;this.applySettings();}
  applySettings(){if(!this.context)return;const t=this.context.currentTime,s=this.settings;this.filter.type=s.filter==='off'?'allpass':s.filter;smooth(this.filter.frequency,Math.min(frequency(s.cutoff),this.context.sampleRate*.45),t);smooth(this.filter.Q,s.filter==='off'?0:.5+s.resonance/100*10,t);smooth(this.reverbSend.gain,s.reverb/100*.7,t);smooth(this.delaySend.gain,s.delay/100*.55,t);}
  setVolume(value){this.volume=value;if(this.context)smooth(this.master.gain,value,this.context.currentTime);}
  setSustain(on){this.sustain=on;if(!on)for(const [id,v] of this.voices)if(v.deferred)this.release(id);}
  noteOn(id,midi,velocity=.75){
    if(!this.context||(this.context.state==='suspended'&&!this.context.startRendering))return;
    if(this.voices.has(id))this.release(id,.01);
    while(this.allVoices.size>=24){const oldest=this.allVoices.values().next().value;oldest.env.disconnect();for(const source of oldest.sources){try{source.stop(this.context.currentTime+.005);}catch{}}this.allVoices.delete(oldest);if(this.voices.get(oldest.id)===oldest)this.voices.delete(oldest.id);}
    const c=this.context,t=c.currentTime,f=440*2**((midi-69)/12),env=c.createGain(),nodes=[],sources=[];
    env.connect(this.input);let level=.24*velocity,decay=0,tail=.7;
    const osc=(type,hz,gain=1,detune=0)=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.value=hz;o.detune.value=detune;g.gain.value=gain;o.connect(g).connect(env);nodes.push(g);sources.push(o);return o;};
    if((this.preset.id==='grand'||this.preset.id==='soft')&&this.samples.size){
      const root=[...this.samples.keys()].reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a);const sample=c.createBufferSource();sample.buffer=this.samples.get(root);sample.playbackRate.value=2**((midi-root)/12);sample.connect(env);sources.push(sample);level=1.15*velocity;tail=1;
    }else if(this.preset.id==='electric'){
      const carrier=osc('sine',f),mod=c.createOscillator(),depth=c.createGain();mod.frequency.value=f*2;depth.gain.setValueAtTime(f*1.4,t);depth.gain.exponentialRampToValueAtTime(f*.025,t+1.3);mod.connect(depth).connect(carrier.frequency);sources.push(mod);nodes.push(depth);osc('sine',f*2,.18);decay=3.2;tail=.025;level=.34*velocity;
    }else if(this.preset.id==='organ'){
      const o=c.createOscillator();const real=new Float32Array(9),imag=new Float32Array([0,1,.48,.65,.22,.12,.1,.06,.08]);o.setPeriodicWave(c.createPeriodicWave(real,imag));o.frequency.value=f;o.connect(env);sources.push(o);level=.28*velocity;
    }else if(this.preset.id==='synth'){
      osc('sawtooth',f,.5,-5);osc('sawtooth',f,.5,5);level=.2*velocity;
    }else if(this.preset.id==='pad'){
      osc('triangle',f,.65,-7);osc('sawtooth',f,.18,7);osc('sine',f/2,.23);level=.28*velocity;
    }else{
      osc('triangle',f,.7);osc('sine',f*2,.25);osc('sine',f*3.002,.12);decay=2.8;tail=.015;level=.3*velocity;
    }
    const attack=attackSeconds(this.settings.attack);env.gain.setValueAtTime(0,t);env.gain.linearRampToValueAtTime(level,t+attack);if(decay)env.gain.exponentialRampToValueAtTime(Math.max(.0001,level*tail),t+attack+decay);
    const voice={id,env,nodes,sources,midi,released:false,deferred:false};this.voices.set(id,voice);this.allVoices.add(voice);let ended=0;
    const dispose=()=>{if(++ended<sources.length)return;env.disconnect();for(const node of [...nodes,...sources])node.disconnect();this.allVoices.delete(voice);if(this.voices.get(id)===voice)this.voices.delete(id);this.onchange();};
    for(const source of sources){source.onended=dispose;source.start(t);}this.onchange();return voice;
  }
  noteOff(id){const v=this.voices.get(id);if(!v)return;if(this.sustain){v.deferred=true;return;}this.release(id);}
  release(id,duration=releaseSeconds(this.settings.release)){
    const v=this.voices.get(id);if(!v||v.released)return;v.released=true;const t=this.context.currentTime,g=v.env.gain;
    if(g.cancelAndHoldAtTime)g.cancelAndHoldAtTime(t);else{g.cancelScheduledValues(t);g.setValueAtTime(g.value,t);}
    g.linearRampToValueAtTime(0,t+duration);for(const source of v.sources){try{source.stop(t+duration+.025);}catch{}}
    this.voices.delete(id);this.onchange();
  }
  panic(){if(!this.context)return;for(const voice of this.allVoices){voice.env.disconnect();for(const source of voice.sources){try{source.stop(this.context.currentTime+.01);}catch{}}}this.voices.clear();this.allVoices.clear();this.onchange();this.sustain=false;this.buildEffects();this.applySettings();}
}
