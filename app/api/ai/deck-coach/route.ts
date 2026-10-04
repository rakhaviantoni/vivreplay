import {database} from '@/lib/server/database';
import {verifyTurnstile} from '@/lib/server/turnstile';

type CardSnapshot={code?:unknown;name?:unknown;colour?:unknown;type?:unknown;cost?:unknown;power?:unknown;counter?:unknown;subtypes?:unknown;effect?:unknown;quantity?:unknown};
type CoachRequest={question?:unknown;locale?:unknown;history?:unknown;context?:{leader?:CardSnapshot|null;deckSize?:unknown;deck?:unknown;candidates?:unknown}};

const baseUrl=(process.env.AZEKHA_AI_GATEWAY_URL??process.env.AI_GATEWAY_URL??process.env.OPENAI_BASE_URL??process.env.SUMOPOD_BASE_URL??'https://ai.sumopod.com/v1').replace(/\/$/,'');
const apiKey=process.env.AZEKHA_AI_GATEWAY_TOKEN??process.env.AZEKHA_AI_GATEWAY_API_KEY??process.env.AI_GATEWAY_INTERNAL_TOKEN??process.env.OPENAI_API_KEY??process.env.SUMOPOD_API_KEY??process.env.ZAI_API_KEY;
const model=process.env.AZEKHA_AI_MODEL??process.env.AI_GATEWAY_MODEL??process.env.SUMOPOD_MODEL??'glm-5.3-flash';

