import {createClient} from '@supabase/supabase-js';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {writeFileSync} from 'node:fs';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false}});
const {data:ruleset,error}=await db.from('tcg_rulesets').select('id').eq('status','published').order('effective_from',{ascending:false}).limit(1).single();
if(error)throw error;
const changes=[];
for(let offset=0;;offset+=500){
 const {data,error}=await db.from('tcg_card_rule_revisions').select('identity_id,effect_text,effect_schema,tcg_card_identities!inner(id,code,name,color,card_type,cost,power,effect_text)').eq('ruleset_id',ruleset.id).order('identity_id').range(offset,offset+499);
 if(error)throw error;
 for(const row of data){const identity=row.tcg_card_identities as unknown as {id:string;code:string;name:string;color:string;card_type:any;cost:number;power:number;effect_text:string};const schema=compileEffectDocument({...identity,type:identity.card_type,effect:identity.effect_text,rarity:'',art:0});if(JSON.stringify(schema)!==JSON.stringify(row.effect_schema))changes.push({identityId:row.identity_id,code:identity.code,before:row.effect_schema,after:schema});}
 if(data.length<500)break;
}
writeFileSync('/tmp/vivreplay-schema-refresh.json',JSON.stringify({rulesetId:ruleset.id,changes},null,2));
console.log(JSON.stringify({rulesetId:ruleset.id,changed:changes.length,report:'/tmp/vivreplay-schema-refresh.json',writes:0}));
