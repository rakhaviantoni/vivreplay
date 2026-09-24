import {createClient} from '@supabase/supabase-js';
import sharp from 'sharp';

const deckCode=(process.env.OPTCG_DECK_CODE||'ST-18').toUpperCase();
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret=process.env.SUPABASE_SECRET_KEY;
if(!url||!secret)throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.');
const supabase=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
const bucket='tcg-card-images';
const normalizedDeck=deckCode.replaceAll('-','');
type SourceCard={card_name:string;set_name:string;card_text:string|null;set_id:string;rarity:string|null;card_set_id:string;card_color:string;card_type:string;life:string|null;card_cost:string|null;card_power:string|null;sub_types:string|null;counter_amount:number|null;attribute:string|null;date_scraped:string|null;card_image_id:string;card_image:string|null};
const variants=[['thumb',180,72],['small',420,78],['large',960,84]] as const;
const number=(value:string|null)=>Number(value??0)||0;

async function imageVariants(card:SourceCard){
  if(!card.card_image)return [];
  const response=await fetch(card.card_image,{headers:{accept:'image/webp,image/*;q=0.8'},signal:AbortSignal.timeout(30_000)});
  if(!response.ok)throw new Error(`${card.card_set_id}: image returned ${response.status}`);
  const source=Buffer.from(await response.arrayBuffer());
  return Promise.all(variants.map(async([kind,width,quality])=>{
    const object_key=`one-piece/${normalizedDeck}/en/${kind}/${card.card_set_id}.webp`;
    const image=await sharp(source).rotate().resize({width,withoutEnlargement:true}).webp({quality,effort:4}).toBuffer();
    const {error}=await supabase.storage.from(bucket).upload(object_key,image,{upsert:true,contentType:'image/webp',cacheControl:'3600'});
    if(error)throw error;
    return {kind,object_key,width};
  }));
}

const response=await fetch(`https://www.optcgapi.com/api/decks/${deckCode}/`,{signal:AbortSignal.timeout(30_000)});
if(!response.ok)throw new Error(`Deck API returned ${response.status}`);
const deck=(await response.json()) as SourceCard[];
const originals=deck.filter(card=>card.card_set_id.toUpperCase().startsWith(`${normalizedDeck}-`));
if(!originals.length)throw new Error(`No original ${normalizedDeck} printings found.`);
const {data:game,error:gameError}=await supabase.from('tcg_games').select('id').eq('slug','one-piece').single();
if(gameError)throw gameError;
const setName=originals[0].set_name;
const {data:set,error:setError}=await supabase.from('tcg_sets').upsert({game_id:game.id,external_set_id:deckCode,name:setName,set_kind:'Starter deck'},{onConflict:'game_id,external_set_id'}).select('id').single();
if(setError)throw setError;
await supabase.from('tcg_card_identities').upsert(originals.map(card=>({game_id:game.id,code:card.card_set_id,name:card.card_name,color:card.card_color,card_type:card.card_type,cost:number(card.card_cost),power:number(card.card_power),effect_text:card.card_text??'',updated_at:new Date().toISOString()})),{onConflict:'game_id,code'});
const {data:identities,error:identityError}=await supabase.from('tcg_card_identities').select('id,code').eq('game_id',game.id).in('code',originals.map(card=>card.card_set_id));
if(identityError)throw identityError;
const identityId=new Map((identities??[]).map(item=>[item.code,item.id]));
const images=await Promise.all(originals.map(async card=>[card,await imageVariants(card)] as const));
const printingRows=originals.map(card=>({identity_id:identityId.get(card.card_set_id),language:'EN',set_id:set.id,set_code:deckCode,set_name:setName,printing_code:card.card_set_id,rarity:card.rarity,variant:'Standard',source_kind:'optcgapi-deck',life:card.life?number(card.life):null,sub_types:card.sub_types,counter_amount:card.counter_amount,attribute:card.attribute,card_image_id:card.card_image_id,card_image_url:card.card_image,source_payload:{deck_code:deckCode,source:'optcgapi-decks',observed_at:card.date_scraped}}));
const {error:printingError}=await supabase.from('tcg_card_printings').upsert(printingRows,{onConflict:'identity_id,language,set_code,variant'});
if(printingError)throw printingError;
const {data:printings,error:printingLookupError}=await supabase.from('tcg_card_printings').select('id,printing_code').eq('set_code',deckCode).eq('language','EN').eq('variant','Standard').in('printing_code',originals.map(card=>card.card_set_id));
if(printingLookupError)throw printingLookupError;
const printingId=new Map((printings??[]).map(item=>[item.printing_code,item.id]));
const assetRows=images.flatMap(([card,assets])=>assets.map(asset=>({...asset,printing_id:printingId.get(card.card_set_id)})));
const {error:assetError}=await supabase.from('tcg_card_assets').upsert(assetRows,{onConflict:'printing_id,kind'});
if(assetError)throw assetError;
console.log(JSON.stringify({deck:deckCode,sourceCards:deck.length,originalPrintings:originals.length,assets:assetRows.length},null,2));
