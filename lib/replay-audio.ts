type ReplayCue='deal'|'draw'|'life'|'reveal'|'turn'|'don'|'play'|'attack'|'block'|'counter'|'attach'|'return'|'trash'|'bottom'|'dice';

let context:AudioContext|undefined;
let enabled=false;
let showdownActive=false;
let matchActive=false;
let musicNodes:OscillatorNode[]=[];
let musicGains:GainNode[]=[];
let musicTimer:number|undefined;

function audioContext(){
 if(typeof window==='undefined')return undefined;
 const AudioContextType=window.AudioContext??(window as Window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
 if(!AudioContextType)return undefined;
 context??=new AudioContextType();
 return context;
}

function tone(frequency:number,duration:number,volume:number,wave:OscillatorType='sine',endFrequency=frequency){
 const audio=audioContext();if(!enabled||!audio)return;
 const now=audio.currentTime,oscillator=audio.createOscillator(),gain=audio.createGain();
 oscillator.type=wave;oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endFrequency),now+duration);
 gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);oscillator.stop(now+duration+.02);
}

function noise(duration:number,volume:number,cutoff:number){
 const audio=audioContext();if(!enabled||!audio)return;
 const length=Math.max(1,Math.floor(audio.sampleRate*duration)),buffer=audio.createBuffer(1,length,audio.sampleRate),data=buffer.getChannelData(0);
 for(let index=0;index<length;index++)data[index]=Math.random()*2-1;
 const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain(),now=audio.currentTime;
 source.buffer=buffer;filter.type='lowpass';filter.frequency.value=cutoff;gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
 source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(now);source.stop(now+duration);
}

function stopMusic(){
 if(musicTimer!==undefined)window.clearTimeout(musicTimer);musicTimer=undefined;
 const audio=context;if(!audio)return;
 const now=audio.currentTime;
 musicGains.forEach(gain=>{gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(.0001,now,.16)});
 const nodes=musicNodes;window.setTimeout(()=>nodes.forEach(node=>{try{node.stop()}catch{}}),700);
 musicNodes=[];musicGains=[];
}

function startMusic(){
 const audio=audioContext();if(!enabled||(!showdownActive&&!matchActive)||!audio||musicNodes.length)return;
 void audio.resume();
 const notes:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=showdownActive?[[110,164.81,220],[98,146.83,196],[130.81,164.81,196],[110,146.83,220]]:[[82.41,123.47,164.81],[73.42,110,146.83],[87.31,130.81,174.61],[65.41,98,146.83]];
 const now=audio.currentTime;
 for(const frequency of notes[0]){
  const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=frequency;
  gain.gain.setValueAtTime(.0001,now);gain.gain.linearRampToValueAtTime(.012,now+1.1);
  oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now);musicNodes.push(oscillator);musicGains.push(gain);
 }
 let chord=1;
 const change=()=>{
  if(!enabled||(!showdownActive&&!matchActive)||!audioContext())return;
  const time=audio.currentTime;
  musicNodes.forEach((oscillator,index)=>oscillator.frequency.setTargetAtTime(notes[chord][index],time,.45));
  chord=(chord+1)%notes.length;musicTimer=window.setTimeout(change,1900);
 };
 musicTimer=window.setTimeout(change,1900);
}

export function setReplaySoundEnabled(value:boolean){
 enabled=value;
 const audio=value?audioContext():undefined;
 if(value&&audio){void audio.resume();startMusic()}
 else stopMusic();
}

export function setReplayShowdownActive(value:boolean){
 showdownActive=value;
 if(value){matchActive=false;stopMusic();startMusic()}else{stopMusic();if(matchActive)startMusic()}
}

export function setReplayMatchActive(value:boolean){
 matchActive=value;
 if(value){showdownActive=false;stopMusic();startMusic()}else{stopMusic();if(showdownActive)startMusic()}
}

export function playReplayCue(cue:ReplayCue,index=0){
 if(!enabled)return;
 const offset=(index%3)*.018;
 switch(cue){
  case 'dice':noise(.34,.085,1500);tone(170,.42,.05,'triangle',54);tone(92,.16,.028,'sine',48);break;
  case 'reveal':tone(220,.46,.027,'triangle',330);tone(330,.52,.02,'sine',495);tone(440,.58,.014,'sine',660);break;
  case 'turn':tone(392,.32,.018,'sine',523.25);tone(587.33,.42,.012,'sine',440);break;
  case 'deal':noise(.09,.018,2600);tone(680+index%5*28,.11,.012,'sine',420);break;
  case 'draw':case 'life':noise(.12,.032,2200);tone(cue==='life'?620:520,.2,.025,'triangle',cue==='life'?920:380);break;
  case 'don':tone(620+offset*700,.18,.024,'sine',840);break;
  case 'play':tone(440,.3,.028,'triangle',660);tone(660,.34,.018,'sine',880);break;
  case 'attack':noise(.22,.045,1100);tone(140,.3,.055,'triangle',62);break;
  case 'block':tone(104,.19,.07,'triangle',58);noise(.075,.025,700);break;
  case 'counter':tone(740,.2,.024,'sine',980);tone(988,.32,.018,'sine',1318);break;
  case 'attach':tone(840,.14,.018,'triangle',1120);break;
  case 'return':case 'trash':case 'bottom':noise(.15,.026,1300);tone(260,.16,.018,'sine',150);break;
 }
}
