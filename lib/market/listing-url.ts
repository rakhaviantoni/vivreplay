const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function marketListingPath(_title:string,id:string){
  if(!UUID_PATTERN.test(id))return `/market/${encodeURIComponent(id)}`;
  const bytes=id.replaceAll('-','').match(/.{2}/g)!.map(value=>String.fromCharCode(Number.parseInt(value,16))).join('');
  return `/market/${btoa(bytes).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')}`;
}

export function listingIdFromMarketPath(segment:string){
  if(UUID_PATTERN.test(segment))return segment;
  const suffix=segment.match(/--([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1];
  if(suffix)return suffix;
  if(/^[0-9a-f]{32}$/i.test(segment))return expandHexUuid(segment);
  if(!/^[a-z0-9_-]{22}$/i.test(segment))return null;
  try{
    const base64=segment.replaceAll('-','+').replaceAll('_','/')+'==';
    const hex=Array.from(atob(base64),character=>character.charCodeAt(0).toString(16).padStart(2,'0')).join('');
    return expandHexUuid(hex);
  }catch{return null}
}

function expandHexUuid(hex:string){
  if(!/^[0-9a-f]{32}$/i.test(hex))return null;
  const expanded=`${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  return UUID_PATTERN.test(expanded)?expanded:null;
}
