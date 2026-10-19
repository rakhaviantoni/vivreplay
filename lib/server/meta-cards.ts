import {database} from './database';
import {displayCardName} from '@/components/tcg/card-name';

type MetaCardRow={id:string;code:string;name:string;color:string;type:string;cost:number;power:number;effect:string;imageUrl:string|null};

export async function loadMetaCards(codes:string[]){
  if(!codes.length)return [];
  let rows:MetaCardRow[];
  try{
    rows=(await database().prepare(`SELECT i.id,i.code,i.name,i.color,i.card_type AS type,i.cost,i.power,i.effect_text AS effect,(SELECT COALESCE(NULLIF(a.object_key,''),NULLIF(p.card_image_url,'')) FROM tcg_card_printings p LEFT JOIN tcg_card_assets a ON a.printing_id=p.id AND a.kind='small' WHERE p.identity_id=i.id ORDER BY CASE WHEN p.language='EN' THEN 0 ELSE 1 END,CASE WHEN p.variant IS NULL OR p.variant='Standard' THEN 0 ELSE 1 END,p.id LIMIT 1) AS imageUrl FROM tcg_card_identities i WHERE i.code IN (${codes.map(()=>'?').join(',')})`).bind(...codes).all<MetaCardRow>()).results;
  }catch{return []}
  return rows.map(row=>({...row,name:displayCardName(row.name,row.code).replaceAll(`(${row.code})`,'').replaceAll(` - ${row.code}`,'').replace(/\s*\((?:SP|SPR|SR|SEC)\)/gi,'').trim(),rarity:'',art:0,language:'EN',setCode:row.code.split('-')[0],imageUrl:row.imageUrl&&!row.imageUrl.startsWith('http')?`/${row.imageUrl.replace(/^\/+/, '').replace(/^one-piece\/([^/]+)\//,(_,setCode:string)=>`${setCode.replaceAll('-','')}/`)}`:row.imageUrl??undefined}));
}
