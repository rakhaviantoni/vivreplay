import {createClient} from '@supabase/supabase-js';
import {compileEffectDocument,type EffectAction} from '../packages/domain/effect-rules';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required.');
const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

type Row={id:string;code:string;name:string;color:string;card_type:string;cost:number;power:number;effect_text:string};
type Coverage='PARTIAL'|'MISSING';
const tutorialCoverage:Partial<Record<EffectAction['kind'],Coverage>>={
 draw:'PARTIAL', search:'PARTIAL', rest:'PARTIAL', power:'PARTIAL', trash:'PARTIAL',
 'attach-don':'PARTIAL', play:'PARTIAL',
};
const rows:Row[]=[];
for(let from=0;;from+=1000){
 const {data,error}=await db.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').range(from,from+999);
 if(error)throw error;
 rows.push(...(data??[]) as Row[]);
 if((data??[]).length<1000)break;
}
const report=new Map<string,{actions:number;cards:Set<string>;examples:string[];coverage:Coverage}>();
const playableRows=rows.filter(row=>! /^(?:OP-?18|EB-?05)-/i.test(row.code));
for(const row of playableRows){
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type as never,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 for(const effect of document.ast)for(const action of effect.actions){
  const current=report.get(action.kind)??{actions:0,cards:new Set<string>(),examples:[],coverage:tutorialCoverage[action.kind]??'MISSING'};
  current.actions++; current.cards.add(row.id);
  if(current.examples.length<3)current.examples.push(`${row.code} ${row.name}`);
  report.set(action.kind,current);
 }
}
const actions=[...report.entries()].map(([kind,value])=>({kind,coverage:value.coverage,actions:value.actions,cards:value.cards.size,examples:value.examples})).sort((a,b)=>b.cards-a.cards||a.kind.localeCompare(b.kind));
console.log(JSON.stringify({cards:playableRows.length,deferredCards:rows.length-playableRows.length,actionFamilies:actions.length,partial:actions.filter(item=>item.coverage==='PARTIAL'),missing:actions.filter(item=>item.coverage==='MISSING')},null,2));
