import { createClient } from '@supabase/supabase-js';

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Supabase credentials are required.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const paths=[
  {id:'801b33f4-70e9-4c85-a481-c206ea051e91',path:'/ST18/en/small/ST18-005_p1.webp'},
  {id:'4df4347f-1712-4231-8db2-143315d28bbd',path:'/ST18/jp/small/ST18-005_p1.webp'},
];
for(const item of paths){
  const {data,error}=await supabase.from('tcg_card_printings').update({card_image_url:item.path}).eq('id',item.id).select('id,language,card_image_url').single();
  if(error)throw new Error(`Printing path update failed: ${error.message}`);
  console.log(`${data.language}: ${data.card_image_url}`);
}
