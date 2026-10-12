import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rm,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const code='ST01-012';
const setCode='OP-05';
const variantFor=suffix=>`Alt art · ST01 · p${suffix}`;
const targets=[
  {language:'EN',suffix:7,url:'https://cards.oplaytcg.com/tcg/en/small/tcg-418873.webp'},
  {language:'EN',suffix:8,url:'https://cards.oplaytcg.com/tcg/en/small/tcg-519815.webp'},
  {language:'EN',suffix:9,url:'https://cards.oplaytcg.com/tcg/en/small/tcg-580050.webp?v=1786238853'},
  {language:'JP',suffix:1,url:'https://cards.oplaytcg.com/OP03/jp/small/ST01-012_p1.webp'},
  {language:'JP',suffix:3,url:'https://cards.oplaytcg.com/OP05/jp/small/ST01-012_p3.webp'},
  {language:'JP',suffix:4,url:'https://cards.oplaytcg.com/OP05/jp/small/ST01-012_p4.webp?v=1786238853'},
  {language:'JP',suffix:5,url:'https://cards.oplaytcg.com/PROMO/jp/small/ST01-012_p5.webp?v=1791435473'},
  {language:'JP',suffix:6,url:'https://cards.oplaytcg.com/PROMO/jp/small/ST01-012_p6.webp?v=1791435473'},
  {language:'JP',suffix:7,url:'https://cards.oplaytcg.com/PROMO/jp/small/ST01-012_p7.webp?v=1791435473'},
];
const apply=process.argv.includes('--apply');
const syncD1=process.argv.includes('--sync-d1');
const d1Target=process.argv.includes('--target=local')?'local':'remote';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!apply&&!process.argv.includes('--sync-existing'))throw new Error('This import writes nine requested printings. Re-run with --apply.');
if(!url||!key)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY before importing.');
const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const literal=value=>value===null||value===undefined?'NULL':typeof value==='boolean'?(value?'1':'0'):typeof value==='number'&&Number.isFinite(value)?String(value):typeof value==='object'?quote(JSON.stringify(value)):quote(value);
const sqlRow=(table,row)=>`INSERT OR REPLACE INTO \`${table}\` (${Object.keys(row).map(column=>`\`${column}\``).join(',')}) VALUES (${Object.values(row).map(literal).join(',')});`;

async function syncExistingD1(){
  const codes=[...new Set(targets.map(target=>`${code}_p${target.suffix}`))];
  const {data:rows,error}=await supabase.from('tcg_card_printings').select('*').eq('set_code',setCode).in('printing_code',codes).in('language',['EN','JP']);
  if(error)throw error;
  const expected=new Set(targets.map(target=>`${target.language}:${code}_p${target.suffix}:${variantFor(target.suffix)}`));
  const printings=rows.filter(row=>expected.has(`${row.language}:${row.printing_code}:${row.variant}`));
  if(printings.length!==targets.length)throw new Error(`Expected ${targets.length} existing printings, found ${printings.length}.`);
  const ids=printings.map(row=>row.id);
  const [assets,sources]=await Promise.all([
    supabase.from('tcg_card_assets').select('*').in('printing_id',ids),
    supabase.from('tcg_card_asset_sources').select('*').in('printing_id',ids),
  ]);
  if(assets.error)throw assets.error;
  if(sources.error)throw sources.error;
  const sql=[...printings.map(row=>sqlRow('tcg_card_printings',row)),...sources.data.map(row=>sqlRow('tcg_card_asset_sources',row)),...assets.data.map(row=>sqlRow('tcg_card_assets',row))].join('\n');
  const sqlPath=join(tmpdir(),`vivreplay-${code.toLowerCase()}-alt-arts-${Date.now()}.sql`);
  await writeFile(sqlPath,sql,{mode:0o600});
  const location=d1Target==='local'?['--local','--persist-to','.wrangler/state']:['--remote'];
  try{execFileSync('node_modules/.bin/wrangler',['d1','execute','vivreplay',...location,'--config','dist/server/wrangler.json','--file',sqlPath],{stdio:'inherit'});}finally{await rm(sqlPath,{force:true});}
  return printings.map(row=>({language:row.language,printing_code:row.printing_code,variant:row.variant}));
}
if(process.argv.includes('--sync-existing')){
  const synced=await syncExistingD1();
  console.log(JSON.stringify({card:code,synced,d1Target},null,2));
  process.exit(0);
}

const identityResult=await supabase.from('tcg_card_identities').select('id,code').eq('code',code).single();
if(identityResult.error)throw identityResult.error;
const baseResult=await supabase.from('tcg_card_printings').select('id,identity_id,set_id,set_code,set_name,rarity,source_kind,life,sub_types,counter_amount,attribute,source_payload,release_date,is_reprint').eq('identity_id',identityResult.data.id).eq('language','EN').eq('set_code',setCode).eq('variant','Standard').limit(1).maybeSingle();
if(baseResult.error)throw baseResult.error;
if(!baseResult.data)throw new Error(`No standard ${code} printing found in ${setCode}.`);
const base=baseResult.data;

const prepared=await Promise.all(targets.map(async target=>{
  const response=await fetch(target.url,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Image source returned ${response.status}: ${target.url}`);
  const input=Buffer.from(await response.arrayBuffer());
  const image=sharp(input).rotate().resize({width:420,withoutEnlargement:true});
  const [metadata,webp]=await Promise.all([image.clone().metadata(),image.webp({quality:78,effort:4}).toBuffer()]);
  return {...target,webp,width:metadata.width,height:metadata.height,printingCode:`${code}_p${target.suffix}`,variant:variantFor(target.suffix)};
}));

