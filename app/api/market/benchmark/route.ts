import {database} from '@/lib/server/database';

export async function GET(request:Request){
  const envRate=Number(process.env.JPY_TO_IDR_RATE??'');
  const rate=Number.isFinite(envRate)&&envRate>0?envRate:110;
  try{
    const printingId=new URL(request.url).searchParams.get('printingId')?.trim();
    if(!printingId)return Response.json({benchmark:null,history:[]});
    const history=await database().prepare(`
      SELECT p.amount,p.currency,p.source_kind AS confidence,p.observed_at AS observedAt,
        json_extract(s.payload,'$.card_url') AS url
      FROM tcg_price_observations p
      LEFT JOIN tcg_source_records s ON s.id=p.source_record_id
      WHERE p.printing_id=? AND lower(p.source)='yuyutei'
      ORDER BY p.observed_at DESC LIMIT 60
    `).bind(printingId).all<{amount:number;currency:string;url:string|null;observedAt:string;confidence:string}>();
    type BenchmarkRow={amount:number;currency:string;url:string|null;observedAt:string;confidence:string};
    let benchmark:BenchmarkRow|null=history.results[0]??null;
    let matchType:'exact'|'same_set_variant'='exact';
    if(!benchmark){
      const target=await database().prepare(`SELECT identity_id AS identityId,language,set_code AS setCode,variant FROM tcg_card_printings WHERE id=?`).bind(printingId).first<{identityId:string;language:string;setCode:string;variant:string}>();
      if(target){
        const variant=target.variant.toLowerCase();
        const family=variant.includes('super')||variant.includes('manga')?'super':/standard|base/i.test(variant)?'standard':'parallel';
        const familyFilter=family==='super'
          ? `lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) LIKE '%スーパーパラレル%' OR lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) LIKE '%super parallel%' OR lower(cp.variant) LIKE '%manga%'`
          : family==='standard'
            ? `lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) NOT LIKE '%パラレル%' AND lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) NOT LIKE '%parallel%' AND lower(cp.variant) NOT LIKE '%alt%'`
            : `lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) LIKE '%パラレル%' AND lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) NOT LIKE '%スーパーパラレル%' AND lower(COALESCE(json_extract(s.payload,'$.card_name'),cp.variant)) NOT LIKE '%super parallel%' AND lower(cp.variant) NOT LIKE '%super%' AND lower(cp.variant) NOT LIKE '%manga%'`;
        benchmark=await database().prepare(`
          SELECT p.amount,p.currency,p.source_kind AS confidence,p.observed_at AS observedAt,
            json_extract(s.payload,'$.card_url') AS url
          FROM tcg_price_observations p
          JOIN tcg_card_printings cp ON cp.id=p.printing_id
          LEFT JOIN tcg_source_records s ON s.id=p.source_record_id
          WHERE cp.identity_id=? AND cp.language=? AND cp.set_code=? AND cp.id<>?
            AND p.source='yuyutei'
            AND (s.payload IS NULL OR lower(json_extract(s.payload,'$.version'))=replace(lower(cp.set_code),'-',''))
            AND (${familyFilter})
          ORDER BY p.observed_at DESC LIMIT 1
        `).bind(target.identityId,target.language,target.setCode,printingId).first<BenchmarkRow>()??null;
        if(benchmark)matchType='same_set_variant';
      }
    }
    const currency=benchmark?.currency.toUpperCase();
    const normalizedAmount=benchmark?(currency==='JPY'?Math.round(benchmark.amount*rate):currency==='IDR'?benchmark.amount:null):null;
    return Response.json({benchmark:benchmark?{...benchmark,normalizedAmount,normalizedCurrency:normalizedAmount===null?null:'IDR',matchType}:null,history:[...history.results].reverse(),jpyToIdrRate:rate});
  }catch(error){
    console.error('market_benchmark_unavailable', error);
    return Response.json({benchmark:null,history:[],jpyToIdrRate:rate});
  }
}
