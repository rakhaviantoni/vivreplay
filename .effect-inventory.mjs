import {createClient} from '@supabase/supabase-js';
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const rows=[];
for(let from=0;;from+=1000){
  const {data,error}=await db.from('tcg_card_identities').select('code,effect_text').range(from,from+999);
  if(error) throw error;
  rows.push(...data);
  if(data.length<1000) break;
}
const triggers={},sentences={};
for(const row of rows){
  const text=(row.effect_text||'').replace(/^NULL$/i,'').trim();
  for(const match of text.matchAll(/\[([^\]]+)\]/g)){
    const key=match[1].replace(/\d+/g,'#').replace(/\s+/g,' ').trim();
    triggers[key]=(triggers[key]||0)+1;
  }
  for(const sentence of text.split(/[\n.]+/).map(value=>value.trim()).filter(Boolean)){
    const key=sentence.replace(/\d+/g,'#').replace(/\{[^}]+\}/g,'{trait}').replace(/\[[^\]]+\]/g,'[keyword]').replace(/\b[A-Z][A-Za-z.]+(?:\.[A-Z][A-Za-z.]+)*\b/g,'<name>');
    sentences[key]=(sentences[key]||0)+1;
  }
}
console.log(JSON.stringify({cards:rows.length,triggers:Object.entries(triggers).sort((a,b)=>b[1]-a[1]).slice(0,80),sentences:Object.entries(sentences).sort((a,b)=>b[1]-a[1]).slice(0,120)},null,2));
