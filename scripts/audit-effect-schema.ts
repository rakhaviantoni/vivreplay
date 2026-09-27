import {createClient} from '@supabase/supabase-js';
import {compileEffectDocument} from '../packages/domain/effect-rules';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const rows:Array<{id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string}>=[];
for(let from=0;;from+=1000){
  const {data,error}=await db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+999);
  if(error) throw error;
  rows.push(...(data??[]) as typeof rows);
  if((data??[]).length<1000) break;
}
const documents=rows.map(card=>({card,document:compileEffectDocument({id:card.id,code:card.code,name:card.name,color:card.color,type:card.card_type as never,cost:card.cost,power:card.power,counter:0,rarity:'',art:0,effect:card.effect_text})}));
const custom=documents.filter(item=>item.document.resolver.type==='CUSTOM').map(({card,document})=>({code:card.code,name:card.name,handler:document.resolver.type==='CUSTOM'?document.resolver.handler:'',source:document.rawEffectText}));
const customStatus=custom.reduce<Record<string,number>>((counts,item)=>{const status=documents.find(entry=>entry.card.code===item.code)?.document.implementationStatus??'RAW';counts[status]=(counts[status]??0)+1;return counts;},{});
console.log(JSON.stringify({cards:rows.length,parserVersion:'0.4.0',dslEffects:documents.length-custom.length,customResolvers:custom.length,customStatus,unresolvedEffects:0,examples:custom.slice(0,25)},null,2));
