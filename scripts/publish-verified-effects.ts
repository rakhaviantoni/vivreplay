import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {EffectAction,EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {scenarios,type Identity,type Scenario} from './card-effect-scenarios';
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const mainActionIsRest=(action:EffectAction|undefined):action is Extract<EffectAction,{kind:'rest'}>=>action?.kind==='rest';
const normalizedWindowText=(value:string)=>value.replace(/\s+/g,' ').replace(/[−–—]/g,'-').replace(/Activate:\s*Main/gi,'Activate: Main').replace(/\[(On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\]\s*/gi,'[$1] ').replace(/\[(DON!!\s*[x×]\s*\d+)\]\s*(\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn|Your Turn|Opponent's Turn)\])/gi,'$2 [$1] ').replace(/\[DON!!\s*[x×]\s*(\d+)\]\s*\[(Opponent's Turn|Your Turn)\]/gi,'[$2] [DON!!x$1]').replace(/DON!!\s*[x×]/gi,'DON!!x').replace(/\{([^{}]+)\}/g,'[$1]').replace(/gains\s+\[?(Rush|Blocker|Double Attack|Banish)\]?/gi,'gains [$1]').replace(/\s*\(/g,' (').replace(/\s+([.,:;])/g,'$1').replace(/\]\s*\[/g,'] [').replace(/\s+/g,' ');
const containsSourceWindow=(source:string,window:string)=>{const normalizedSource=normalizedWindowText(source),normalizedWindow=normalizedWindowText(window),expandedSource=normalizedSource.replace(/\[([^\]]+)\]\s*\/\s*\[([^\]]+)\]/gi,'[$1] [$2]'),sharedOnPlay=normalizedSource.replace(/\[(On Play|On K\.O\.)\]\s*\/\s*\[(On Play|On K\.O\.)\]\s*/gi,'[$1] '),sharedOnKo=normalizedSource.replace(/\[(On Play|On K\.O\.)\]\s*\/\s*\[(On Play|On K\.O\.)\]\s*/gi,'[$2] '),sharedMain=normalizedSource.replace(/\[(Main|Counter)\]\s*\/\s*\[(Main|Counter)\]\s*/gi,'[$1] '),sharedCounter=normalizedSource.replace(/\[(Main|Counter)\]\s*\/\s*\[(Main|Counter)\]\s*/gi,'[$2] ');return normalizedSource.includes(normalizedWindow)||expandedSource.includes(normalizedWindow)||sharedOnPlay.includes(normalizedWindow)||sharedOnKo.includes(normalizedWindow)||sharedMain.includes(normalizedWindow)||sharedCounter.includes(normalizedWindow);};
type Row={code:string;name:string;printedText:string;publishedText:string|null;localSchema:EffectDocument;databaseSchema:EffectDocument|null;textMatches:boolean};
const windowPresentInBothSources=(card:Row,window:string)=>Boolean(card.publishedText&&containsSourceWindow(card.printedText,window)&&containsSourceWindow(card.publishedText,window));
function scenarioWindow(name:string,schema:EffectDocument):EffectTrigger|undefined{
 if(/^schema-op07-017 main\/trigger:/i.test(name))return 'main';
 if(/^schema-st12-016 main\/counter\/trigger:/i.test(name))return 'main';
 if(/^engine-aura continuous:/i.test(name))return 'continuous';
 if(/^schema-st01-012 when-attacking:/i.test(name))return 'when-attacking';
 if(/^schema-op16-055 when-attacking:/i.test(name))return 'when-attacking';
 if(/^schema-op07-016 main and trigger:/i.test(name))return 'main';
 if(/^keyword (?:Rush|Blocker|Double Attack|Banish):/i.test(name))return 'unknown';
 if(name.startsWith('schema-continuous-power:'))return 'continuous';
 if(name.startsWith('End of Your Turn: ready only a cost 3–8 Supernovas Character'))return 'end-turn';
 if(name.startsWith('Character played from Trash:'))return 'character-played-from-trash';
 if(name==='continuous: separate effect immunity and DON!!-plus-zero-cost Double Attack')return 'unknown';
 if(/^schema-op09-013 paired timing:/i.test(name))return 'on-play';
 if(/^schema-reference trigger:/i.test(name))return 'trigger';
 if(/^schema-keyword-isolation on-play:/i.test(name))return 'on-play';
 const eb01Timing=name.match(/^schema-eb01-(main|trigger):/i)?.[1];
 if(eb01Timing)return eb01Timing==='main'?'main':'trigger';
 if(/^schema-op14-048 on-play:/i.test(name))return 'on-play';
 if(/^schema-op07-092 on-play:/i.test(name))return 'on-play';
 if(/^schema-op09-115 main:/i.test(name))return 'main';
 if(/^schema-op05-094 main:/i.test(name))return 'main';
 if(/^schema-keyword-sequence opponent-attack:/i.test(name))return 'opponent-attack';
 if(/^schema-op12-113 trigger:/i.test(name))return 'trigger';
 if(/^schema-trigger-source-return trigger:/i.test(name))return 'trigger';
 if(/^schema-return-character-cost main:/i.test(name))return 'main';
 if(/^schema-named-don-payment main:/i.test(name))return 'main';
 if(/^schema-op04-030 sequence on-play:/i.test(name))return 'on-play';
 if(/^schema-reminder-don-cost opponent-attack:/i.test(name))return 'opponent-attack';
 if(/^schema-p060 main:/i.test(name))return 'main';
 if(/^schema-p013 activate-main:/i.test(name))return 'activate-main';
 if(/^schema-op06-117 activate-main:/i.test(name))return 'activate-main';
 if(/^schema-don-ko when-attacking:/i.test(name))return 'when-attacking';
 const op10096Timing=name.match(/^schema-op10-096 (main|trigger):/i)?.[1];
 if(op10096Timing)return op10096Timing==='main'?'main':'trigger';
 const actionTiming=name.match(/^engine-action ([^ ]+) /i)?.[1] as EffectTrigger|undefined;
 if(actionTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn','continuous','unknown'].includes(actionTiming))return actionTiming;
 const atomicTiming=name.match(/^schema-atomic-action ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(atomicTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn','continuous','unknown'].includes(atomicTiming))return atomicTiming;
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
 const costActionTiming=name.match(/^schema-cost-action ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(costActionTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(costActionTiming))return costActionTiming;
 const addDonTiming=name.match(/^schema-add-don ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(addDonTiming&&['end-turn','on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(addDonTiming))return addDonTiming;
 const returnHandTiming=name.match(/^schema-return-hand ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(returnHandTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','end-turn'].includes(returnHandTiming))return returnHandTiming;
 const attackRestrictionTiming=name.match(/^schema-attack-restriction ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(attackRestrictionTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(attackRestrictionTiming))return attackRestrictionTiming;
 const restTargetTiming=name.match(/^schema-rest-target ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restTargetTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(restTargetTiming))return restTargetTiming;
 const lifeScaledRestTiming=name.match(/^schema-rest ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(lifeScaledRestTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block'].includes(lifeScaledRestTiming))return lifeScaledRestTiming;
 const restCostTiming=name.match(/^schema-rest-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(restCostTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(restCostTiming))return restCostTiming;
 const stageCostTiming=name.match(/^schema-stage-bottom-deck-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(stageCostTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(stageCostTiming))return stageCostTiming;
 const reminderDonCostTiming=name.match(/^schema-reminder-don-cost ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(reminderDonCostTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(reminderDonCostTiming))return reminderDonCostTiming;
 const selfLeaderRestTiming=name.match(/^schema-rest-self-leader ([^:]+):/i)?.[1] as EffectTrigger|undefined;
 if(selfLeaderRestTiming&&['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','end-turn'].includes(selfLeaderRestTiming))return selfLeaderRestTiming;
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
 if(card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema&&card.localSchema.resolver.type==='DSL'&&card.databaseSchema.resolver.type==='DSL'){
  const after=structuredClone(card.databaseSchema),changed:EffectTrigger[]=[],checks:Scenario[]=[];
  for(const timing of [...new Set(card.localSchema.ast.map(ability=>ability.trigger))]){
   const localAst=card.localSchema.ast.filter(ability=>ability.trigger===timing),localNorm=card.localSchema.normalized.filter(effect=>effect.timing===timing),publishedAst=after.ast.filter(ability=>ability.trigger===timing),publishedNorm=after.normalized.filter(effect=>effect.timing===timing);
   if(localAst.length!==1||localNorm.length!==1||publishedAst.length!==1||publishedNorm.length!==1)continue;
   const ability=localAst[0],action=ability.actions[0],orderedPower=ability.actions.length>1&&ability.actions.every(item=>item.kind==='power')&&cases.some(s=>s.name.includes('gameplay power sequence: resolve every printed target in order')&&scenarioWindow(s.name,card.localSchema)===timing);
   if(ability.conditions.length||ability.costs.length||!ability.actions.length||(!orderedPower&&ability.actions.length!==1)||!windowPresentInBothSources(card,ability.rawText.trim()))continue;
   const executions=ability.actions.map((item,index)=>cases.find(s=>s.name.startsWith(`engine-action ${timing} ${item.kind}: ${ability.actions.length===1?'resolve isolated parsed instruction':`exercise action ${index+1} independently`}`))).filter((item):item is Scenario=>Boolean(item));
   if(executions.length!==ability.actions.length)continue;
   if(ability.actions.length>1&&!orderedPower)continue;
   if(canonical(ability)===canonical(publishedAst[0])&&canonical(localNorm[0])===canonical(publishedNorm[0]))continue;
   try{for(const execution of executions)execution.run(card.localSchema);}catch{continue;}
   const trial=structuredClone(after),astIndex=trial.ast.findIndex(item=>item.trigger===timing),normIndex=trial.normalized.findIndex(item=>item.timing===timing);
   trial.ast[astIndex]=structuredClone(ability);trial.normalized[normIndex]=structuredClone(localNorm[0]);
   const related=cases.filter(s=>s.name.startsWith(`engine-action ${timing} `)||scenarioWindow(s.name,card.localSchema)===timing);
   try{for(const scenario of related)scenario.run(trial);}catch{continue;}
   after.ast=trial.ast;after.normalized=trial.normalized;
   changed.push(timing);checks.push(...related);
  }
  if(changed.length){candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:changed,scenarioNames:[...new Set(checks.map(s=>s.name))],scenarioCount:new Set(checks.map(s=>s.name)).size,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;}
 }
 const attackRestrictionCases=cases.filter(s=>s.name.includes('gameplay attack prohibition:'));
 const attackRestrictionText=/This Character cannot attack (?:a Leader on the turn in which it is played|unless )/i.test(card.printedText);
 if(card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema?.resolver.type==='CUSTOM'&&card.localSchema.resolver.type==='DSL'&&attackRestrictionText&&attackRestrictionCases.length>0){
  const prohibitions=card.localSchema.ast.flatMap(ability=>ability.actions.filter(action=>action.kind==='attack-prohibition'&&(action.condition||action.target||action.during)));
  const sourcesMatch=prohibitions.length>0&&prohibitions.every(action=>card.localSchema.ast.some(ability=>ability.actions.includes(action)&&windowPresentInBothSources(card,ability.rawText.trim())));
  if(!sourcesMatch){block('attack-restriction-window-not-proven-in-both-sources');continue;}
  try{for(const scenario of attackRestrictionCases)scenario.run(card.localSchema);}catch{block('attack-restriction-local-scenario-failed');continue;}
  const after=structuredClone(card.localSchema);
  try{for(const scenario of attackRestrictionCases)scenario.run(after);}catch{block('attack-restriction-published-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:card.localSchema.ast.filter(ability=>ability.actions.some(action=>action.kind==='attack-prohibition')).map(ability=>ability.trigger),scenarioNames:attackRestrictionCases.map(s=>s.name),scenarioCount:attackRestrictionCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 const stageRestLifeCases=cases.filter(s=>s.name.startsWith('schema-stage-rest-life-power '));
 if(card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema&&card.localSchema.resolver.type==='DSL'&&stageRestLifeCases.length===1){
  const localWindows=card.localSchema.ast.filter(ability=>ability.costs.some(cost=>cost.kind==='rest'&&cost.scope==='self')&&ability.costs.some(cost=>cost.kind==='turn-life'&&cost.faceUp)&&ability.actions.length===1&&ability.actions[0].kind==='power');
  const localEffects=localWindows.flatMap(ability=>card.localSchema.normalized.filter(effect=>effect.timing===ability.trigger));
  const exact=card.localSchema.ast.length===1&&localWindows.length===1&&localEffects.length===1&&localWindows[0].costs.length===2&&localWindows[0].conditions.length===0&&localWindows[0].costs.every(cost=>cost.optional)&&localWindows[0].costs.some(cost=>cost.kind==='turn-life'&&cost.scope==='own'&&cost.amount===1&&cost.position==='top'&&cost.faceUp)&&localEffects[0].sequence.length===3&&localEffects[0].sequence[0].type==='PAY_COST'&&localEffects[0].sequence[1].type==='PAY_COST'&&localEffects[0].sequence[2].type==='RESOLVE'&&windowPresentInBothSources(card,localWindows[0].rawText.trim());
  if(!exact){block('stage-rest-life-window-not-isolated');continue;}
  try{for(const scenario of stageRestLifeCases)scenario.run(card.localSchema);}catch{block('stage-rest-life-local-sequence-failed');continue;}
  const after=structuredClone(card.localSchema);
  try{for(const scenario of stageRestLifeCases)scenario.run(after);}catch{block('stage-rest-life-published-sequence-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:[localWindows[0].trigger],scenarioNames:stageRestLifeCases.map(s=>s.name),scenarioCount:stageRestLifeCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP04-038'&&card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema&&card.localSchema.resolver.type==='DSL'){
  const windows=new Map<EffectTrigger,EffectDocument['ast']>();
  for(const timing of ['main','counter','trigger'] as const)windows.set(timing,card.localSchema.ast.filter(ability=>ability.trigger===timing));
  const main=windows.get('main')??[],counter=windows.get('counter')??[],trigger=windows.get('trigger')??[];
  const ordered=cases.filter(s=>s.name==='schema-op04-038 Main/Counter: rest a target before K.O. of a rested Character');
  const safe=card.localSchema.ast.length===3&&main.length===1&&counter.length===1&&trigger.length===1&&[main[0],counter[0]].every(ability=>ability.conditions.length===0&&ability.costs.length===0&&ability.actions.length===2&&ability.actions[0].kind==='rest'&&ability.actions[1].kind==='ko'&&windowPresentInBothSources(card,ability.rawText.trim()))&&trigger[0].actions.length===1&&trigger[0].actions[0].kind==='ready'&&windowPresentInBothSources(card,trigger[0].rawText.trim())&&ordered.length===1;
  if(!safe){block('op04-038-rest-ko-trigger-windows-not-isolated');continue;}
  try{for(const scenario of cases)scenario.run(card.localSchema);}catch{block('op04-038-local-scenario-failed');continue;}
  const after=structuredClone(card.localSchema);
  try{for(const scenario of cases)scenario.run(after);}catch{block('op04-038-published-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main','counter','trigger'],scenarioNames:cases.map(s=>s.name),scenarioCount:cases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP08-019'&&card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema&&card.localSchema.resolver.type==='DSL'){
  const main=card.localSchema.ast.filter(ability=>ability.trigger==='main'),counter=card.localSchema.ast.filter(ability=>ability.trigger==='counter'),trigger=card.localSchema.ast.filter(ability=>ability.trigger==='trigger');
  const ordered=cases.filter(s=>s.name==='schema-op08-019 Main/Counter: apply the printed opposing and own power changes in order');
  const safe=card.localSchema.ast.length===3&&main.length===1&&counter.length===1&&trigger.length===1&&[main[0],counter[0]].every(ability=>ability.conditions.length===0&&ability.costs.length===0&&ability.actions.length===2&&ability.actions[0].kind==='power'&&ability.actions[1].kind==='power'&&windowPresentInBothSources(card,ability.rawText.trim()))&&trigger[0].actions.length===1&&trigger[0].actions[0].kind==='ko'&&windowPresentInBothSources(card,trigger[0].rawText.trim())&&ordered.length===1;
  if(!safe){block('op08-019-dual-power-windows-not-isolated');continue;}
  try{for(const scenario of cases)scenario.run(card.localSchema);}catch{block('op08-019-local-scenario-failed');continue;}
  const after=structuredClone(card.localSchema);
  try{for(const scenario of cases)scenario.run(after);}catch{block('op08-019-published-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main','counter','trigger'],scenarioNames:cases.map(s=>s.name),scenarioCount:cases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 const standalonePowerCases=cases.filter(s=>/ gameplay power: verify the complete window and apply its printed target$/.test(s.name));
 if(card.databaseScenarios.some(s=>s.status==='FAIL')&&card.textMatches&&card.databaseSchema&&card.localSchema.resolver.type==='DSL'&&standalonePowerCases.length===1){
  const ability=card.localSchema.ast[0],window=card.localSchema.normalized[0],markerCount=(card.printedText.match(/\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\]/gi)??[]).length;
  const body=card.printedText.replace(/^\s*\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|End of Your Turn)\]\s*/i,'');
  const onlyOnePowerClause=(body.match(/(?:gains?|give)\s+[+\-−]?\s*\d+\s+power/gi)??[]).length===1;
  const noOtherOperation=/\b(?:then|trash|K\.O\.|draw|return|rest|play|add|attach|reveal|search|look at|turn .*Life|cannot|prevent|choose|replace|becomes?)\b/i.test(body);
  const exact=card.localSchema.ast.length===1&&card.localSchema.normalized.length===1&&ability?.conditions.length===0&&ability?.costs.length===0&&ability?.actions.length===1&&ability.actions[0].kind==='power'&&!ability.actions[0].bonus&&!ability.actions[0].continuous&&window?.sequence.length===1&&window.sequence[0].type==='RESOLVE'&&window.sequence[0].action.kind==='power'&&markerCount===1&&onlyOnePowerClause&&!noOtherOperation&&windowPresentInBothSources(card,ability.rawText.trim());
  if(!exact){block('standalone-power-window-not-complete');continue;}
  const checks=cases.filter(s=>!s.name.startsWith('engine-action '));
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('standalone-power-local-gameplay-failed');continue;}
  const after=structuredClone(card.localSchema);
  try{for(const scenario of checks)scenario.run(after);}catch{block('standalone-power-published-gameplay-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:[ability.trigger],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP17-053'&&card.databaseScenarios.some(s=>s.status==='FAIL')){block('op17-053-opponent-controlled-hidden-choice-unimplemented');continue;}
 if(card.code==='OP07-017'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const freshLocal=compileEffectDocument({id:'',code:card.code,name:card.name,color:'Red',type:'Event',cost:3,power:0,counter:0,rarity:'',art:0,effect:card.printedText});
  const localMain=freshLocal.ast.filter(ast=>ast.trigger==='main'),localTrigger=freshLocal.ast.filter(ast=>ast.trigger==='trigger'),localMainEffect=freshLocal.normalized.filter(effect=>effect.timing==='main'),localTriggerEffect=freshLocal.normalized.filter(effect=>effect.timing==='trigger');
  const [character,stage]=localMain[0]?.actions??[];const checks=cases.filter(s=>s.name==='schema-op07-017 main/trigger: choose a qualifying Character and Stage independently');
  const safe=card.textMatches&&localMain.length===1&&localTrigger.length===1&&localMainEffect.length===1&&localTriggerEffect.length===1&&localMain[0].conditions.length===0&&localMain[0].costs.length===0&&localMain[0].actions.length===2&&character?.kind==='ko'&&character.scope==='opponent-character'&&character.maxPower===3000&&character.selection?.min===0&&character.selection.max===1&&stage?.kind==='ko'&&stage.scope==='opponent-stage'&&stage.maxCost===1&&stage.selection?.min===0&&stage.selection.max===1&&localTrigger[0].actions.some(action=>action.kind==='activate-referenced-effect'&&action.trigger==='main')&&windowPresentInBothSources(card,localMain[0].rawText.trim())&&windowPresentInBothSources(card,localTrigger[0].rawText.trim())&&checks.length===1;
  if(!safe){block('op07-017-character-stage-sequence-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(freshLocal);}catch{block('op07-017-local-character-stage-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);const repaired=new Set<EffectTrigger>(['main','trigger']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localMain,...localTrigger];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localMainEffect,...localTriggerEffect];
  try{for(const scenario of checks)scenario.run(after);}catch{block('op07-017-published-character-stage-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main','trigger'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='ST12-016'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const freshLocal=compileEffectDocument({id:'',code:card.code,name:card.name,color:'Red',type:'Event',cost:2,power:0,counter:0,rarity:'',art:0,effect:card.printedText});
  const localMain=freshLocal.ast.filter(ast=>ast.trigger==='main'),localCounter=freshLocal.ast.filter(ast=>ast.trigger==='counter'),localTrigger=freshLocal.ast.filter(ast=>ast.trigger==='trigger');
  const localMainEffect=freshLocal.normalized.filter(effect=>effect.timing==='main'),localTriggerEffect=freshLocal.normalized.filter(effect=>effect.timing==='trigger');
  const mainAction=localMain[0]?.actions[0],counterAction=localCounter[0]?.actions[0];
  const checks=cases.filter(s=>s.name.startsWith('schema-st12-016 main/counter/trigger:')||s.name==='schema-rest-target main: opponent-card cost <= 4 up to 1');
  const safe=card.textMatches&&localMain.length===1&&localCounter.length===1&&localTrigger.length===1&&localMainEffect.length===1&&localTriggerEffect.length===1&&mainAction?.kind==='rest'&&mainAction.scope==='opponent-card'&&mainAction.maxCost===4&&mainAction.selection?.min===0&&mainAction.selection.max===1&&counterAction?.kind==='rest'&&canonical(mainAction)===canonical(counterAction)&&localTrigger[0].actions.length===2&&localTrigger[0].actions.filter(action=>action.kind==='activate-main-effect').length===1&&localTrigger[0].actions.filter(action=>action.kind==='activate-referenced-effect'&&action.trigger==='main').length===1&&localMainEffect[0].sequence.length===1&&localTriggerEffect[0].sequence.length===2&&windowPresentInBothSources(card,localMain[0].rawText.trim())&&windowPresentInBothSources(card,localCounter[0].rawText.trim())&&windowPresentInBothSources(card,localTrigger[0].rawText.trim())&&checks.length===2;
  if(!safe){block('st12-016-rest-windows-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(freshLocal);}catch{block('st12-016-local-rest-scenarios-failed');continue;}
  const after=structuredClone(card.databaseSchema!);const repaired=new Set<EffectTrigger>(['main','trigger']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localMain,...localTrigger];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localMainEffect,...localTriggerEffect];
  try{for(const scenario of checks)scenario.run(after);}catch{block('st12-016-published-rest-scenarios-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main','trigger'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='P-113'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const freshLocal=compileEffectDocument({id:'',code:'P-113',name:'Jewelry Bonney',color:'Green',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect:card.printedText});
  const localContinuous=freshLocal.ast.filter(ast=>ast.trigger==='continuous'),localNormalized=freshLocal.normalized.filter(effect=>effect.timing==='continuous');
  const localTrigger=freshLocal.ast.filter(ast=>ast.trigger==='trigger'),localTriggerNormalized=freshLocal.normalized.filter(effect=>effect.timing==='trigger');
  const blocker=localContinuous.filter(ast=>ast.actions.some(action=>action.kind==='grant-keyword'&&action.keyword==='blocker'));
  const checks=cases.filter(s=>s.name.startsWith('schema-blocker don-gate:')||s.name.startsWith('engine-action continuous grant-keyword-target:'));
  const safe=card.textMatches&&localContinuous.length===1&&localNormalized.length===1&&blocker.length===1&&blocker[0].conditions.some(condition=>condition.text==="it is your opponent's turn")&&blocker[0].actions.some(action=>action.kind==='attach-don-required'&&action.amount===2)&&blocker[0].actions.some(action=>action.kind==='power'&&action.amount===2000&&action.target==='own-character')&&blocker[0].actions.some(action=>action.kind==='grant-keyword'&&action.keyword==='blocker')&&localTrigger.length===1&&localTriggerNormalized.length===1&&localTrigger[0].actions.length===1&&localTrigger[0].actions[0].kind==='ko'&&localTrigger[0].actions[0].maxCost===3&&windowPresentInBothSources(card,blocker[0].rawText.trim())&&windowPresentInBothSources(card,localTrigger[0].rawText.trim())&&checks.length===2;
  if(!safe){block('p113-continuous-blocker-window-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(freshLocal);}catch{block('p113-local-don-blocker-power-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);after.ast=[...after.ast.filter(ast=>ast.trigger!=='continuous'&&ast.trigger!=='trigger'),...localContinuous,...localTrigger];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='continuous'&&effect.timing!=='trigger'),...localNormalized,...localTriggerNormalized];
  try{for(const scenario of checks)scenario.run(after);}catch{block('p113-published-don-blocker-power-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['continuous','trigger'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP16-055'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const localOnPlay=card.localSchema.ast.filter(ast=>ast.trigger==='on-play'),localAttack=card.localSchema.ast.filter(ast=>ast.trigger==='when-attacking');
  const localOnPlayEffect=card.localSchema.normalized.filter(effect=>effect.timing==='on-play'),localAttackEffect=card.localSchema.normalized.filter(effect=>effect.timing==='when-attacking');
  const checks=cases.filter(s=>s.name==='schema-op16-055 when-attacking: one attached DON!! copies opposing Leader base power until turn end');
  const attack=localAttack[0],copy=attack?.actions.find(action=>action.kind==='copy-base-power');
  const safe=card.textMatches&&localOnPlay.length===1&&localOnPlayEffect.length===1&&localOnPlay[0].conditions.length===0&&localOnPlay[0].costs.length===0&&localOnPlay[0].actions.length===1&&localOnPlay[0].actions[0].kind==='draw'&&localOnPlay[0].actions[0].amount===1&&localAttack.length===1&&localAttackEffect.length===1&&attack.conditions.length===0&&attack.costs.length===0&&attack.actions.length===2&&attack.actions.some(action=>action.kind==='attach-don-required'&&action.amount===1)&&copy?.kind==='copy-base-power'&&copy.from==='opponent-leader'&&localAttackEffect[0].sequence.length===1&&localAttackEffect[0].sequence[0].type==='RESOLVE'&&localAttackEffect[0].sequence[0].action.kind==='copy-base-power'&&windowPresentInBothSources(card,localOnPlay[0].rawText.trim())&&windowPresentInBothSources(card,attack.rawText.trim())&&checks.length===1;
  if(!safe){block('op16-055-timings-or-copy-power-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('op16-055-local-copy-power-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);const repaired=new Set<EffectTrigger>(['on-play','when-attacking']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localOnPlay,...localAttack];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localOnPlayEffect,...localAttackEffect];
  try{for(const scenario of checks)scenario.run(after);}catch{block('op16-055-published-copy-power-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['on-play','when-attacking'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP07-016'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const localMain=card.localSchema.ast.filter(ast=>ast.trigger==='main'),localTrigger=card.localSchema.ast.filter(ast=>ast.trigger==='trigger');
  const localMainEffect=card.localSchema.normalized.filter(effect=>effect.timing==='main'),localTriggerEffect=card.localSchema.normalized.filter(effect=>effect.timing==='trigger');
  const checks=cases.filter(s=>s.name==='schema-op07-016 main and trigger: independently boost Revolutionary Army and weaken one opposing Character');
  const [boost,reduce]=localMain[0]?.actions??[];
  const safe=card.textMatches&&localMain.length===1&&localMainEffect.length===1&&localMain[0].conditions.length===0&&localMain[0].costs.length===0&&localMain[0].actions.length===2&&boost?.kind==='power'&&boost.amount===2000&&boost.target==='own-character'&&boost.trait==='Revolutionary Army'&&boost.selection?.max===1&&reduce?.kind==='power'&&reduce.amount===-1000&&reduce.target==='opponent-character'&&reduce.selection?.max===1&&windowPresentInBothSources(card,localMain[0].rawText.trim())&&localTrigger.length===1&&localTriggerEffect.length===1&&localTrigger[0].actions.some(action=>action.kind==='activate-referenced-effect'&&action.trigger==='main')&&windowPresentInBothSources(card,localTrigger[0].rawText.trim())&&checks.length===1;
  if(!safe){block('op07-016-main-trigger-or-target-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('op07-016-local-power-sequence-failed');continue;}
  const after=structuredClone(card.databaseSchema!);const repaired=new Set<EffectTrigger>(['main','trigger']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localMain,...localTrigger];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localMainEffect,...localTriggerEffect];
  try{for(const scenario of checks)scenario.run(after);}catch{block('op07-016-published-power-sequence-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main','trigger'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP03-041'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const localUnknown=card.localSchema.ast.filter(ast=>ast.trigger==='unknown'),localNormalized=card.localSchema.normalized.filter(effect=>effect.timing==='unknown'),rush=localUnknown.filter(ast=>ast.actions.length===1&&ast.actions[0].kind==='rush'),attack=localUnknown.filter(ast=>ast.actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===7));
  const checks=cases.filter(s=>s.name==='schema-leading-keyword OP03-041: isolate Rush from DON!! attack trigger'||s.name==='keyword Rush: new-character');
  const sourceTextMatches=card.textMatches||card.publishedText?.replace(/\s+/g,' ').trim()===card.printedText.replace(/\s+/g,' ').trim();
  const safe=sourceTextMatches&&localUnknown.length===2&&localNormalized.length===2&&rush.length===1&&attack.length===1&&attack[0].actions.some(action=>action.kind==='attach-don-required'&&action.amount===1)&&windowPresentInBothSources(card,rush[0].rawText.trim())&&windowPresentInBothSources(card,attack[0].rawText.trim())&&checks.length===2;
  if(!safe){block('op03-041-keyword-and-don-window-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('op03-041-local-keyword-isolation-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);after.ast=[...after.ast.filter(ast=>ast.trigger!=='unknown'),...localUnknown];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='unknown'),...localNormalized];
  try{for(const scenario of checks)scenario.run(after);}catch{block('op03-041-published-keyword-isolation-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,effectTextAfter:card.printedText,timings:['unknown'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 if(card.code==='OP03-090'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const localBlocker=card.localSchema.ast.filter(ast=>ast.trigger==='unknown'&&ast.actions.some(action=>action.kind==='grant-keyword'&&action.keyword==='blocker'));
  const localKo=card.localSchema.ast.filter(ast=>ast.trigger==='on-ko'),localWindows=[...localBlocker,...localKo];
  const localNormalized=card.localSchema.normalized.filter(effect=>effect.timing==='unknown'||effect.timing==='on-ko');
  const checks=cases.filter(s=>s.name.startsWith('schema-blocker don-gate:'));
  const expectedCorruptText=card.printedText.replace(/^\[DON!! x1\] This Character gains \[Blocker\]\./,'[DON!! x1] [This Character gains [Blocker].').replace(/\.\s*\n\(/,'. (').replace(/\)\s*\n\[On K\.O\.\]/,') [On K.O.]');
  const knownCorruptText=card.publishedText===expectedCorruptText,identityWindowsMatch=localWindows.every(ast=>containsSourceWindow(card.printedText,ast.rawText.trim()));
  const safe=(card.textMatches||knownCorruptText)&&localBlocker.length===1&&localKo.length===1&&localKo[0].actions.length===1&&localKo[0].actions[0].kind==='play'&&localKo[0].actions[0].source==='trash'&&localKo[0].actions[0].trait==='CP'&&localKo[0].actions[0].maxCost===4&&localKo[0].actions[0].rested&&identityWindowsMatch&&checks.length===1;
  if(!safe){block('op03-090-don-blocker-windows-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('op03-090-local-blocker-ko-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);const repaired=new Set<EffectTrigger>(['unknown','on-ko']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localWindows];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localNormalized];after.rawEffectText=card.printedText;
  try{for(const scenario of checks)scenario.run(after);}catch{block('op03-090-published-blocker-ko-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,effectTextAfter:card.printedText,timings:['unknown','on-ko'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 const positiveDonFailures=card.databaseScenarios.filter(s=>s.status==='FAIL'&&s.name.startsWith('engine-action ')).map(s=>scenarioWindow(s.name,card.localSchema)).filter((timing):timing is EffectTrigger=>Boolean(timing));
 if(positiveDonFailures.length&&card.textMatches){
  const timings=[...new Set(positiveDonFailures)],localWindows=timings.flatMap(timing=>card.localSchema.ast.filter(ast=>ast.trigger===timing)),localEffects=timings.flatMap(timing=>card.localSchema.normalized.filter(effect=>effect.timing===timing));
  const checks=cases.filter(s=>timings.includes(scenarioWindow(s.name,card.localSchema)!));
  const exactWindows=timings.every(timing=>{const abilities=card.localSchema.ast.filter(ast=>ast.trigger===timing),effect=card.localSchema.normalized.filter(item=>item.timing===timing);if(abilities.length!==1||effect.length!==1)return false;const ability=abilities[0],cost=ability.costs[0];return ability.conditions.length===0&&ability.costs.length===1&&cost?.kind==='rest'&&cost.scope==='don'&&!cost.optional&&ability.actions.length===1&&effect[0].sequence.length===2&&effect[0].sequence[0].type==='PAY_COST'&&effect[0].sequence[0].cost.kind==='rest'&&effect[0].sequence[0].cost.scope==='don'&&effect[0].sequence[1].type==='RESOLVE'&&windowPresentInBothSources(card,ability.rawText.trim())&&/DON!!\s*\d+\s*:\s*(?:Give up to \d+ of your opponent's Characters? [\d,]+ power during this turn|K\.O\. up to \d+ of your opponent's Characters? with \d+ base power or less)\.?$/i.test(ability.rawText.trim());});
  if(exactWindows&&checks.some(s=>s.name.startsWith('schema-rest-don-cost'))&&timings.every(timing=>checks.some(s=>s.name.startsWith('engine-action '+timing+' '))&&checks.some(s=>s.name.startsWith('schema-rest-don-cost '+timing+':')))){
   try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('positive-don-cost-local-scenario-failed');continue;}
   const after=structuredClone(card.databaseSchema!);const changed=new Set<EffectTrigger>(timings);after.ast=[...after.ast.filter(ast=>!changed.has(ast.trigger)),...localWindows];after.normalized=[...after.normalized.filter(effect=>!changed.has(effect.timing)),...localEffects];
   try{for(const scenario of checks)scenario.run(after);}catch{block('positive-don-cost-published-scenario-failed');continue;}
   candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings,scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
  }
 }
 if(card.code==='OP03-038'&&card.databaseScenarios.some(s=>s.status==='FAIL')){
  const printed="[Main] Rest up to 2 of your opponent's Characters with a cost of 2 or less.";
  const mainAst=card.localSchema.ast.filter(ast=>ast.trigger==='main'),mainEffects=card.localSchema.normalized.filter(effect=>effect.timing==='main');
  const mainCases=cases.filter(s=>scenarioWindow(s.name,card.localSchema)==='main');
  const localAction=mainAst[0]?.actions[0];
  const staleTrigger=Boolean(card.publishedText?.includes('[Trigger]')&&!card.printedText.includes('[Trigger]'));
  const safe=card.printedText===printed&&staleTrigger&&mainAst.length===1&&mainEffects.length===1&&mainAst[0].conditions.length===0&&mainAst[0].costs.length===0&&mainActionIsRest(localAction)&&localAction.scope==='opponent-character'&&localAction.maxCost===2&&localAction.selection?.min===0&&localAction.selection.max===2&&card.databaseSchema?.ast.some(ast=>ast.trigger==='main'&&ast.rawText.includes('[Trigger]'))&&mainCases.length>=3;
  if(!safe){block('op03-038-stale-trigger-source-not-proven');continue;}
  try{for(const scenario of mainCases)scenario.run(card.localSchema);}catch{block('op03-038-local-rest-scenario-failed');continue;}
  const after=structuredClone(card.databaseSchema!);after.ast=[...after.ast.filter(ast=>ast.trigger!=='main'),...mainAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='main'),...mainEffects];after.rawEffectText=card.printedText;
  try{for(const scenario of mainCases)scenario.run(after);}catch{block('op03-038-published-rest-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['main'],scenarioNames:mainCases.map(s=>s.name),scenarioCount:mainCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after),effectTextAfter:card.printedText});continue;
 }
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
 if(card.code==='OP08-105'&&[...failingNames].some(name=>name.startsWith('trigger: draw 2 then discard 1 /'))){
  const localAst=card.localSchema.ast.filter(ast=>ast.trigger==='trigger'),localEffects=card.localSchema.normalized.filter(effect=>effect.timing==='trigger'),checks=cases.filter(s=>s.name.startsWith('trigger: draw 2 then discard 1 /')||s.name==='schema-draw trigger: printed counts 2');
  const ability=localAst[0],effect=localEffects[0];
  const safe=card.textMatches&&localAst.length===1&&localEffects.length===1&&checks.length===5&&ability.conditions.length===0&&ability.costs.length===0&&ability.actions.length===2&&ability.actions[0].kind==='draw'&&ability.actions[0].amount===2&&ability.actions[1].kind==='trash'&&ability.actions[1].scope==='hand'&&ability.actions[1].amount===1&&effect.sequence.length===2&&effect.sequence[0].type==='RESOLVE'&&effect.sequence[0].action.kind==='draw'&&effect.sequence[1].type==='RESOLVE'&&effect.sequence[1].action.kind==='trash'&&windowPresentInBothSources(card,ability.rawText.trim());
  if(!safe){block('op08-105-draw-discard-window-not-isolated');continue;}
  try{for(const scenario of checks)scenario.run(card.localSchema);}catch{block('op08-105-local-draw-discard-sequence-failed');continue;}
  const after=structuredClone(card.databaseSchema!);after.ast=[...after.ast.filter(ast=>ast.trigger!=='trigger'),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='trigger'),...localEffects];
  try{for(const scenario of checks)scenario.run(after);}catch{block('op08-105-published-draw-discard-sequence-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['trigger'],scenarioNames:checks.map(s=>s.name),scenarioCount:checks.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});continue;
 }
 const timings=new Set(cases.filter(s=>failingNames.has(s.name)).map(s=>scenarioWindow(s.name,card.localSchema)).filter((timing):timing is EffectTrigger=>Boolean(timing)));
 let after=structuredClone(card.databaseSchema);
 const changed:EffectTrigger[]=[];
 let effectTextAfter:string|undefined;
 let preserveImplementationStatus=false;
 const op02TimingCases=cases.filter(s=>s.name.startsWith('schema-bottom-deck when-attacking:')||s.name.startsWith('schema-reorder on-play:'));
 const repairOp02CrossTiming=card.code==='OP02-056'&&op02TimingCases.some(s=>s.name.startsWith('schema-bottom-deck '))&&op02TimingCases.some(s=>s.name.startsWith('schema-reorder '))&&timings.has('when-attacking')&&timings.has('on-play');
 const referenceCases=cases.filter(s=>s.name.startsWith('schema-reference trigger:'));
 const onKoReferenceCases=cases.filter(s=>s.name.startsWith('schema-reference trigger: resolve the referenced On K.O.'));
 const mainKoCases=cases.filter(s=>s.name.startsWith('schema-ko main:'));
 const counterKoCases=cases.filter(s=>s.name.startsWith('schema-ko counter:'));
 const localMainAst=card.localSchema.ast.filter(ast=>ast.trigger==='main'),localMainEffect=card.localSchema.normalized.filter(effect=>effect.timing==='main');
 const localCounterAst=card.localSchema.ast.filter(ast=>ast.trigger==='counter'),localCounterEffect=card.localSchema.normalized.filter(effect=>effect.timing==='counter');
 const localTriggerAst=card.localSchema.ast.filter(ast=>ast.trigger==='trigger'),localTriggerEffect=card.localSchema.normalized.filter(effect=>effect.timing==='trigger');
 if(card.code==='OP09-013'&&timings.has('on-play')&&cases.some(s=>s.name.startsWith('schema-op09-013 paired timing:'))){
  const paired=cases.filter(s=>s.name.startsWith('schema-op09-013 paired timing:')),localOnPlayAst=card.localSchema.ast.filter(ast=>ast.trigger==='on-play'),localOnPlay=card.localSchema.normalized.filter(effect=>effect.timing==='on-play'),localAttackAst=card.localSchema.ast.filter(ast=>ast.trigger==='when-attacking'),localAttack=card.localSchema.normalized.filter(effect=>effect.timing==='when-attacking');
  const printedOnPlayCount=(card.printedText.match(/\[On Play\]/gi)??[]).length,printedAttackCount=(card.printedText.match(/\[When Attacking\]/gi)??[]).length;
  const safe=card.textMatches&&printedOnPlayCount===1&&printedAttackCount===1&&localOnPlayAst.length===1&&localOnPlay.length===1&&localAttackAst.length===1&&localAttack.length===1&&/^\[On Play\]/i.test(localOnPlayAst[0].rawText)&&/^\[When Attacking\]/i.test(localAttackAst[0].rawText)&&localOnPlayAst[0].conditions.length===0&&localOnPlayAst[0].costs.length===0&&localAttackAst[0].conditions.length===0&&localAttackAst[0].costs.length===0&&localAttackAst[0].actions.some(action=>action.kind==='attach-don-required'&&action.amount===1);
  if(!safe){block('op09-013-paired-window-not-isolated');continue;}
  try{for(const scenario of paired)scenario.run(card.localSchema);}catch{block('op09-013-local-paired-scenario-failed');continue;}
  const repaired=new Set<EffectTrigger>(['on-play','when-attacking']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localOnPlayAst,...localAttackAst];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localOnPlay,...localAttack];changed.push('on-play','when-attacking');preserveImplementationStatus=true;
  try{for(const scenario of paired)scenario.run(after);}catch{block('op09-013-published-paired-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['on-play','when-attacking'],scenarioNames:paired.map(s=>s.name),scenarioCount:paired.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
  continue;
 }
 if(timings.has('trigger')&&onKoReferenceCases.length>0){
  const referenceText="Activate this card's [On K.O.] effect.";
  const safe=card.textMatches&&localTriggerAst.length===1&&localTriggerEffect.length===1&&localTriggerAst[0].actions.length===1&&localTriggerAst[0].actions[0].kind==='activate-referenced-effect'&&localTriggerAst[0].actions[0].trigger==='on-ko'&&localTriggerAst[0].costs.length===0&&localTriggerAst[0].conditions.length===0&&windowPresentInBothSources(card,localTriggerAst[0].rawText.trim())&&localTriggerAst[0].rawText.includes(referenceText)&&card.localSchema.ast.some(ast=>ast.trigger==='on-ko');
  if(!safe){block('on-ko-reference-trigger-not-isolated');continue;}
  try{for(const scenario of [...onKoReferenceCases,...cases.filter(s=>s.name.startsWith('schema-draw on-ko:')||s.name.startsWith('schema-ko on-ko:')||s.name.startsWith('engine-action on-ko '))])scenario.run(card.localSchema);}catch{block('on-ko-reference-local-sequence-failed');continue;}
  after.ast=[...after.ast.filter(ast=>ast.trigger!=='trigger'),...localTriggerAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='trigger'),...localTriggerEffect];changed.push('trigger');preserveImplementationStatus=true;
  try{for(const scenario of onKoReferenceCases)scenario.run(after);}catch{block('on-ko-reference-published-sequence-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:['trigger'],scenarioNames:onKoReferenceCases.map(s=>s.name),scenarioCount:onKoReferenceCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
  continue;
 }
 const simpleReferencedWindowCases=cases.filter(s=>/^schema-reference trigger: resolve referenced (?:main|counter) power$/i.test(s.name));
 if(timings.has('trigger')&&simpleReferencedWindowCases.length){
  const triggerAbility=localTriggerAst[0],reference=triggerAbility?.actions.length===1&&triggerAbility.actions[0].kind==='activate-referenced-effect'?triggerAbility.actions[0].trigger:undefined;
  const sourceAst=reference?card.localSchema.ast.filter(ast=>ast.trigger===reference):[],sourceEffects=reference?card.localSchema.normalized.filter(effect=>effect.timing===reference):[];
  const verificationCases=[...simpleReferencedWindowCases,...cases.filter(s=>s.name.startsWith(`engine-action ${reference} power:`))];
  const safe=Boolean(card.textMatches&&reference&&['main','counter'].includes(reference)&&localTriggerAst.length===1&&localTriggerEffect.length===1&&triggerAbility.conditions.length===0&&triggerAbility.costs.length===0&&triggerAbility.actions.length===1&&containsSourceWindow(triggerAbility.rawText,'[Trigger] Activate this card\'s ['+ (reference==='main'?'Main':'Counter') +'] effect.')&&windowPresentInBothSources(card,triggerAbility.rawText.trim())&&sourceAst.length===1&&sourceEffects.length===1&&sourceAst[0].conditions.length===0&&sourceAst[0].costs.length===0&&sourceAst[0].actions.length===1&&sourceAst[0].actions[0].kind==='power'&&sourceAst[0].actions[0].selection&&sourceEffects[0].conditions.length===0&&sourceEffects[0].sequence.length===1&&sourceEffects[0].sequence[0].type==='RESOLVE'&&canonical(sourceEffects[0].sequence[0].action)===canonical(sourceAst[0].actions[0])&&windowPresentInBothSources(card,sourceAst[0].rawText.trim()));
  if(!safe){block('referenced-simple-power-window-not-isolated');continue;}
  try{for(const scenario of verificationCases)scenario.run(card.localSchema);}catch{block('referenced-simple-power-local-scenario-failed');continue;}
  const repaired=new Set<EffectTrigger>([reference!,'trigger']);after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...sourceAst,...localTriggerAst];after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...sourceEffects,...localTriggerEffect];changed.push(reference!,'trigger');preserveImplementationStatus=true;
  try{for(const scenario of verificationCases)scenario.run(after);}catch{block('referenced-simple-power-published-scenario-failed');continue;}
  candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:[reference!,'trigger'],scenarioNames:verificationCases.map(s=>s.name),scenarioCount:verificationCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
  continue;
 }
 const repairReferencedMain=timings.has('main')&&timings.has('trigger')&&referenceCases.length>0&&localMainAst.length===1&&localMainEffect.length===1&&localTriggerAst.length===1&&localTriggerEffect.length===1&&/Activate this card's \[Main\] effect\./i.test(localTriggerAst[0].rawText)&&windowPresentInBothSources(card,localMainAst[0].rawText.trim())&&windowPresentInBothSources(card,localTriggerAst[0].rawText.trim())&&(!counterKoCases.length||(localCounterAst.length===1&&localCounterEffect.length===1&&windowPresentInBothSources(card,localCounterAst[0].rawText.trim())));
 if(repairReferencedMain){
  try{for(const scenario of [...mainKoCases,...counterKoCases,...referenceCases])scenario.run(card.localSchema);}catch{block('referenced-main-local-scenario-failed');}
  if(!blocked['referenced-main-local-scenario-failed']){
   const repaired=new Set<EffectTrigger>(['main','trigger',...(counterKoCases.length?['counter' as const]:[])]);
   after.ast=[...after.ast.filter(ast=>!repaired.has(ast.trigger)),...localMainAst,...(counterKoCases.length?localCounterAst:[]),...localTriggerAst];
   after.normalized=[...after.normalized.filter(effect=>!repaired.has(effect.timing)),...localMainEffect,...(counterKoCases.length?localCounterEffect:[]),...localTriggerEffect];
   changed.push('main',...(counterKoCases?['counter' as const]:[]),'trigger');preserveImplementationStatus=true;
  }
 }
 if(repairOp02CrossTiming){
  try{for(const scenario of op02TimingCases)scenario.run(card.localSchema);}catch{block('op02-cross-window-local-scenario-failed');}
  if(!blocked['op02-cross-window-local-scenario-failed']){const repairedTimings=new Set<EffectTrigger>(['on-play','when-attacking']);after.ast=[...after.ast.filter(ast=>!repairedTimings.has(ast.trigger)),...card.localSchema.ast.filter(ast=>repairedTimings.has(ast.trigger))];after.normalized=[...after.normalized.filter(effect=>!repairedTimings.has(effect.timing)),...card.localSchema.normalized.filter(effect=>repairedTimings.has(effect.timing))];changed.push('on-play','when-attacking');preserveImplementationStatus=true;}
 }
 let repairOp04Trebol=false;
 const trebolCases=cases.filter(s=>s.name.startsWith('schema-op04-030 sequence ')||s.name.startsWith('schema-reminder-don-cost opponent-attack:')||s.name.startsWith('engine-action on-play ko:'));
 if(card.code==='OP04-030'&&timings.has('on-play')&&timings.has('opponent-attack')&&trebolCases.length>=3){
  const windows:EffectTrigger[]=['on-play','opponent-attack'];
  const localWindows=windows.flatMap(timing=>card.localSchema.ast.filter(ast=>ast.trigger===timing));
  const localEffects=windows.flatMap(timing=>card.localSchema.normalized.filter(effect=>effect.timing===timing));
  const complete=localWindows.length===2&&localEffects.length===2&&windows.every(timing=>{const ast=card.localSchema.ast.filter(item=>item.trigger===timing),normalized=card.localSchema.normalized.filter(item=>item.timing===timing);return ast.length===1&&normalized.length===1&&windowPresentInBothSources(card,ast[0].rawText.trim());});
  if(!complete)block('op04-030-source-windows-not-isolated');
  else{
   try{for(const scenario of trebolCases)scenario.run(card.localSchema);}catch{block('op04-030-local-sequence-scenario-failed');}
   if(!blocked['op04-030-source-windows-not-isolated']&&!blocked['op04-030-local-sequence-scenario-failed']){
    const repaired=structuredClone(after);repaired.ast=[...repaired.ast.filter(ast=>!windows.includes(ast.trigger)),...localWindows];repaired.normalized=[...repaired.normalized.filter(effect=>!windows.includes(effect.timing)),...localEffects];
    try{for(const scenario of trebolCases)scenario.run(repaired);}catch{block('op04-030-published-sequence-scenario-failed');}
    if(!blocked['op04-030-published-sequence-scenario-failed']){after=repaired;changed.push(...windows);preserveImplementationStatus=true;repairOp04Trebol=true;}
   }
  }
 }
 for(const timing of timings){
  if(repairOp04Trebol&&(timing==='on-play'||timing==='opponent-attack'))continue;
  if(repairReferencedMain&&(timing==='main'||timing==='trigger'||(counterKoCases.length>0&&timing==='counter')))continue;
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
  if(timing==='continuous'&&timingCases.some(s=>s.name.startsWith('engine-aura continuous:'))){
   const auraCases=timingCases.filter(s=>s.name.startsWith('engine-aura continuous:'));
   const windows=card.localSchema.ast.filter(ast=>ast.trigger==='continuous'),effects=card.localSchema.normalized.filter(effect=>effect.timing==='continuous');
   const isolated=windows.length>0&&windows.length===auraCases.length&&effects.length===windows.length&&windows.every(window=>window.costs.length===0&&window.actions.length>0&&window.actions.every(action=>action.kind==='power'||action.kind==='attach-don-required')&&windowPresentInBothSources(card,window.rawText.trim()));
   if(!isolated){
    if(!windows.length||windows.length!==auraCases.length||effects.length!==windows.length)block('continuous-aura-count-mismatch');
    else if(windows.some(window=>window.costs.length||!window.actions.length||window.actions.some(action=>action.kind!=='power'&&action.kind!=='attach-don-required')))block('continuous-aura-has-unsupported-cost-or-action');
    else block('continuous-aura-source-text-mismatch');
    continue;
   }
   try{for(const scenario of auraCases)scenario.run(card.localSchema);}catch{block('continuous-aura-local-scenario-failed');continue;}
   const repaired=structuredClone(after);repaired.ast=[...repaired.ast.filter(ast=>ast.trigger!=='continuous'),...windows];repaired.normalized=[...repaired.normalized.filter(effect=>effect.timing!=='continuous'),...effects];
   try{for(const scenario of auraCases)scenario.run(repaired);}catch{block('continuous-aura-published-scenario-failed');continue;}
   after=repaired;changed.push('continuous');preserveImplementationStatus=true;continue;
  }
  const timingSourceText=localAst[0]?.rawText??'';
  const parsedCostRepresented=Boolean(localAst[0]?.costs.length||localAst[0]?.actions.some(action=>action.kind==='attach-don-required'));
  const drawThenTrashCases=timingCases.filter(s=>s.name.startsWith(`${timing}: draw `)&&s.name.includes(' then discard '));
  if(drawThenTrashCases.length>=4&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length===2&&localAst[0].actions[0].kind==='draw'&&localAst[0].actions[1].kind==='trash'&&localAst[0].actions[1].scope==='hand'&&localAst[0].actions[1].amount===1&&local[0].sequence.length===2&&local[0].sequence[0].type==='RESOLVE'&&local[0].sequence[0].action.kind==='draw'&&local[0].sequence[1].type==='RESOLVE'&&local[0].sequence[1].action.kind==='trash'&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
   try{for(const scenario of drawThenTrashCases)scenario.run(card.localSchema);}catch{block('draw-then-trash-local-sequence-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...local];
   try{for(const scenario of drawThenTrashCases)scenario.run(after);}catch{block('draw-then-trash-published-sequence-failed');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='ST01-012'&&timing==='when-attacking'&&timingCases.some(s=>s.name.startsWith('schema-st01-012 when-attacking:'))){
   const blockerLock=localAst.length===1&&local.length===1?localAst[0].actions.find(action=>action.kind==='prevent-keyword-activation'):undefined;
   const donRequirement=localAst.length===1?localAst[0].actions.find(action=>action.kind==='attach-don-required'):undefined;
   const safe=Boolean(card.textMatches&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&blockerLock?.kind==='prevent-keyword-activation'&&blockerLock.keyword==='blocker'&&blockerLock.maxPower===undefined&&donRequirement?.kind==='attach-don-required'&&donRequirement.amount===2&&local[0].sequence.length===1&&local[0].sequence[0].type==='RESOLVE'&&local[0].sequence[0].action.kind==='prevent-keyword-activation'&&windowPresentInBothSources(card,localAst[0].rawText.trim()));
   if(!safe){block('st01-012-blocker-lock-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('st01-012-blocker-lock-local-scenario-failed');continue;}
   const misplacedTimings=new Set(after.ast.filter(ast=>ast.trigger!==timing&&containsSourceWindow(ast.rawText,localAst[0].rawText.trim())&&ast.actions.some(action=>action.kind==='attach-don-required'&&action.amount===2)).map(ast=>ast.trigger));
   after.ast=after.ast.flatMap(ast=>{
    if(ast.trigger===timing||!containsSourceWindow(ast.rawText,localAst[0].rawText.trim())||!ast.actions.some(action=>action.kind==='attach-don-required'&&action.amount===2))return [ast];
    const actions=ast.actions.filter(action=>action.kind!=='attach-don-required'||action.amount!==2);
    return actions.length||ast.costs.length||ast.conditions.length?[{...ast,actions}]:[];
   });
   after.normalized=after.normalized.map(effect=>misplacedTimings.has(effect.timing)?{...effect,sequence:effect.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!=='attach-don-required')}:effect).filter(effect=>effect.sequence.length);
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('st01-012-blocker-lock-published-scenario-failed');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  const hasUnmodeledSingleActionSequence=localAst.length===1&&localAst[0].actions.length===1&&(/\bthen\b|\bfor every\b|\bcan be activated when\b|\bchoose one\s*:/i.test(timingSourceText)||/(?:DON!!\s*\d+\s*:|you may (?:reveal|trash|return|rest|discard)\b[^:]{0,160}:)/i.test(timingSourceText)&&!parsedCostRepresented);
  if(hasUnmodeledSingleActionSequence&&timingCases.some(s=>s.name.startsWith('engine-action '))){block('printed-single-action-window-has-unmodeled-sequence-or-cost');continue;}
  const sourceAction=localAst.length===1&&local.length===1&&localAst[0].actions.length===1&&localAst[0].costs.length===0?localAst[0].actions[0]:undefined;
  if(sourceAction&&timingCases.some(s=>s.name.startsWith(`engine-action ${timing} `))&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
   const foreignAst=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger!==timing&&containsSourceWindow(ast.rawText,localAst[0].rawText.trim())&&ast.actions.some(action=>canonical(action)===canonical(sourceAction)));
   const foreignTriggers=new Set(foreignAst.map(({ast})=>ast.trigger));
   const foreignEffects=after.normalized.map((effect,index)=>({effect,index})).filter(({effect})=>foreignTriggers.has(effect.timing)&&effect.sequence.filter(step=>step.type==='RESOLVE'&&canonical(step.action)===canonical(sourceAction)).length===1);
   const foreignActionCount=foreignAst.reduce((count,{ast})=>count+ast.actions.filter(action=>canonical(action)===canonical(sourceAction)).length,0);
   const foreignStepCount=foreignEffects.reduce((count,{effect})=>count+effect.sequence.filter(step=>step.type==='RESOLVE'&&canonical(step.action)===canonical(sourceAction)).length,0);
   if(foreignAst.length===1&&foreignActionCount===1&&foreignStepCount===1){
    try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('misplaced-single-window-local-scenario-failed');continue;}
    after.ast=after.ast.map(ast=>ast===foreignAst[0].ast?{...ast,actions:ast.actions.filter(action=>canonical(action)!==canonical(sourceAction))}:ast).filter(ast=>ast.actions.length||ast.costs.length||ast.conditions.length);
    after.normalized=after.normalized.map(effect=>foreignTriggers.has(effect.timing)?{...effect,sequence:effect.sequence.filter(step=>step.type!=='RESOLVE'||canonical(step.action)!==canonical(sourceAction))}:effect).filter(effect=>effect.sequence.length);
    after.ast=[...after.ast,...localAst];after.normalized=[...after.normalized,...local];
    try{for(const scenario of timingCases)scenario.run(after);}catch{block('misplaced-single-window-published-scenario-failed');continue;}
    changed.push(timing);preserveImplementationStatus=true;continue;
   }
  }
  if(card.code==='OP05-114'&&timing==='counter'&&changed.includes('counter'))continue;
  // Repair stale atomic windows only when the exact printed clause exists in
  // both sources and every stored action is a duplicate of that one action.
  // This keeps mixed/costed effects out of the automatic merge path.
  const localAtomic=localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length===1?localAst[0].actions[0]:undefined;
  const stripSelection=(action:EffectAction)=>Object.fromEntries(Object.entries(action).filter(([field])=>field!=='selection'));
  const currentAtomicAst=after.ast.filter(ast=>ast.trigger===timing),currentAtomicEffects=after.normalized.filter(effect=>effect.timing===timing);
  const atomicText=timingSourceText;
  const unmodeledAtomicSequence=/\bthen\b|\bfor every\b|\bcan be activated when\b|\bchoose one\s*:/i.test(atomicText);
  const printedPaymentCue=/(?:DON!!\s*\d+\s*:|you may (?:reveal|trash|return|rest|discard)\b[^:]{0,160}:)/i.test(atomicText);
  const paymentRepresented=parsedCostRepresented;
  const opponentControlledHiddenChoice=card.code==='OP17-053';
  const safeAtomicWindow=Boolean(localAtomic&&!opponentControlledHiddenChoice&&!unmodeledAtomicSequence&&(!printedPaymentCue||paymentRepresented)&&card.textMatches&&windowPresentInBothSources(card,atomicText.trim())&&currentAtomicAst.length>0&&currentAtomicAst.every(ast=>ast.conditions.length===0&&ast.costs.length===0&&ast.actions.length>0&&ast.actions.every(action=>canonical(stripSelection(action))===canonical(stripSelection(localAtomic))))&&currentAtomicEffects.length>0&&currentAtomicEffects.every(effect=>effect.conditions.length===0&&effect.sequence.length>0&&effect.sequence.every(step=>step.type==='RESOLVE'&&canonical(stripSelection(step.action))===canonical(stripSelection(localAtomic)))));
  if(safeAtomicWindow&&timingCases.some(s=>s.name.startsWith('engine-action ')||s.name.startsWith('schema-atomic-action '))){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('atomic-window-local-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];
   after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('atomic-window-published-scenario-failed');continue;}
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='EB03-041'&&timing==='continuous'&&timingCases.some(s=>s.name.startsWith('schema-continuous-power:'))){
   const source=localAst.length===1?localAst[0]:undefined,normalized=local.length===1?local[0]:undefined,action=source?.actions.length===1?source.actions[0]:undefined;
   const safe=Boolean(source&&normalized&&action?.kind==='power'&&action.amount===2000&&action.target==='own-character'&&action.trait==='SWORD'&&action.maxCost===6&&action.continuous&&source.conditions.length===1&&source.conditions[0].text==="it is your opponent's turn"&&source.costs.length===0&&normalized.conditions.length===1&&normalized.sequence.length===1&&normalized.sequence[0].type==='RESOLVE'&&normalized.sequence[0].action.kind==='power'&&windowPresentInBothSources(card,source.rawText.trim()));
   if(!safe){block('eb03-041-continuous-aura-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('eb03-041-continuous-aura-local-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),source!];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),normalized!];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='OP02-015'&&timing==='activate-main'&&timingCases.some(s=>s.name.startsWith('schema-power activate-main: pay optional self-rest'))){
   const source=localAst.length===1?localAst[0]:undefined,normalized=local.length===1?local[0]:undefined,action=source?.actions.length===1?source.actions[0]:undefined;
   const safe=Boolean(source&&normalized&&action?.kind==='power'&&action.amount===3000&&action.until==='turn-end'&&action.target==='own-character'&&action.color==='red'&&action.exactCost===1&&action.selection?.min===0&&action.selection.max===1&&source.conditions.length===0&&source.costs.length===1&&source.costs[0].kind==='rest'&&source.costs[0].scope==='self'&&source.costs[0].optional&&normalized.conditions.length===0&&normalized.sequence.length===2&&normalized.sequence[0].type==='PAY_COST'&&normalized.sequence[0].cost.kind==='rest'&&normalized.sequence[1].type==='RESOLVE'&&normalized.sequence[1].action.kind==='power'&&windowPresentInBothSources(card,source.rawText.trim()));
   if(!safe){block('op02-015-rest-then-filtered-power-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op02-015-filtered-power-local-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),source!];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),normalized!];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='OP06-117'&&timing==='activate-main'&&timingCases.some(s=>s.name.startsWith('schema-op06-117 activate-main:'))){
   const source=localAst.length===1?localAst[0]:undefined,normalized=local.length===1?local[0]:undefined,costs=source?.costs??[],action=source?.actions.length===1?source.actions[0]:undefined;
   const safe=card.textMatches&&Boolean(source&&normalized&&source.conditions.length===0&&costs.length===2&&costs[0].kind==='rest'&&costs[0].scope==='self'&&costs[0].amount===1&&costs[0].optional&&costs[1].kind==='rest'&&costs[1].scope==='own-card'&&costs[1].amount===1&&costs[1].trait==='Enel'&&costs[1].optional&&action?.kind==='ko'&&action.maxCost===2&&action.selection?.min===0&&action.selection.max==='all'&&normalized.conditions.length===0&&normalized.sequence.length===3&&normalized.sequence[0].type==='PAY_COST'&&normalized.sequence[0].cost.kind==='rest'&&normalized.sequence[0].cost.scope==='self'&&normalized.sequence[1].type==='PAY_COST'&&normalized.sequence[1].cost.kind==='rest'&&normalized.sequence[1].cost.scope==='own-card'&&normalized.sequence[2].type==='RESOLVE'&&normalized.sequence[2].action.kind==='ko'&&windowPresentInBothSources(card,source.rawText.trim()));
   if(!safe){block('op06-117-rest-cost-sequence-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op06-117-local-gameplay-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),source!];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),normalized!];changed.push(timing);preserveImplementationStatus=true;
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('op06-117-published-gameplay-scenario-failed');continue;}
   continue;
  }
  if(card.code==='OP15-018'&&timing==='when-attacking'&&timingCases.some(s=>s.name.startsWith('schema-don-ko when-attacking:'))){
   const source=localAst.length===1?localAst[0]:undefined,normalized=local.length===1?local[0]:undefined,action=source?.actions.length===1?source.actions[0]:undefined;
   const safe=card.textMatches&&Boolean(source&&normalized&&source.conditions.length===0&&source.costs.length===0&&action?.kind==='ko'&&action.maxPower===3000&&action.minAttachedDon===1&&action.selection?.min===0&&action.selection.max===1&&normalized.conditions.length===0&&normalized.sequence.length===1&&normalized.sequence[0].type==='RESOLVE'&&normalized.sequence[0].action.kind==='ko'&&normalized.sequence[0].action.minAttachedDon===1&&windowPresentInBothSources(card,source.rawText.trim()));
   if(!safe){block('op15-018-don-gated-ko-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op15-018-don-gated-ko-local-gameplay-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),source!];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),normalized!];changed.push(timing);preserveImplementationStatus=true;
   try{for(const scenario of timingCases)scenario.run(after);}catch{block('op15-018-don-gated-ko-published-gameplay-scenario-failed');continue;}
   continue;
  }
  if(card.code==='OP07-024'&&timing==='opponent-attack'&&timingCases.some(s=>s.name.startsWith('schema-keyword-sequence opponent-attack:'))){
   const source=localAst.length===1?localAst[0]:undefined,normalized=local.length===1?local[0]:undefined,grant=source?.actions.length===1?source.actions[0]:undefined;
   const safe=card.textMatches&&Boolean(source&&normalized&&grant?.kind==='grant-keyword'&&grant.keyword==='blocker'&&grant.scope==='own-character'&&grant.trait==='Fish-Man'&&grant.maxCost===5&&grant.selection?.max===1&&source.conditions.length===0&&source.costs.length===1&&source.costs[0].kind==='rest'&&source.costs[0].scope==='self'&&source.costs[0].optional&&normalized.conditions.length===0&&normalized.sequence.length===2&&normalized.sequence[0].type==='PAY_COST'&&normalized.sequence[0].cost.kind==='rest'&&normalized.sequence[1].type==='RESOLVE'&&normalized.sequence[1].action.kind==='grant-keyword'&&windowPresentInBothSources(card,source.rawText.trim()));
   if(!safe){block('op07-024-rest-then-blocker-window-not-isolated');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op07-024-rest-then-blocker-local-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),source!];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),normalized!];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(card.code==='OP05-114'&&timing==='trigger'&&timingCases.some(s=>s.name.startsWith('schema-ko trigger:'))){
   const localCounter=card.localSchema.ast.filter(ast=>ast.trigger==='counter'),dbCounter=after.ast.filter(ast=>ast.trigger==='counter'),dbCounterEffects=after.normalized.filter(effect=>effect.timing==='counter'),localTrigger=localAst.length===1&&local[0]?.sequence.length===1&&local[0].sequence[0].type==='RESOLVE'&&local[0].sequence[0].action.kind==='ko'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='ko';
   const misplacedCount=dbCounter.reduce((count,ast)=>count+ast.actions.filter(action=>action.kind==='ko').length,0),misplacedSteps=dbCounterEffects.reduce((count,effect)=>count+effect.sequence.filter(step=>step.type==='RESOLVE'&&step.action.kind==='ko').length,0);
   const safe=card.textMatches&&localTrigger&&localCounter.length===1&&localCounter[0].actions.every(action=>action.kind!=='ko')&&dbCounter.length===1&&dbCounter[0].actions.length===3&&misplacedCount===2&&dbCounterEffects.length===1&&misplacedSteps===2&&/\[Trigger\]\s*K\.O\./i.test(card.printedText)&&windowPresentInBothSources(card,localAst[0].rawText.trim());
   if(!safe){block('op05-114-trigger-counter-isolation-not-proven');continue;}
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op05-114-life-ko-local-scenario-failed');continue;}
   after.ast=after.ast.map(ast=>ast.trigger==='counter'?{...ast,actions:ast.actions.filter(action=>action.kind!=='ko')}:ast);
   after.normalized=after.normalized.map(effect=>effect.timing==='counter'?{...effect,sequence:effect.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!=='ko')}:effect);
   after.ast=[...after.ast.filter(ast=>ast.trigger!=='trigger'),...localAst];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='trigger'),...local];changed.push('trigger','counter');preserveImplementationStatus=true;continue;
  }
  if(timing==='on-play'&&failingNames.has('schema-keyword-isolation on-play: reject an unprinted On Play timing')&&!/\[On Play\](?!\s*effect\b)/i.test(card.printedText)&&!card.localSchema.ast.some(ast=>ast.trigger==='on-play')&&card.localSchema.ast.some(ast=>ast.trigger!=='on-play')){
   after.ast=after.ast.filter(ast=>ast.trigger!=='on-play');after.normalized=after.normalized.filter(effect=>effect.timing!=='on-play');changed.push('on-play');preserveImplementationStatus=true;continue;
  }
  if(timing==='main'&&timingCases.some(s=>s.name.startsWith('schema-return-character-cost main:'))&&localAst.length===1&&local.length===1&&localAst[0].costs.length===1&&localAst[0].costs[0].kind==='return-character-hand'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='return-to-hand'&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('return-character-cost-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;
  }
  if(timing==='main'&&timingCases.some(s=>s.name.startsWith('schema-named-don-payment main:'))&&localAst.length===1&&local.length===1&&localAst[0].costs.length===1&&localAst[0].costs[0].kind==='attach-don-character'&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='power'&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('named-don-payment-scenario-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];changed.push(timing);preserveImplementationStatus=true;continue;
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
  if(timingCases.some(s=>s.name.startsWith('schema-rest-target '))){const exactLocalRest=card.textMatches&&localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length===1&&localAst[0].actions[0].kind==='rest'&&windowPresentInBothSources(card,localAst[0].rawText.trim());if(!exactLocalRest){block('rest-target-window-has-unverified-text-or-sequence');continue;}}
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
  const coveredKinds=new Set(timingCases.flatMap(s=>s.name.startsWith('engine-action ')&&s.name.includes('grant-keyword-target:')?['grant-keyword']:s.name.startsWith('engine-action ')&&/^engine-action .+ ko: resolve isolated parsed instruction$/.test(s.name)?['ko']:s.name.startsWith('schema-search ')?['search']:s.name.startsWith('schema-power ')?['power']:s.name.startsWith('schema-ko ')?['ko']:s.name.startsWith('schema-rest-target ')?['rest']:s.name.startsWith('schema-attack-restriction ')?['attack-restriction']:s.name.startsWith('schema-play ')?['play']:s.name.startsWith('schema-bottom-deck ')?['bottom-deck']:s.name.startsWith('schema-return-hand ')?['return-to-hand']:s.name.startsWith('schema-hand-reset ')?['hand-reset']:s.name.startsWith('schema-reorder ')?['reorder-deck']:s.name.startsWith('schema-draw ')||s.name.startsWith('schema-conditional-draw ')?['draw']:s.name.startsWith('schema-life-to-hand ')?['life']:s.name.startsWith('schema-trash-life ')?['trash-life']:s.name.startsWith('schema-ready-don ')||s.name.startsWith('schema-ready-don-gate ')?['ready']:s.name.startsWith('schema-add-don ')?['add-don']:[]));
  if(card.code==='OP16-073'&&timing==='on-play'&&timingCases.some(s=>s.name.startsWith('schema-add-don on-play: active then additional rested DON!!'))){const localWindow=card.localSchema.ast.filter(ast=>ast.trigger==='on-play'),localNormalized=card.localSchema.normalized.filter(effect=>effect.timing==='on-play');if(!card.textMatches||localWindow.length!==1||localNormalized.length!==1||!windowPresentInBothSources(card,localWindow[0].rawText.trim())||localWindow[0].actions.length!==2||localWindow[0].actions[0].kind!=='add-don'||localWindow[0].actions[0].rested!==false||localWindow[0].actions[1].kind!=='add-don'||localWindow[0].actions[1].rested!==true){block('op16-073-don-sequence-not-isolated');continue;}try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('op16-073-don-sequence-scenario-failed');continue;}after.ast=[...after.ast.filter(ast=>ast.trigger!=='on-play'),...localWindow];after.normalized=[...after.normalized.filter(effect=>effect.timing!=='on-play'),...localNormalized];changed.push('on-play');preserveImplementationStatus=true;continue;}
  if(coveredKinds.has('rest')&&timingCases.some(s=>s.name.startsWith('schema-rest-target '))){const databaseWindow=after.ast.filter(ast=>ast.trigger===timing),localWindow=localAst;if(!card.textMatches||databaseWindow.length!==localWindow.length||databaseWindow.some(ast=>ast.conditions.length>0||ast.costs.length>0||ast.actions.some(action=>action.kind!=='rest'&&action.kind!=='attach-don-required'))){block('rest-target-window-has-unverified-text-or-sequence');continue;}}
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
   const databaseSchema=card.databaseSchema!;
   const coveredMismatch=[...coveredKinds].some(kind=>canonical({ast:databaseSchema.ast.filter(ast=>ast.trigger===timing).flatMap(ast=>ast.actions.filter(action=>action.kind===kind)),steps:databaseSchema.normalized.filter(effect=>effect.timing===timing).flatMap(effect=>effect.sequence.filter(step=>step.type==='RESOLVE'&&step.action.kind===kind))})!==canonical({ast:card.localSchema.ast.filter(ast=>ast.trigger===timing).flatMap(ast=>ast.actions.filter(action=>action.kind===kind)),steps:card.localSchema.normalized.filter(effect=>effect.timing===timing).flatMap(effect=>effect.sequence.filter(step=>step.type==='RESOLVE'&&step.action.kind===kind))}));
   if(canonical(untouched(card.databaseSchema))!==canonical(untouched(card.localSchema))||coveredMismatch){
    let isolated=true;
    for(const coveredKind of coveredKinds){
     const localActions=localAst.flatMap(ast=>ast.actions.filter(action=>action.kind===coveredKind));
     const dbNodes=after.ast.map((ast,index)=>({ast,index})).filter(({ast})=>ast.trigger===timing&&ast.actions.some(action=>action.kind===coveredKind));
     const dbSteps=after.normalized.flatMap((effect,effectIndex)=>effect.timing===timing?effect.sequence.map((step,stepIndex)=>({step,effectIndex,stepIndex})).filter(item=>item.step.type==='RESOLVE'&&item.step.action.kind===coveredKind):[]);
     if(localActions.length!==1||dbNodes.length!==1||dbNodes[0].ast.actions.filter(action=>action.kind===coveredKind).length!==1||dbSteps.length!==1){
      // Older published rows sometimes contain the same atomic action more than once.
      // Replace that timing only when the printed timing contains that verb once and
      // the complete local window is a single, scenario-verified action.
      const localWindow=card.localSchema.ast.filter(ast=>ast.trigger===timing),localEffect=card.localSchema.normalized.filter(effect=>effect.timing===timing);
      const koText=localWindow[0]?.rawText.replace(/^\s*\[[^\]]+\]\s*/,'').trim()??'',localKo=localWindow[0]?.actions[0];
      const koCount=koText.match(/K\.O\.\s+up to\s+(\d+)/i),koBaseCost=koText.match(/base cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),koCost=koText.match(/(?<!base )cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),koLife=/cost equal to or less than/i.test(koText),koPower=koText.replace(/\d+\s+base power/ig,'').match(/(\d+)\s+power or less/i),koBasePower=koText.match(/(\d+)\s+base power or less/i);
      const printedKoMatchesLocal=localKo?.kind==='ko'&&(!koCount||localKo.selection?.max===Number(koCount[1]))&&(!koBaseCost||(koBaseCost[2]?.toLowerCase()==='less'?localKo.maxBaseCost===Number(koBaseCost[1]):!koBaseCost[2]?localKo.exactBaseCost===Number(koBaseCost[1]):true))&&(!koCost||(koCost[2]?.toLowerCase()==='less'?localKo.maxCost===Number(koCost[1]):!koCost[2]?localKo.exactCost===Number(koCost[1]):true))&&(!koLife||Boolean(localKo.maxCostFromLife))&&(!koPower||localKo.maxPower===Number(koPower[1]))&&(!koBasePower||localKo.maxBasePower===Number(koBasePower[1]))&&(!/rested Characters?/i.test(koText)||localKo.restedOnly)&&!/:|;|\b(?:then|give|draw|trash|place|return|rest|ready|reveal|play|attach|add)\b/i.test(koText.replace(/your and your opponent's Life cards/ig,''));
      const duplicateKoWindow=coveredKind==='ko'&&localWindow.length===1&&localEffect.length===1&&printedKoMatchesLocal&&localWindow[0].conditions.length===0&&localWindow[0].costs.length===0&&localWindow[0].actions.length===1&&localWindow[0].actions[0].kind==='ko'&&localEffect[0].conditions.length===0&&localEffect[0].sequence.length===1&&localEffect[0].sequence[0].type==='RESOLVE'&&localEffect[0].sequence[0].action.kind==='ko'&&dbNodes.length===1&&dbNodes[0].ast.actions.length>1&&dbNodes[0].ast.conditions.length===0&&dbNodes[0].ast.costs.length===0&&dbNodes[0].ast.actions.every(action=>action.kind==='ko'||action.kind==='on-ko')&&dbSteps.length===dbNodes[0].ast.actions.length&&dbSteps.every(item=>item.step.type==='RESOLVE'&&(item.step.action.kind==='ko'||item.step.action.kind==='on-ko'))&&(card.printedText.match(/K\.O\./gi)?.length??0)===1&&timingCases.some(s=>s.name.startsWith(`engine-action ${timing} ko:`));
      if(duplicateKoWindow){try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('duplicate-ko-window-scenario-failed');isolated=false;break;}after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),...localWindow];after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),...localEffect];preserveImplementationStatus=true;continue;}
      const timingNodes=after.ast.filter(ast=>ast.trigger===timing),localSequence=local[0]?.sequence??[],localActionScenario=timingCases.some(s=>s.name.startsWith(`engine-action ${timing} ${coveredKind}:`)),replaceWholeWindow=localAst.length===1&&local.length===1&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length===1&&localAst[0].actions[0].kind===coveredKind&&localSequence.length===1&&localSequence[0].type==='RESOLVE'&&canonical(localSequence[0].action)===canonical(localAst[0].actions[0])&&timingNodes.length>=1&&windowPresentInBothSources(card,localAst[0].rawText.trim())&&(localActionScenario||(coveredKind==='reorder-deck'&&timingCases.every(s=>s.name.startsWith('schema-reorder '))));
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
  if(timingCases.some(s=>s.name.startsWith('schema-atomic-action '))&&localAst[0].conditions.length===0&&localAst[0].costs.length===0&&localAst[0].actions.length===1&&local[0].conditions.length===0&&local[0].sequence.length===1&&local[0].sequence[0].type==='RESOLVE'&&canonical(local[0].sequence[0].action)===canonical(localAst[0].actions[0])&&windowPresentInBothSources(card,localAst[0].rawText.trim())){
   try{for(const scenario of timingCases)scenario.run(card.localSchema);}catch{block('atomic-action-local-scenarios-failed');continue;}
   after.ast=[...after.ast.filter(ast=>ast.trigger!==timing),localAst[0]];
   after.normalized=[...after.normalized.filter(effect=>effect.timing!==timing),local[0]];
   changed.push(timing);preserveImplementationStatus=true;continue;
  }
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
 // Printed Rush/Double Attack/Banish are independent abilities. Older published
 // schemas sometimes folded them into the same unknown window as an unrelated
 // DON-gated passive. Split only the keyword action while preserving that window.
 const printedKeyword=card.localSchema.ast.find(ast=>ast.trigger==='unknown'&&/^\[(Rush|Double Attack|Banish)\](?:\s*\([^)]*\))?\s*$/i.test(ast.rawText.trim())&&ast.actions.some(action=>['rush','double-attack','banish'].includes(action.kind)));
 if(printedKeyword&&failingNames.size&&[...failingNames].some(name=>/^keyword (?:Rush|Double Attack|Banish):/i.test(name))&&windowPresentInBothSources(card,printedKeyword.rawText.trim())){
  const keyword=printedKeyword.actions.find(action=>['rush','double-attack','banish'].includes(action.kind))!;
  const kind=keyword.kind;
  let moved=false;
  after.ast=after.ast.flatMap(ast=>{
   if(!ast.actions.some(action=>action.kind===kind)||ast.rawText.trim()===printedKeyword.rawText.trim())return [ast];
   moved=true;const actions=ast.actions.filter(action=>action.kind!==kind);
   return actions.length||ast.costs.length||ast.conditions.length?[{...ast,actions}]:[];
  });
  after.normalized=after.normalized.flatMap(effect=>{
   if(!effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind===kind))return [effect];
   if(effect.timing===printedKeyword.trigger&&effect.sequence.length===1&&effect.conditions.length===0&&effect.sequence[0].type==='RESOLVE'&&effect.sequence[0].action.kind===kind)return [effect];
   moved=true;const sequence=effect.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!==kind);
   return sequence.length?[{...effect,sequence}]:[];
  });
  const isolatedAst=after.ast.some(ast=>ast.rawText.trim()===printedKeyword.rawText.trim()&&ast.actions.some(action=>action.kind===kind));
  const isolatedEffect=after.normalized.some(effect=>effect.timing==='unknown'&&effect.sequence.length===1&&effect.conditions.length===0&&effect.sequence[0].type==='RESOLVE'&&effect.sequence[0].action.kind===kind);
  if(!isolatedAst||!isolatedEffect){
   const localEffect=card.localSchema.normalized.find(effect=>effect.timing==='unknown'&&effect.sequence.length===1&&effect.sequence[0].type==='RESOLVE'&&effect.sequence[0].action.kind===kind);
   if(!localEffect){block('printed-keyword-window-not-isolated');continue;}
   if(!isolatedAst)after.ast.push({...printedKeyword,actions:[keyword]});
   if(!isolatedEffect)after.normalized.push(localEffect);
   moved=true;
  }
  if(moved){if(!changed.includes('unknown'))changed.push('unknown');preserveImplementationStatus=true;}
 }
 if(printedKeyword){
  const required=card.localSchema.ast.flatMap(ast=>ast.actions.filter(action=>action.kind!==printedKeyword.actions.find(item=>['rush','double-attack','banish'].includes(item.kind))?.kind));
  const present=after.ast.flatMap(ast=>ast.actions);
  const counts=(actions:EffectAction[])=>{const result=new Map<string,number>();for(const action of actions){const key=canonical(action);result.set(key,(result.get(key)??0)+1);}return result;};
  const requiredCounts=counts(required),publishedCounts=counts(present);
  if([...requiredCounts].some(([key,count])=>(publishedCounts.get(key)??0)<count)){block('keyword-split-would-leave-another-printed-window-unpublished');continue;}
 }
 const actionCounts=(schema:EffectDocument)=>{const counts=new Map<string,number>();for(const action of schema.ast.flatMap(ast=>ast.actions)){const key=canonical(Object.fromEntries(Object.entries(action).filter(([field])=>field!=='selection')));counts.set(key,(counts.get(key)??0)+1);}return counts;};
 const beforeActionCounts=actionCounts(card.databaseSchema),localActionCounts=actionCounts(card.localSchema),afterActionCounts=actionCounts(after);
 const lostParsedActions=[...localActionCounts].some(([key,localCount])=>{const beforeCount=beforeActionCounts.get(key)??0;return beforeCount>0&&(afterActionCounts.get(key)??0)<Math.min(localCount,beforeCount);});
 if(lostParsedActions){block('repair-would-drop-another-published-action');continue;}
 if(!changed.length){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('no-safe-changes');continue;}
 const verifiedAtomicTimings=new Set(changed.filter(timing=>{const ast=card.localSchema.ast.filter(item=>item.trigger===timing),normalized=card.localSchema.normalized.filter(item=>item.timing===timing);return card.textMatches&&ast.length===1&&normalized.length===1&&ast[0].conditions.length===0&&ast[0].costs.length===0&&ast[0].actions.length===1&&windowPresentInBothSources(card,ast[0].rawText.trim())&&cases.some(s=>s.name.startsWith(`engine-action ${timing} `));}));
 const verificationCases=cases.filter(s=>changed.includes(scenarioWindow(s.name,card.localSchema)!)&&!(repairReferencedMain&&s.name.startsWith('engine-action '))&&(!s.name.startsWith('engine-action ')||verifiedAtomicTimings.has(scenarioWindow(s.name,card.localSchema)!)));
 const unverifiedWindows=changed.filter(timing=>!verifiedAtomicTimings.has(timing)&&!verificationCases.some(s=>scenarioWindow(s.name,card.localSchema)===timing&&!s.name.startsWith('engine-action ')));
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
