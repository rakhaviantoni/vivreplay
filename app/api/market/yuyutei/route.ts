import {createClient} from '@supabase/supabase-js';

const printingIdPattern=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export async function GET(request:Request) {
  const printingId=new URL(request.url).searchParams.get('printingId')?.trim()??'';
  if(!printingIdPattern.test(printingId)) return Response.json({history:[]},{status:400});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.SUPABASE_SECRET_KEY;
  if(!url||!key) return Response.json({history:[]},{status:503});
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await supabase.from('tcg_price_observations').select('amount,currency,observed_at,source_kind,source_record:tcg_source_records(payload)').eq('printing_id',printingId).eq('source','yuyutei').order('observed_at',{ascending:true}).limit(60);
  if(error) return Response.json({history:[]},{status:500});
  return Response.json({history:data??[]},{headers:{'Cache-Control':'public, max-age=60, s-maxage=300'}});
}
