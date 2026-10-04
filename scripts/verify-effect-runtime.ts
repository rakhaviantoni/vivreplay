import {createClient} from '@supabase/supabase-js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {customEffectDefinition} from '../packages/domain/custom-effect-resolvers';

const auditSource=process.env.EFFECT_AUDIT_SOURCE??'supabase';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
let db:ReturnType<typeof createClient>|undefined;
if(auditSource!=='d1'){
 if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
 db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
const rows:Array<{id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}>=[];
if(auditSource==='d1'){
 const output=execFileSync('node_modules/.bin/wrangler',['d1','execute','site-creator-d1','--remote','--config','wrangler.migrations.json','--json','--command',"SELECT id,code,name,color,card_type,cost,power,effect_text FROM tcg_card_identities ORDER BY code"],{encoding:'utf8',maxBuffer:32*1024*1024});
 const envelope=JSON.parse(output.trimStart()) as Array<{results?:typeof rows;success?:boolean;error?:{text?:string}}>;
 if(!envelope[0]?.success)throw new Error(envelope[0]?.error?.text??'Cloudflare D1 query failed.');
 rows.push(...(envelope[0].results??[]));
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
let executed=0,customImplemented=0,customTested=0;const issues:string[]=[];
for(const row of supported){
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as never,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 if(document.resolver.type==='CUSTOM'){const resolution=resolveEffectTiming(document,customEffectDefinition(document.resolver.handler)?.timing??document.ast[0]?.trigger??'unknown');if(document.implementationStatus==='TESTED')customTested++;else if(document.implementationStatus==='IMPLEMENTED')customImplemented++;else issues.push(`${row.code}: custom handler ${document.resolver.handler} is ${document.implementationStatus}`);
  if(['IMPLEMENTED','TESTED'].includes(document.implementationStatus)&&(resolution.status!=='ready'||!resolution.instructions?.length))issues.push(`${row.code}: custom handler ${document.resolver.handler} did not resolve to instructions`);
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
const report={source:auditSource,cards:supported.length,excludedUnsupportedReleaseCards:rows.length-supported.length,dslTimingWindows:executed,customTested,customImplemented,issueCount:issues.length,issues,verified:issues.length===0};
mkdirSync('reports/effects',{recursive:true});writeFileSync('reports/effects/runtime-audit.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,issues:issues.slice(0,20),issuesInReport:'reports/effects/runtime-audit.json'},null,2));
if(issues.length)process.exitCode=1;
