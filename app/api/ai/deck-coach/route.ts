import {database} from '@/lib/server/database';
import {verifyTurnstile} from '@/lib/server/turnstile';

type CardSnapshot={code?:unknown;name?:unknown;colour?:unknown;type?:unknown;cost?:unknown;power?:unknown;counter?:unknown;subtypes?:unknown;effect?:unknown;quantity?:unknown};
type CoachRequest={question?:unknown;locale?:unknown;history?:unknown;context?:{leader?:CardSnapshot|null;opponentLeader?:CardSnapshot|null;deckSize?:unknown;deck?:unknown;candidates?:unknown}};
type TournamentExample={event:string;date:string;place:number;player:string;leaderCode:string;archetype:string|null;cards:string;source:string;eventSource:string};
type MatchupEvidence={leaderCode:string;opponentLeaderCode:string;seriesRecords:number;seriesWins:number;seriesWinRate:number|null;games:number;gameWins:number;gameWinRate:number|null;sources:string[];mirrorBuildComparisons?:Array<{buildOne:string;buildTwo:string;seriesRecords:number;buildOneWins:number;buildTwoWins:number;buildOneWinRate:number|null;games:number;buildOneGameWins:number;buildTwoGameWins:number;sources:string[]}>};
type TournamentMatchSummary={event:string;date:string;round:string;leaderOneCode:string;archetypeOne:string;playerOneName:string|null;leaderTwoCode:string;archetypeTwo:string;playerTwoName:string|null;scoreOne:number;scoreTwo:number;winnerLeaderCode:string;winnerSide:number;seriesComplete:number;scoreComplete:number;summary:string;evidenceStatus:string;sourceName:string;sourceUrl:string};

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
async function tournamentExamples(leaderCodes:string[]):Promise<TournamentExample[]>{
  const codes=[...new Set(leaderCodes.filter(code=>/^(?:OP|ST|EB|P|PRB)\d{0,2}-\d{3}$/.test(code)))].slice(0,3);
  if(!codes.length)return [];
  try{
    const examples=await Promise.all(codes.map(async code=>{
      const result=await database().prepare(`SELECT e.name AS event,e.event_date AS date,f.place,f.player_name AS player,f.leader_code AS leaderCode,f.archetype,GROUP_CONCAT(c.card_code || ' x' || c.quantity, ', ') AS cards,f.deck_source_url AS source,e.source_url AS eventSource FROM tournament_finishes f JOIN tournament_events e ON e.id=f.event_id JOIN tournament_deck_cards c ON c.finish_id=f.id WHERE f.list_status='VERIFIED' AND f.leader_code=? GROUP BY f.id ORDER BY e.event_date DESC,f.place ASC LIMIT 3`).bind(code).all<TournamentExample>();
      return result.results;
    }));
    return examples.flat().sort((a,b)=>a.date===b.date?a.place-b.place:b.date.localeCompare(a.date));
  }catch{return [];}
}
async function tournamentMatchup(leaderCode:string|null,opponentLeaderCode:string|null):Promise<MatchupEvidence|null>{
  if(!leaderCode||!opponentLeaderCode)return null;
  try{
    if(leaderCode===opponentLeaderCode){
      const records=(await database().prepare(`SELECT m.archetype_one AS buildOne,m.archetype_two AS buildTwo,m.score_one AS scoreOne,m.score_two AS scoreTwo,m.winner_side AS winnerSide,m.series_complete AS seriesComplete,m.source_url AS source FROM tournament_match_summaries m WHERE m.evidence_status='VERIFIED' AND m.leader_one_code=? AND m.leader_two_code=?`).bind(leaderCode,opponentLeaderCode).all<{buildOne:string;buildTwo:string;scoreOne:number;scoreTwo:number;winnerSide:number;seriesComplete:number;source:string}>()).results;
      const groups=new Map<string,{buildOne:string;buildTwo:string;seriesRecords:number;buildOneWins:number;buildTwoWins:number;games:number;buildOneGameWins:number;buildTwoGameWins:number;sources:Set<string>}>();
      for(const record of records){const key=`${record.buildOne}\u0000${record.buildTwo}`;const row=groups.get(key)??{buildOne:record.buildOne,buildTwo:record.buildTwo,seriesRecords:0,buildOneWins:0,buildTwoWins:0,games:0,buildOneGameWins:0,buildTwoGameWins:0,sources:new Set<string>()};row.seriesRecords+=record.seriesComplete?1:0;row.buildOneWins+=record.seriesComplete&&record.winnerSide===1?1:0;row.buildTwoWins+=record.seriesComplete&&record.winnerSide===2?1:0;row.games+=record.scoreOne+record.scoreTwo;row.buildOneGameWins+=record.scoreOne;row.buildTwoGameWins+=record.scoreTwo;row.sources.add(record.source);groups.set(key,row);}
      const mirrorBuildComparisons=[...groups.values()].map(row=>({buildOne:row.buildOne,buildTwo:row.buildTwo,seriesRecords:row.seriesRecords,buildOneWins:row.buildOneWins,buildTwoWins:row.buildTwoWins,buildOneWinRate:row.seriesRecords?row.buildOneWins/row.seriesRecords:null,games:row.games,buildOneGameWins:row.buildOneGameWins,buildTwoGameWins:row.buildTwoGameWins,sources:[...row.sources]}));
      if(!mirrorBuildComparisons.length)return null;
      return {leaderCode,opponentLeaderCode,seriesRecords:0,seriesWins:0,seriesWinRate:null,games:0,gameWins:0,gameWinRate:null,sources:[],mirrorBuildComparisons};
    }
    let seriesRecords=0,seriesWins=0,games=0,gameWins=0;const sources=new Set<string>();
    const base=(await database().prepare(`SELECT f.leader_code AS leaderCode,o.leader_code AS opponentLeaderCode,CASE WHEN m.winner_finish_id=f.id THEN f.leader_code WHEN m.winner_finish_id=o.id THEN o.leader_code END AS winnerLeaderCode,m.source_url AS source FROM tournament_matches m JOIN tournament_finishes f ON f.id=m.player_finish_id JOIN tournament_finishes o ON o.id=m.opponent_finish_id WHERE m.verification_status='VERIFIED' AND ((f.leader_code=? AND o.leader_code=?) OR (f.leader_code=? AND o.leader_code=?))`).bind(leaderCode,opponentLeaderCode,opponentLeaderCode,leaderCode).all<{leaderCode:string;opponentLeaderCode:string;winnerLeaderCode:string|null;source:string}>()).results;
    for(const row of base){seriesRecords+=1;seriesWins+=row.winnerLeaderCode===leaderCode?1:0;games+=1;gameWins+=row.winnerLeaderCode===leaderCode?1:0;sources.add(row.source);}
    const summaries=(await database().prepare(`SELECT leader_one_code AS leaderOneCode,archetype_one AS archetypeOne,leader_two_code AS leaderTwoCode,archetype_two AS archetypeTwo,score_one AS scoreOne,score_two AS scoreTwo,winner_leader_code AS winnerLeaderCode,winner_side AS winnerSide,series_complete AS seriesComplete,source_url AS source FROM tournament_match_summaries WHERE evidence_status='VERIFIED' AND ((leader_one_code=? AND leader_two_code=?) OR (leader_one_code=? AND leader_two_code=?))`).bind(leaderCode,opponentLeaderCode,opponentLeaderCode,leaderCode).all<{leaderOneCode:string;archetypeOne:string;leaderTwoCode:string;archetypeTwo:string;scoreOne:number;scoreTwo:number;winnerLeaderCode:string;winnerSide:number;seriesComplete:number;source:string}>()).results;
    for(const row of summaries){const oriented=row.leaderOneCode===leaderCode;const ownScore=oriented?row.scoreOne:row.scoreTwo;const opponentScore=oriented?row.scoreTwo:row.scoreOne;if(row.seriesComplete){seriesRecords+=1;seriesWins+=row.winnerLeaderCode===leaderCode?1:0;}games+=ownScore+opponentScore;gameWins+=ownScore;sources.add(row.source);}
    if(!seriesRecords&&!games)return null;
    return {leaderCode,opponentLeaderCode,seriesRecords,seriesWins,seriesWinRate:seriesRecords?seriesWins/seriesRecords:null,games,gameWins,gameWinRate:games?gameWins/games:null,sources:[...sources]};
  }catch{return null;}
}
async function tournamentMatchSummaries(leaderCode:string|null,opponentLeaderCode:string|null):Promise<TournamentMatchSummary[]>{
  if(!leaderCode||!opponentLeaderCode)return [];
  try{return (await database().prepare(`SELECT e.name AS event,e.event_date AS date,m.round,m.leader_one_code AS leaderOneCode,m.archetype_one AS archetypeOne,m.player_one_name AS playerOneName,m.leader_two_code AS leaderTwoCode,m.archetype_two AS archetypeTwo,m.player_two_name AS playerTwoName,m.score_one AS scoreOne,m.score_two AS scoreTwo,m.winner_leader_code AS winnerLeaderCode,m.winner_side AS winnerSide,m.series_complete AS seriesComplete,m.score_complete AS scoreComplete,m.summary,m.evidence_status AS evidenceStatus,m.source_name AS sourceName,m.source_url AS sourceUrl FROM tournament_match_summaries m JOIN tournament_events e ON e.id=m.event_id WHERE m.evidence_status='VERIFIED' AND ((m.leader_one_code=? AND m.leader_two_code=?) OR (m.leader_one_code=? AND m.leader_two_code=?)) ORDER BY e.event_date DESC LIMIT 4`).bind(leaderCode,opponentLeaderCode,opponentLeaderCode,leaderCode).all<TournamentMatchSummary>()).results;}catch{return [];}
}

