import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scenarios,type Identity} from './card-effect-scenarios';
import type {EffectAction,EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';

const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string;code:string}};cards:Array<{code:string;printedText:string;publishedText:string|null;textMatches:boolean;localSchema:EffectDocument;databaseSchema:EffectDocument|null}>};
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const candidates:Array<Record<string,unknown>>=[];
const blocked:Record<string,number>={};
let activeCode='';
const block=(reason:string)=>{blocked[reason]=(blocked[reason]??0)+1;if(process.env.EFFECT_PLAN_DEBUG==='all'||process.env.EFFECT_PLAN_DEBUG===activeCode)console.error(activeCode,reason);};
const supportedTimings=new Set<EffectTrigger>(['on-play','when-attacking','attack-damage','when-rested','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','opponent-blocker','don-attached','end-turn','end-battle','character-played-from-trash','hand-trash','continuous','unknown']);
const timingCovered=(name:string,timing:EffectTrigger)=>{
 const value=name.toLowerCase();
 const patterns:Record<EffectTrigger,RegExp>={'on-play':/on[ -]?play/,'when-attacking':/when[ -]?attacking/,'attack-damage':/attack damage|damage to .*life/,'when-rested':/when this character becomes rested|when rested/,'activate-main':/activate[ -]?:?[ -]?main|main[ -]activation/,'main':/\bmain\b/,'counter':/\bcounter\b/,'trigger':/\btrigger\b/,'on-ko':/on[ -]?k\.?o\.?/,'on-block':/on[ -]?block/,'opponent-attack':/opponent[ -]attack/,'opponent-blocker':/opponent[ -]blocker/,'don-attached':/don attached/,'end-turn':/end[ -]of[ -]your[ -]turn/,'end-battle':/end[ -]of[ -]battle/,'continuous':/continuous|opponent.?s turn|your turn/,'unknown':/unknown|passive|keyword/,'character-played-from-trash':/played from trash/,'hand-trash':/hand trash/};
 return patterns[timing].test(value);
};
const familyForAction:Partial<Record<EffectAction['kind'],string>>={power:'gameplay power:',ko:'gameplay K.O.:',rest:'gameplay rest:',ready:'gameplay ready:', 'prevent-ko':'gameplay prevent-K.O.:'};

