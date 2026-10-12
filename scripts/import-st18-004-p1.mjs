import {readFile, mkdir, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const code='ST18-004';
const variant='Alt art | ST18 p1';
const bucket='tcg-card-images';
const root=process.cwd();
const outputDir=join(root,'public','ST18');
const input={
  EN:process.env.ST18_004_P1_EN_PATH??'/Users/rakhaviantoni/Downloads/ST18-004_p1.jpeg',
  JP:process.env.ST18_004_P1_JP_PATH??'/Users/rakhaviantoni/Downloads/[JP]ST18-004_p1.jpg',
};
const apply=process.argv.includes('--apply');
const syncD1=process.argv.includes('--sync-d1');
const d1Target=process.argv.includes('--target=local')?'local':'remote';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!apply)throw new Error('This import writes two requested printings. Re-run with --apply.');
if(!url||!key)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');

const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const sqlValue=value=>value===null||value===undefined?'NULL':typeof value==='boolean'?(value?'1':'0'):typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='object'?quote(JSON.stringify(value)):quote(value);
const sqlRow=(table,row)=>`INSERT OR REPLACE INTO \`${table}\` (${Object.keys(row).map(column=>`\`${column}\``).join(',')}) VALUES (${Object.values(row).map(sqlValue).join(',')});`;
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});

await mkdir(join(outputDir,'en'),{recursive:true});
await mkdir(join(outputDir,'jp'),{recursive:true});
const webps={};
for(const language of ['EN','JP']){
  const source=await readFile(input[language]);
  const webp=await sharp(source).rotate().resize({width:420,withoutEnlargement:true}).webp({quality:82,effort:4}).toBuffer();
  const path=join(outputDir,language.toLowerCase(),`${code}_p1.webp`);
  await writeFile(path,webp);
  webps[language]=webp;
}

const identityResult=await supabase.from('tcg_card_identities').select('id,code').eq('code',code).single();
if(identityResult.error)throw identityResult.error;
const bases={};
for(const language of ['EN','JP']){
  const base=await supabase.from('tcg_card_printings').select('id,identity_id,set_id,set_code,set_name,rarity,source_kind,life,sub_types,counter_amount,attribute,source_payload,release_date,is_reprint').eq('identity_id',identityResult.data.id).eq('set_code','ST-18').eq('language',language).eq('variant','Standard').limit(1).maybeSingle();
  if(base.error)throw base.error;
  if(base.data){bases[language]=base.data;continue;}
  if(language==='JP'&&bases.EN){bases.JP=bases.EN;continue;}
  throw new Error(`No standard ${language} printing found for ${code} in ST-18.`);
}

const printings=['EN','JP'].map(language=>({
  identity_id:identityResult.data.id,language,set_id:bases[language].set_id,set_code:bases[language].set_code,
  set_name:bases[language].set_name,printing_code:`${code}_p1`,rarity:bases[language].rarity,
  variant,source_kind:'user-requested-card-art',life:bases[language].life,sub_types:bases[language].sub_types,
  counter_amount:bases[language].counter_amount,attribute:bases[language].attribute,
  card_image_id:`${code}_p1`,card_image_url:`/${code.slice(0,4)}/${language.toLowerCase()}/${code}_p1.webp`,
  source_payload:{...(bases[language].source_payload??{}),alt_art:true,card_image_id:`${code}_p1`,card_image_source:'user-provided'},
  release_date:bases[language].release_date,is_reprint:bases[language].is_reprint,
}));
const printWrite=await supabase.from('tcg_card_printings').upsert(printings,{onConflict:'identity_id,language,set_code,variant'});
if(printWrite.error)throw printWrite.error;
const lookup=await supabase.from('tcg_card_printings').select('*').eq('identity_id',identityResult.data.id).eq('set_code','ST-18').eq('variant',variant).in('language',['EN','JP']);
if(lookup.error)throw lookup.error;
if(lookup.data?.length!==2)throw new Error('Both language printings were not created.');
const idByLanguage=new Map(lookup.data.map(row=>[row.language,row.id]));
const assetRows=[];
const sourceRows=[];
for(const language of ['EN','JP']){
  const lower=language.toLowerCase();
  const objectKey=`one-piece/ST18/${lower}/${code}_p1.webp`;
  const upload=await supabase.storage.from(bucket).upload(objectKey,webps[language],{contentType:'image/webp',cacheControl:'31536000',upsert:true});
  if(upload.error)throw new Error(`${language} image upload failed: ${upload.error.message}`);
  const dimensions=await sharp(webps[language]).metadata();
  assetRows.push({printing_id:idByLanguage.get(language),kind:'small',object_key:objectKey,mime_type:'image/webp',width:dimensions.width,height:dimensions.height,byte_size:webps[language].byteLength});
  sourceRows.push({printing_id:idByLanguage.get(language),source_type:'user-requested',source_url:`user-upload://${code.toLowerCase()}-p1-${lower}`,rights_status:'user_requested_import_pending_review',storage_path:objectKey,storage_variants:{small:objectKey},stored_format:'webp',approved_for_display:false,approved_for_storage:false});
}
const assetWrite=await supabase.from('tcg_card_assets').upsert(assetRows,{onConflict:'printing_id,kind'});
if(assetWrite.error)throw assetWrite.error;
const sourceWrite=await supabase.from('tcg_card_asset_sources').upsert(sourceRows,{onConflict:'source_url'});
if(sourceWrite.error)throw sourceWrite.error;

if(syncD1){
  const printingIds=[...idByLanguage.values()];
  const [printingData,assetData,sourceData]=await Promise.all([
    supabase.from('tcg_card_printings').select('*').in('id',printingIds),
    supabase.from('tcg_card_assets').select('*').in('printing_id',printingIds),
    supabase.from('tcg_card_asset_sources').select('*').in('printing_id',printingIds),
  ]);
  for(const result of [printingData,assetData,sourceData])if(result.error)throw result.error;
  const commands=[...printingData.data.map(row=>sqlRow('tcg_card_printings',row)),...sourceData.data.map(row=>sqlRow('tcg_card_asset_sources',row)),...assetData.data.map(row=>sqlRow('tcg_card_assets',row))].join('\n');
  const sqlPath=join(tmpdir(),`vivreplay-${code.toLowerCase()}-p1-${Date.now()}.sql`);
  await writeFile(sqlPath,commands,{mode:0o600});
  const d1Location=d1Target==='local'?['--local','--persist-to','.wrangler/state']:['--remote'];
  try{execFileSync('node_modules/.bin/wrangler',['d1','execute','vivreplay',...d1Location,'--config','dist/server/wrangler.json','--file',sqlPath],{stdio:'inherit'});}finally{await rm(sqlPath,{force:true});}
}
console.log(JSON.stringify({printings:lookup.data.map(row=>({id:row.id,language:row.language,printing_code:row.printing_code,variant:row.variant})),images:['public/ST18/en/ST18-004_p1.webp','public/ST18/jp/ST18-004_p1.webp'],d1Synced:syncD1?d1Target:null},null,2));
