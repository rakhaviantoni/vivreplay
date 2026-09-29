import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {scenarios,type Identity} from './card-effect-scenarios';
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
type Row={code:string;name:string;printedText:string;publishedText:string|null;localSchema:EffectDocument;databaseSchema:EffectDocument|null;textMatches:boolean};
function scenarioWindow(name:string,schema:EffectDocument):EffectTrigger|undefined{
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
 if(!card.databaseSchema){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('missing-schema');continue;}
 const cases=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 if(!cases.length){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('no-scenarios');continue;}
 const failingNames=new Set(card.databaseScenarios.filter(s=>s.status==='FAIL').map(s=>s.name));
 const timings=new Set(cases.filter(s=>failingNames.has(s.name)).map(s=>scenarioWindow(s.name,card.localSchema)).filter((timing):timing is EffectTrigger=>Boolean(timing)));
 let after=structuredClone(card.databaseSchema);
 const changed:EffectTrigger[]=[];
 for(const timing of timings){
  const local=card.localSchema.normalized.filter(e=>e.timing===timing);
  const localAst=card.localSchema.ast.filter(e=>e.trigger===timing);
  const timingCases=cases.filter(s=>scenarioWindow(s.name,card.localSchema)===timing);
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
 if(!changed.length){if(card.databaseScenarios.some(s=>s.status==='FAIL'))block('no-safe-changes');continue;}
 const verificationCases=cases.filter(s=>changed.includes(scenarioWindow(s.name,card.localSchema)!));
 try{for(const scenario of verificationCases)scenario.run(after);}catch{block('local-window-scenarios-failed-after-merge');continue;}
 after.implementationStatus=card.localSchema.implementationStatus;
 after.implementationStatus='PARSED';
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,timings:changed,scenarioNames:verificationCases.map(s=>s.name),scenarioCount:verificationCases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
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
 const {data:current,error}=await db.from('tcg_card_rule_revisions').select('effect_schema,effect_text').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).single();
 if(error)throw error;
 if(hash(current.effect_schema)!==candidate.beforeHash||current.effect_text!==candidate.publishedText)throw new Error(`${candidate.code}: published revision changed; stopping`);
 const {data:updated,error:updateError}=await db.from('tcg_card_rule_revisions').update({effect_text:candidate.printedText,effect_schema:candidate.after}).eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).eq('effect_schema',JSON.stringify(current.effect_schema)).eq('effect_text',current.effect_text).select('identity_id');
 if(updateError)throw updateError;
 if(updated.length!==1)throw new Error(`${candidate.code}: concurrent update detected`);
 const {data:readback,error:readError}=await db.from('tcg_card_rule_revisions').select('effect_schema,effect_text').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).single();
 if(readError)throw readError;
 if(hash(readback.effect_schema)!==candidate.afterHash||readback.effect_text!==candidate.printedText)throw new Error(`${candidate.code}: readback differs`);
 const scenarioNames=new Set(candidate.scenarioNames);
 for(const scenario of scenarios({code:candidate.code,effect_text:candidate.printedText} as Identity).filter(s=>scenarioNames.has(s.name)))scenario.run(readback.effect_schema);
 results.push({code:candidate.code,status:'PUBLISHED_AND_READBACK_TESTED'});
 writeFileSync(path.replace('.json','.results.json'),JSON.stringify(results,null,2));
}
console.log(JSON.stringify({published:results.length,readbackScenariosPassed:candidates.reduce((n,c)=>n+c.scenarioCount,0)}));
