import {scenarios} from './card-effect-scenarios';
import {createClient} from '@supabase/supabase-js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {compileEffectDocument,type EffectDocument,type EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
import {familyScenarios} from './effect-family-scenarios';

type Identity={id:string;code:string;name:string;color:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;effect_text:string;};
type Revision={identity_id:string;effect_text:string;effect_schema:EffectDocument};
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Supabase environment is required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:ruleset,error}=await db.from('tcg_rulesets').select('id,code,effective_from').eq('status','published').lte('effective_from',new Date().toISOString().slice(0,10)).order('effective_from',{ascending:false}).limit(1).single();
if(error)throw error;
async function pages<T>(table:string,columns:string,filter?:[string,string]):Promise<T[]>{
 const rows:T[]=[];
 for(let offset=0;;offset+=500){
  let query=db.from(table).select(columns).order(table==='tcg_card_identities'?'id':'identity_id').range(offset,offset+499);
  if(filter)query=query.eq(...filter);
  const {data,error}=await query;if(error)throw error;
  rows.push(...data as unknown as T[]);if(data.length<500)return rows;
 }
}
const [identities,revisions]=await Promise.all([
 pages<Identity>('tcg_card_identities','id,code,name,color,card_type,cost,power,effect_text'),
 pages<Revision>('tcg_card_rule_revisions','identity_id,effect_text,effect_schema',['ruleset_id',ruleset.id]),
]);
const byId=new Map(revisions.map(row=>[row.identity_id,row]));
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const clean=(text:string|null)=>text?.replace(/^NULL$/i,'').trim()??'';
const cards=identities.filter(row=>! /^(OP18|EB05)-/.test(row.code)).map(row=>{
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as Parameters<typeof compileEffectDocument>[0]['type'],cost:row.cost,power:row.power,rarity:'',art:0,effect:row.effect_text});
 const published=byId.get(row.id);
 const cases=scenarios(row);
 const run=(doc:EffectDocument|undefined)=>cases.map(scenario=>{try{if(!doc)throw new Error('Missing published schema');scenario.run(doc);return {name:scenario.name,status:'PASS',error:null};}catch(error){return {name:scenario.name,status:'FAIL',error:error instanceof Error?error.message:String(error)};}});
 const gameplayScenarios=cases.filter(scenario=>!scenario.name.startsWith('engine-action ')),actionExecutionScenarios=cases.filter(scenario=>scenario.name.startsWith('engine-action '));
 return {code:row.code,name:row.name,printedText:row.effect_text,publishedText:published?.effect_text??null,published:!!published,textMatches:!!published&&clean(published.effect_text)===clean(row.effect_text)&&clean(published.effect_schema?.rawEffectText)===clean(row.effect_text),schemaMatches:!!published&&canonical(local.normalized)===canonical(published.effect_schema?.normalized),localScenarios:run(local),databaseScenarios:run(published?.effect_schema),gameplayScenarioCount:gameplayScenarios.length,actionExecutionScenarioCount:actionExecutionScenarios.length,coverage:gameplayScenarios.length?'BOUNDED_ENGINE_SCENARIO':actionExecutionScenarios.length?'ACTION_EXECUTION_ONLY':'NOT_GAMEPLAY_VERIFIED',browserVerified:false,localSchema:local,databaseSchema:published?.effect_schema??null};
});
const summary={ruleset,cards:cards.length,missingPublished:cards.filter(c=>!c.published).length,textMismatches:cards.filter(c=>!c.textMatches).length,schemaMismatches:cards.filter(c=>!c.schemaMatches).length,scenarioCards:cards.filter(c=>c.localScenarios.length).length,gameplayScenarioCards:cards.filter(c=>c.gameplayScenarioCount>0).length,actionOnlyCards:cards.filter(c=>c.actionExecutionScenarioCount>0&&!c.gameplayScenarioCount).length,localFailures:cards.flatMap(c=>c.localScenarios).filter(s=>s.status==='FAIL').length,databaseFailures:cards.flatMap(c=>c.databaseScenarios).filter(s=>s.status==='FAIL').length,untestedCards:cards.filter(c=>!c.localScenarios.length).length,databaseWrites:0};
mkdirSync('reports/effects',{recursive:true});
writeFileSync('reports/effects/per-card.json',JSON.stringify({generatedAt:new Date().toISOString(),summary,cards},null,2));
writeFileSync('reports/effects/per-card.md',['# Per-card local and published schema audit','', 'Read-only database snapshot. Schema equality is not gameplay verification. Card-specific scenarios cover only the named engine situations; action-only checks confirm execution of one parsed action and do not verify the complete printed effect. Browser integration and other situations remain unverified. OP18 and EB05 are excluded from supported play.','', '```json',JSON.stringify(summary,null,2),'```','','| Card | Printed text matches DB | Schema matches DB | Coverage | Local scenarios | DB scenarios |','| --- | --- | --- | --- | --- | --- |',...cards.map(c=>`| ${c.code} | ${c.textMatches} | ${c.schemaMatches} | ${c.coverage} | ${c.localScenarios.map(s=>s.status).join(', ')||'Untested'} | ${c.databaseScenarios.map(s=>s.status).join(', ')||'Untested'} |`)].join('\n')+'\n');
console.log(JSON.stringify(summary,null,2));
if(summary.localFailures||summary.databaseFailures||summary.missingPublished||summary.textMismatches||summary.schemaMismatches)process.exitCode=1;
