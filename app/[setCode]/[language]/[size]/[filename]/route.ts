import {createClient} from '@supabase/supabase-js';

const sizes=new Set(['thumb','small','large']);
const filenamePattern=/^[A-Za-z0-9_-]+\.webp$/;

export async function GET(_request:Request,{params}:{params:Promise<{setCode:string;language:string;size:string;filename:string}>}) {
  const {setCode,language,size,filename}=await params;
  if(!sizes.has(size)||!filenamePattern.test(filename)) return new Response('Not found',{status:404});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return new Response('Asset storage is unavailable',{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const normalizedSet=setCode.toUpperCase().replaceAll('-','');
  const legacySet=setCode.toUpperCase().includes('-')?setCode.toUpperCase():setCode.toUpperCase().replace(/^(OP|ST|EB|PRB)(\d+)/,'$1-$2');
  const compoundSet=normalizedSet.replace(/^(OP\d+)(EB\d+)$/,'$1-$2');
  const objectKeys=[...new Set([normalizedSet,legacySet,compoundSet].map(candidate=>`one-piece/${candidate}/${language.toLowerCase()}/${size}/${filename}`))];
  let {data:asset,error:assetError}=await supabase.from('tcg_card_assets').select('object_key').in('object_key',objectKeys).limit(1).maybeSingle();
  if(!asset&&!assetError){
    const printingCode=filename.slice(0,-5).replace(/--[0-9a-f]{8}$/i,'');
    const {data:printing}=await supabase.from('tcg_card_printings').select('id').in('set_code',[normalizedSet,legacySet]).eq('language',language.toUpperCase()).eq('printing_code',printingCode).limit(1).maybeSingle();
    if(printing){const result=await supabase.from('tcg_card_assets').select('object_key').eq('printing_id',printing.id).eq('kind',size).limit(1).maybeSingle();asset=result.data;assetError=result.error;}
  }
  if(assetError||!asset?.object_key) return new Response('Not found',{status:404});
  const {data,error}=await supabase.storage.from('tcg-card-images').download(asset.object_key);
  if(error||!data) return new Response('Not found',{status:404});
  return new Response(data.stream(),{headers:{'Content-Type':'image/webp','Cache-Control':'public, max-age=3600, stale-while-revalidate=86400','X-Content-Type-Options':'nosniff'}});
}
