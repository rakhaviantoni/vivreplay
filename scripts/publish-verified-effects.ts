import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {EffectAction,EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {scenarios,type Identity} from './card-effect-scenarios';
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const normalizedWindowText=(value:string)=>value.replace(/\s+/g,' ').replace(/[−–—]/g,'-').replace(/Activate:\s*Main/gi,'Activate: Main').replace(/\[(DON!!\s*[x×]\s*\d+)\]\s*(\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\])/gi,'$2 [$1]').replace(/DON!!\s*[x×]/gi,'DON!!x').replace(/\{([^{}]+)\}/g,'[$1]').replace(/gains\s+\[?(Rush|Blocker|Double Attack|Banish)\]?/gi,'gains [$1]').replace(/\s*\(/g,' (').replace(/\s+([.,:;])/g,'$1').replace(/\]\s*\[/g,'] [');
const containsSourceWindow=(source:string,window:string)=>{const normalizedSource=normalizedWindowText(source),normalizedWindow=normalizedWindowText(window),expandedSource=normalizedSource.replace(/\[([^\]]+)\]\s*\/\s*\[([^\]]+)\]/gi,'[$1] [$2]');return normalizedSource.includes(normalizedWindow)||expandedSource.includes(normalizedWindow);};
type Row={code:string;name:string;printedText:string;publishedText:string|null;localSchema:EffectDocument;databaseSchema:EffectDocument|null;textMatches:boolean};
const windowPresentInBothSources=(card:Row,window:string)=>Boolean(card.publishedText&&containsSourceWindow(card.printedText,window)&&containsSourceWindow(card.publishedText,window));
function scenarioWindow(name:string,schema:EffectDocument):EffectTrigger|undefined{
 if(name.startsWith('End of Your Turn: ready only a cost 3–8 Supernovas Character'))return 'end-turn';
 if(name.startsWith('Character played from Trash:'))return 'character-played-from-trash';
 if(name==='continuous: separate effect immunity and DON!!-plus-zero-cost Double Attack')return 'unknown';
 if(/^schema-reference trigger:/i.test(name))return 'trigger';
 if(/^schema-keyword-isolation on-play:/i.test(name))return 'on-play';
 const actionTiming=name.match(/^engine-action ([^ ]+) /i)?.[1] as EffectTrigger|undefined;
 if(actionTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn','continuous','unknown'].includes(actionTiming))return actionTiming;
 const keywordActionTiming=name.match(/^engine-action ([^ ]+) grant-keyword-target:/i)?.[1] as EffectTrigger|undefined;
 if(keywordActionTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn','continuous','unknown'].includes(keywordActionTiming))return keywordActionTiming;
 const keywordGrantTiming=name.match(/^schema-keyword-grant ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(keywordGrantTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(keywordGrantTiming))return keywordGrantTiming;
 const attachedDonTiming=name.match(/^schema-attached-don-rest ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(attachedDonTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn','continuous','unknown'].includes(attachedDonTiming))return attachedDonTiming;
 const opponentPowerTiming=name.match(/^schema-opponent-power ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(opponentPowerTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(opponentPowerTiming))return opponentPowerTiming;
 const powerTiming=name.match(/^schema-power ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(powerTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(powerTiming))return powerTiming;
 const returnHandTiming=name.match(/^schema-return-hand ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(returnHandTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(returnHandTiming))return returnHandTiming;
 const restTargetTiming=name.match(/^schema-rest-target ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restTargetTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(restTargetTiming))return restTargetTiming;
 const readyTargetTiming=name.match(/^schema-ready-target ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(readyTargetTiming&&['on-play','when-attacking','activate-main','main','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(readyTargetTiming))return readyTargetTiming;
 const preventReadyTiming=name.match(/^schema-prevent-ready ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(preventReadyTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(preventReadyTiming))return preventReadyTiming;
 const koTiming=name.match(/^schema-ko ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(koTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(koTiming))return koTiming;
 const searchTiming=name.match(/^schema-search ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(searchTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','unknown'].includes(searchTiming))return searchTiming;
 const reorderTiming=name.match(/^schema-reorder ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(reorderTiming&&['on-play','when-attacking','activate-main','main','trigger','unknown'].includes(reorderTiming))return reorderTiming;
 const resetTiming=name.match(/^schema-hand-reset ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(resetTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','continuous','end-turn','unknown'].includes(resetTiming))return resetTiming;
 const bottomTiming=name.match(/^schema-bottom-deck ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(bottomTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','continuous','end-turn','unknown'].includes(bottomTiming))return bottomTiming;
 const lifeTiming=name.match(/^schema-turn-life-cost(?:-add-don)? ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(lifeTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(lifeTiming))return lifeTiming;
 const drawTiming=name.match(/^schema-draw ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(drawTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(drawTiming))return drawTiming;
 const conditionalDrawTiming=name.match(/^schema-conditional-draw ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(conditionalDrawTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(conditionalDrawTiming))return conditionalDrawTiming;
 const selfTrashDrawTiming=name.match(/^schema-self-trash-conditional-draw ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(selfTrashDrawTiming&&['activate-main','on-play'].includes(selfTrashDrawTiming))return selfTrashDrawTiming;
 const mihawkTiming=name.match(/^schema-mihawk-rested-don ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(mihawkTiming&&mihawkTiming==='activate-main')return mihawkTiming;
 const compoundDonTiming=name.match(/^schema-compound-rest-hand-add-don ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(compoundDonTiming&&compoundDonTiming==='main')return compoundDonTiming;
 const restSelfSearchTiming=name.match(/^schema-rest-self-search ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restSelfSearchTiming&&restSelfSearchTiming==='activate-main')return restSelfSearchTiming;
 const lifeToHandTiming=name.match(/^schema-life-to-hand ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(lifeToHandTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(lifeToHandTiming))return lifeToHandTiming;
 const trashLifeTiming=name.match(/^schema-trash-life ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(trashLifeTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(trashLifeTiming))return trashLifeTiming;
 const returnDonTiming=name.match(/^schema-return-don-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(returnDonTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(returnDonTiming))return returnDonTiming;
 const topKnotTiming=name.match(/^schema-top-knot-reference ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(topKnotTiming==='main')return topKnotTiming;
 const readyDonTiming=name.match(/^schema-ready-don ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(readyDonTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(readyDonTiming))return readyDonTiming;
 const readyDonGateTiming=name.match(/^schema-ready-don-gate ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(readyDonGateTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(readyDonGateTiming))return readyDonGateTiming;
 const restDonTiming=name.match(/^schema-rest-don-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restDonTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(restDonTiming))return restDonTiming;
 const restedDonAdditionTiming=name.match(/^schema-rested-don-addition ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restedDonAdditionTiming&&['activate-main'].includes(restedDonAdditionTiming))return restedDonAdditionTiming;
 const handTrashTiming=name.match(/^schema-hand-trash-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(handTrashTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(handTrashTiming))return handTrashTiming;
 const playTiming=name.match(/^schema-play ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(playTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','continuous','unknown'].includes(playTiming))return playTiming;
 const namedKeyword=name.match(/^keyword (Rush|Blocker|Double Attack|Banish):/i);
 if(namedKeyword){const label=namedKeyword[1].toLowerCase();return schema.ast.find(window=>new RegExp(`^\\[${label}\\]`,'i').test(window.rawText.trimStart()))?.trigger;}
 if(/^blocker:/i.test(name))return schema.ast.find(window=>/^\[Blocker\]/i.test(window.rawText.trimStart()))?.trigger;
 if(/^don:/i.test(name))return schema.ast.find(window=>/^Your Turn \+1000$/i.test(window.rawText.trim()))?.trigger;
 const prefix=name.split(':')[0].trim();
 const aliases:Record<string,EffectTrigger>={'On Play':'on-play','on-play':'on-play','When Attacking':'when-attacking','when-attacking':'when-attacking','Activate: Main':'activate-main','Activate Main':'activate-main','activate-main':'activate-main','Main':'main','main':'main','Counter':'counter','counter':'counter','Trigger':'trigger','trigger':'trigger','On K.O.':'on-ko','on-ko':'on-ko','On Block':'on-block','on-block':'on-block','opponent-attack':'opponent-attack','end-turn':'end-turn','continuous':'continuous','unknown':'unknown'};
 if(prefix in aliases)return aliases[prefix];
 if(/^no-effect$/i.test(prefix))return 'unknown';
 return undefined;
}
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string}};cards:Array<Row&{databaseScenarios:Array<{name:string;status:string}>}>};
const candidates=[];
const blocked:Record<string,number>={};
const block=(reason:string)=>{blocked[reason]=(blocked[reason]??0)+1;};
for(const card of snapshot.cards){
 const cases=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 if(!card.databaseSchema){
  if(card.code==='P-163'&&cases.some(s=>s.name.startsWith('schema-mihawk-rested-don '))){
   const localWindow=card.localSchema.ast.filter(ast=>ast.trigger==='activate-main'),localNormalized=card.localSchema.normalized.filter(effect=>effect.timing==='activate-main');
   if(localWindow.length!==1||localNormalized.length!==1){block('p163-missing-window-not-isolated');continue;}
   try{for(const scenario of cases.filter(s=>s.name.startsWith('schema-mihawk-rested-don ')))scenario.run(card.localSchema);}catch{block('p163-scenario-failed');continue;}
   const after=structuredClone(card.localSchema);after.implementationStatus='PARSED';const changed:EffectTrigger[]=['activate-main'];
   candidates.push({code:card.code,printedText:card.printedText,publishedText:null,timings:changed,scenarioNames:cases.filter(s=>s.name.startsWith('schema-mihawk-rested-don ')).map(s=>s.name),scenarioCount:1,before:null,after,beforeHash:hash(null),afterHash:hash(after)});continue;
  }
  if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('missing-schema');continue;
 }
 if(!cases.length){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('no-scenarios');continue;}
 const failingNames=new Set(card.databaseScenarios.filter(s=>s.status==='FAIL').map(s=>s.name));
 const timings=new Set(cases.filter(s=>failingNames.has(s.name)).map(s=>scenarioWindow(s.name,card.localSchema)).filter((timing):timing is EffectTrigger=>Boolean(timing)));
 let after=structuredClone(card.databaseSchema);
 const changed:EffectTrigger[]=[];
 let effectTextAfter:string|undefined;
 let preserveImplementationStatus=false;
 const op02TimingCases=cases.filter(s=>s.name.startsWith('schema-bottom-deck when-attacking:')||s.name.startsWith('schema-reorder on-play:'));
 const repairOp02CrossTiming=card.code==='OP02-056'&&op02TimingCases.some(s=>s.name.startsWith('schema-bottom-deck '))&&op02TimingCases.some(s=>s.name.startsWith('schema-reorder '))&&timings.has('when-attacking')&&timings.has('on-play');
 const referenceCases=cases.filter(s=>s.name.startsWith('schema-reference trigger:'));
 const mainKoCases=cases.filter(s=>s.name.startsWith('schema-ko main:'));
 const localMainAst=card.localSchema.ast.filter(ast=>ast.trigger==='main'),localMainEffect=card.localSchema.normalized.filter(effect=>effect.timing==='main');
 const localTriggerAst=card.localSchema.ast.filter(ast=>ast.trigger==='trigger'),localTriggerEffect=card.localSchema.normalized.filter(effect=>effect.timing==='trigger');
 const repairReferencedMain=timings.has('main')&&timings.has('trigger')&&referenceCases.length>0&&localMainAst.length===1&&localMainEffect.length===1&&localTriggerAst.length===1&&localTriggerEffect.length===1&&/Activate this card's \[Main\] effect\./i.test(localTriggerAst[0].rawText)&&windowPresentInBothSources(card,localMainAst[0].rawText.trim())&&windowPresentInBothSources(card,localTriggerAst[0].rawText.trim());
 if(repairReferencedMain){
  try{for(const scenario of [...mainKoCases,...referenceCases])scenario.run(card.localSchema);}catch{block('referenced-main-local-scenario-failed');}
  if(!blocked['referenced-main-local-scenario-failed']){
   const repaired=new Set<EffectTrigger>(['main','trigger']);
   after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localMainAst,...localTriggerAst];
   after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localMainEffect,...localTriggerEffect];
   changed.push('main','trigger');preserveImplementationStatus=true;
  }
 }
 if(repairOp02CrossTiming){
  try{for(const scenario of op02TimingCases)scenario.run(card.localSchema);}catch{block('op02-cross-window-local-scenario-failed');}
  if(!blocked['op02-cross-window-local-scenario-failed']){const repairedTimings=new Set<EffectTrigger>(['on-play','when-attacking']);after.ast=[...after.ast.filter(ast=>!repairedTimings.has(ast.trigger)),...card.localSchema.ast.filter(ast=>repairedTimings.has(ast.trigger))];after.normalized=[...after.normalized.filter(effect=>!repairedTimings.has(effect.timing)),...card.localSchema.normalized.filter(effect=>repairedTimings.has(effect.timing))];changed.push('on-play','when-attacking');preserveImplementationStatus=true;}
 }
 for(const timing of timings){
  if(repairReferencedMain&&(timing==='main'||timing==='trigger'))continue;
  if(repairOp02CrossTiming&&(timing==='on-play'||timing==='when-attacking'))continue;
 const local=card.localSchema.normalized.filter(e=>e.timing===timing);
 const localAst=card.localSchema.ast.filter(e=>e.trigger===timing);
 if(card.code==='OP16-079'&&timing==='character-played-from-trash'&&cases.some(s=>s.name.startsWith('Character played from Trash:'))&&localAst.length===1&&local.length===1&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='grant-keyword'&&localAst[0].actions[0].scope==='previous-played'&&localAst[0].actions[0].trait==='Land of Wano'&&after.ast.filter(ast=>ast.trigger==='unknown').length===1&&after.normalized.filter(effect=>effect.timing==='unknown').length===1&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
  const scenariosForEvent=cases.filter(s=>s.name.startsWith('Character played from Trash:'));
  try{for(const scenario of scenariosForEvent)scenario.run(card.localSchema);}catch{block('op16-079-trash-event-local-scenario-failed');continue;}
  after.ast=[...after.ast.filter(ast=>ast.trigger!=='unknown'),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='unknown'),...local];changed.push('character-played-from-trash');preserveImplementationStatus=true;
  try{for(const scenario of scenariosForEvent)scenario.run(after);}catch{block('op16-079-trash-event-readback-scenario-failed');continue;}
  continue;
 }
  const timingCases=cases.filter(s=>scenarioWindow(s.name,card.localSchema)===timing);
  if(timing==='on-play'&&failingNames.has('schema-keyword-isolation on-play: reject an unprinted On Play timing')&&!/\[On Play\](?!\s*effect\b)/i.test(card.printedText)&&!card.localSchema.ast.some(ast=>ast.trigger==='on-play')&&card.localSchema.ast.some(ast=>ast.trigger!=='on-play')){
   after.ast=after.ast.filter(ast=>ast.trigger!=='on-play');after.normalized=after.normalized.filter(effect=>effect.timing!=='on-play');changed.push('on-play');preserveImplementationStatus=true;continue;
  }
  if(card.code==='EB04-033'&&timing==='on-play'&&card.publishedText?.includes('DON!! 1:')&&card.printedText.includes('DON!! −1:')&&localAst.length===1&&local.length===1){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('eb04-033-source-correction-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!=='on-play'),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='on-play'),local[0]];after.rawEffectText=card.printedText;effectTextAfter=card.printedText;changed.push('on-play');preserveImplementationStatus=true;continue;
  }
  if(card.code==='OP03-074'&&timing==='main'&&card.publishedText?.includes('DON!! -1')&&card.publishedText.includes('[Trigger] Activate this card\'s [Main] effect.')&&card.printedText.includes('DON!! −2')&&localAst.length===1&&local.length===1){
   const triggerText=card.publishedText.match(/\[Trigger\]\s*Activate this card's \[Main\] effect\./i)?.[0];
   if(!triggerText){block('op03-074-trigger-source-not-isolated');continue;}
   try{for(const scenario of cases.filter(s=>scenarioWindow(s.name,card.localSchema)==='main'))scenario.run(card.localSchema);}catch{block('op03-074-main-scenarios-failed');continue;}
   const correctedText=card.publishedText.replace('DON!! -1','DON!! −2');
   const reference:EffectAction={kind:'activate-referenced-effect',trigger:'main'};
   const triggerAst:EffectDocument['ast'][number]={rawText:triggerText,trigger:'trigger',conditions:[],costs:[],actions:[reference]};
   const triggerEffect:EffectDocument['normalized'][number]={timing:'trigger',optional:false,conditions:[],sequence:[{type:'RESOLVE',action:reference}]};
   after.ast=[...after.ast.filter(ast=>ast.trigger!=='main'&&ast.trigger!=='trigger'),localAst[0],triggerAst];
   after.normalized=[...after.normalized.filter(effect=>effect.timing!=='main'&&effect.timing!=='trigger'),local[0],triggerEffect];
   after.rawEffectText=correctedText;effectTextAfter=correctedText;changed.push('main','trigger');preserveImplementationStatus=true;
   try{for(const scenario of cases.filter(s=>['main','trigger'].includes(scenarioWindow(s.name,card.localSchema)??'')))scenario.run(after);}catch{block('op03-074-trigger-reference-verification-failed');continue;}
   continue;
  }
  if(card.code==='EB04-022'&&timing==='when-attacking'&&card.publishedText?.includes('Characters 2000 power during this turn')&&card.printedText.includes('Characters −2000 power during this turn')){
   const relevant=cases.filter(s=>['on-play','when-attacking'].includes(scenarioWindow(s.name,card.localSchema)??'')),ownWindows=card.localSchema.ast.filter(ast=>ast.trigger==='on-play'||ast.trigger==='when-attacking'),ownEffects=card.localSchema.normalized.filter(effect=>effect.timing==='on-play'||effect.timing==='when-attacking');
   if(ownWindows.length!==2||ownEffects.length!==2){block('eb04-022-source-windows-not-isolated');continue;}
   try{for(const scenario of relevant)scenario.run(card.localSchema);}catch{block('eb04-022-local-sequence-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!=='on-play'&&ast.trigger!=='when-attacking'),...ownWindows];
   after.normalized=[...after.normalized.filter(effect=>effect.timing!=='on-play'&&effect.timing!=='when-attacking'),...ownEffects];
   after.rawEffectText=card.printedText;effectTextAfter=card.printedText;changed.push('on-play','when-attacking');preserveImplementationStatus=true;
   try{for(const scenario of relevant)scenario.run(after);}catch{block('eb04-022-published-sequence-failed');continue;}
   continue;
  }
  // Prefer a complete, scenario-verified local timing window when the source
  // text is identical and the parser preserved that exact window verbatim.
  // This repairs stale/mis-split published nodes without touching other
  // timings or relying on a cost/action being uniquely isolated in the DB.
  const sourceWindow=localAst.length===1?localAst[0].rawText.trim():'';
  if(timingCases.some(s=>!s.name.startsWith('engine-action '))&&local.length===1&&sourceWindow&&windowPresentInBothSources(card,sourceWindow)){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('complete-local-window-scenario-failed');continue;}
   const currentAst=after.ast.filter(ast=>ast.trigger===timing),currentNormalized=after.normalized.filter(effect=>effect.timing===timing);
   if(canonical(currentAst)!==canonical(localAst)||canonical(currentNormalized)!==canonical(local)){
    after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];changed.push(timing);preserveImplementationStatus=true;
   }
   continue;
  }
  if(['OP17-078','OP17-077'].includes(card.code)&&timing==='main'&&timingCases.some(s=>s.name.startsWith('schema-compound-rest-hand-add-don '))&&localAst.length===1&&local.length===1&&localAst[0].costs.length===2&&localAst[0].costs[0].kind==='rest'&&localAst[0].costs[0].scope==='don'&&localAst[0].costs[1].kind==='trash'&&localAst[0].costs[1].scope==='hand'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='add-don'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op17-compound-rest-trash-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='OP10-028'&&timing==='activate-main'&&timingCases.some(s=>s.name.startsWith('schema-rest-self-search '))&&localAst.length===1&&local.length===1&&localAst[0].costs.length===2&&localAst[0].costs[0].kind==='rest'&&localAst[0].costs[0].scope==='don'&&localAst[0].costs[1].kind==='trash'&&localAst[0].costs[1].scope==='self'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='search'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op10-rest-self-search-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-rested-don-addition '))&&timingCases.some(s=>s.name.startsWith('schema-rest-don-cost '))&&after.ast.every(ast=>ast.trigger!==timing)&&after.normalized.every(effect=>effect.timing!==timing)&&local.length===1&&localAst.length===1&&localAst[0].costs.length===1&&localAst[0].costs[0].kind==='rest'&&localAst[0].costs[0].scope==='don'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='add-don'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('rested-don-addition-local-scenarios-failed');continue;}
   after.ast=[...after.ast,...localAst];after.normalized=[...after.normalized,...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-ready-don-gate '))&&timingCases.some(s=>s.name.startsWith('schema-ready-don '))&&after.ast.every(ast=>ast.trigger!==timing)&&after.normalized.every(effect=>effect.timing!==timing)&&local.length===1&&localAst.length===1&&localAst[0].conditions.length===1&&/you have no other \[[^\]]+\] Characters?/i.test(localAst[0].conditions[0].text)&&localAst[0].costs.length===0&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='ready'&&localAst[0].actions[0].scope==='own-don'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('ready-don-gate-local-scenarios-failed');continue;}
   after.ast=[...after.ast,...localAst];after.normalized=[...after.normalized,...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-trash-life '))){
   const localNodes=localAst.filter(ast=>ast.actions.some(action=>action.kind==='trash-life')),dbNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing&&ast.actions.some(action=>action.kind==='trash-life'));
   const localAction=localNodes.length===1?localNodes[0].actions.find(action=>action.kind==='trash-life'):undefined,dbNode=dbNodes.length===1?dbNodes[0]:undefined;
   const dbEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>effect.timing===timing&&effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='trash-life'));
   const localEffect=local.find(effect=>effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='trash-life')),dbEffect=dbEffects.length===1?dbEffects[0]:undefined;
   const stripMarker=(actions:EffectAction[])=>actions.filter(action=>action.kind!=='trash-life'&&!(timing==='on-ko'&&action.kind==='on-ko'));
   const stripStep=(sequence:EffectDocument['normalized'][number]['sequence'])=>sequence.filter(step=>step.type!=='RESOLVE'||(step.action.kind!=='trash-life'&&!(timing==='on-ko'&&step.action.kind==='on-ko')));
   const safe=Boolean(localAction?.kind==='trash-life'&&localNodes.length===1&&localAst.length===1&&dbNode&&after.ast.filter(ast=>ast.trigger===timing).length===1&&localEffect&&dbEffect&&canonical({...localNodes[0],actions:stripMarker(localNodes[0].actions)})===canonical({...dbNode.ast,actions:stripMarker(dbNode.ast.actions)})&&canonical({...localEffect,sequence:stripStep(localEffect.sequence)})===canonical({...dbEffect.effect,sequence:stripStep(dbEffect.effect.sequence)}));
   if(!safe){block('verified-trash-life-not-isolated');continue;}
   const localStep=localEffect!.sequence.find(step=>step.type==='RESOLVE'&&step.action.kind==='trash-life')!;
   after.ast=after.ast.map((ast,index)=>index===dbNode!.index?{...ast,actions:[...stripMarker(ast.actions),localAction!]}:ast);
   after.normalized=after.normalized.map((effect,index)=>{if(index!==dbEffect!.index)return effect;const sequence=stripStep(effect.sequence);return {...effect,sequence:[...sequence,localStep]};});
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('verified-trash-life-fix-failed-scenario');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-rest-don-cost '))){
   const localAstCostNodes=localAst.filter(ast=>ast.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'));
   const localEffects=local.filter(effect=>effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don'));
   const dbAstNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing);
   const dbEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>effect.timing===timing);
   const localCost=localAstCostNodes.length===1?localAstCostNodes[0].costs.find(cost=>cost.kind==='rest'&&cost.scope==='don'):undefined;
   const localEffect=localEffects.length===1?localEffects[0]:undefined;
   const localPayIndex=localEffect?.sequence.findIndex(step=>step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don')??-1;
   const dbNode=dbAstNodes.length===1?dbAstNodes[0]:undefined,dbEffect=dbEffects.length===1?dbEffects[0]:undefined;
   const localAstShape=localAstCostNodes.length===1?{conditions:localAstCostNodes[0].conditions,actions:localAstCostNodes[0].actions,costs:localAstCostNodes[0].costs.filter(cost=>!(cost.kind==='rest'&&cost.scope==='don'))}:undefined;
   const dbAstShape=dbNode?{conditions:dbNode.ast.conditions,actions:dbNode.ast.actions,costs:dbNode.ast.costs.filter(cost=>!(cost.kind==='rest'&&cost.scope==='don'))}:undefined;
   const stripRestCost=(sequence:EffectDocument['normalized'][number]['sequence'])=>sequence.filter(step=>!(step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don'));
   const localEffectShape=localEffect?{optional:localEffect.optional,conditions:localEffect.conditions,sequence:stripRestCost(localEffect.sequence)}:undefined;
   const dbEffectShape=dbEffect?{optional:dbEffect.effect.optional,conditions:dbEffect.effect.conditions,sequence:stripRestCost(dbEffect.effect.sequence)}:undefined;
   const safe=Boolean(localCost&&localAstCostNodes.length===1&&localEffect&&localEffects.length===1&&localPayIndex>=0&&dbNode&&dbEffect&&canonical(localAstShape)===canonical(dbAstShape)&&canonical(localEffectShape)===canonical(dbEffectShape));
   if(!safe){
    // When older published revisions split/copy a cost into several nodes of
    // the same timing, the field-by-field repair above cannot prove isolation.
    // If the source text is unchanged and the local parser produced one exact
    // timing window, validate every known scenario for that window and replace
    // that window as a unit. Other timings remain untouched.
    const completeWindow=Boolean(local.length===1&&localAst.length===1&&localAst[0].rawText.trim()&&windowPresentInBothSources(card,localAst[0].rawText.trim()));
    if(completeWindow){try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('verified-rest-don-cost-not-isolated');continue;}
     after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;
    }
    block('verified-rest-don-cost-not-isolated');continue;
   }
   const existing=dbNode!.ast.costs.filter(cost=>cost.kind==='rest'&&cost.scope==='don');
   const existingSteps=dbEffect!.effect.sequence.filter(step=>step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don');
   if(existing.length===1&&canonical(existing[0])===canonical(localCost)&&existingSteps.length===1&&canonical(existingSteps[0])===canonical(localEffect!.sequence[localPayIndex]))continue;
   const localStep=localEffect!.sequence[localPayIndex],precedingUnaffected=localEffect!.sequence.slice(0,localPayIndex).filter(step=>!(step.type==='PAY_COST'&&step.cost.kind==='rest'&&step.cost.scope==='don')).length;
   after.ast=after.ast.map((ast,index)=>index===dbNode!.index?{...ast,costs:[...ast.costs.filter(cost=>!(cost.kind==='rest'&&cost.scope==='don')),localCost!]}:ast);
   after.normalized=after.normalized.map((effect,index)=>{if(index!==dbEffect!.index)return effect;const sequence=stripRestCost(effect.sequence),insertAt=Math.min(precedingUnaffected,sequence.length);return {...effect,sequence:[...sequence.slice(0,insertAt),localStep,...sequence.slice(insertAt)]};});
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('verified-rest-don-fix-failed-scenario');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-hand-trash-cost '))){
   const isHandCost=(cost:EffectDocument['ast'][number]['costs'][number]):cost is EffectDocument['ast'][number]['costs'][number] & {kind:'trash';scope:'hand'}=>cost.kind==='trash'&&cost.scope==='hand';
   const isHandTrashAction=(action:EffectAction):action is EffectAction & {kind:'trash';scope:'hand'}=>action.kind==='trash'&&action.scope==='hand';
   const localCostNodes=localAst.filter(ast=>ast.costs.some(isHandCost));
   const localCostEffects=local.filter(effect=>effect.sequence.some(step=>step.type==='PAY_COST'&&isHandCost(step.cost)));
   const dbAstNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing);
   const dbEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>effect.timing===timing);
   const localCost=localCostNodes.length===1?localCostNodes[0].costs.find(isHandCost):undefined;
   const localEffect=localCostEffects.length===1?localCostEffects[0]:undefined;
   const localPayIndex=localEffect?.sequence.findIndex(step=>step.type==='PAY_COST'&&isHandCost(step.cost))??-1;
   const dbNode=dbAstNodes.length===1?dbAstNodes[0]:undefined,dbEffect=dbEffects.length===1?dbEffects[0]:undefined;
   const duplicateDbActions=dbNode?.ast.actions.filter(isHandTrashAction)??[];
   const localHandActions=localCostNodes.flatMap(node=>node.actions.filter(isHandTrashAction));
   // The printed colon clause and local parser define the payment's restrictions.
   // Older published parsers often dropped those attributes from the duplicate
   // RESOLVE trash action; a unique same-count hand-trash action is still that
   // duplicate when local parsing found no separate hand-trash effect.
   const paymentMatchesAction=Boolean(localCost&&duplicateDbActions.length===1&&localHandActions.length===0&&duplicateDbActions[0].amount===localCost.amount);
   const stripPaymentAction=(actions:EffectAction[])=>paymentMatchesAction?actions.filter(action=>!isHandTrashAction(action)):actions;
   const localAstShape=localCostNodes.length===1?{conditions:localCostNodes[0].conditions,actions:localCostNodes[0].actions.filter(action=>!(action.kind==='trash'&&action.scope==='hand')),costs:localCostNodes[0].costs.filter(cost=>!isHandCost(cost))}:undefined;
   const dbAstShape=dbNode?{conditions:dbNode.ast.conditions,actions:stripPaymentAction(dbNode.ast.actions),costs:dbNode.ast.costs.filter(cost=>!isHandCost(cost))}:undefined;
   const stripHandCost=(sequence:EffectDocument['normalized'][number]['sequence'])=>sequence.filter(step=>!(step.type==='PAY_COST'&&isHandCost(step.cost))&&!(step.type==='RESOLVE'&&isHandTrashAction(step.action)&&paymentMatchesAction));
   const localEffectShape=localEffect?{optional:localEffect.optional,conditions:localEffect.conditions,sequence:stripHandCost(localEffect.sequence)}:undefined;
   const dbEffectShape=dbEffect?{optional:dbEffect.effect.optional,conditions:dbEffect.effect.conditions,sequence:stripHandCost(dbEffect.effect.sequence)}:undefined;
   const safe=Boolean(localCost&&localCostNodes.length===1&&localCostEffects.length===1&&localPayIndex>=0&&dbNode&&dbEffect&&duplicateDbActions.length<=1&&(duplicateDbActions.length===0||paymentMatchesAction)&&canonical(localAstShape)===canonical(dbAstShape)&&canonical(localEffectShape)===canonical(dbEffectShape));
   if(!safe){
    const completeWindow=Boolean(local.length===1&&localAst.length===1&&localAst[0].rawText.trim()&&windowPresentInBothSources(card,localAst[0].rawText.trim()));
    if(completeWindow){try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('verified-hand-trash-cost-not-isolated');continue;}
     after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;
    }
    block('verified-hand-trash-cost-not-isolated');continue;
   }
   const existingCosts=dbNode!.ast.costs.filter(isHandCost),existingSteps=dbEffect!.effect.sequence.filter(step=>step.type==='PAY_COST'&&isHandCost(step.cost));
   if(existingCosts.length===1&&canonical(existingCosts[0])===canonical(localCost)&&existingSteps.length===1&&canonical(existingSteps[0])===canonical(localEffect!.sequence[localPayIndex]))continue;
   const localStep=localEffect!.sequence[localPayIndex],precedingUnaffected=localEffect!.sequence.slice(0,localPayIndex).filter(step=>!(step.type==='PAY_COST'&&isHandCost(step.cost))).length;
   after.ast=after.ast.map((ast,index)=>index===dbNode!.index?{...ast,actions:stripPaymentAction(ast.actions),costs:[...ast.costs.filter(cost=>!isHandCost(cost)),localCost!]}:ast);
   after.normalized=after.normalized.map((effect,index)=>{if(index!==dbEffect!.index)return effect;const sequence=stripHandCost(effect.sequence),insertAt=Math.min(precedingUnaffected,sequence.length);return {...effect,sequence:[...sequence.slice(0,insertAt),localStep,...sequence.slice(insertAt)]};});
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('verified-hand-trash-cost-fix-failed-scenario');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-return-don-cost '))){
   const localCostNodes=localAst.filter(ast=>ast.costs.some(cost=>cost.kind==='return-don'));
   const localCostEffects=local.filter(effect=>effect.sequence.some(step=>step.type==='PAY_COST'&&step.cost.kind==='return-don'));
   const dbAstNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing);
   const dbEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>effect.timing===timing);
   const localCost=localCostNodes.length===1?localCostNodes[0].costs.find(cost=>cost.kind==='return-don'):undefined;
   const localEffect=localCostEffects.length===1?localCostEffects[0]:undefined;
   const localPaySteps=localEffect?.sequence.filter(step=>step.type==='PAY_COST');
   const dbNode=dbAstNodes.length===1?dbAstNodes[0]:undefined,dbEffect=dbEffects.length===1?dbEffects[0]:undefined;
   const duplicatedDbReturnActions=dbNode?.ast.actions.filter(action=>action.kind==='return-don')??[];
   const localReturnActions=localCostNodes.flatMap(node=>node.actions.filter(action=>action.kind==='return-don'));
   // A published parser sometimes stores the printed DON!! payment twice: once as a
   // cost and again as a RESOLVE action. Treat that as a duplicate only when its
   // amount/owner exactly match the local payment and the local effect has no distinct
   // DON-return action of its own.
   const duplicateDbActionIsPayment=Boolean(localCost&&duplicatedDbReturnActions.length===1&&localReturnActions.length===0&&duplicatedDbReturnActions[0].amount===localCost.amount&&(duplicatedDbReturnActions[0].owner??'self')==='self');
   const stripDuplicatePayment=(actions:EffectAction[])=>duplicateDbActionIsPayment?actions.filter(action=>action.kind!=='return-don'):actions;
   const localAstShape=localCostNodes.length===1?{conditions:localCostNodes[0].conditions,actions:localCostNodes[0].actions,costs:localCostNodes[0].costs.filter(cost=>cost.kind!=='return-don')}:undefined;
   const dbAstShape=dbNode?{conditions:dbNode.ast.conditions,actions:stripDuplicatePayment(dbNode.ast.actions),costs:dbNode.ast.costs.filter(cost=>cost.kind!=='return-don')}:undefined;
   const stripDonCost=(sequence:EffectDocument['normalized'][number]['sequence'])=>sequence.filter(step=>!(step.type==='PAY_COST'&&step.cost.kind==='return-don')&&!(step.type==='RESOLVE'&&step.action.kind==='return-don'&&(step.action.owner??'self')==='self'));
   const localEffectShape=localEffect?{optional:localEffect.optional,conditions:localEffect.conditions,sequence:stripDonCost(localEffect.sequence)}:undefined;
   const dbEffectShape=dbEffect?{optional:dbEffect.effect.optional,conditions:dbEffect.effect.conditions,sequence:stripDonCost(dbEffect.effect.sequence)}:undefined;
   const safe=Boolean(localCost&&localCostNodes.length===1&&localCostNodes[0].costs.length===1&&localCostEffects.length===1&&localPaySteps?.length===1&&dbNode&&dbEffect&&duplicatedDbReturnActions.length<=1&&(duplicatedDbReturnActions.length===0||duplicateDbActionIsPayment)&&canonical(localAstShape)===canonical(dbAstShape)&&canonical(localEffectShape)===canonical(dbEffectShape));
   if(!safe){
    const completeWindow=Boolean(local.length===1&&localAst.length===1&&localAst[0].rawText.trim()&&windowPresentInBothSources(card,localAst[0].rawText.trim()));
    if(completeWindow){try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('verified-return-don-cost-not-isolated');continue;}
     after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;
    }
    block('verified-return-don-cost-not-isolated');continue;
   }
   const existingDbCosts=dbNode!.ast.costs.filter(cost=>cost.kind==='return-don');
   const existingDbReturnActions=dbEffect!.effect.sequence.filter(step=>step.type==='RESOLVE'&&step.action.kind==='return-don'&&(step.action.owner??'self')==='self');
   if(existingDbCosts.length===1&&existingDbCosts[0].amount===localCost!.amount&&existingDbReturnActions.length===0)continue;
   const payStep=localEffect!.sequence.find(step=>step.type==='PAY_COST'&&step.cost.kind==='return-don')!;
   after.ast=after.ast.map((ast,index)=>index===dbNode!.index?{...ast,actions:stripDuplicatePayment(ast.actions),costs:[...ast.costs.filter(cost=>cost.kind!=='return-don'),localCost!]}:ast);
   after.normalized=after.normalized.map((effect,index)=>{if(index!==dbEffect!.index)return effect;const sequence=stripDonCost(effect.sequence),firstResolve=sequence.findIndex(step=>step.type==='RESOLVE'),insertAt=firstResolve<0?sequence.length:firstResolve;return {...effect,sequence:[...sequence.slice(0,insertAt),payStep,...sequence.slice(insertAt)]};});
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('verified-return-don-fix-failed-scenario');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  const coveredKinds=new Set(timingCases.flatMap(s=>s.name.startsWith('engine-action ')&&s.name.includes('grant-keyword-target:')?['grant-keyword']:s.name.startsWith('schema-search ')?['search']:s.name.startsWith('schema-power ')?['power']:s.name.startsWith('schema-ko ')?['ko']:s.name.startsWith('schema-play ')?['play']:s.name.startsWith('schema-bottom-deck ')?['bottom-deck']:s.name.startsWith('schema-return-hand ')?['return-to-hand']:s.name.startsWith('schema-hand-reset ')?['hand-reset']:s.name.startsWith('schema-reorder ')?['reorder-deck']:s.name.startsWith('schema-draw ')||s.name.startsWith('schema-conditional-draw ')?['draw']:s.name.startsWith('schema-life-to-hand ')?['life']:s.name.startsWith('schema-trash-life ')?['trash-life']:s.name.startsWith('schema-ready-don ')||s.name.startsWith('schema-ready-don-gate ')?['ready']:[]));
  const hasLifeCostCase=timingCases.some(s=>s.name.startsWith('schema-turn-life-cost '));
  if(card.code==='OP08-058'&&timing==='when-attacking'&&hasLifeCostCase&&timingCases.some(s=>s.name.startsWith('schema-turn-life-cost-add-don '))){
   const localWindow=card.localSchema.ast.filter(ast=>ast.trigger===timing),localNormalized=card.localSchema.normalized.filter(effect=>effect.timing===timing);
   if(localWindow.length!==1||localNormalized.length!==1||!localWindow[0].costs.some(cost=>cost.kind==='turn-life')||localWindow[0].actions.length!==1||localWindow[0].actions[0].kind!=='add-don'||!localWindow[0].actions[0].selection){block('op08-life-cost-rested-don-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op08-life-cost-rested-don-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localWindow];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...localNormalized];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(hasLifeCostCase&&canonical(after.ast.filter(ast=>ast.trigger===timing).map(ast=>ast.costs.filter(cost=>cost.kind!=='turn-life')))!==canonical(localAst.map(ast=>ast.costs.filter(cost=>cost.kind!=='turn-life')))) {block('verified-life-cost-shares-window-with-other-differences');continue;}
  if(hasLifeCostCase&&canonical(after.ast.filter(ast=>ast.trigger===timing).map(ast=>ast.costs.filter(cost=>cost.kind==='turn-life')))!==canonical(localAst.map(ast=>ast.costs.filter(cost=>cost.kind==='turn-life')))){
   const localNode=localAst.length===1?localAst[0]:undefined;
   const dbNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing);
   const localEffect=local.length===1?local[0]:undefined;
   const dbEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>effect.timing===timing);
   const stripCost=(costs:EffectDocument['ast'][number]['costs'])=>costs.filter(cost=>cost.kind!=='turn-life');
   const stripPay=(sequence:EffectDocument['normalized'][number]['sequence'])=>sequence.filter(step=>step.type!=='PAY_COST'||step.cost.kind!=='turn-life');
   const structurallyIsolated=Boolean(localNode&&dbNodes.length===1&&localEffect&&dbEffects.length===1&&
    canonical({...localNode,costs:stripCost(localNode.costs)})===canonical({...dbNodes[0].ast,costs:stripCost(dbNodes[0].ast.costs)})&&
    canonical({...localEffect,sequence:stripPay(localEffect.sequence)})===canonical({...dbEffects[0].effect,sequence:stripPay(dbEffects[0].effect.sequence)}));
   if(!structurallyIsolated||!localNode||localNode.costs.filter(cost=>cost.kind==='turn-life').length!==1){block('verified-life-cost-not-isolated');continue;}
   const localCost=localNode.costs.find(cost=>cost.kind==='turn-life')!,nodeIndex=dbNodes[0].index;
   after.ast=after.ast.map((ast,index)=>index===nodeIndex?{...ast,costs:ast.costs.map(cost=>cost.kind==='turn-life'?localCost:cost)}:ast);
   const localSteps=localEffect!.sequence.filter(step=>step.type==='PAY_COST'&&step.cost.kind==='turn-life');
   if(localSteps.length!==1){block('verified-life-cost-normalized-step-not-isolated');continue;}
   const effectIndex=dbEffects[0].index,localStep=localSteps[0];
   after.normalized=after.normalized.map((effect,index)=>index===effectIndex?{...effect,sequence:effect.sequence.map(step=>step.type==='PAY_COST'&&step.cost.kind==='turn-life'?localStep:step)}:effect);
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-conditional-draw '))&&after.ast.every(ast=>ast.trigger!==timing)&&after.normalized.every(effect=>effect.timing!==timing)&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===1&&/^your Leader is multicolored$/i.test(localAst[0].conditions[0].text)&&localAst[0].costs.length===0&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='draw'&&local[0].conditions.length===1&&local[0].sequence.length===1&&local[0].sequence[0].type==='RESOLVE'&&local[0].sequence[0].action.kind==='draw'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('conditional-draw-local-scenario-failed');continue;}
   after.ast=[...after.ast,...localAst];after.normalized=[...after.normalized,...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='EB03-028'&&timing==='activate-main'&&timingCases.some(s=>s.name.startsWith('schema-self-trash-conditional-draw '))&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===1&&localAst[0].conditions[0].text==='you have 4 or less cards in your hand'&&localAst[0].costs.length===1&&localAst[0].costs[0].kind==='trash'&&localAst[0].costs[0].scope==='self'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='draw'&&localAst[0].actions[0].amount===2){
   const paired=cases.filter(s=>s.name.startsWith('schema-self-trash-conditional-draw ')),onPlayAst=card.localSchema.ast.filter(ast=>ast.trigger==='on-play'),onPlayNormalized=card.localSchema.normalized.filter(effect=>effect.timing==='on-play');
   if(paired.length!==2||onPlayAst.length!==1||onPlayNormalized.length!==1||onPlayAst[0].conditions.length||onPlayAst[0].costs.length||onPlayAst[0].actions.length!==1||onPlayAst[0].actions[0].kind!=='trash'||onPlayAst[0].actions[0].scope!=='hand'||onPlayAst[0].actions[0].amount!==1){block('eb03-028-paired-on-play-window-not-isolated');continue;}
   try{for(const scenario of paired)scenario.run(card.localSchema);}catch{block('eb03-028-conditional-draw-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!=='activate-main'&&ast.trigger!=='on-play'),...onPlayAst,...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='activate-main'&&effect.timing!=='on-play'),...onPlayNormalized,...local];changed.push('on-play','activate-main');preserveImplementationStatus=true;continue;
  }
  if(['OP17-078','OP17-077'].includes(card.code)&&timing==='main'&&timingCases.some(s=>s.name.startsWith('schema-compound-rest-hand-add-don '))&&localAst.length===1&&local.length===1&&localAst[0].costs.length===2&&localAst[0].costs[0].kind==='rest'&&localAst[0].costs[0].scope==='don'&&localAst[0].costs[1].kind==='trash'&&localAst[0].costs[1].scope==='hand'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='add-don'){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op17-compound-rest-trash-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timingCases.some(s=>s.name.startsWith('schema-draw '))&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length>0&&localAst[0].actions.every(action=>action.kind==='draw')&&local[0].conditions.length===0&&local[0].sequence.length===localAst[0].actions.length&&local[0].sequence.every(step=>step.type==='RESOLVE'&&step.action.kind==='draw')){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('draw-only-window-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(coveredKinds.size){
   const untouched=(schema:EffectDocument)=>({ast:schema.ast.filter(ast=>ast.trigger===timing).map(ast=>({...ast,actions:ast.actions.filter(action=>!coveredKinds.has(action.kind))})),normalized:schema.normalized.filter(effect=>effect.timing===timing).map(effect=>({...effect,sequence:effect.sequence.filter(step=>step.type!=='RESOLVE'||!coveredKinds.has(step.action.kind))}))});
   if(canonical(untouched(card.databaseSchema))!==canonical(untouched(card.localSchema))){
    let isolated=true;
    for(const coveredKind of coveredKinds){
     const localActions=localAst.flatMap(ast=>ast.actions.filter(action=>action.kind===coveredKind));
     const dbNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing&&ast.actions.some(action=>action.kind===coveredKind));
     const dbSteps=after.normalized.flatMap((effect,effectIndex)=>effect.timing===timing?effect.sequence.map((step,stepIndex)=>({step,effectIndex,stepIndex})).filter(item=>item.step.type==='RESOLVE'&&item.step.action.kind===coveredKind):[]);
     if(localActions.length!==1||dbNodes.length!==1||dbNodes[0].ast.actions.filter(action=>action.kind===coveredKind).length!==1||dbSteps.length!==1){
      const timingNodes=after.ast.filter(ast=>ast.trigger===timing),replaceWholeWindow=coveredKind==='reorder-deck'&&timingCases.length>0&&timingCases.every(s=>s.name.startsWith('schema-reorder '))&&local.length===1&&localAst.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&timingNodes.length===1;
      if(replaceWholeWindow){try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{isolated=false;break;}after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;}
      isolated=false;break;
     }
     const localAction=localActions[0],nodeIndex=dbNodes[0].index,step=dbSteps[0];
     after.ast=after.ast.map((ast,index)=>index===nodeIndex?{...ast,actions:ast.actions.map(action=>action.kind===coveredKind?localAction:action)}:ast);
     after.normalized=after.normalized.map((effect,effectIndex)=>effectIndex===step.effectIndex?{...effect,sequence:effect.sequence.map((item,stepIndex)=>stepIndex===step.stepIndex&&item.type==='RESOLVE'?{...item,action:localAction}:item)}:effect);
    }
    if(!isolated){block('verified-action-not-isolated-in-published-window');continue;}
    changed.push(timing);preserveImplementationStatus=true;continue;
   }
  }
  // OP11-005 has two independent passive abilities in the same unknown timing bucket.
  // Replace that bucket only after its dedicated protection matrix and every Blocker
  // combat/schema-isolation scenario all pass against the complete local document.
  if(card.code==='OP11-005'&&timing==='unknown'&&failingNames.has('keyword Blocker: schema isolation')&&timingCases.some(s=>s.name.startsWith('unknown: DON!!-gated'))&&timingCases.some(s=>s.name==='keyword Blocker: schema isolation')){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('local-window-scenario-failed');continue;}
   after.normalized=[...after.normalized.filter(effect=>effect.timing!=='unknown'),...local];
   after.ast=[...after.ast.filter(ability=>ability.trigger!=='unknown'),...localAst];
   changed.push(timing);continue;
  }
  // ST06-004 has two independent passive clauses in the same unknown timing:
  // unconditional effect immunity and a DON!!/field-condition Double Attack.
  // Replace that bucket only after its complete combat + effect-removal matrix passes.
  if(card.code==='ST06-004'&&timing==='unknown'&&timingCases.some(s=>s.name==='continuous: separate effect immunity and DON!!-plus-zero-cost Double Attack')){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('local-window-scenario-failed');continue;}
   after.normalized=[...after.normalized.filter(effect=>effect.timing!=='unknown'),...local];
   after.ast=[...after.ast.filter(ability=>ability.trigger!=='unknown'),...localAst];
   changed.push(timing);continue;
  }
  if(local.length!==1||localAst.length!==1||!timingCases.length)continue;
  // Scenario-check the exact replacement against the local parse before it can reach the published revision.
  try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('local-window-scenario-failed');continue;}
  const prior=after.normalized.filter(e=>e.timing===timing);
  if(prior.length===1&&canonical(local[0])===canonical(prior[0])&&after.ast.some(ast=>ast.trigger===timing&&canonical(ast)===canonical(localAst[0])))continue;
  after.normalized=[...after.normalized.filter(e=>e.timing!==timing),local[0]];
  // Replace every stale AST node assigned to this timing; these published nodes can contain
  // actions copied from other printed windows. Other timing windows remain intact.
  after.ast=[...after.ast.filter(e=>e.trigger!==timing),localAst[0]];
  changed.push(timing);
 }
 // OP04-119's opponent-turn aura was previously copied into its On Play bucket.
 // Move the repaired passive ability to its continuous timing and remove only
 // that misplaced K.O.-protection action from On Play; keep the play sequence intact.
 if(card.code==='OP04-119'&&changed.includes('continuous')&&!card.localSchema.ast.some(ast=>ast.trigger==='on-play'&&ast.actions.some(action=>action.kind==='prevent-ko'))){
  let removed=false;
  after.ast=after.ast.map(ast=>{if(ast.trigger!=='on-play')return ast;const actions=ast.actions.filter(action=>action.kind!=='prevent-ko'),conditions=ast.conditions.filter(condition=>condition.text!=='this Character is rested');if(actions.length!==ast.actions.length||conditions.length!==ast.conditions.length)removed=true;return {...ast,actions,conditions};});
  after.normalized=after.normalized.map(effect=>{if(effect.timing!=='on-play')return effect;const sequence=effect.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!=='prevent-ko'),conditions=effect.conditions.filter(condition=>condition.text!=='this Character is rested');if(sequence.length===effect.sequence.length&&conditions.length===effect.conditions.length)return effect;removed=true;return {...effect,sequence,conditions};});
  if(removed&&!changed.includes('on-play'))changed.push('on-play');
 }
 // A leading printed Blocker is an independent keyword, even when an older
 // published parser folded it into On Play/Trigger text. Move that action out
 // of the unrelated window while preserving every other action and condition.
 if(failingNames.has('keyword Blocker: schema isolation')&&card.localSchema.ast.some(ast=>ast.trigger==='unknown'&&/^\[Blocker\](?:\s*\([^)]*\))?\s*$/i.test(ast.rawText.trim())&&ast.actions.some(action=>action.kind==='blocker'))){
  const contaminated=new Set<EffectTrigger>();
  after.ast=after.ast.flatMap(ast=>{
   if(ast.trigger==='unknown'||!ast.actions.some(action=>action.kind==='blocker'))return [ast];
   contaminated.add(ast.trigger);
   const actions=ast.actions.filter(action=>action.kind!=='blocker');
   return actions.length||ast.costs.length||ast.conditions.length?[{...ast,actions}]:[];
  });
  after.normalized=after.normalized.flatMap(effect=>{
   if(effect.timing==='unknown'||!effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='blocker'))return [effect];
   contaminated.add(effect.timing);
   const sequence=effect.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!=='blocker');
   return sequence.length?[{...effect,sequence}]:[];
  });
  for(const timing of contaminated)if(!changed.includes(timing))changed.push(timing);
 }
 if(!changed.length){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('no-safe-changes');continue;}
 const verificationCases=cases.filter(s=>changed.includes(scenarioWindow(s.name,card.localSchema)!)&&!(repairReferencedMain&&s.name.startsWith('engine-action ')));
 const unverifiedWindows=changed.filter(timing=>!verificationCases.some(s=>scenarioWindow(s.name,card.localSchema)===timing&&!s.name.startsWith('engine-action ')));
 if(unverifiedWindows.length){block('action-only-window-needs-printed-text-scenario');continue;}
 try{for(const scenario of verificationCases)scenario.run(after);}catch{block('local-window-scenarios-failed-after-merge');continue;}
 if(!preserveImplementationStatus)after.implementationStatus='PARSED';
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,effectTextAfter,timings:changed,scenarioNames:verificationCases.map(s=>s.name),scenarioCount:verificationCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
}
mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,timings:candidates.reduce((n,c)=>n+c.timings.length,0),scenarios:candidates.reduce((n,c)=>n+c.scenarioCount,0),blocked,apply:process.argv.includes('--apply')}));
if(!process.argv.includes('--apply'))process.exit(0);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const results:Array<{code:string;status:string}>=[];
for(const candidate of candidates){
 const {data:identity,error:identityError}=await db.from('tcg_card_identities').select('id,effect_text').eq('code',candidate.code).single();
 if(identityError)throw identityError;
 if(identity.effect_text!==candidate.printedText)throw new Error(`${candidate.code}: catalog text changed; stopping`);
 const {data:current,error}=await db.from('tcg_card_rule_revisions').select('effect_schema,effect_text').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).maybeSingle();
 if(error)throw error;
 if(candidate.before===null){
  if(current)throw new Error(`${candidate.code}: a published revision appeared after planning; stopping`);
  const {error:insertError}=await db.from('tcg_card_rule_revisions').insert({ruleset_id:plan.rulesetId,identity_id:identity.id,effect_text:candidate.printedText,effect_schema:candidate.after,errata_reference:null,source_url:'https://en.onepiece-cardgame.com/cardlist/'});
  if(insertError)throw insertError;
 }else{
  if(!current||hash(current.effect_schema)!==candidate.beforeHash||current.effect_text!==candidate.publishedText)throw new Error(`${candidate.code}: published revision changed; stopping`);
  const updatedEffectText=candidate.effectTextAfter??candidate.printedText;
  const {data:updated,error:updateError}=await db.from('tcg_card_rule_revisions').update({effect_text:updatedEffectText,effect_schema:candidate.after}).eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).eq('effect_schema',JSON.stringify(current.effect_schema)).eq('effect_text',current.effect_text).select('identity_id');
  if(updateError)throw updateError;
  if(updated.length!==1)throw new Error(`${candidate.code}: concurrent update detected`);
 }
 const {data:readback,error:readError}=await db.from('tcg_card_rule_revisions').select('effect_schema,effect_text').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).single();
 if(readError)throw readError;
 if(hash(readback.effect_schema)!==candidate.afterHash||readback.effect_text!==(candidate.effectTextAfter??candidate.printedText))throw new Error(`${candidate.code}: readback differs`);
 const scenarioNames=new Set(candidate.scenarioNames);
 for(const scenario of scenarios({code:candidate.code,effect_text:candidate.printedText} as Identity).filter(s=>scenarioNames.has(s.name)))scenario.run(readback.effect_schema);
 results.push({code:candidate.code,status:'PUBLISHED_AND_READBACK_TESTED'});
 writeFileSync(path.replace('.json','.results.json'),JSON.stringify(results,null,2));
}
console.log(JSON.stringify({published:results.length,readbackScenariosPassed:candidates.reduce((n,c)=>n+c.scenarioCount,0)}));
