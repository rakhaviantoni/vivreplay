import {createClient} from '@supabase/supabase-js';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {customEffectBranch,customEffectDefinition,hasCustomBoardExecutor} from '../packages/domain/custom-effect-resolvers';
import {readD1AuditPages} from './d1-audit-reader';

const auditSource=process.env.EFFECT_AUDIT_SOURCE??'report';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
let db:ReturnType<typeof createClient>|undefined;
if(auditSource!=='d1'&&auditSource!=='report'){
 if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
 db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const rows:Array<{id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}>=[];
let sourceSnapshotAt:string|undefined;
if(auditSource==='d1')rows.push(...await readD1AuditPages<typeof rows[number]>({select:'id,code,name,color,card_type,cost,power,effect_text',from:'tcg_card_identities',key:'id'}));
else if(auditSource==='report'){
 const snapshot=JSON.parse(readFileSync('reports/effects/per-card-d1.json','utf8')) as {generatedAt:string;cards:Array<{code:string;name:string;color:string;cardType:string;cost:number;power:number;printedText:string}>};
 sourceSnapshotAt=snapshot.generatedAt;
 rows.push(...snapshot.cards.map(card=>({id:card.code,code:card.code,name:card.name,color:card.color,card_type:card.cardType,cost:card.cost,power:card.power,effect_text:card.printedText})));
}else for(let from=0;;from+=1000){const {data,error}=await db!.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+999);if(error)throw error;rows.push(...(data??[]) as typeof rows);if((data??[]).length<1000)break;}
const supported=rows.filter(row=>! /^(?:OP-?18|EB-?05)-/i.test(row.code));
function expectedCommands(document:ReturnType<typeof compileEffectDocument>,timing:Parameters<typeof resolveEffectTiming>[1],visited:typeof timing[]=[]):number{
 if(visited.includes(timing))return 0;
 return document.normalized.filter(effect=>effect.timing===timing).reduce((total,effect)=>{
  let count=0;
  for(const step of effect.sequence){
   if(step.type==='PAY_COST'){count++;continue;}
   if(step.action.kind==='activate-main-effect'||step.action.kind==='activate-referenced-effect'){
    if(step.action.kind==='activate-main-effect'&&effect.sequence.some(next=>next.type==='RESOLVE'&&next.action.kind==='activate-referenced-effect'&&next.action.trigger==='main'))continue;
    count+=expectedCommands(document,step.action.kind==='activate-main-effect'?'main':step.action.trigger,[...visited,timing]);
   }else count++;
  }
  return total+count;
 },0);
}
let executed=0,customInstructionPlans=0;const issues:string[]=[],blockedCustom:string[]=[],unhandledCustom:Array<{code:string;handler:string;timing:string;text:string}>=[];
for(const row of supported){
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as never,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 if(document.resolver.type==='CUSTOM'){const definition=customEffectDefinition(document.resolver.handler),timing=definition?.timing??document.ast[0]?.trigger??'unknown',resolution=resolveEffectTiming(document,timing);if(definition)customInstructionPlans++;else{issues.push(`${row.code}: custom handler ${document.resolver.handler} has no registered resolver (${document.implementationStatus})`);unhandledCustom.push({code:row.code,handler:document.resolver.handler,timing,text:row.effect_text});}
  if(!definition){
   // A schema marked CUSTOM without a registered, tested resolver is not a
   // passing runtime result. Keep it in the same blocking issue list as a
   // missing board executor so live audits cannot report false green.
   // The unregistered resolver was already added to issues above.
  }else{
   if(resolution.status!=='custom'||!resolution.instructions?.length)issues.push(`${row.code}: custom handler ${document.resolver.handler} does not expose an explicit blocked plan`);
   else if(!hasCustomBoardExecutor(document.resolver.handler))blockedCustom.push(`${row.code}: ${document.resolver.handler} (${customEffectDefinition(document.resolver.handler)?.timing??'unknown'}) has instructions but no board executor`);
   else {const expectedBranches:Record<string,number>={OP06_092_ON_PLAY:2,EB01_052_ON_PLAY:2,OP09_009_ON_PLAY:1,OP12_039_MAIN:1,OP13_098_MAIN:1,OP17_116_MAIN:1};const expected=expectedBranches[document.resolver.handler];if(expected!==undefined)for(let branch=0;branch<expected;branch++)if(!customEffectBranch(document.resolver.handler,branch)?.length)issues.push(`${row.code}: ${document.resolver.handler} is missing executable branch ${branch}`);}
  }
  continue;}
 for(const effect of document.normalized){
  const resolution=resolveEffectTiming(document,effect.timing);
  if(resolution.status!=='ready'){issues.push(`${row.code}: DSL document returned custom resolution at ${effect.timing}`);continue;}
  const expected=expectedCommands(document,effect.timing);
  const actual=resolution.commands.length;
  if(actual<expected)issues.push(`${row.code}: lost commands at ${effect.timing} (expected ${expected}, got ${actual})`);
  executed++;
 }
}
const report={source:auditSource,sourceSnapshotAt,cards:supported.length,excludedUnsupportedReleaseCards:rows.length-supported.length,dslTimingWindows:executed,customInstructionPlans,blockedCustomCount:blockedCustom.length,blockedCustom,unhandledCustomCount:unhandledCustom.length,unhandledCustom,issueCount:issues.length,issues,verified:issues.length===0&&blockedCustom.length===0&&unhandledCustom.length===0};
mkdirSync('reports/effects',{recursive:true});writeFileSync('reports/effects/runtime-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,blockedCustom:blockedCustom.slice(0,20),issues:issues.slice(0,20),detailsInReport:'reports/effects/runtime-audit.json'},null,2));
if(issues.length||blockedCustom.length)process.exitCode=1;
