import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const bucket='tcg-card-images';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY;
if(!url||!key)throw new Error('Supabase credentials are required.');

const suppliedJpPath=process.env.ST18_005_P1_JP_PATH??'/Users/rakhaviantoni/Downloads/st18-005_p1.webp';
const englishSource='https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSLrml5aSEfZ21_oSdq9RY3N4aJMdOSuxvUTDoRTjj5lw&s=10';
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const identityQuery=await supabase.from('tcg_card_identities').select('id,code,name,color,card_type,cost,power,effect_text').eq('code','ST18-005').single();
if(identityQuery.error)throw identityQuery.error;
const baseQuery=await supabase.from('tcg_card_printings').select('id,identity_id,set_id,set_code,set_name,rarity,source_kind,life,sub_types,counter_amount,attribute,source_payload').eq('id','8134ce7e-874d-4a59-b6e4-0536196fccbe').single();
if(baseQuery.error)throw baseQuery.error;
const englishResponse=await fetch(englishSource);
if(!englishResponse.ok)throw new Error(`Could not download the provided English card art (${englishResponse.status}).`);
const originals={EN:Buffer.from(await englishResponse.arrayBuffer()),JP:await readFile(suppliedJpPath)};
const printingVariant='Alt art · ST18 · p1';
const printings=['EN','JP'].map(language=>({
  identity_id:identityQuery.data.id,
  language,
  set_id:baseQuery.data.set_id,
  set_code:'ST-18',
  set_name:baseQuery.data.set_name,
  printing_code:'ST18-005_p1',
  rarity:baseQuery.data.rarity,
  variant:printingVariant,
  source_kind:'user-requested-card-art',
  life:baseQuery.data.life,
  sub_types:baseQuery.data.sub_types,
  counter_amount:baseQuery.data.counter_amount,
  attribute:baseQuery.data.attribute,
  card_image_id:'ST18-005_p1',
  card_image_url:`/ST18/${language.toLowerCase()}/small/ST18-005_p1.webp`,
  source_payload:{...baseQuery.data.source_payload,alt_art:true,card_image_id:'ST18-005_p1',card_image_source:language==='EN'?'user-provided-google-image':'user-provided-japanese-attachment'},
}));
const printingWrite=await supabase.from('tcg_card_printings').upsert(printings,{onConflict:'identity_id,language,set_code,variant'});
if(printingWrite.error)throw printingWrite.error;
const printingLookup=await supabase.from('tcg_card_printings').select('id,language').eq('identity_id',identityQuery.data.id).eq('set_code','ST-18').eq('variant',printingVariant).in('language',['EN','JP']);
if(printingLookup.error)throw printingLookup.error;
const idByLanguage=new Map(printingLookup.data.map(row=>[row.language,row.id]));
if(!idByLanguage.has('EN')||!idByLanguage.has('JP'))throw new Error('The English and Japanese printings were not both created.');

const assets=[];
const sources=[];
for(const language of ['EN','JP']){
  const objectKey=`one-piece/ST18/${language.toLowerCase()}/small/ST18-005_p1.webp`;
  const webp=await sharp(originals[language]).rotate().resize({width:420,withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  const uploaded=await supabase.storage.from(bucket).upload(objectKey,webp,{contentType:'image/webp',cacheControl:'31536000',upsert:true});
  if(uploaded.error)throw new Error(`${language} image upload failed: ${uploaded.error.message}`);
  assets.push({printing_id:idByLanguage.get(language),kind:'small',object_key:objectKey,mime_type:'image/webp',width:420,byte_size:webp.byteLength});
  sources.push({printing_id:idByLanguage.get(language),source_type:'user-requested',source_url:language==='EN'?englishSource:'user-upload://st18-005-p1-jp.webp',rights_status:'user_requested_import_pending_review',storage_path:objectKey,storage_variants:{small:objectKey},stored_format:'webp',approved_for_display:false,approved_for_storage:false});
}
const assetWrite=await supabase.from('tcg_card_assets').upsert(assets,{onConflict:'printing_id,kind'});
if(assetWrite.error)throw assetWrite.error;
const sourceWrite=await supabase.from('tcg_card_asset_sources').upsert(sources,{onConflict:'source_url'});
if(sourceWrite.error)throw sourceWrite.error;
console.log(JSON.stringify({printings:printings.map(row=>({language:row.language,set_code:row.set_code,printing_code:row.printing_code,variant:row.variant})),assets:assets.map(({printing_id,object_key,byte_size})=>({printing_id,object_key,byte_size}))},null,2));