function cleanCard(input:unknown):CardSnapshot|null{if(!input||typeof input!=='object')return null;const card=input as CardSnapshot;return {code:typeof card.code==='string'?card.code.slice(0,32):undefined,name:typeof card.name==='string'?card.name.slice(0,100):undefined,colour:typeof card.colour==='string'?card.colour.slice(0,48):undefined,type:typeof card.type==='string'?card.type.slice(0,32):undefined,cost:typeof card.cost==='number'?card.cost:undefined,power:typeof card.power==='number'?card.power:undefined,counter:typeof card.counter==='number'?card.counter:undefined,subtypes:Array.isArray(card.subtypes)?card.subtypes.filter(value=>typeof value==='string').slice(0,8):[],effect:typeof card.effect==='string'?card.effect.slice(0,700):undefined,quantity:typeof card.quantity==='number'?Math.max(0,Math.min(4,card.quantity)):undefined};}
function messageContent(value:unknown,depth=0):string{
  if(depth>6||value==null)return '';
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(part=>messageContent(part,depth+1)).join('');
  if(typeof value==='object'){
    const item=value as Record<string,unknown>;
    for(const key of ['output_text','content','text','message','delta','output','choices']){
      const text=messageContent(item[key],depth+1);
      if(text)return text;
    }
  }
  return '';
}
function responseText(data:unknown){
  const value=data as {choices?:Array<{message?:unknown;text?:unknown}>;output_text?:unknown;output?:unknown}|null;
  return messageContent(value?.choices?.[0]?.message) || messageContent(value?.choices?.[0]?.text) || messageContent(value?.output_text) || messageContent(value?.output);
}
function promptCard(card:CardSnapshot|null, effectLimit:number){
  if(!card)return null;
  return {...card,effect:typeof card.effect==='string'?card.effect.slice(0,effectLimit):undefined};
}
function localCoachFallback(input:{leader:CardSnapshot|null;deckSize:number;deck:CardSnapshot[];locale:'EN'|'ID'}){
  const cards=input.deck.map(card=>({...card,quantity:typeof card.quantity==='number'?card.quantity:1}));
  const weighted=cards.reduce((total,card)=>total+card.quantity,0);
  const byType=cards.reduce<Record<string,number>>((result,card)=>{const type=typeof card.type==='string'?card.type:'Card';result[type]=(result[type]??0)+card.quantity;return result;},{});
  const colours=[...new Set(cards.flatMap(card=>typeof card.colour==='string'?card.colour.split(/\s+/):[]).filter(Boolean))];
  const average=weighted?cards.reduce((total,card)=>total+(Number(card.cost)||0)*card.quantity,0)/weighted:0;
  const leader=input.leader?.name&&input.leader?.code?`${input.leader.name} [${input.leader.code}]`:input.leader?.name??input.leader?.code??null;
  if(input.locale==='ID')return `## Ringkasan deck saat ini

- **Leader:** ${leader??'belum dipilih'}
- **Ukuran deck:** ${input.deckSize}/50
- **Kartu unik:** ${cards.length}
- **Warna kartu:** ${colours.join(', ')||'belum ada'}
- **Rata-rata cost:** ${average?average.toFixed(1):'-'}
- **Komposisi:** ${Object.entries(byType).map(([type,count])=>`${type} ${count}`).join(' · ')||'belum ada kartu'}

Model Coach sedang tidak memberikan teks, tetapi konteks deck Anda terbaca. Pilih Leader bila belum ada, lengkapi hingga 50 kartu, lalu coba lagi untuk rekomendasi spesifik.`;
  return `## Current deck snapshot

- **Leader:** ${leader??'not selected'}
- **Deck size:** ${input.deckSize}/50
- **Unique cards:** ${cards.length}
- **Card colours:** ${colours.join(', ')||'none yet'}
- **Average cost:** ${average?average.toFixed(1):'-'}
- **Mix:** ${Object.entries(byType).map(([type,count])=>`${type} ${count}`).join(' · ')||'no cards yet'}

The Coach provider did not return text, but your deck context was received. Select a Leader if needed, complete the 50-card list, then try again for card-specific advice.`;
}
function clientIp(request:Request){const forwarded=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')??'';return forwarded.split(',')[0]?.trim().slice(0,64)||null;}
async function record(input:{request:Request;question:string;locale:'EN'|'ID';leaderCode:string|null;deckSize:number;candidateCount:number;status:string;durationMs:number;responseText?:string;errorCode?:string}){try{await database().prepare('INSERT INTO ai_coach_requests (id,actor_id,actor_subject,actor_email,ip_address,user_agent,locale,model,question,leader_code,deck_size,candidate_count,response_text,status,error_code,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),null,null,null,clientIp(input.request),input.request.headers.get('user-agent')?.slice(0,500)??null,input.locale,model,input.question,input.leaderCode,input.deckSize,input.candidateCount,input.responseText??null,input.status,input.errorCode??null,input.durationMs).run();}catch(error){console.error('ai_coach_audit_failed',error instanceof Error?error.message:'Unknown error');}}

export async function POST(request:Request){
  const started=Date.now();let question='';let locale:'EN'|'ID'='EN';let leaderCode:string|null=null;let deckSize=0;let candidateCount=0;
  try{
    const rejected=await verifyTurnstile(request);if(rejected)return rejected;
    const payload=await request.json() as CoachRequest;
    question=typeof payload.question==='string'?payload.question.trim().slice(0,900):'';locale=payload.locale==='ID'?'ID':'EN';
    if(!question)return Response.json({error:locale==='ID'?'Tulis pertanyaan untuk Deck Coach.':'Ask the deck coach a question.'},{status:400});
    const leader=cleanCard(payload.context?.leader);leaderCode=typeof leader?.code==='string'?leader.code:null;
    const deck=Array.isArray(payload.context?.deck)?payload.context.deck.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,55):[];
    const candidates=Array.isArray(payload.context?.candidates)?payload.context.candidates.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,90):[];
    deckSize=typeof payload.context?.deckSize==='number'?payload.context.deckSize:0;candidateCount=candidates.length;
    const history=Array.isArray(payload.history)?payload.history.filter((item):item is {role:'assistant'|'user';content:string}=>Boolean(item)&&typeof item==='object'&&(item.role==='assistant'||item.role==='user')&&typeof item.content==='string').slice(-6).map(item=>({role:item.role,content:item.content.slice(0,1200)})):[];
    const context={leader,deckSize,deck,candidates};
    // A full builder catalogue can exceed an upstream model's context budget.
    // Keep the current deck and its leader intact, while trimming verbose rules text.
    const promptContext={leader:promptCard(leader,420),deckSize,deck:deck.map(card=>promptCard(card,240)),candidates:candidates.map(card=>promptCard(card,140))};
    const retryContext={leader:promptCard(leader,420),deckSize,deck:deck.map(card=>promptCard(card,80)),candidates:candidates.slice(0,30).map(card=>promptCard(card,0))};
    if(!apiKey){await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'CONFIGURATION_ERROR',durationMs:Date.now()-started,errorCode:'AI_GATEWAY_TOKEN_MISSING'});return Response.json({error:locale==='ID'?'Deck Coach belum dikonfigurasi.':'Deck Coach is not configured.'},{status:503});}
    const language=locale==='ID'?'Indonesian (Bahasa Indonesia)':'English';
    const completion={model,temperature:.25,max_tokens:900,messages:[{role:'system',content:`You are VivrePlay’s One Piece Card Game coach. Respond in ${language}, even when card names and effects remain in their printed language. Use the supplied deck, candidates, and verified VivrePlay context only. Do not invent cards, effects, rules, prices, benchmarks, tournaments, or market availability. When you recommend a card, name its code. If no leader is supplied, explain that a leader is needed before a legal list can be completed. Treat every recommendation as a testing suggestion. Use short headings and bullets; stay under 450 words.`},...history,{role:'user',content:`Question: ${question}\n\nDECK CONTEXT:\n${JSON.stringify(context)}`}]};
    const requestCompletion=(payload=completion)=>fetch(`${baseUrl}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},body:JSON.stringify({...payload,stream:false})});
    type ProviderResponse={choices?:Array<{message?:unknown;text?:unknown}>;output_text?:unknown;output?:unknown;error?:{message?:string}};
    let response=await requestCompletion();
    let data=await response.json().catch(()=>null) as ProviderResponse|null;
    if(!response.ok){const error=data?.error?.message??'Deck Coach could not respond.';await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'PROVIDER_ERROR',durationMs:Date.now()-started,errorCode:`HTTP_${response.status}`});return Response.json({error},{status:response.status});}
    let reply=responseText(data).trim();
    if(!reply){
      const compactCompletion={...completion,messages:[completion.messages[0],{role:'user',content:`Question: ${question}

DECK CONTEXT (compact):
${JSON.stringify(retryContext)}`}]};
      response=await requestCompletion(compactCompletion);
      data=await response.json().catch(()=>null) as ProviderResponse|null;
      reply=response.ok?responseText(data).trim():'';
    }
    const usedLocalFallback=!reply;
    if(usedLocalFallback) reply=localCoachFallback({leader,deckSize,deck,locale});
    await record({request,question,locale,leaderCode,deckSize,candidateCount,status:usedLocalFallback?'FALLBACK_RESPONSE':'SUCCESS',durationMs:Date.now()-started,responseText:reply.slice(0,8000),errorCode:usedLocalFallback?'EMPTY_PROVIDER_RESPONSE':undefined});
    return Response.json({reply,model,source:usedLocalFallback?'local':'model'});
  }catch{if(question)await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'REQUEST_ERROR',durationMs:Date.now()-started,errorCode:'BAD_REQUEST'});return Response.json({error:locale==='ID'?'Deck Coach tidak dapat membaca permintaan ini.':'Deck Coach could not read that request.'},{status:400});}
}