for(const card of snapshot.cards){
 activeCode=card.code;
 const before=card.databaseSchema,local=card.localSchema;
 if(!before||!card.publishedText||!card.textMatches){block('missing-schema-or-printed-text-mismatch');continue;}
 if(before.resolver.type!=='DSL'||local.resolver.type!=='DSL'){block('custom-resolver-requires-handler-test');continue;}
 const cardScenarios=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 const changedScenarios:Array<{name:string;run:(doc:EffectDocument)=>void}>=[];
 const after=structuredClone(before);
 const localTimings=new Map<EffectTrigger,number>();
 let changed=0,failed=false;
 for(let abilityIndex=0;abilityIndex<local.ast.length;abilityIndex++){
  const expected=local.ast[abilityIndex],timing=expected.trigger;
  if(!supportedTimings.has(timing))continue;
  const localIndex=localTimings.get(timing)??0;
  localTimings.set(timing,localIndex+1);
  const actual=before.ast.filter(item=>item.trigger===timing)[localIndex],next=after.ast.filter(item=>item.trigger===timing)[localIndex];
  // A stale published schema can omit or merge a different timing window.
  // Leave that window alone and keep checking independently aligned timings.
  if(!actual||!next){block('timing-window-count-mismatch');continue;}
  const actionCountDiff=actual.actions.length!==expected.actions.length;
  if(actionCountDiff&&!cardScenarios.some(s=>!s.name.startsWith('engine-action ')&&timingCovered(s.name,timing))){block('action-count-rewrite-needs-timing-gameplay-scenario');continue;}
  if(actionCountDiff&&!expected.actions.length){block('empty-local-window-cannot-remove-actions');continue;}
  if(actionCountDiff&&(canonical(actual.conditions)!==canonical(expected.conditions)||canonical(actual.costs)!==canonical(expected.costs))){block('action-count-mismatch');continue;}
  const differing=actionCountDiff?expected.actions.map((_action,index)=>index):expected.actions.flatMap((action,index)=>canonical(action)===canonical(actual.actions[index])?[]:[index]);
  if(!differing.length)continue;
  const actionScenarios:Array<{index:number;action:EffectAction;scenario:{name:string;run:(doc:EffectDocument)=>void}}>=[];
  for(const actionIndex of differing){
   const action=expected.actions[actionIndex];
   const fullWindowPrefix=familyForAction[action.kind];
   const singleTimingWindow=local.ast.filter(ability=>ability.trigger===timing).length===1;
   const named=cardScenarios.find(s=>s.name.startsWith(`engine-action ${timing} ${action.kind}:`)&&(s.name.includes(`action ${actionIndex+1} independently`)||(expected.actions.length===1&&s.name.includes('resolve isolated parsed instruction'))))
    ?? (fullWindowPrefix&&singleTimingWindow?cardScenarios.find(s=>timingCovered(s.name,timing)&&s.name.includes(fullWindowPrefix)):undefined);
   if(!named){failed=true;block('changed-action-has-no-execution-scenario');break;}
   try{named.run(local);}catch{failed=true;block('local-action-scenario-failed');break;}
   actionScenarios.push({index:actionIndex,action,scenario:named});
  }
  if(failed)break;
  const localWindows=local.normalized.filter(item=>item.timing===timing),publishedWindows=after.normalized.filter(item=>item.timing===timing),expectedWindow=localWindows[localIndex],nextWindow=publishedWindows[localIndex];
  if(!expectedWindow||!nextWindow){block('normalized-window-shape-mismatch');continue;}
  const protectionOnly=expected.actions.some(action=>action.kind==='prevent-ko')&&expected.actions.every(action=>action.kind==='prevent-ko'||action.kind==='attach-don-required')&&actual.actions.every(action=>action.kind==='prevent-ko'||action.kind==='attach-don-required');
  const legacyDonMarkers=protectionOnly&&nextWindow.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='attach-don-required')&&expectedWindow.sequence.every(step=>step.type!=='RESOLVE'||step.action.kind!=='attach-don-required');
  if(!actionCountDiff&&expectedWindow.sequence.length!==nextWindow.sequence.length&&!legacyDonMarkers){block('normalized-window-shape-mismatch');continue;}
  if(actionCountDiff&&(canonical(expectedWindow.conditions)!==canonical(nextWindow.conditions)||expectedWindow.optional!==nextWindow.optional)){block('normalized-window-shape-mismatch');continue;}
  // Older D1 rows serialized the DON!! gate as a visible RESOLVE step. The
  // current schema keeps that gate on the ability and omits it from the
  // normalized sequence. A full protection gameplay scenario verifies the
  // gate, so rebuild only this narrowly-shaped sequence from the local AST.
  if(legacyDonMarkers){
   if(!differing.every(index=>expected.actions[index]?.kind==='prevent-ko')||!cardScenarios.some(s=>s.name===`${timing} gameplay prevent-K.O.: preserve printed protection scope and condition`)){block('legacy-protection-sequence-lacks-gameplay-scenario');continue;}
   for(const {index,action,scenario} of actionScenarios){next.actions[index]=structuredClone(action);changedScenarios.push(scenario);changed++;}
   nextWindow.sequence=structuredClone(expectedWindow.sequence);
   continue;
  }
  const expectedResolve=expectedWindow.sequence.flatMap((step,index)=>step.type==='RESOLVE'?[index]:[]),publishedResolve=nextWindow.sequence.flatMap((step,index)=>step.type==='RESOLVE'?[index]:[]);
  if(expectedResolve.length!==expected.actions.length||publishedResolve.length!==actual.actions.length){block('normalized-action-count-mismatch');continue;}
  if(actionCountDiff){
   const expectedPayments=expectedWindow.sequence.filter(step=>step.type==='PAY_COST'),publishedPayments=nextWindow.sequence.filter(step=>step.type==='PAY_COST');
   const expectedPaymentPrefix=expectedWindow.sequence.slice(0,expectedPayments.length).every(step=>step.type==='PAY_COST'),publishedPaymentPrefix=nextWindow.sequence.slice(0,publishedPayments.length).every(step=>step.type==='PAY_COST');
   if(!expectedPaymentPrefix||!publishedPaymentPrefix||canonical(expectedPayments)!==canonical(publishedPayments)){block('action-count-window-payment-sequence-mismatch');continue;}
   next.actions=structuredClone(expected.actions);
   nextWindow.sequence=[...structuredClone(publishedPayments),...expected.actions.map(action=>({type:'RESOLVE' as const,action:structuredClone(action)}))];
   for(const {scenario} of actionScenarios){changedScenarios.push(scenario);changed++;}
   continue;
  }
  let otherStepsMatch=true;
  for(let index=0;index<expectedWindow.sequence.length;index++){
   if(expectedResolve.includes(index))continue;
   if(canonical(expectedWindow.sequence[index])!==canonical(nextWindow.sequence[index])){otherStepsMatch=false;break;}
  }
  if(!otherStepsMatch){block('another-sequence-step-differs');continue;}
  for(const {index,action} of actionScenarios)next.actions[index]=structuredClone(action);
  for(const {index,action,scenario} of actionScenarios){
   const resolveIndex=publishedResolve[index],step=nextWindow.sequence[resolveIndex];
   if(step.type!=='RESOLVE'){failed=true;block('normalized-action-position-mismatch');break;}
   step.action=structuredClone(action);
   changedScenarios.push(scenario);changed++;
  }
  if(failed)break;
 }
 if(failed||!changed)continue;
 const names=new Set(changedScenarios.map(s=>s.name));
 const verification=cardScenarios.filter(s=>names.has(s.name)||!s.name.startsWith('engine-action '));
 try{for(const scenario of verification)scenario.run(after);}catch(error){if(process.env.EFFECT_PLAN_DEBUG)console.error(card.code,(error as Error).message);block('preserved-window-scenario-failed-after-patch');continue;}
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:[...new Set(changedScenarios.map(s=>s.name.split(' ')[1]))],scenarioNames:verification.map(s=>s.name),scenarioCount:verification.length,before,after,beforeHash:hash(before),afterHash:hash(after),patchKind:'ACTION_ONLY_PRESERVING_ALL_OTHER_WINDOW_STEPS',patchedActionCount:changed});
}

mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/action-patches-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,actions:candidates.reduce((sum,c)=>sum+Number(c.patchedActionCount),0),scenarios:candidates.reduce((sum,c)=>sum+Number(c.scenarioCount),0),blocked}));