export async function POST(request:Request){
  const started=Date.now();let question='';let locale:'EN'|'ID'='EN';let leaderCode:string|null=null;let deckSize=0;let candidateCount=0;
  try{
    const rejected=await verifyTurnstile(request);if(rejected)return rejected;
    const payload=await request.json() as CoachRequest;
    question=typeof payload.question==='string'?payload.question.trim().slice(0,900):'';locale=payload.locale==='ID'?'ID':'EN';
    if(!question)return Response.json({error:locale==='ID'?'Tulis pertanyaan untuk Deck Coach.':'Ask the deck coach a question.'},{status:400});
    const leader=cleanCard(payload.context?.leader);leaderCode=typeof leader?.code==='string'?leader.code:null;
    const opponentLeader=cleanCard(payload.context?.opponentLeader);
    const deck=Array.isArray(payload.context?.deck)?payload.context.deck.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,55):[];
    const candidates=Array.isArray(payload.context?.candidates)?payload.context.candidates.map(cleanCard).filter((card):card is CardSnapshot=>Boolean(card)).slice(0,90):[];
    deckSize=typeof payload.context?.deckSize==='number'?payload.context.deckSize:0;candidateCount=candidates.length;
    const history=Array.isArray(payload.history)?payload.history.filter((item):item is {role:'assistant'|'user';content:string}=>Boolean(item)&&typeof item==='object'&&(item.role==='assistant'||item.role==='user')&&typeof item.content==='string').slice(-6).map(item=>({role:item.role,content:item.content.slice(0,1200)})):[];
    // A full builder catalogue can exceed an upstream model's context budget.
    // Keep the current deck and its leader intact, while trimming verbose rules text.
    const questionLeaderCodes=[...new Set([...question.matchAll(/\b(?:OP|ST|EB|P|PRB)\d{0,2}-\d{3}\b/g)].map(match=>match[0]))];
    const mirrorQuestion=/\bmirror(?:\s+(?:match|matchup))?\b/i.test(question);
    const opponentLeaderCode=typeof opponentLeader?.code==='string'?opponentLeader.code:questionLeaderCodes.find(code=>code!==leaderCode)??(mirrorQuestion?leaderCode:null);
    const [examples,matchup,matchSummaries]=await Promise.all([tournamentExamples([...(leaderCode?[leaderCode]:[]),...(opponentLeaderCode?[opponentLeaderCode]:[])]),tournamentMatchup(leaderCode,opponentLeaderCode),tournamentMatchSummaries(leaderCode,opponentLeaderCode)]);
    const tournamentEvidence={tournamentDeckExamples:examples,verifiedMatchupRecords:matchup?[matchup]:[],videoMatchSummaries:matchSummaries};
    const promptContext={leader:promptCard(leader,420),opponentLeader:promptCard(opponentLeader,240),deckSize,deck:deck.map(card=>promptCard(card,240)),candidates:candidates.map(card=>promptCard(card,140)),...tournamentEvidence};
    const retryContext={leader:promptCard(leader,420),opponentLeader:promptCard(opponentLeader,80),deckSize,deck:deck.map(card=>promptCard(card,80)),candidates:candidates.slice(0,30).map(card=>promptCard(card,0)),...tournamentEvidence};
    if(!apiKey){await record({request,question,locale,leaderCode,deckSize,candidateCount,status:'CONFIGURATION_ERROR',durationMs:Date.now()-started,errorCode:'AI_GATEWAY_TOKEN_MISSING'});return Response.json({error:locale==='ID'?'Deck Coach belum dikonfigurasi.':'Deck Coach is not configured.'},{status:503});}
    const language=locale==='ID'?'Indonesian (Bahasa Indonesia)':'English';
    const completion={model,temperature:.25,max_tokens:900,messages:[{role:'system',content:`You are VivrePlay’s One Piece Card Game coach. Respond in ${language}, even when card names and effects remain in their printed language. Use the supplied deck, candidates, and VivrePlay context only. Do not invent cards, effects, rules, prices, benchmarks, tournaments, or market availability. Tournament deck examples represent published decklists and final placements; they are not head-to-head match records and must never be presented as matchup win rates. Verified head-to-head records include match results transcribed from video analysis summaries and approved by the user. Count only completed series as series results; partial match summaries contribute only the games observed, and a partial score must never be presented as the final series score. State sample sizes alongside any rate. For mirror matchups, compare the listed deck-build variants; do not report a leader-versus-itself win rate. When verified records are absent, empirical matchup performance and win rates are unknown; you may still give qualitative matchup/card advice from the supplied card text and decklists. When you recommend a card, name its code. If no leader is supplied, explain that a leader is needed before a legal list can be completed. Treat every recommendation as a testing suggestion. Use short headings and bullets; stay under 450 words.`},...history,{role:'user',content:`Question: ${question}\n\nDECK CONTEXT:\n${JSON.stringify(promptContext)}`}]};
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
