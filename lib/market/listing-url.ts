const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function marketListingPath(title:string,id:string){
  const readable=title.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64).replace(/-$/,'')||'listing';
  return `/market/${readable}--${id}`;
}

export function listingIdFromMarketPath(segment:string){
  if(UUID_PATTERN.test(segment))return segment;
  const suffix=segment.match(/--([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i)?.[1];
  return suffix??null;
}
