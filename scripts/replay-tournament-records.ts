import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {runD1AuditQuery} from './d1-audit-reader';

type TournamentReplaySource={id:string;round:string;leader_one_code:string;leader_two_code:string;score_one:number;score_two:number;winner_leader_code:string;event:string;event_date:string;source_url:string};
const localDb=process.env.VIVREPLAY_LOCAL_D1;
const sourceQuery=`SELECT m.id,m.round,m.leader_one_code,m.leader_two_code,m.score_one,m.score_two,m.winner_leader_code,e.name AS event,e.event_date,e.source_url FROM tournament_match_summaries m JOIN tournament_events e ON e.id=m.event_id WHERE m.evidence_status='VERIFIED' AND m.leader_one_code<>m.leader_two_code ORDER BY e.event_date DESC,m.id LIMIT 100`;
const sources=localDb?JSON.parse(execFileSync('sqlite3',['-json',localDb,sourceQuery],{encoding:'utf8'})) as TournamentReplaySource[]:runD1AuditQuery<TournamentReplaySource>(sourceQuery);
const replays=[],skipped:Array<{id:string;reason:string}>=[];
for(const [index,source] of sources.entries()){
 let raw:string;
 try{raw=execFileSync('node',['--import','tsx','scripts/simulate-ai-match.ts',String(20261018+index*997),`--match=${source.id}`],{encoding:'utf8',maxBuffer:16*1024*1024,stdio:['ignore','pipe','pipe']});}
 catch(error){const details=error&&typeof error==='object'&&'stderr'in error?String((error as {stderr:unknown}).stderr):'';const reason=details.includes('No verified 50-card representative tournament deck exists')?'No verified 50-card tournament deck exists for both Leaders.':undefined;if(!reason)throw error;skipped.push({id:source.id,reason});console.log(`${index+1}/${sources.length} ${source.id}: skipped (${reason})`);continue;}
 const replay=JSON.parse(raw) as {mode:string;seed:number;turns:number;winner:'player'|'opponent'|null;firstPlayer:{owner:string;leader:string;basis:string};match:{id:string;recordedScore:number[];recordedWinner:string;reconstruction:string};deckLists:Record<string,{leader:string;event:string;eventDate:string;finish:number;archetype:string;player:string;source:string;cards:Record<string,number>}>;trace:unknown[]};
 replays.push({source:{id:source.id,round:source.round,event:source.event,eventDate:source.event_date,recordedScore:[source.score_one,source.score_two],recordedWinner:source.winner_leader_code,sourceUrl:source.source_url},reconstruction:{game:1,seed:replay.seed,firstPlayer:replay.firstPlayer,simulatedWinner:replay.winner,simulatedWinnerLeader:replay.winner==='player'?source.leader_one_code:replay.winner==='opponent'?source.leader_two_code:null,turns:replay.turns,deckLists:replay.deckLists,trace:replay.trace,notes:replay.match.reconstruction,coverage:replay.mode}});
 console.log(`${index+1}/${sources.length} ${source.id}: ${replay.turns} turns, simulated ${replay.winner??'no winner'}`);
}
const report={generatedAt:new Date().toISOString(),source:'Cloudflare D1 verified tournament match summaries, tournament decklists, published card identities and effect schemas',sourceCount:sources.length,replayedCount:replays.length,skipped,limitations:['Each record provides a series summary rather than a canonical per-turn log. This is a seeded plausible game-one reconstruction, not historical footage or a claim that these exact actions occurred. Attack targets are now stored for each generated simulation, but they describe the reconstruction and cannot establish the historical target.','The finalists’ exact decklists are usually absent. The replay uses a verified 50-card tournament list for the same Leader, selected from the best available tournament finish; each deck’s actual event, place, player and source are included.','Current core engine playout covers normal card play, DON progression, attack declaration, battle, life movement, turn rotation and deck-out. Card-specific effect choice sequences, Trigger, Counter and Blocker are not fully automated by this prototype.'],replays};
mkdirSync('reports/tournaments',{recursive:true});
writeFileSync('reports/tournaments/inferred-engine-replays.json',JSON.stringify(report,null,2)+'\n');
mkdirSync('public/data',{recursive:true});
writeFileSync('public/data/tournament-inferred-replays.json',JSON.stringify(report)+'\n');
console.log(JSON.stringify({report:'reports/tournaments/inferred-engine-replays.json',publicReport:'public/data/tournament-inferred-replays.json',sourceCount:sources.length,generatedReplays:replays.length,skipped,limitations:report.limitations},null,2));
