import {readFileSync,writeFileSync} from 'node:fs';
import {scenarios} from './card-effect-scenarios';
import {compileEffectDocument} from '../packages/domain/effect-rules';

type SnapshotCard={code:string;name:string;printedText:string;publishedText:string|null;published:boolean;textMatches:boolean;schemaMatches:boolean;localSchema:any;databaseSchema:any};
const path='reports/effects/per-card.json';
const snapshot=JSON.parse(readFileSync(path,'utf8')) as {generatedAt:string;summary:Record<string,unknown>;cards:SnapshotCard[]};
const cards=snapshot.cards.map(card=>{
 const row={id:card.code,code:card.code,name:card.name,color:'',card_type:'Character' as const,cost:0,power:0,effect_text:card.printedText};
 const cases=scenarios(row);
 const localSchema=compileEffectDocument({id:card.code,code:card.code,name:card.name,color:'',type:'Character',cost:0,power:0,rarity:'',art:0,effect:card.printedText});
 const run=(document:SnapshotCard['localSchema']|undefined)=>cases.map(scenario=>{
  try{if(!document)throw new Error('Missing published schema');scenario.run(document);return {name:scenario.name,status:'PASS',error:null};}
  catch(error){return {name:scenario.name,status:'FAIL',error:error instanceof Error?error.message:String(error)};}
 });
 const gameplay=cases.filter(scenario=>!scenario.name.startsWith('engine-action ')),actions=cases.filter(scenario=>scenario.name.startsWith('engine-action '));
 return {...card,localSchema,localScenarios:run(localSchema),databaseScenarios:run(card.databaseSchema),gameplayScenarioCount:gameplay.length,actionExecutionScenarioCount:actions.length,coverage:gameplay.length?'BOUNDED_ENGINE_SCENARIO':actions.length?'ACTION_EXECUTION_ONLY':'NOT_GAMEPLAY_VERIFIED',browserVerified:false};
});
const summary={
 ...snapshot.summary,
 source:'d1-cached-snapshot',
 snapshotAsOf:snapshot.generatedAt,
 scenarioCards:cards.filter(card=>card.localScenarios.length).length,
 gameplayScenarioCards:cards.filter(card=>card.gameplayScenarioCount>0).length,
 actionOnlyCards:cards.filter(card=>card.actionExecutionScenarioCount>0&&!card.gameplayScenarioCount).length,
 localFailures:cards.flatMap(card=>card.localScenarios).filter(scenario=>scenario.status==='FAIL').length,
 databaseFailures:cards.flatMap(card=>card.databaseScenarios).filter(scenario=>scenario.status==='FAIL').length,
 untestedCards:cards.filter(card=>!card.localScenarios.length).length,
 databaseWrites:0,
};
writeFileSync(path,JSON.stringify({generatedAt:new Date().toISOString(),summary,cards},null,2));
writeFileSync('reports/effects/per-card.md',['# Per-card local and published schema audit','','This report re-evaluates the last successfully retrieved D1 snapshot; Cloudflare D1 was unavailable during this run. Action-only checks exercise one parsed instruction and do not verify its enclosing sequence, cost, or conditions. Card-specific scenarios verify only the named situations. Browser integration remains unverified. OP18 and EB05 are excluded from supported play.','','```json',JSON.stringify(summary,null,2),'```','','| Card | Printed text matches D1 | Schema matches D1 | Coverage | Local scenarios | D1 snapshot scenarios |','| --- | --- | --- | --- | --- | --- |',...cards.map(card=>`| ${card.code} | ${card.textMatches} | ${card.schemaMatches} | ${card.coverage} | ${card.localScenarios.map(scenario=>scenario.status).join(', ')||'Untested'} | ${card.databaseScenarios.map(scenario=>scenario.status).join(', ')||'Untested'} |`)].join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
