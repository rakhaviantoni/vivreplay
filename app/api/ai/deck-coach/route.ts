import {getCurrentUser} from '@/lib/server/auth';
import {db,optionalUser} from '@/lib/server/store';

type CardSnapshot={code?:unknown;name?:unknown;colour?:unknown;type?:unknown;cost?:unknown;power?:unknown;counter?:unknown;subtypes?:unknown;effect?:unknown;quantity?:unknown};
type CoachRequest={question?:unknown;locale?:unknown;history?:unknown;context?:{leader?:CardSnapshot|null;deckSize?:unknown;deck?:unknown;candidates?:unknown}};

const baseUrl=(process.env.AZEKHA_AI_GATEWAY_URL??process.env.AI_GATEWAY_URL??process.env.OPENAI_BASE_URL??process.env.SUMOPOD_BASE_URL??'https://ai.sumopod.com/v1').replace(/\/$/,'');
const apiKey=process.env.AZEKHA_AI_GATEWAY_TOKEN??process.env.AZEKHA_AI_GATEWAY_API_KEY??process.env.AI_GATEWAY_INTERNAL_TOKEN??process.env.OPENAI_API_KEY??process.env.SUMOPOD_API_KEY??process.env.ZAI_API_KEY;
const model=process.env.AZEKHA_AI_MODEL??process.env.AI_GATEWAY_MODEL??process.env.SUMOPOD_MODEL??'glm-5.3-flash';

function cleanCard(input:unknown):CardSnapshot|null{if(!input||typeof input!=='object')return null;const card=input as CardSnapshot;return {code:typeof card.code==='string'?card.code.slice(0,32):undefined,name:typeof card.name==='string'?card.name.slice(0,100):undefined,colour:typeof card.colour==='string'?card.colour.slice(0,48):undefined,type:typeof card.type==='string'?card.type.slice(0,32):undefined,cost:typeof card.cost==='number'?card.cost:undefined,power:typeof card.power==='number'?card.power:undefined,counter:typeof card.counter==='number'?card.counter:undefined,subtypes:Array.isArray(card.subtypes)?card.subtypes.filter(value=>typeof value==='string').slice(0,8):[],effect:typeof card.effect==='string'?card.effect.slice(0,700):undefined,quantity:typeof card.quantity==='number'?Math.max(0,Math.min(4,card.quantity)):undefined};}
function messageContent(value:unknown){if(typeof value==='string')return value;if(Array.isArray(value))return value.map(part=>part&&typeof part==='object'&&'text' in part&&typeof part.text==='string'?part.text:'').join('');return '';}
function clientIp(request:Request){const forwarded=request.headers.get('cf-connecting-ip')??request.headers.get('x-forwarded-for')??'';return forwarded.split(',')[0]?.trim().slice(0,64)||null;}
async function record(input:{request:Request;question:string;locale:'EN'|'ID';leaderCode:string|null;deckSize:number;candidateCount:number;status:string;durationMs:number;responseText?:string;errorCode?:string}){try{const [profile,auth]=await Promise.all([optionalUser(),getCurrentUser()]);await db().prepare('INSERT INTO ai_coach_requests (id,actor_id,actor_subject,actor_email,ip_address,user_agent,locale,model,question,leader_code,deck_size,candidate_count,response_text,status,error_code,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),profile?.id??null,auth?.id??null,auth?.email??null,clientIp(input.request),input.request.headers.get('user-agent')?.slice(0,500)??null,input.locale,model,input.question,input.leaderCode,input.deckSize,input.candidateCount,input.responseText??null,input.status,input.errorCode??null,input.durationMs).run();}catch(error){console.error('ai_coach_audit_failed',error instanceof Error?error.message:'Unknown error');}}

export async function POST(request:Request){
  const started=Date.now();let question='';let locale:'EN'|'ID'='EN';let leaderCode:string|null=null;let deckSize=0;let candidateCount=0;
  try{
    const payload=await request.json() as CoachRequest;
    question=typeof payload.question==='string'?payload.question.trim().slice(0,900):'';locale=payload.locale==='ID'?'ID':'EN';
    if(!question)return Response.json({error:locale==='ID'?'Tulis pertanyaan untuk Deck Coach.':'Ask the deck coach a question.'},{status:400});
    const leader=cleanCard(payload.context?.leader);leaderCode=typeof leader?.code==='string'?leader.code:null;
    const deck=Array.isArray(payload.context?.deck)?payload.context.deck.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,55):[];
    const candidates=Array.isArray(payload.context?.candidates)?payload.context.candidates.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,90):[];
    deckSize=typeof payload.context?.deckSize==='number'?payload.context.deckSize:0;candidateCount=candidates.length;
    const history=Array.isArray(payload.history)?payload.history.filter((item):item is {role:'assistant'|'user';content:string}=>Boolean(item)&&typeof item==='object'&&(item.role==='assistant'||item.role==='user')&&typeof item.content==='string').slice(-6).map(item=>({role:item.role,content:item.content.slice(0,1200)})):[];
    const context={leader,deckSize,deck,candidates};
    if(!apiKey){await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'CONFIGURATION_ERROR',durationMs:Date.now()-started,errorCode:'AI_GATEWAY_TOKEN_MISSING'});return Response.json({error:locale==='ID'?'Deck Coach belum dikonfigurasi.':'Deck Coach is not configured.'},{status:503});}
    const language=locale==='ID'?'Indonesian (Bahasa Indonesia)':'English';
    const response=await fetch(`${baseUrl}/chat/completions`,{method:'POST',headers:{'content-type':'application/json',authorization:`Bearer ${apiKey}`},body:JSON.stringify({model,temperature:.25,max_tokens:900,messages:[{role:'system',content:`You are VivrePlay’s One Piece Card Game coach. Respond in ${language}, even when card names and effects remain in their printed language. Use the supplied deck, candidates, and verified VivrePlay context only. Do not invent cards, effects, rules, prices, benchmarks, tournaments, or market availability. When you recommend a card, name its code. If no leader is supplied, explain that a leader is needed before a legal list can be completed. Treat every recommendation as a testing suggestion. Use short headings and bullets; stay under 450 words.`},...history,{role:'user',content:`Question: ${question}\n\nDECK CONTEXT:\n${JSON.stringify(context)}`} ]})});
    const data=await response.json().catch(()=>null) as {choices?:Array<{message?:{content?:unknown}}> ;error?:{message?:string}}|null;
    if(!response.ok){const error=data?.error?.message??'Deck Coach could not respond.';await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'PROVIDER_ERROR',durationMs:Date.now()-started,errorCode:`HTTP_${response.status}`});return Response.json({error},{status:response.status});}
    const reply=messageContent(data?.choices?.[0]?.message?.content).trim();
    if(!reply){await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'EMPTY_RESPONSE',durationMs:Date.now()-started,errorCode:'EMPTY_RESPONSE'});return Response.json({error:'Deck Coach returned an empty response.'},{status:502});}
    await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'SUCCESS',durationMs:Date.now()-started,responseText:reply.slice(0,8000)});
    return Response.json({reply,model});
  }catch{if(question)await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'REQUEST_ERROR',durationMs:Date.now()-started,errorCode:'BAD_REQUEST'});return Response.json({error:locale==='ID'?'Deck Coach tidak dapat membaca permintaan ini.':'Deck Coach could not read that request.'},{status:400});}
}
