import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

const setArg=process.argv.find(arg=>arg.startsWith('--set='))?.split('=')[1]??'OP15';
const codeArg=process.argv.find(arg=>arg.startsWith('--code='))?.split('=')[1]?.toUpperCase();
const target=process.argv.find(arg=>arg.startsWith('--target='))?.split('=')[1]??'remote';
const apply=process.argv.includes('--apply');
const skipImages=process.argv.includes('--skip-images');
if(!/^(OP|EB|ST|PRB)\d{2}$/i.test(setArg))throw new Error('Use a set code such as --set=OP15.');
if(codeArg&&!new RegExp(`^${setArg.toUpperCase()}-\\d{3}$`).test(codeArg))throw new Error('The card code must belong to the selected set, for example --code=ST18-004.');
if(!['local','remote'].includes(target))throw new Error('Use --target=local or --target=remote.');
const setPrefix=setArg.toUpperCase().replace(/^(OP|EB|ST|PRB)(\d{2})$/,'$1$2');
const wrangler='node_modules/.bin/wrangler';
const config='dist/server/wrangler.json';
const logPath=join(tmpdir(),`vivreplay-jp-printing-${target}.log`);
const location=target==='local'?['--local','--persist-to','.wrangler/state']:['--remote'];
const env={...process.env,WRANGLER_LOG_PATH:logPath};
function query(sql){
  const output=execFileSync(wrangler,['d1','execute','vivreplay',...location,'--config',config,'--json','--command',sql],{encoding:'utf8',env});
  const parsed=JSON.parse(output);
  return parsed[0]?.results??[];
}
function uuid(value){
  const bytes=createHash('sha256').update(`vivreplay:jp-printing:${value}`).digest().subarray(0,16);
  bytes[6]=(bytes[6]&0x0f)|0x50;bytes[8]=(bytes[8]&0x3f)|0x80;
  const hex=bytes.toString('hex');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
const game=query("SELECT id FROM tcg_games WHERE slug='one-piece' LIMIT 1")[0];
if(!game)throw new Error('One Piece catalog is not present in D1.');
const rows=query(`SELECT p.id,p.identity_id,p.set_id,p.set_code,p.set_name,p.rarity,p.source_kind,p.life,p.sub_types,p.counter_amount,p.attribute,p.card_image_id,p.source_payload,p.printing_code,p.release_date,p.is_reprint,i.code
  FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
  WHERE i.game_id='${String(game.id).replaceAll("'","''")}' AND p.language='EN' AND p.variant='Standard'
    AND upper(i.code) LIKE '${setPrefix}-%' ${codeArg?`AND upper(i.code)='${codeArg}'`:''} ORDER BY i.code,p.id`);
const existing=query(`SELECT p.identity_id,p.set_code FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id
  WHERE i.game_id='${String(game.id).replaceAll("'","''")}' AND p.language='JP' AND p.variant='Standard'
    AND upper(i.code) LIKE '${setPrefix}-%' ${codeArg?`AND upper(i.code)='${codeArg}'`:''}`);
const existingKeys=new Set(existing.map(row=>`${row.identity_id}:${String(row.set_code).toUpperCase().replace(/[^A-Z0-9]/g,'')}`));
const candidates=rows.filter(row=>!existingKeys.has(`${row.identity_id}:${String(row.set_code).toUpperCase().replace(/[^A-Z0-9]/g,'')}`));
const quote=value=>`'${String(value??'').replaceAll("'","''")}'`;
const jobs=candidates.map(row=>{
  const code=String(row.printing_code||row.code).toUpperCase();
  const folder=String(row.set_code).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const sourceUrl=`https://cards.oplaytcg.com/${folder}/jp/small/${code}.webp`;
  const assetKey=`one-piece/${folder.replace(/[^A-Z0-9]/g,'')}/jp/${code}.webp`;
  let payload={};try{payload=typeof row.source_payload==='string'?JSON.parse(row.source_payload):row.source_payload??{}}catch{}
  payload={...payload,image_locale:'JP',image_source:'oplaytcg'};
  const id=uuid(row.id);
  const values=[id,row.identity_id,'JP',row.set_id,row.set_code,row.set_name,row.rarity,'Standard','oplaytcg-jp',row.life,row.sub_types,row.counter_amount,row.attribute,code,sourceUrl,JSON.stringify(payload),code,row.release_date,row.is_reprint??0,new Date().toISOString()];
  const printingSql=`INSERT OR IGNORE INTO tcg_card_printings (id,identity_id,language,set_id,set_code,set_name,rarity,variant,source_kind,life,sub_types,counter_amount,attribute,card_image_id,card_image_url,source_payload,printing_code,release_date,is_reprint,created_at) VALUES (${values.map(quote).join(',')});`;
  const assetId=uuid(`${id}:small`);
  const assetSql=`INSERT OR IGNORE INTO tcg_card_assets (id,printing_id,kind,object_key,width,created_at) VALUES (${quote(assetId)},${quote(id)},'small',${quote(assetKey)},420,datetime('now'));`;
  return {code,sourceUrl,assetKey,printingSql,assetSql};
});
console.log(JSON.stringify({set:setArg.toUpperCase(),target,englishStandardRows:rows.length,japaneseStandardRows:existing.length,missing:candidates.length,samples:candidates.slice(0,8).map(row=>row.code),mode:apply?'apply':'dry-run'}));
if(!apply){console.log('Preview only. Pass --apply to verify each exact Japanese image, upload it to R2, and add its printing to D1.');process.exit(0);}
if(!jobs.length)process.exit(0);
if(target!=='remote')throw new Error('Image imports require --target=remote so verified files are written to production R2.');
const tempDirectory=mkdtempSync(join(tmpdir(),'vivreplay-op-jp-'));
let fetchCursor=0,nextFetchAt=0;
const imageFailures=[];
async function fetchImage(job,index){
  const wait=Math.max(0,nextFetchAt-Date.now());nextFetchAt=Math.max(nextFetchAt,Date.now())+250;if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  const response=await fetch(job.sourceUrl,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(20_000)});
  const type=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()??'';
  if(!response.ok||type!=='image/webp')throw new Error(`Source returned ${response.status} (${type||'unknown type'}).`);
  const bytes=Buffer.from(await response.arrayBuffer());if(!bytes.length||bytes.length>12*1024*1024)throw new Error('Image size is invalid.');
  const path=join(tempDirectory,`${index}.webp`);writeFileSync(path,bytes,{mode:0o600});job.file=path;
}
if(!skipImages){
  await Promise.all(Array.from({length:Math.min(4,jobs.length)},async()=>{while(fetchCursor<jobs.length){const index=fetchCursor++,job=jobs[index];try{await fetchImage(job,index);}catch(error){imageFailures.push({code:job.code,sourceUrl:job.sourceUrl,reason:error instanceof Error?error.message:'Fetch failed'});}}}));
  if(imageFailures.length){rmSync(tempDirectory,{recursive:true,force:true});throw new Error(`No D1 rows were written because ${imageFailures.length} Japanese images failed verification: ${JSON.stringify(imageFailures.slice(0,8))}`);}
  let uploadCursor=0,uploaded=0;
  try{
    await Promise.all(Array.from({length:4},async()=>{while(uploadCursor<jobs.length){const job=jobs[uploadCursor++];const objectPath=`tcg-card-images/${job.assetKey}`;execFileSync(wrangler,['r2','object','put',objectPath,'--remote','--config',config,'--file',job.file,'--content-type','image/webp','--cache-control','public, max-age=31536000, immutable','--force'],{stdio:'ignore',env});uploaded++;if(uploaded%25===0)console.log(JSON.stringify({r2Uploaded:uploaded,total:jobs.length}));}}));
  }catch(error){rmSync(tempDirectory,{recursive:true,force:true});throw new Error(`Uploaded ${uploaded} verified images; D1 was left unchanged because an R2 upload failed. Rerun with --apply to safely retry.`);}
}
const statements=jobs.flatMap(job=>[job.printingSql,job.assetSql]);
const chunks=[];let group=[],size=0;
for(const statement of statements){const bytes=Buffer.byteLength(statement);if(group.length&&size+bytes>60_000){chunks.push(group.join('\n'));group=[];size=0;}group.push(statement);size+=bytes;}
if(group.length)chunks.push(group.join('\n'));
const sqlPath=join(tmpdir(),`vivreplay-jp-${setArg.toLowerCase()}-${Date.now()}.sql`);
try{
  for(const chunk of chunks){writeFileSync(sqlPath,chunk,{mode:0o600});execFileSync(wrangler,['d1','execute','vivreplay',...location,'--config',config,'--file',sqlPath],{stdio:'inherit',env});}
}finally{rmSync(sqlPath,{force:true});}
rmSync(tempDirectory,{recursive:true,force:true});
const verify=query(`SELECT COUNT(*) AS total FROM tcg_card_printings p JOIN tcg_card_identities i ON i.id=p.identity_id WHERE i.game_id='${String(game.id).replaceAll("'","''")}' AND p.language='JP' AND p.variant='Standard' AND upper(i.code) LIKE '${setPrefix}-%'`)[0]?.total;
console.log(JSON.stringify({set:setArg.toUpperCase(),insertedCandidates:jobs.length,verifiedJapaneseStandardRows:verify}));
