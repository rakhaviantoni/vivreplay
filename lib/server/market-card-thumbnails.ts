import {db} from '@/lib/server/store';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';

export type MarketCardThumbnail={printingId:string;name:string;code:string;language:string;variant:string;rarity:string;setCode:string;imageUrl:string|null};

const THUMBNAIL_TTL=365*24*60*60*1000;
const MAX_THUMBNAILS=5000;
const thumbnailCache=new Map<string,{value:MarketCardThumbnail;expiresAt:number}>();

function rememberThumbnail(value:MarketCardThumbnail,now:number){
  const key=`${CARD_CATALOG_CACHE_REVISION}:${value.printingId}`;
  thumbnailCache.delete(key);
  thumbnailCache.set(key,{value,expiresAt:now+THUMBNAIL_TTL});
  while(thumbnailCache.size>MAX_THUMBNAILS){const oldest=thumbnailCache.keys().next().value;if(oldest===undefined)break;thumbnailCache.delete(oldest)}
}

function publicImagePath(imageUrl:string|null,setCode:string,language:string,printingCode:string){
  if(imageUrl){
    try{
      const source=new URL(imageUrl);
      if(source.hostname==='cards.oplaytcg.com'){
        const [,folder,lang,...parts]=source.pathname.split('/');
        const filename=parts.at(-1);
        if(folder&&lang&&filename)return `/${encodeURIComponent(folder)}/${encodeURIComponent(lang.toLowerCase())}/${encodeURIComponent(filename)}`;
      }
      if(source.protocol==='https:')return imageUrl;
    }catch{
      if(imageUrl.startsWith('/'))return imageUrl;
    }
    if(imageUrl.startsWith('/'))return imageUrl;
  }
  const set=setCode.replaceAll('-','');
  return set&&printingCode?`/${encodeURIComponent(set)}/${encodeURIComponent(language.toLowerCase())}/${encodeURIComponent(printingCode)}.webp`:null;
}

export async function marketCardThumbnails(printingIds:string[]){
  const unique=[...new Set(printingIds.filter(Boolean))];
  const result=new Map<string,MarketCardThumbnail>();
  const now=Date.now();
  const missing:string[]=[];
  for(const id of unique){
    const key=`${CARD_CATALOG_CACHE_REVISION}:${id}`;
    const cached=thumbnailCache.get(key);
    if(cached&&cached.expiresAt>now){
      thumbnailCache.delete(key);thumbnailCache.set(key,cached);result.set(id,cached.value);
    }else{if(cached)thumbnailCache.delete(key);missing.push(id)}
  }
  for(let offset=0;offset<missing.length;offset+=80){
    const chunk=missing.slice(offset,offset+80);
    const database=db();
    const rows=(await database.prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.rarity,p.set_code AS setCode,p.image_url AS imageUrl,i.code,i.name FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id WHERE p.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;rarity:string;setCode:string;imageUrl:string|null;code:string|null;name:string|null}>()).results;
    for(const row of rows){
      const code=row.code??row.printingCode??row.printingId;
      const value={printingId:row.printingId,name:row.name??code,code,language:row.language,variant:row.variant??'Standard',rarity:row.rarity,setCode:row.setCode,imageUrl:publicImagePath(row.imageUrl,row.setCode,row.language,row.printingCode??code)};
      result.set(row.printingId,value);rememberThumbnail(value,now);
    }
    const missing=chunk.filter(id=>!result.has(id));
    if(missing.length){
      const mirrored=(await database.prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.rarity,p.set_code AS setCode,p.card_image_url AS imageUrl,i.code,i.name FROM tcg_card_printings p LEFT JOIN tcg_card_identities i ON i.id=p.identity_id WHERE p.id IN (${missing.map(()=>'?').join(',')})`).bind(...missing).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;rarity:string;setCode:string;imageUrl:string|null;code:string|null;name:string|null}>()).results;
      for(const row of mirrored){
        const code=row.code??row.printingCode??row.printingId;
        const value={printingId:row.printingId,name:row.name??code,code,language:row.language,variant:row.variant??'Standard',rarity:row.rarity??'',setCode:row.setCode,imageUrl:publicImagePath(row.imageUrl,row.setCode,row.language,row.printingCode??code)};
        result.set(row.printingId,value);rememberThumbnail(value,now);
      }
    }
  }
  return result;
}
