import {db} from '@/lib/server/store';
import {sealedProductById,sealedProductKinds} from '@/lib/market/sealed-products';
import {CARD_CATALOG_CACHE_REVISION} from '@/lib/card-catalog-cache';
import {pokemonLocalCardNumber} from '@/lib/pokemon-set-aliases';
import {pokemonArtRoute} from '@/lib/pokemon-art-route';

export type MarketCardThumbnail={printingId:string;name:string;code:string;language:string;variant:string;rarity:string;setCode:string;printingCode?:string;localCardNumber?:string;assetPath?:string|null;imageUrl:string|null};

const THUMBNAIL_TTL=365*24*60*60*1000;
const MAX_THUMBNAILS=5000;
const thumbnailCache=new Map<string,{value:MarketCardThumbnail;expiresAt:number}>();

function rememberThumbnail(value:MarketCardThumbnail,now:number){
  const key=`${CARD_CATALOG_CACHE_REVISION}:${value.printingId}`;
  thumbnailCache.delete(key);
  thumbnailCache.set(key,{value,expiresAt:now+THUMBNAIL_TTL});
  while(thumbnailCache.size>MAX_THUMBNAILS){const oldest=thumbnailCache.keys().next().value;if(oldest===undefined)break;thumbnailCache.delete(oldest)}
}

function publicImagePath(imageUrl:string|null,setCode:string,language:string,printingCode:string,assetPath:string|null,gameSlug:string|null,localCardNumber:string,printingId:string){
  if(gameSlug==='pokemon')return pokemonArtRoute(language,setCode,localCardNumber,printingId);
  if(assetPath){
    const key=assetPath.replace(/^\/+/, '');
    const stored=key.match(/^one-piece\/([^/]+)\/([^/]+)\/(?:small\/|thumb\/|large\/)?(.+)$/);
    if(stored)return `/${encodeURIComponent(stored[1].replaceAll('-',''))}/${encodeURIComponent(stored[2].toLowerCase())}/${stored[3].split('/').map(encodeURIComponent).join('/')}`;
    if(!key.startsWith('http'))return `/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  if(imageUrl){
    try{
      const source=new URL(imageUrl);
      if(source.hostname==='cards.oplaytcg.com'){
        const [,folder,lang,...parts]=source.pathname.split('/');
        const filename=parts.at(-1);
        if(folder&&lang&&filename&&folder.toLowerCase()!=='tcg'&&!filename.toLowerCase().startsWith('tcg-'))return `/${encodeURIComponent(folder)}/${encodeURIComponent(lang.toLowerCase())}/${encodeURIComponent(filename)}`;
      }
      // Source hosts are provenance only. Public card images always resolve
      // through VivrePlay's own storage route.
    }catch{
      if(imageUrl.startsWith('/')&&!imageUrl.startsWith('//'))return imageUrl;
    }
    if(imageUrl.startsWith('/')&&!imageUrl.startsWith('//'))return imageUrl;
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
    const product=sealedProductById(id);
    if(product){result.set(id,{printingId:id,name:product.name,code:product.setCode,language:product.language,variant:sealedProductKinds[product.kind],rarity:'',setCode:product.setCode,imageUrl:product.imageUrl});continue;}
    const key=`${CARD_CATALOG_CACHE_REVISION}:${id}`;
    const cached=thumbnailCache.get(key);
    if(cached&&cached.expiresAt>now){
      thumbnailCache.delete(key);thumbnailCache.set(key,cached);result.set(id,cached.value);
    }else{if(cached)thumbnailCache.delete(key);missing.push(id)}
  }
  for(let offset=0;offset<missing.length;offset+=80){
    const chunk=missing.slice(offset,offset+80);
    const database=db();
    const rows=(await database.prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.rarity,p.set_code AS setCode,p.image_url AS imageUrl,i.code,i.name,g.slug AS gameSlug,tcp.source_payload AS sourcePayload,tca.object_key AS assetPath FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id LEFT JOIN games g ON g.id=i.game_id LEFT JOIN tcg_card_printings tcp ON tcp.id=p.id LEFT JOIN tcg_card_assets tca ON tca.printing_id=tcp.id AND tca.kind='small' WHERE p.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;rarity:string;setCode:string;imageUrl:string|null;assetPath:string|null;code:string|null;name:string|null;gameSlug:string|null;sourcePayload:string|null}>()).results;
    for(const row of rows){
      const code=row.code??row.printingCode??row.printingId;
      const printingCode=row.printingCode??code;
      const localCardNumber=pokemonLocalCardNumber(row.sourcePayload,printingCode);
      const value={printingId:row.printingId,name:row.name??code,code,language:row.language,variant:row.variant??'Standard',rarity:row.rarity,setCode:row.setCode,printingCode,localCardNumber,assetPath:row.assetPath,imageUrl:publicImagePath(row.imageUrl,row.setCode,row.language,printingCode,row.assetPath,row.gameSlug,localCardNumber,row.printingId)};
      result.set(row.printingId,value);rememberThumbnail(value,now);
    }
    const unresolvedIds=chunk.filter(id=>!result.has(id));
    if(unresolvedIds.length){
      const mirrored=(await database.prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.rarity,p.set_code AS setCode,p.card_image_url AS imageUrl,p.source_payload AS sourcePayload,i.code,i.name,g.slug AS gameSlug,a.object_key AS assetPath FROM tcg_card_printings p LEFT JOIN tcg_card_identities i ON i.id=p.identity_id LEFT JOIN tcg_games g ON g.id=i.game_id LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.id IN (${unresolvedIds.map(()=>'?').join(',')})`).bind(...unresolvedIds).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;rarity:string;setCode:string;imageUrl:string|null;assetPath:string|null;code:string|null;name:string|null;sourcePayload:string|null;gameSlug:string|null}>()).results;
      for(const row of mirrored){
        const code=row.code??row.printingCode??row.printingId;
        const printingCode=row.printingCode??code;
        const localCardNumber=pokemonLocalCardNumber(row.sourcePayload,printingCode);
        const value={printingId:row.printingId,name:row.name??code,code,language:row.language,variant:row.variant??'Standard',rarity:row.rarity??'',setCode:row.setCode,printingCode,localCardNumber,assetPath:row.assetPath,imageUrl:publicImagePath(row.imageUrl,row.setCode,row.language,printingCode,row.assetPath,row.gameSlug,localCardNumber,row.printingId)};
        result.set(row.printingId,value);rememberThumbnail(value,now);
      }
    }
  }
  return result;
}
