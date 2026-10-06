import {publishedActionScenarios,scenarios} from './card-effect-scenarios';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {compileEffectDocument,type EffectDocument,type EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
import {familyScenarios} from './effect-family-scenarios';

type Identity={id:string;code:string;name:string;color:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;effect_text:string;};
type Revision={identity_id:string;effect_text:string;effect_schema:EffectDocument};
const auditSource=process.env.EFFECT_AUDIT_SOURCE??'supabase';
let ruleset:{id:string;code:string;effective_from:string};
let identities:Identity[];
let revisions:Revision[];
if(auditSource==='d1'){
 const runD1=(sql:string)=>{
  const output=execFileSync('node_modules/.bin/wrangler',['d1','execute','site-creator-d1','--remote','--config','wrangler.migrations.json','--json','--command',sql],{encoding:'utf8',maxBuffer:96*1024*1024});
  const envelope=JSON.parse(output.trimStart()) as Array<{results?:unknown[];success?:boolean;error?:{text?:string}}>;
  if(!envelope[0]?.success)throw new Error(envelope[0]?.error?.text??'Cloudflare D1 query failed.');
  return envelope[0].results??[];
 };
 const active=runD1("SELECT id,code,effective_from FROM tcg_rulesets WHERE status='published' AND effective_from<=date('now') ORDER BY effective_from DESC LIMIT 1")[0] as typeof ruleset|undefined;
 if(!active)throw new Error('D1 has no active published ruleset.');
 ruleset=active;
 const rows=runD1(`SELECT i.id,i.code,i.name,i.color,i.card_type,i.cost,i.power,i.effect_text AS printed_text,r.identity_id,r.effect_text AS published_text,r.effect_schema FROM tcg_card_identities i JOIN tcg_card_rule_revisions r ON r.identity_id=i.id WHERE r.ruleset_id='${ruleset.id.replaceAll("'","''")}' ORDER BY i.code`);
 identities=rows.map(value=>{const row=value as Identity&{printed_text:string};return {...row,effect_text:row.printed_text};});
 revisions=rows.map(value=>{const row=value as {identity_id:string;published_text:string;effect_schema:EffectDocument|string};return {identity_id:row.identity_id,effect_text:row.published_text,effect_schema:typeof row.effect_schema==='string'?JSON.parse(row.effect_schema):row.effect_schema};});
}else{
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)throw new Error('Supabase environment is required.');
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await db.from('tcg_rulesets').select('id,code,effective_from').eq('status','published').lte('effective_from',new Date().toISOString().slice(0,10)).order('effective_from',{ascending:false}).limit(1).single();
 if(error)throw error;
 ruleset=data;
 async function pages<T>(table:string,columns:string,filter?:[string,string]):Promise<T[]>{
  const rows:T[]=[];
  for(let offset=0;;offset+=500){
   let query=db.from(table).select(columns).order(table==='tcg_card_identities'?'id':'identity_id').range(offset,offset+499);
   if(filter)query=query.eq(...filter);
   const {data,error}=await query;if(error)throw error;
   rows.push(...data as unknown as T[]);if(data.length<500)return rows;
  }
 }
 [identities,revisions]=await Promise.all([
  pages<Identity>('tcg_card_identities','id,code,name,color,card_type,cost,power,effect_text'),
  pages<Revision>('tcg_card_rule_revisions','identity_id,effect_text,effect_schema',['ruleset_id',ruleset.id]),
 ]);
}
const byId=new Map(revisions.map(row=>[row.identity_id,row]));
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clean=(text:string|null)=>text?.replace(/^NULL$/i,'').trim()??'';
const completeStandaloneCoverage=(schema:EffectDocument,cases:Array<{name:string}>)=>schema.resolver.type==='DSL'&&schema.implementationStatus==='PARSED'&&schema.ast.some(ability=>ability.actions.length>0)&&schema.ast.every(ability=>ability.actions.length===0||ability.actions.length===1&&!ability.conditions.length&&!ability.costs.length&&ability.actions[0].kind!=='custom-resolver'&&cases.some(scenario=>scenario.name===`engine-action ${ability.trigger} ${ability.actions[0].kind}: resolve isolated parsed instruction`));
const cards=identities.filter(row=>! /^(OP18|EB05)-/.test(row.code)).map(row=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as Parameters<typeof compileEffectDocument>[0]['type'],cost:row.cost,power:row.power,rarity:'',art:0,effect:row.effect_text});
 const published=byId.get(row.id);
 const cases=scenarios(row);
 const publishedActions=published?.effect_schema?publishedActionScenarios(row,published.effect_schema):[];
 const localNames=new Set(cases.map(scenario=>scenario.name));
 const databaseCases=[...cases,...publishedActions.filter(scenario=>!localNames.has(scenario.name))];
 const run=(doc:EffectDocument|undefined)=>cases.map(scenario=>{try{if(!doc)throw new Error('Missing published schema');scenario.run(doc);return {name:scenario.name,status:'PASS',error:null};}catch(error){return {name:scenario.name,status:'FAIL',error:error instanceof Error?error.message:String(error)};}});
 const runDatabase=(doc:EffectDocument|undefined)=>databaseCases.map(scenario=>{try{if(!doc)throw new Error('Missing published schema');scenario.run(doc);return {name:scenario.name,status:'PASS',error:null};}catch(error){return {name:scenario.name,status:'FAIL',error:error instanceof Error?error.message:String(error)};}});
 const gameplayScenarios=cases.filter(scenario=>!scenario.name.startsWith('engine-action ')),actionExecutionScenarios=cases.filter(scenario=>scenario.name.startsWith('engine-action ')),standalone=completeStandaloneCoverage(local,cases);
 return {code:row.code,name:row.name,printedText:row.effect_text,publishedText:published?.effect_text??null,published:!!published,textMatches:!!published&&clean(published.effect_text)===clean(row.effect_text)&&clean(published.effect_schema?.rawEffectText)===clean(row.effect_text),schemaMatches:!!published&&canonical(local.normalized)===canonical(published.effect_schema?.normalized),localScenarios:run(local),databaseScenarios:runDatabase(published?.effect_schema),gameplayScenarioCount:gameplayScenarios.length,standaloneActionComplete:standalone,actionExecutionScenarioCount:actionExecutionScenarios.length,publishedActionExecutionScenarioCount:publishedActions.length,coverage:gameplayScenarios.length?'BOUNDED_ENGINE_SCENARIO':standalone?'COMPLETE_SINGLE_ACTION_SCENARIOS':actionExecutionScenarios.length?'ACTION_EXECUTION_ONLY':'NOT_GAMEPLAY_VERIFIED',databaseCoverage:cases.some(scenario=>!scenario.name.startsWith('engine-action '))?'BOUNDED_ENGINE_SCENARIO':standalone?'COMPLETE_SINGLE_ACTION_SCENARIOS':databaseCases.length?'ACTION_EXECUTION_ONLY':'NOT_GAMEPLAY_VERIFIED',browserVerified:false,localSchema:local,databaseSchema:published?.effect_schema??null};
});
const summary={source:auditSource,ruleset,cards:cards.length,missingPublished:cards.filter(c=>!c.published).length,textMismatches:cards.filter(c=>!c.textMatches).length,schemaMismatches:cards.filter(c=>!c.schemaMatches).length,scenarioCards:cards.filter(c=>c.localScenarios.length).length,gameplayScenarioCards:cards.filter(c=>c.gameplayScenarioCount>0).length,standaloneActionCompleteCards:cards.filter(c=>c.standaloneActionComplete).length,actionOnlyCards:cards.filter(c=>c.actionExecutionScenarioCount>0&&!c.gameplayScenarioCount&&!c.standaloneActionComplete).length,publishedScenarioCards:cards.filter(c=>c.databaseScenarios.length).length,publishedGameplayScenarioCards:cards.filter(c=>c.databaseCoverage==='BOUNDED_ENGINE_SCENARIO').length,publishedStandaloneActionCompleteCards:cards.filter(c=>c.databaseCoverage==='COMPLETE_SINGLE_ACTION_SCENARIOS').length,publishedActionOnlyCards:cards.filter(c=>c.databaseCoverage==='ACTION_EXECUTION_ONLY').length,publishedActionScenarios:cards.reduce((n,c)=>n+c.publishedActionExecutionScenarioCount,0),localFailures:cards.flatMap(c=>c.localScenarios).filter(s=>s.status==='FAIL').length,databaseFailures:cards.flatMap(c=>c.databaseScenarios).filter(s=>s.status==='FAIL').length,untestedCards:cards.filter(c=>!c.localScenarios.length).length,publishedUntestedCards:cards.filter(c=>!c.databaseScenarios.length).length,databaseWrites:0};
mkdirSync('reports/effects',{recursive:true});
writeFileSync('reports/effects/per-card.json',JSON.stringify({generatedAt:new Date().toISOString(),summary,cards},null,2));
writeFileSync('reports/effects/per-card.md',['# Per-card local and published schema audit','', 'Read-only database snapshot. Schema equality is not gameplay verification. Card-specific scenarios cover only the named engine situations; action-only checks confirm execution of one parsed action and do not verify the complete printed effect. Browser integration and other situations remain unverified. OP18 and EB05 are excluded from supported play.','', '```json',JSON.stringify(summary,null,2),'```','','| Card | Printed text matches DB | Schema matches DB | Coverage | Local scenarios | DB scenarios |','| --- | --- | --- | --- | --- | --- |',...cards.map(c=>`| ${c.code} | ${c.textMatches} | ${c.schemaMatches} | ${c.coverage} | ${c.localScenarios.map(s=>s.status).join(', ')||'Untested'} | ${c.databaseScenarios.map(s=>s.status).join(', ')||'Untested'} |`)].join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
if(summary.localFailures||summary.databaseFailures||summary.missingPublished||summary.textMismatches||summary.schemaMismatches)process.exitCode=1;
