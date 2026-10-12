const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LISTING_CODE_ALPHABET='0123456789ABCDEFGHJKMNPQRSTVWXYZ';

type MarketListingSelector =
  | {kind:'id';id:string}
  | {kind:'prefix';lower:string;upper:string};

export function marketListingPath(_title:string,id:string){
  if(!UUID_PATTERN.test(id))return `/market/${encodeURIComponent(id)}`;
  return `/market/${listingCode(id)}`;
}

export function marketListingSelectorFromPath(segment:string):MarketListingSelector|null{
  if(UUID_PATTERN.test(segment))return {kind:'id',id:segment};
  const legacySuffix=segment.match(/--([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1];
  if(legacySuffix)return {kind:'id',id:legacySuffix};
  if(/^[0-9a-f]{32}$/i.test(segment))return {kind:'id',id:expandHexUuid(segment)!};

  const readableSuffix=segment.match(/--([0-9a-f]{8}-[0-9a-f]{4})$/i)?.[1];
  if(readableSuffix){
    const compact=readableSuffix.replaceAll('-','').toLowerCase();
    return prefixRange(compact);
  }

  const code=decodeListingCode(segment);
  if(code)return prefixRange(code);

  // Keep links already shared with the older compact UUID format working.
  if(!/^[a-z0-9_-]{22}$/i.test(segment))return null;
  try{
    const base64=segment.replaceAll('-','+').replaceAll('_','/')+'==';
    const hex=Array.from(atob(base64),character=>character.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    const id=expandHexUuid(hex);
    return id?{kind:'id',id}:null;
  }catch{return null}
}

function listingCode(id:string){
  let value=BigInt(`0x${id.replaceAll('-','').slice(0,16)}`);
  let code='';
  for(let index=0;index<13;index++){
    code=LISTING_CODE_ALPHABET[Number(value&BigInt(31))]+code;
    value>>=BigInt(5);
  }
  return code;
}

function decodeListingCode(code:string){
  if(!/^[0-9A-HJKMNP-TV-Z]{13}$/i.test(code))return null;
  let value=BigInt(0);
  for(const character of code.toUpperCase()){
    const digit=LISTING_CODE_ALPHABET.indexOf(character);
    if(digit<0)return null;
    value=(value<<BigInt(5))|BigInt(digit);
  }
  const hex=value.toString(16);
  return hex.length<=16?hex.padStart(16,'0'):null;
}

function prefixRange(prefix:string):MarketListingSelector{
  const lower=formatUuidBoundary(prefix.padEnd(32,'0'));
  const next=(BigInt(`0x${prefix}`)+BigInt(1)).toString(16).padStart(prefix.length,'0');
  const upper=next.length>prefix.length?'g0000000-0000-0000-0000-000000000000':formatUuidBoundary(next.padEnd(32,'0'));
  return {kind:'prefix',lower,upper};
}

function formatUuidBoundary(hex:string){
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`;
}

export function listingIdFromMarketPath(segment:string){
  const selector=marketListingSelectorFromPath(segment);
  return selector?.kind==='id'?selector.id:null;
}

function expandHexUuid(hex:string){
  if(!/^[0-9a-f]{32}$/i.test(hex))return null;
  const expanded=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return UUID_PATTERN.test(expanded)?expanded:null;
}
