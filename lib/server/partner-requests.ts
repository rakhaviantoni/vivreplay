import {db as database} from './store';

type DB=ReturnType<typeof database>;

export interface PartnerAiReview{
  score:number;
  risk:'LOW'|'MEDIUM'|'HIGH';
  summary:string;
}

let partnerSchemaReady=false;

export async function ensurePartnerRequestsSchema(db:DB){
  if(partnerSchemaReady)return;
  await db.prepare(`CREATE TABLE IF NOT EXISTS market_partner_requests (
    id TEXT PRIMARY KEY,
    profile_id TEXT,
    shop_name TEXT NOT NULL,
    social_handle TEXT NOT NULL,
    category TEXT NOT NULL,
    city TEXT NOT NULL,
    monthly_volume TEXT,
    contact_whatsapp TEXT NOT NULL,
    notes TEXT,
    request_type TEXT NOT NULL DEFAULT 'BOTH',
    ai_score INTEGER,
    ai_risk TEXT,
    ai_summary TEXT,
    social_metrics TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();

  const alterColumns=[
    "ALTER TABLE market_partner_requests ADD COLUMN request_type TEXT NOT NULL DEFAULT 'BOTH'",
    'ALTER TABLE market_partner_requests ADD COLUMN ai_score INTEGER',
    'ALTER TABLE market_partner_requests ADD COLUMN ai_risk TEXT',
    'ALTER TABLE market_partner_requests ADD COLUMN ai_summary TEXT',
    'ALTER TABLE market_partner_requests ADD COLUMN social_metrics TEXT',
    'ALTER TABLE market_partner_requests ADD COLUMN reviewed_at TEXT',
  ];
  for(const sql of alterColumns){
    await db.prepare(sql).run().catch(()=>undefined);
  }
  partnerSchemaReady=true;
}

export async function getConnectedSocialSnapshot(db:DB,profileId:string|null|undefined){
  if(!profileId)return null;
  try{
    const rows=(await db.prepare('SELECT platform,username,display_name AS displayName FROM social_connections WHERE profile_id=? AND disconnected_at IS NULL LIMIT 10').bind(profileId).all<{platform:string;username:string|null;displayName:string|null}>()).results;
    if(!rows?.length)return null;
    return rows.map(row=>({
      platform:row.platform,
      handle:row.username||row.displayName||'',
    }));
  }catch{
    return null;
  }
}

function heuristicReview(input:{
  shopName:string;
  socialHandle:string;
  category:string;
  city:string;
  monthlyVolume?:string;
  contactWhatsapp:string;
  notes?:string;
  requestType:string;
  connectedSocials:Array<{platform:string;handle:string}>|null;
}):PartnerAiReview{
  let score=52;
  const digits=input.contactWhatsapp.replace(/\D/g,'');
  if(digits.length>=10&&digits.length<=15)score+=10;
  if(input.socialHandle.trim().length>=3)score+=8;
  if(input.monthlyVolume==='100+')score+=15;
  else if(input.monthlyVolume==='30-100')score+=10;
  else if(input.monthlyVolume==='10-30')score+=5;
  if(input.notes&&input.notes.trim().length>=15)score+=5;
  if(input.connectedSocials?.length)score+=10;
  score=Math.min(98,Math.max(25,score));

  const risk:PartnerAiReview['risk']=score>=75?'LOW':score>=55?'MEDIUM':'HIGH';
  const socialNote=input.connectedSocials?.length
    ?`Verified connected social(s): ${input.connectedSocials.map(s=>`${s.platform} (${s.handle})`).join(', ')}.`
    :'No connected social account on file yet; verify handle manually via WhatsApp.';
  const summary=`${input.shopName} (${input.city}) applied for ${input.requestType} in ${input.category} (${input.monthlyVolume||'unspecified'} items/mo). ${socialNote}`;
  return {score,risk,summary};
}

export async function runPartnerAiPrescreen(input:{
  shopName:string;
  socialHandle:string;
  category:string;
  city:string;
  monthlyVolume?:string;
  contactWhatsapp:string;
  notes?:string;
  requestType:string;
  connectedSocials:Array<{platform:string;handle:string}>|null;
}):Promise<PartnerAiReview>{
  const fallback=heuristicReview(input);
  const baseUrl=(
    process.env.AZEKHA_AI_GATEWAY_URL??
    process.env.AI_GATEWAY_URL??
    process.env.OPENAI_BASE_URL??
    process.env.SUMOPOD_BASE_URL??
    ''
  ).replace(/\/$/,'');
  const apiKey=
    process.env.AZEKHA_AI_GATEWAY_TOKEN??
    process.env.AZEKHA_AI_GATEWAY_API_KEY??
    process.env.AI_GATEWAY_INTERNAL_TOKEN??
    process.env.OPENAI_API_KEY??
    process.env.SUMOPOD_API_KEY??
    process.env.ZAI_API_KEY;
  if(!baseUrl||!apiKey)return fallback;

  const model=
    process.env.AZEKHA_AI_MODEL??
    process.env.AI_GATEWAY_MODEL??
    process.env.SUMOPOD_MODEL??
    'glm-5.3-flash';

  try{
    const response=await fetch(`${baseUrl}/chat/completions`,{
      method:'POST',
      headers:{
        'content-type':'application/json',
        authorization:`Bearer ${apiKey}`,
      },
      body:JSON.stringify({
        model,
        temperature:0.2,
        response_format:{type:'json_object'},
        messages:[
          {
            role:'system',
            content:'You pre-screen marketplace partner and social auto-post early-access applications. Return strict JSON with keys: score (integer 0-100), risk ("LOW"|"MEDIUM"|"HIGH"), and summary (concise 2-sentence review note for an admin).',
          },
          {
            role:'user',
            content:JSON.stringify(input),
          },
        ],
      }),
    });
    if(!response.ok)return fallback;
    const payload=await response.json() as {choices?:Array<{message?:{content?:string}}>};
    const raw=payload.choices?.[0]?.message?.content;
    if(!raw)return fallback;
    const parsed=JSON.parse(raw) as Partial<PartnerAiReview>;
    const score=Number.isFinite(Number(parsed.score))?Math.min(100,Math.max(0,Math.round(Number(parsed.score)))):fallback.score;
    const risk=parsed.risk==='LOW'||parsed.risk==='MEDIUM'||parsed.risk==='HIGH'?parsed.risk:fallback.risk;
    const summary=typeof parsed.summary==='string'&&parsed.summary.trim()?parsed.summary.trim().slice(0,500):fallback.summary;
    return {score,risk,summary};
  }catch{
    return fallback;
  }
}
