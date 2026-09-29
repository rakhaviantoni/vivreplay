import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
export type Scenario={name:string;run:(document:EffectDocument)=>void};
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
const timingNames:Record<string,EffectTrigger>={'On Play':'on-play',Main:'main',Counter:'counter',Trigger:'trigger','When Attacking':'when-attacking','On K.O.':'on-ko'};
const state=():MatchEffectState=>({turn:'player',cards:Array.from({length:6},(_,i)=>({id:`draw${i}`,owner:'player',zone:'deck',type:'Character'})),turnEffects:[],restrictions:[],delayed:[]});

/** Exact complete ability bodies only. Passing an ability does not certify the other timings. */
export function donScenarios(text:string):Scenario[]{
 const out:Scenario[]=[];
 for(const line of text.split(/\r?\n|\s+(?=\[(?:On Play|Main|Counter|Trigger|When Attacking|On K\.O\.)\])/)){
  const ability=line.trim().match(/^\[(On Play|Main|Counter|Trigger|When Attacking|On K\.O\.)\]\s*(.+)$/);
  if(!ability)continue;
  const timing=timingNames[ability[1]],body=ability[2];
  const add=body.match(/^Add up to (\d+) DON!! cards? (?:from your DON!! deck and (set (?:it|them) as active|rest (?:it|them))|as (rested) from your DON!! deck)\.$/);
  if(add){
   const amount=Number(add[1]),rested=Boolean(add[3])||add[2].startsWith('rest');
   for(const choice of ['maximum','skip','short-supply','empty-supply','enemy','not-don','already-field','unknown','too-many','duplicate'])out.push({name:`${timing}: add up to ${amount} ${rested?'rested':'active'} DON / ${choice}`,run(doc){
    const initial=state(),supply=choice==='empty-supply'?0:choice==='short-supply'?Math.max(0,amount-1):amount+1;
    for(let i=0;i<supply;i++)initial.cards.push({id:`don${i}`,owner:'player',zone:'don-deck',type:'DON!!'});
    initial.cards.push({id:'enemy',owner:'opponent',zone:'don-deck',type:'DON!!'},{id:'not-don',owner:'player',zone:'don-deck',type:'Character'},{id:'already-field',owner:'player',zone:'cost-area',type:'DON!!',rested:false});
    const begun=beginEffectExecution(initial,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    if(supply===0&&begun.complete){check(JSON.stringify(begun.execution.state)===JSON.stringify(initial),'Empty reserve changed state');return;}
    check(begun.requiresSelection,'Optional DON addition must ask how many DON to add');
    check(JSON.stringify(begun.execution.state)===JSON.stringify(initial),'Added DON before player choice');
    const ids=['maximum','short-supply','empty-supply'].includes(choice)?Array.from({length:Math.min(amount,supply)},(_,i)=>`don${i}`):choice==='skip'?[]:choice==='too-many'?Array.from({length:amount+1},(_,i)=>`don${i}`):choice==='duplicate'?['don0','don0']:[choice];
    const result=advanceEffectExecution(begun.execution,{cardIds:ids});
    if(!['maximum','skip','short-supply','empty-supply'].includes(choice)){check(result.error,'Invalid DON addition accepted');check(JSON.stringify(result.execution.state)===JSON.stringify(initial),'Invalid addition changed state');return;}
    check(result.complete&&!result.error,'Valid DON addition failed');
    for(const card of result.execution.state.cards){const before=initial.cards.find(c=>c.id===card.id)!;if(ids.includes(card.id)){check(card.zone==='cost-area'&&Boolean(card.rested)===rested,'Wrong DON zone or rest status');}else check(JSON.stringify(card)===JSON.stringify(before),'Unselected card changed');}
   }});
  }
  const draw=body.match(/^DON!! [-−](\d+)(?: \(You may return the specified number of DON!! cards from your field to your DON!! deck\.\))?: Draw (\d+) cards?\.$/);
  if(draw){
   const amount=Number(draw[1]),draws=Number(draw[2]);
   for(const choice of ['active','rested','attached','decline','insufficient','enemy','not-don','unknown','duplicate'])out.push({name:`${timing}: return ${amount} DON cost then draw ${draws} / ${choice}`,run(doc){
    const initial=state();for(let i=0;i<amount;i++)initial.cards.push({id:`don${i}`,owner:'player',zone:'cost-area',type:'DON!!',rested:choice==='rested',attachedTo:choice==='attached'?'source':undefined});
    initial.cards.push({id:'enemy',owner:'opponent',zone:'cost-area',type:'DON!!'},{id:'not-don',owner:'player',zone:'character',type:'Character'});
    const begun=beginEffectExecution(initial,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(begun.requiresSelection,'Must select DON payment before draw');check(JSON.stringify(begun.execution.state)===JSON.stringify(initial),'Drew before returning DON cost');
    const ids=choice==='insufficient'?Array.from({length:amount-1},(_,i)=>`don${i}`):choice==='duplicate'?Array.from({length:amount+1},()=> 'don0'):['enemy','not-don','unknown'].includes(choice)?[choice,...Array.from({length:amount-1},(_,i)=>`don${i}`)]:Array.from({length:amount},(_,i)=>`don${i}`);
    const result=advanceEffectExecution(begun.execution,choice==='decline'?{choice:'decline'}:{cardIds:ids});
    if(choice==='decline'){check(!result.complete&&!result.error,'An activated DON!! cost was incorrectly declined');check(JSON.stringify(result.execution.state)===JSON.stringify(initial),'Unpaid ability changed state');return;}
    if(!['active','rested','attached'].includes(choice)){check(!result.complete,'Invalid DON payment accepted');check(JSON.stringify(result.execution.state)===JSON.stringify(initial),'Invalid payment changed state');return;}
    check(result.complete&&!result.error,'Valid DON payment failed');
    check(result.execution.state.cards.filter(c=>c.zone==='hand').map(c=>c.id).join(',')===Array.from({length:draws},(_,i)=>`draw${i}`).join(','),'Wrong cards drawn');
    for(const id of ids){const card=result.execution.state.cards.find(c=>c.id===id)!;check(card.zone==='don-deck'&&!card.attachedTo&&!card.rested,'Returned DON retained attachment/rest state');}
   }});
  }
 }
 return out;
}
