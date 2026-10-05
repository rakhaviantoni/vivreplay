import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scenarios,type Identity} from './card-effect-scenarios';
import type {EffectDocument} from '../packages/domain/effect-rules';

type AuditCard={code:string;printedText:string;publishedText:string|null;textMatches:boolean;schemaMatches:boolean;localSchema:EffectDocument;databaseSchema:EffectDocument|null;databaseScenarios:Array<{name:string;status:string}>};
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string;code:string}};cards:AuditCard[]};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const candidates:Array<Record<string,unknown>>=[];
const skipped:Record<string,number>={};
const skip=(reason:string)=>{skipped[reason]=(skipped[reason]??0)+1;};

for(const card of snapshot.cards){
 const before=card.databaseSchema;
 if(!before||(!card.databaseScenarios.some(item=>item.status==='FAIL')&&card.schemaMatches))continue;
 if(!card.textMatches||!card.publishedText){skip('printed-text-parity-required');continue;}
 if(card.localSchema.resolver.type!=='DSL'||before.resolver.type!=='DSL'||card.localSchema.implementationStatus!=='PARSED'){skip('non-dsl-or-unparsed-schema');continue;}
 const cardScenarios=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 if(!cardScenarios.length){skip('no-card-scenarios');continue;}
 const after=structuredClone(card.localSchema);
 const verified:string[]=[];
 let failed=false;
 for(const scenario of cardScenarios){
  try{scenario.run(after);verified.push(scenario.name);}catch{failed=true;break;}
 }
 if(failed){skip('local-schema-did-not-pass-every-card-scenario');continue;}
 const failing=card.databaseScenarios.filter(item=>item.status==='FAIL').map(item=>item.name);
 const passing=card.databaseScenarios.filter(item=>item.status==='PASS').map(item=>item.name);
 // Published action-only probes validate the stored action in isolation. When
 // that action is the stale one being replaced, its PASS is not evidence that
 // the printed card works; require all gameplay/sequence passes to remain, but
 // allow an obsolete action-only probe to disappear with the schema repair.
 const blockingPasses=passing.filter(name=>!name.startsWith('engine-action ')&&!name.startsWith('schema-atomic-action '));
 if((failing.length>0&&!failing.some(name=>verified.includes(name)))||blockingPasses.some(name=>!verified.includes(name))){skip('did-not-clear-failures-or-would-regress-pass');continue;}
 if(canonical(before)===canonical(after))continue;
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:[...new Set(after.ast.map(item=>item.trigger))],scenarioNames:verified,scenarioCount:verified.length,before,after,beforeHash:hash(before),afterHash:hash(after),patchKind:failing.length?'FULL_DSL_SCHEMA_ALL_CARD_SCENARIOS_PASS':'NORMALIZE_TEXT_MATCHED_DSL_SCHEMA_ALL_CARD_SCENARIOS_PASS'});
}

mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/full-schema-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,scenarios:candidates.reduce((sum,item)=>sum+Number(item.scenarioCount),0),skipped}));
