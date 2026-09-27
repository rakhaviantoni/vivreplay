import {createClient} from '@supabase/supabase-js';
import {compileEffectDocument,type EffectAction} from '../packages/domain/effect-rules';

const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
type Row={id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string};
const rows:Row[]=[];
for(let from=0;;from+=1000){const {data,error}=await db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+999);if(error)throw error;rows.push(...data as Row[]);if(data.length<1000)break;}
const playable=rows.filter(row=>! /^(?:OP-?18|EB-?05)-/i.test(row.code));
const boardActions=new Set<EffectAction['kind']>(['draw','search','rest','power','trash','play','attach-don','ko','ready','add-don','return-don','return-to-hand','bottom-deck','life','move-to-life','recover','grant-keyword','rush','double-attack','banish','attack-permission','attack-restriction','prevent-ready','prevent-rest','prevent-ko','negate-effect','set-power','set-cost','base-power','copy-base-power','swap-power','trash-life','reorder-life','hand-reset','hand-limit','bottom-deck-hand','return-trash-to-deck-bottom','reveal-hand']);
const unsupported=new Map<string,Row[]>(), conditions=new Map<string,Row[]>();
for(const row of playable){const doc=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as never,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});for(const effect of doc.ast){for(const action of effect.actions)if(!boardActions.has(action.kind)){const list=unsupported.get(action.kind)??[];list.push(row);unsupported.set(action.kind,list);}for(const condition of effect.conditions){const key=condition.text.replace(/\d+/g,'#').replace(/\[[^\]]+\]/g,'[name]');const list=conditions.get(key)??[];list.push(row);conditions.set(key,list);}}}
const compact=(items:Row[])=>({cards:new Set(items.map(item=>item.id)).size,examples:items.slice(0,5).map(item=>`${item.code} ${item.name}`)});
console.log(JSON.stringify({cards:playable.length,unsupportedActionKinds:Object.fromEntries([...unsupported].map(([kind,items])=>[kind,compact(items)])),unexecutedConditions:[...conditions].sort((a,b)=>b[1].length-a[1].length).slice(0,100).map(([condition,items])=>({condition,...compact(items)}))},null,2));
