import {db} from '@/lib/server/store';

export type MarketCardThumbnail={printingId:string;name:string;code:string;language:string;variant:string;imageUrl:string|null};

function publicImagePath(imageUrl:string|null,setCode:string,language:string,printingCode:string){
  if(imageUrl){
    try{
      const source=new URL(imageUrl);
      if(source.hostname==='cards.oplaytcg.com'){
        const [,folder,lang,...parts]=source.pathname.split('/');
        const filename=parts.at(-1);
        if(folder&&lang&&filename)return `/${encodeURIComponent(folder)}/${encodeURIComponent(lang.toLowerCase())}/${encodeURIComponent(filename)}`;
      }
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
  for(let offset=0;offset<unique.length;offset+=80){
    const chunk=unique.slice(offset,offset+80);
    const rows=(await db().prepare(`SELECT p.id AS printingId,p.printing_code AS printingCode,p.language,p.variant,p.set_code AS setCode,p.image_url AS imageUrl,i.code,i.name FROM card_printings p LEFT JOIN card_identities i ON i.id=p.identity_id WHERE p.id IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all<{printingId:string;printingCode:string|null;language:string;variant:string|null;setCode:string;imageUrl:string|null;code:string|null;name:string|null}>()).results;
    for(const row of rows){
      const code=row.code??row.printingCode??row.printingId;
      result.set(row.printingId,{printingId:row.printingId,name:row.name??code,code,language:row.language,variant:row.variant??'Standard',imageUrl:publicImagePath(row.imageUrl,row.setCode,row.language,row.printingCode??code)});
    }
  }
  return result;
}
