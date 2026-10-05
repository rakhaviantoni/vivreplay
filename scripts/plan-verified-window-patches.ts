import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scenarios,type Identity} from './card-effect-scenarios';
import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';

type AuditCard={code:string;printedText:string;publishedText:string|null;textMatches:boolean;localSchema:EffectDocument;databaseSchema:EffectDocument|null;databaseScenarios:Array<{name:string;status:string}>};
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string;code:string}};cards:AuditCard[]};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const normalizedWindowBody=(value:string)=>value.toLowerCase().replace(/\bany of your characters?\b/g,'1 of your characters').replace(/\[(?:on play|when attacking|activate\s*:\s*main|main|counter|trigger|on k\.?o\.?|on block|on your opponent's attack|opponent's turn|your turn|end of your turn)\]/gi,' ').replace(/[{}<>]/g,' ').replace(/[−–—]/g,'-').replace(/[^a-z0-9+-]+/g,' ').replace(/\s+/g,' ').trim();
const windowTextPresent=(card:AuditCard,timing:EffectTrigger)=>{
 if(!card.publishedText)return false;
 const expected=card.localSchema.ast.filter(item=>item.trigger===timing);
 if(!expected.length)return false;
 const sources=[card.printedText,card.publishedText].map(normalizedWindowBody);
 return expected.every(ability=>{
  const body=normalizedWindowBody(ability.rawText);
  return body.length>0&&sources.every(source=>source.includes(body));
 });
};
const timings:EffectTrigger[]=['on-play','when-attacking','activate-main','main','counter','trigger','on-ko','on-block','opponent-attack','opponent-blocker','don-attached','end-turn','continuous','unknown','character-played-from-trash'];
const scenarioMatchesTiming=(name:string,timing:EffectTrigger)=>{
 if(name.startsWith('DON attached gameplay'))return timing==='don-attached';
 if(name.startsWith('Opponent Blocker gameplay'))return timing==='opponent-blocker';
 const match=name.match(/^engine-action ([a-z-]+) /);
 if(match){
  const scenarioTiming=match[1];
  if(scenarioTiming==='unknown')return timing==='unknown';
  return scenarioTiming===timing;
 }
 if(name.startsWith('unknown gameplay '))return timing==='unknown';
 const matchWindow=name.match(/^(On Play|When Attacking|Activate: Main|Main|Counter|Trigger|On K\.O\.|On Block|Opponent's Attack|End of Your Turn|Your Turn|Opponent's Turn|On your Opponent's Attack|On Your Turn|On Opponent's Turn|On K\.O\.|On Block|Continuous|On Character Played From Trash)/i);
 if(!matchWindow)return false;
 const label=matchWindow[1].toLowerCase().replace(/\./g,'').replace(/\s+/g,' ');
 const map:Record<string,EffectTrigger>={
  'on play':'on-play','when attacking':'when-attacking','activate: main':'activate-main','main':'main',counter:'counter',trigger:'trigger',
  'on ko':'on-ko','on block':'on-block',"opponent's attack":'opponent-attack',"on your opponent's attack":'opponent-attack',
  'end of your turn':'end-turn','your turn':'continuous',"opponent's turn":'continuous','on your turn':'continuous',"on opponent's turn":'continuous',
  continuous:'continuous','on character played from trash':'character-played-from-trash'
 };
 return map[label]===timing;
};
const candidates:Array<Record<string,unknown>>=[];
const rejected:Record<string,number>={};
const reject=(reason:string)=>{rejected[reason]=(rejected[reason]??0)+1;};

for(const card of snapshot.cards){
 const before=card.databaseSchema;
 if(!before||!card.publishedText)continue;
 const failedNames=new Set(card.databaseScenarios.filter(item=>item.status==='FAIL').map(item=>item.name));
 if(!failedNames.size)continue;
 const cardScenarios=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 let after=structuredClone(before);
 const changed:EffectTrigger[]=[];
 const verifiedNames=new Set<string>();
 for(const timing of timings){
  if(changed.includes(timing))continue;
  const expectedAst=card.localSchema.ast.filter(item=>item.trigger===timing);
  const expectedNormalized=card.localSchema.normalized.filter(item=>item.timing===timing);
  const actualAst=after.ast.filter(item=>item.trigger===timing);
  const actualNormalized=after.normalized.filter(item=>item.timing===timing);
  if(!expectedAst.length||!expectedNormalized.length)continue;
  if(!windowTextPresent(card,timing)){reject('printed-timing-window-not-present-in-both-text-sources');continue;}
  // A card may have a custom handler in a different timing. Repair this timing
  // only when every action in the replacement window is explicitly parsed.
  if(expectedAst.some(ability=>ability.actions.some(action=>action.kind==='custom-resolver')))continue;
  if(canonical(expectedAst)===canonical(actualAst)&&canonical(expectedNormalized)===canonical(actualNormalized))continue;
  const trial=structuredClone(after);
  trial.ast=[...trial.ast.filter(item=>item.trigger!==timing),...structuredClone(expectedAst)];
  trial.normalized=[...trial.normalized.filter(item=>item.timing!==timing),...structuredClone(expectedNormalized)];
  // Exercise every previously failing card scenario against the trial schema.
  // Card-specific scenario names do not always begin with their timing label;
  // inferring coverage from the name prefix silently omitted real-play checks.
  const matching=cardScenarios.filter(item=>failedNames.has(item.name));
  const flipped:string[]=[];
  for(const scenario of matching){try{scenario.run(trial);flipped.push(scenario.name);}catch{}}
  if(!flipped.length)continue;
  let regressed=false;
  for(const scenario of cardScenarios){
   const wasPassing=!failedNames.has(scenario.name);
   if(!wasPassing)continue;
   try{scenario.run(trial);}catch{regressed=true;break;}
  }
  if(regressed){reject('would-regress-passing-scenario');continue;}
  after=trial;
  changed.push(timing);
  for(const name of flipped)verifiedNames.add(name);
 }
 if(!changed.length)continue;
 // Confirm all source text parity and all previously passing cases against the final combined patch.
 let finalValid=true;
 for(const scenario of cardScenarios){
  try{scenario.run(after);verifiedNames.add(scenario.name);}catch{finalValid=false;break;}
 }
 if(!finalValid){reject('combined-window-patch-failed-scenario');continue;}
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:changed,scenarioNames:cardScenarios.filter(item=>verifiedNames.has(item.name)).map(item=>item.name),scenarioCount:verifiedNames.size,before,after,beforeHash:hash(before),afterHash:hash(after),patchKind:'INDIVIDUAL_PRINTED_WINDOW_WITH_ALL_CARD_SCENARIOS_PASS'});
}

mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/window-patches-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,timings:candidates.reduce((sum,item)=>sum+(item.timings as unknown[]).length,0),scenarios:candidates.reduce((sum,item)=>sum+Number(item.scenarioCount),0),rejected}));