const printings=prepared.map(target=>({
  identity_id:identityResult.data.id,language:target.language,set_id:base.set_id,set_code:base.set_code,set_name:base.set_name,
  printing_code:target.printingCode,rarity:base.rarity,variant:target.variant,source_kind:'oplaytcg-alt-art',
  life:base.life,sub_types:base.sub_types,counter_amount:base.counter_amount,attribute:base.attribute,
  card_image_id:target.printingCode,card_image_url:target.url,
  source_payload:{...(base.source_payload??{}),alt_art:true,oplay_source:target.url,variant:target.variant},
  release_date:base.release_date,is_reprint:base.is_reprint,
}));
const printingWrite=await supabase.from('tcg_card_printings').upsert(printings,{onConflict:'identity_id,language,set_code,variant'});
if(printingWrite.error)throw printingWrite.error;
const printingLookup=await supabase.from('tcg_card_printings').select('id,language,printing_code,variant').eq('identity_id',identityResult.data.id).eq('set_code',setCode).in('language',['EN','JP']).in('variant',prepared.map(item=>item.variant));
if(printingLookup.error)throw printingLookup.error;
const expectedKeys=new Set(targets.map(target=>`${target.language}:${variantFor(target.suffix)}`));
const idByKey=new Map(printingLookup.data.filter(row=>expectedKeys.has(`${row.language}:${row.variant}`)).map(row=>[`${row.language}:${row.variant}`,row.id]));
if(idByKey.size!==targets.length)throw new Error(`Expected ${targets.length} alt-art rows, found ${idByKey.size}.`);

const assetRows=[];
const sourceRows=[];
for(const target of prepared){
  const printingId=idByKey.get(`${target.language}:${target.variant}`);
  const objectKey=`one-piece/OP05/${target.language.toLowerCase()}/small/${target.printingCode}.webp`;
  const upload=await supabase.storage.from('tcg-card-images').upload(objectKey,target.webp,{contentType:'image/webp',cacheControl:'31536000',upsert:true});
  if(upload.error)throw new Error(`${target.language} ${target.printingCode} upload failed: ${upload.error.message}`);
  assetRows.push({printing_id:printingId,kind:'small',object_key:objectKey,mime_type:'image/webp',width:target.width,height:target.height,byte_size:target.webp.byteLength});
  sourceRows.push({printing_id:printingId,source_type:'oplaytcg',source_url:target.url,rights_status:'user_requested_import_pending_review',storage_path:objectKey,storage_variants:{small:objectKey},stored_format:'webp',approved_for_display:false,approved_for_storage:false});
}
const assetWrite=await supabase.from('tcg_card_assets').upsert(assetRows,{onConflict:'printing_id,kind'});
if(assetWrite.error)throw assetWrite.error;
const sourceWrite=await supabase.from('tcg_card_asset_sources').upsert(sourceRows,{onConflict:'source_url'});
if(sourceWrite.error)throw sourceWrite.error;

if(syncD1){
  const ids=[...idByKey.values()];
  const [printingData,assetData,sourceData]=await Promise.all([
    supabase.from('tcg_card_printings').select('*').in('id',ids),
    supabase.from('tcg_card_assets').select('*').in('printing_id',ids),
    supabase.from('tcg_card_asset_sources').select('*').in('printing_id',ids),
  ]);
  for(const result of [printingData,assetData,sourceData])if(result.error)throw result.error;
  const sql=[...printingData.data.map(row=>sqlRow('tcg_card_printings',row)),...sourceData.data.map(row=>sqlRow('tcg_card_asset_sources',row)),...assetData.data.map(row=>sqlRow('tcg_card_assets',row))].join('\n');
  const sqlPath=join(tmpdir(),`vivreplay-${code.toLowerCase()}-alt-arts-${Date.now()}.sql`);
  await writeFile(sqlPath,sql,{mode:0o600});
  const location=d1Target==='local'?['--local','--persist-to','.wrangler/state']:['--remote'];
  try{execFileSync('node_modules/.bin/wrangler',['d1','execute','vivreplay',...location,'--config','dist/server/wrangler.json','--file',sqlPath],{stdio:'inherit'});}finally{await rm(sqlPath,{force:true});}
}
console.log(JSON.stringify({card:code,created:prepared.map(item=>({language:item.language,variant:item.variant,source:item.url,bytes:item.webp.byteLength})),d1Synced:syncD1?d1Target:null},null,2));
