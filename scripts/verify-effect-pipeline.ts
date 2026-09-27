import {createClient} from '@supabase/supabase-js';
import {compileEffectDocument} from '../packages/domain/effect-rules';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const rows:Array<{id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}>=[];
for(let from=0;;from+=1000){
 const {data,error}=await db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+999);
 if(error)throw error;
 rows.push(...(data??[]) as typeof rows);
 if((data??[]).length<1000)break;
}
let dsl=0,custom=0,customTested=0,customImplemented=0;
for(const row of rows){
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as never,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 if(document.rawEffectText!==((row.effect_text??'').replace(/^NULL$/i,'').trim()))throw new Error(`${row.code}: raw text drift`);
 if(!document.ast.length||document.ast.length!==document.normalized.length)throw new Error(`${row.code}: AST/normalized effect mismatch`);
 const hasCustom=document.ast.some(effect=>effect.actions.some(action=>action.kind==='custom-resolver'));
 if(hasCustom!== (document.resolver.type==='CUSTOM'))throw new Error(`${row.code}: resolver mismatch`);
 if(document.resolver.type==='CUSTOM'){
  custom++;
  if(!['REVIEWED','IMPLEMENTED','TESTED'].includes(document.implementationStatus)||!/^[-A-Z0-9_]+$/.test(document.resolver.handler))throw new Error(`${row.code}: missing reviewed custom resolver metadata`);
  if(document.implementationStatus==='TESTED')customTested++;else customImplemented++;
 }else{
  dsl++;
  if(document.implementationStatus!=='IMPLEMENTED')throw new Error(`${row.code}: invalid DSL status`);
 }
 document.normalized.forEach((effect,index)=>{
  const astHasCustom=document.ast[index].actions.some(action=>action.kind==='custom-resolver');
  const sequenceHasCustom=effect.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='custom-resolver');
  if(sequenceHasCustom!==astHasCustom)throw new Error(`${row.code}: sequence resolver mismatch`);
 });
}
console.log(JSON.stringify({cards:rows.length,dsl,custom,customTested,customImplemented,verified:true},null,2));
