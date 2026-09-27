import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';

type InputPrice = {code:string; amount:number};
type Printing = {id:string;printing_code:string|null;variant:string|null;language:string;tcg_card_identities:{code:string}};

function inputFile(){const index=process.argv.indexOf('--file');const value=index>=0?process.argv[index+1]:undefined;if(!value)throw new Error('Use --file path/to/yuyutei-prices.json or .csv');return value;}
function parsePrices(file:string):InputPrice[]{const raw=fs.readFileSync(file,'utf8').trim();if(file.endsWith('.csv'))return raw.split(/\r?\n/).slice(1).map(line=>{const [code,amount]=line.split(',').map(value=>value.trim());return {code,amount:Number(amount)}}).filter(item=>item.code&&Number.isFinite(item.amount)&&item.amount>=0);const value=JSON.parse(raw) as unknown;const entries=Array.isArray(value)?value:(value&&typeof value==='object'?Object.entries(value as Record<string,unknown>).map(([code,amount])=>({code,amount})):[]);return entries.map(item=>{if(Array.isArray(item))return {code:String(item[0]),amount:Number(item[1])};const record=item as {code?:unknown;amount?:unknown;price?:unknown};return {code:String(record.code??''),amount:Number(record.amount??record.price)}}).filter(item=>item.code&&Number.isFinite(item.amount)&&item.amount>=0);}
function normalized(value:string){return value.trim().toUpperCase().replace(/\s+/g,'');}
function isStandard(printing:Printing, code:string){return !printing.printing_code&&normalized(printing.tcg_card_identities.code)===normalized(code)&&/^(standard|base)$/i.test(printing.variant??'standard');}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const serviceRole=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!serviceRole)throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
const prices=parsePrices(inputFile());if(!prices.length)throw new Error('No valid Yuyutei prices found.');
const observedAt=new Date().toISOString();const supabase=createClient(url,serviceRole);
const printings:Printing[]=[];
for(let from=0;;from+=1000){const {data,error}=await supabase.from('tcg_card_printings').select('id,printing_code,variant,language,tcg_card_identities!inner(code)').eq('language','JP').range(from,from+999);if(error)throw error;printings.push(...((data??[]) as unknown as Printing[]));if((data??[]).length<1000)break;}
const imported=[] as Array<{printing_id:string;source:string;source_kind:string;amount:number;currency:string;observed_at:string}>;const unmatched:string[]=[];
for(const item of prices){const code=normalized(item.code);const match=printings.find(printing=>normalized(printing.printing_code??'')===code)||printings.find(printing=>isStandard(printing,item.code));if(!match){unmatched.push(item.code);continue}imported.push({printing_id:match.id,source:'yuyutei',source_kind:'market_price',amount:item.amount,currency:'JPY',observed_at:observedAt});}
for(let start=0;start<imported.length;start+=200){const {error:writeError}=await supabase.from('tcg_price_observations').upsert(imported.slice(start,start+200),{onConflict:'printing_id,source,source_kind,observed_at'});if(writeError)throw writeError;}
console.log(JSON.stringify({observedAt,imported:imported.length,unmatched},null,2));
