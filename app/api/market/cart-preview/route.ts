import {db} from '@/lib/server/store';

type ListingRow={id:string;sellerId:string;title:string;amount:number;currency:string;quantity:number;condition:string;items:string|null;printingId:string;seller:string};
type BundleEntry={printingId:string;quantity:number;condition?:string;unitAmount?:number};

export async function GET(request:Request){
  const url=new URL(request.url);
  const ids=[...new Set((url.searchParams.get('ids')??'').split(',').filter(Boolean))].slice(0,10);
  if(!ids.length||ids.some(id=>!/^[0-9a-f-]{36}$/i.test(id)))return Response.json({listings:[],unavailableIds:ids},{headers:{'Cache-Control':'private, no-store'}});
  try{
    const rows=(await db().prepare(`SELECT l.id,l.seller_id AS sellerId,l.title,l.amount,l.currency,l.quantity,l.condition,l.items,l.printing_id AS printingId,p.display_name AS seller
      FROM listings l JOIN profiles p ON p.id=l.seller_id
      WHERE l.id IN (${ids.map(()=>'?').join(',')}) AND l.type='WTS' AND l.status='ACTIVE' AND (l.expires_at IS NULL OR l.expires_at>CURRENT_TIMESTAMP)`)
      .bind(...ids).all<ListingRow>()).results;
    const unavailableIds=ids.filter(id=>!rows.some(row=>row.id===id));
    const cardsByListing=new Map<string,BundleEntry[]>();
    const printingIds=new Set<string>();
    for(const row of rows){
      let entries:BundleEntry[]=[];
      try{const parsed=row.items?JSON.parse(row.items) as BundleEntry[]:[];if(Array.isArray(parsed))entries=parsed.filter(item=>item&&typeof item.printingId==='string'&&Number.isInteger(item.quantity)&&item.quantity>0&&Number.isSafeInteger(item.unitAmount)&&Number(item.unitAmount)>=0)}catch{}
      if(!entries.length)entries=[{printingId:row.printingId,quantity:row.quantity,condition:row.condition,unitAmount:Math.max(1,Math.round(row.amount/Math.max(1,row.quantity)))}];
      cardsByListing.set(row.id,entries);for(const item of entries)printingIds.add(item.printingId);
    }
    const idsToLookup=[...printingIds];
    let cards: Array<{printingId:string;code:string|null;name:string|null;setCode:string|null;language:string|null;printingCode:string|null;imageUrl:string|null;assetPath:string|null}> = [];
    if(idsToLookup.length){
      try{cards=(await db().prepare(`SELECT p.id AS printingId,i.code,i.name,p.set_code AS setCode,p.language,p.printing_code AS printingCode,p.card_image_url AS imageUrl,a.object_key AS assetPath
      FROM tcg_card_printings p LEFT JOIN tcg_card_identities i ON i.id=p.identity_id
      LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small'
      WHERE p.id IN (${idsToLookup.map(()=>'?').join(',')})`).bind(...idsToLookup).all<typeof cards[number]>()).results}catch{}
      const found=new Set(cards.map(card=>card.printingId));
      const missing=idsToLookup.filter(id=>!found.has(id));
      if(missing.length){
        try{const legacy=(await db().prepare(`SELECT cp.id AS printingId,ci.code,ci.name,cp.set_code AS setCode,cp.language,cp.image_url AS imageUrl
          FROM card_printings cp LEFT JOIN card_identities ci ON ci.id=cp.identity_id
          WHERE cp.id IN (${missing.map(()=>'?').join(',')})`).bind(...missing).all<{printingId:string;code:string|null;name:string|null;setCode:string|null;language:string|null;imageUrl:string|null}>()).results;
          cards.push(...legacy.map(card=>({...card,printingCode:card.code,assetPath:null})))
        }catch{}
      }
    }
    const cardByPrinting=new Map(cards.map(card=>[card.printingId,card]));
    return Response.json({listings:rows.map(row=>{const items=cardsByListing.get(row.id)??[];return{id:row.id,sellerId:row.sellerId,title:row.title,seller:row.seller,currency:row.currency,items:items.map(item=>{const card=cardByPrinting.get(item.printingId);return{printingId:item.printingId,name:card?.name??card?.code??item.printingId,code:card?.code??item.printingId,quantity:item.quantity,unitAmount:item.unitAmount??0,condition:item.condition??row.condition,imageUrl:card?.imageUrl??null,assetPath:card?.assetPath??null,setCode:card?.setCode??null,language:card?.language??null,printingCode:card?.printingCode??null}}),subtotal:items.reduce((sum,item)=>sum+(item.unitAmount??0)*item.quantity,0)}}),unavailableIds},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('market_cart_preview_failed',error instanceof Error?error.message:'unknown error');
    return Response.json({error:'Cart details are temporarily unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
