import {supabaseAdmin} from '@/lib/server/supabase-storage';

export async function GET(){
 const db=supabaseAdmin();
 if(!db)return Response.json({error:'Rules storage is unavailable.'},{status:503});
 const {data:ruleset,error}=await db.from('tcg_rulesets').select('id,code,rules_revision').eq('status','published').lte('effective_from',new Date().toISOString().slice(0,10)).order('effective_from',{ascending:false}).limit(1).maybeSingle();
 if(error||!ruleset)return Response.json({error:'No published ruleset is available.'},{status:503});
 const cards=[];
 for(let from=0;;from+=1000){
  const {data,error}=await db.from('tcg_card_rule_revisions').select('identity_id,effect_text,effect_schema,tcg_card_identities!inner(code)').eq('ruleset_id',ruleset.id).order('identity_id').range(from,from+999);
  if(error)return Response.json({error:'Card rules could not be loaded.'},{status:503});
  cards.push(...data);
  if(data.length<1000)break;
 }
 return Response.json({ruleset,cards},{headers:{'Cache-Control':'no-store'}});
}
