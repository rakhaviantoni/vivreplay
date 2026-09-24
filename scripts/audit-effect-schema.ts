import {createClient} from '@supabase/supabase-js';
import {parseEffects} from '../packages/domain/effect-rules';

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
const unresolved=rows.flatMap(card=>parseEffects({id:card.id,code:card.code,name:card.name,color:card.color,type:card.card_type as never,cost:card.cost,power:card.power,counter:0,rarity:'',art:0,effect:card.effect_text}).filter(effect=>effect.actions.some(action=>action.kind==='unimplemented')).map(effect=>({code:card.code,name:card.name,trigger:effect.trigger,source:effect.source})));
const families=[...unresolved.reduce((items,effect)=>{const key=effect.source.replace(/\d+/g,'#').replace(/\[[^\]]+\]/g,'[keyword]').replace(/\{[^}]+\}/g,'{trait}').replace(/\b[A-Z][A-Za-z.\"'-]+(?:\.[A-Z][A-Za-z.\"'-]+)*\b/g,'<name>');items.set(key,(items.get(key)??0)+1);return items},new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,50);console.log(JSON.stringify({cards:rows.length,unresolvedEffects:unresolved.length,families,examples:unresolved.slice(0,25)},null,2));
