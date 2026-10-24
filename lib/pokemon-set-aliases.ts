const normalized=(value:string)=>value.trim().toLowerCase().replace(/[^a-z0-9]/g,'');

export type PokemonSetFamily='30th-celebration'|'30th-classic'|null;
const celebrationExtraIds=new Set(['WAT','FIR','GRA','DAR','LIG','MET','FIG','PSY','B-RGB','R-RGB','G-RGB']);

export function pokemonSetFamily(setCode:string,localId?:string|null):PokemonSetFamily{
  const code=normalized(setCode);
  if(code==='30thc')return '30th-classic';
  if(code==='30th')return '30th-celebration';
  if(code==='ma6'){
    const local=String(localId??'').toUpperCase().replaceAll('/','-');
    if(celebrationExtraIds.has(local))return '30th-celebration';
    const number=Number.parseInt(local.match(/^\d+/)?.[0]??'',10);
    if(number>=167&&number<=196)return '30th-classic';
    if(number>=1&&number<=166)return '30th-celebration';
  }
  return null;
}

export function pokemonSetAliases(setCode:string,localId?:string|null):string[]{
  const family=pokemonSetFamily(setCode,localId);
  if(family==='30th-celebration')return ['MA6','30th'];
  if(family==='30th-classic')return ['MA6','30th-c'];
  return [setCode];
}

const setCodeSql="UPPER(REPLACE(REPLACE(REPLACE(p.set_code,'-',''),'_',''),' ',''))";
const shortDescriptionSql="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.shortDescription') END)";
const descriptionSql="trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.description') END)";
const describedNumberSql=`CASE WHEN instr(${shortDescriptionSql},' ')>0 THEN substr(${shortDescriptionSql},instr(${shortDescriptionSql},' ')+1) WHEN instr(${descriptionSql},'·')>0 THEN trim(substr(${descriptionSql},instr(${descriptionSql},'·')+1)) ELSE NULL END`;
const localIdSql=`COALESCE(NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.localId') END),''),NULLIF(trim(CASE WHEN json_valid(p.source_payload) THEN json_extract(p.source_payload,'$.collectorNumber') END),''),NULLIF(${describedNumberSql},''),p.printing_code)`;
const localNumberSql=`CAST(CASE WHEN (CASE WHEN instr(CAST(${localIdSql} AS TEXT),'/')>0 THEN substr(CAST(${localIdSql} AS TEXT),1,instr(CAST(${localIdSql} AS TEXT),'/')-1) ELSE CAST(${localIdSql} AS TEXT) END) GLOB '[0-9]*' THEN (CASE WHEN instr(CAST(${localIdSql} AS TEXT),'/')>0 THEN substr(CAST(${localIdSql} AS TEXT),1,instr(CAST(${localIdSql} AS TEXT),'/')-1) ELSE CAST(${localIdSql} AS TEXT) END) ELSE '' END AS INTEGER)`;

export function pokemonSetFilter(setCodes:string[]):{sql:string;values:string[]}{
  const predicates:string[]=[];
  const values:string[]=[];
  for(const raw of setCodes){
    const code=normalized(raw);
    if(code==='30TH'){
      predicates.push(`(${setCodeSql}='30TH' OR (${setCodeSql}='MA6' AND (${localNumberSql} BETWEEN 1 AND 166 OR UPPER(REPLACE(${localIdSql},'/','-')) IN ('WAT','FIR','GRA','DAR','LIG','MET','FIG','PSY','B-RGB','R-RGB','G-RGB'))))`);
    }else if(code==='30THC'){
      predicates.push(`(${setCodeSql}='30THC' OR (${setCodeSql}='MA6' AND ${localNumberSql} BETWEEN 167 AND 196))`);
    }else if(code==='MA6'){
      predicates.push(`(${setCodeSql} IN ('MA6','30TH','30THC'))`);
    }else{
      predicates.push(`${setCodeSql}=?`);
      values.push(code);
    }
  }
  return {sql:predicates.length?`(${predicates.join(' OR ')})`:'0',values};
}

export function pokemonLocalCardNumber(sourcePayload:unknown,fallback:string):string{
  let payload=sourcePayload;
  if(typeof payload==='string'){
    try{payload=JSON.parse(payload)}catch{return fallback}
  }
  if(!payload||typeof payload!=='object')return fallback;
  const record=payload as Record<string,unknown>;
  const explicit=[record.localId,record.collectorNumber].map(value=>String(value??'').trim()).find(value=>value&&value!=='null');
  if(explicit)return explicit.replace(/^(\d+)\/\d+$/,'$1').replace(/^([a-z0-9]+)\/([a-z0-9]+)$/i,'$1-$2');
  const description=String(record.shortDescription??'').trim()||String(record.description??'').trim();
  const parsed=description.match(/(?:^|\s|[·•])([A-Za-z0-9]+(?:\/[A-Za-z0-9]+)?)\s*$/)?.[1];
  if(parsed)return parsed.replace(/^(\d+)\/\d+$/,'$1').replace(/^([a-z0-9]+)\/([a-z0-9]+)$/i,'$1-$2');
  return fallback;
}
