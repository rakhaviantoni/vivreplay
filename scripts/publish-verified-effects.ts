import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {scenarios,type Identity} from './card-effect-scenarios';
import {familyScenarios} from './effect-family-scenarios';
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
type Row={code:string;name:string;printedText:string;localSchema:EffectDocument;databaseSchema:EffectDocument|null;textMatches:boolean};
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string}};cards:Row[]};
const candidates=[];
for(const card of snapshot.cards){
 if(!card.databaseSchema||!card.textMatches)continue;
 const cases=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 if(!cases.length)continue;
 const timings=new Set(cases.map(s=>s.name.startsWith('On Play')?'on-play':s.name.split(':')[0]) as EffectTrigger[]);
 let after=structuredClone(card.databaseSchema);
 const changed:EffectTrigger[]=[];
 const allWindowsCovered=card.localSchema.ast.length>0&&card.localSchema.ast.every(window=>familyScenarios(window.rawText).length>0||(
  /^\[Trigger\] Activate this card's \[(Main|Counter|On Play)\] effect\.$/.test(window.rawText)&&cases.some(s=>s.name.startsWith('trigger:'))
 ));
 if(allWindowsCovered&&canonical(card.localSchema.normalized)!==canonical(after.normalized)){
  after=structuredClone(card.localSchema);
  changed.push(...new Set(after.normalized.map(window=>window.timing)));
 }
 for(const timing of timings){
  if(allWindowsCovered)continue;
  const local=card.localSchema.normalized.filter(e=>e.timing===timing),prior=after.normalized.filter(e=>e.timing===timing);
  const localAst=card.localSchema.ast.filter(e=>e.trigger===timing),priorAst=after.ast.filter(e=>e.trigger===timing);
  if(local.length!==1||prior.length!==1||localAst.length!==1||priorAst.length!==1)continue;
  // Replacing a window must not discard a separate ability previously merged into its text.
  if(localAst[0].rawText!==priorAst[0].rawText)continue;
  if(canonical(local[0])===canonical(prior[0]))continue;
  after.normalized=after.normalized.map(e=>e.timing===timing?local[0]:e);
  after.ast=after.ast.map(e=>e.trigger===timing?localAst[0]:e);
  changed.push(timing);
 }
 if(!changed.length)continue;
 try{for(const scenario of cases)scenario.run(after);}catch{continue;}
 after.implementationStatus='PARSED';
 candidates.push({code:card.code,printedText:card.printedText,timings:changed,scenarioCount:cases.length,before:card.databaseSchema,after,beforeHash:hash(card.databaseSchema),afterHash:hash(after)});
}
mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,timings:candidates.reduce((n,c)=>n+c.timings.length,0),scenarios:candidates.reduce((n,c)=>n+c.scenarioCount,0),apply:process.argv.includes('--apply')}));
if(!process.argv.includes('--apply'))process.exit(0);
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
const results:Array<{code:string;status:string}>=[];
for(const candidate of candidates){
 const {data:identity,error:identityError}=await db.from('tcg_card_identities').select('id,effect_text').eq('code',candidate.code).single();
 if(identityError)throw identityError;
 if(identity.effect_text!==candidate.printedText)throw new Error(`${candidate.code}: catalog text changed; stopping`);
 const {data:current,error}=await db.from('tcg_card_rule_revisions').select('effect_schema,effect_text').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).single();
 if(error)throw error;
 if(hash(current.effect_schema)!==candidate.beforeHash||current.effect_text!==candidate.printedText)throw new Error(`${candidate.code}: published revision changed; stopping`);
 const {data:updated,error:updateError}=await db.from('tcg_card_rule_revisions').update({effect_schema:candidate.after}).eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).eq('effect_schema',JSON.stringify(current.effect_schema)).eq('effect_text',current.effect_text).select('identity_id');
 if(updateError)throw updateError;
 if(updated.length!==1)throw new Error(`${candidate.code}: concurrent update detected`);
 const {data:readback,error:readError}=await db.from('tcg_card_rule_revisions').select('effect_schema').eq('ruleset_id',plan.rulesetId).eq('identity_id',identity.id).single();
 if(readError)throw readError;
 if(hash(readback.effect_schema)!==candidate.afterHash)throw new Error(`${candidate.code}: readback differs`);
 for(const scenario of scenarios({code:candidate.code,effect_text:candidate.printedText} as Identity))scenario.run(readback.effect_schema);
 results.push({code:candidate.code,status:'PUBLISHED_AND_READBACK_TESTED'});
 writeFileSync(path.replace('.json','.results.json'),JSON.stringify(results,null,2));
}
console.log(JSON.stringify({published:results.length,readbackScenariosPassed:candidates.reduce((n,c)=>n+c.scenarioCount,0)}));
