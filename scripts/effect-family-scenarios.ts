import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import {expireEffectModifiers,type MatchEffectState} from '../packages/domain/match-effect-state';
export type Scenario={name:string;run:(document:EffectDocument)=>void};
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
const board=():MatchEffectState=>({turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:Array.from({length:12},(_,i)=>({id:`d${i}`,owner:'player',zone:'deck',type:'Character',name:`Other ${i}`,traits:['Other']}))});
const timingNames:Record<string,EffectTrigger>={'On Play':'on-play',Main:'main',Counter:'counter',Trigger:'trigger','When Attacking':'when-attacking','On K.O.':'on-ko','On Block':'on-block'};

// These deliberately narrow printed-text templates are independent of the production parser.
// A scenario covers its named timing only; other abilities on the card remain unverified.
export function familyScenarios(text:string,executionTiming?:EffectTrigger):Scenario[]{
 const result:Scenario[]=[];
 for(const line of text.split(/\r?\n|(?<=\.)\s*(?=\[(?:On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block)\])/)){
  const window=line.trim().match(/^\[(On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block)\]\s*(.+)$/);
  if(!window)continue;
  const timing=executionTiming??timingNames[window[1]],body=window[2];
  const power=body.match(/^Up to 1 of your Leader or Character cards gains \+(\d+) power during this (battle|turn)\.$/);
  if(power){
   const amount=Number(power[1]),duration=power[2]==='battle'?'battle':'turn-end';
   for(const choice of ['leader','character','opponent','hand','skip'])result.push({name:`${timing}: power +${amount} ${duration} / ${choice}`,run(doc){
    const state=board();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',power:5000},{id:'character',owner:'player',zone:'character',type:'Character',power:3000},{id:'opponent',owner:'opponent',zone:'character',type:'Character',power:3000},{id:'hand',owner:'player',zone:'hand',type:'Character',power:3000});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Power effect must ask for a target');
    const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:[choice],...(choice==='skip'?{}:{targetId:choice})});
    if(choice==='opponent'||choice==='hand'){check(done.error,'Illegal power target accepted');return;}
    check(done.complete&&!done.error,'Legal power target or skip rejected');
    const target=done.execution.state.cards.find(c=>c.id===choice);
    if(choice==='skip'){check(done.execution.state.cards.every(c=>!c.powerModifier)&&!done.execution.state.turnEffects.some(e=>e.kind==='power'),'Skipped boost changed state');return;}
    check(target?.powerModifier===amount,'Wrong power boost');
    const battleEnd=expireEffectModifiers(done.execution.state,'battle');
    check((battleEnd.cards.find(c=>c.id===choice)?.powerModifier??0)===(duration==='battle'?0:amount),'Wrong battle expiry');
    const turnEnd=expireEffectModifiers(battleEnd,'turn-end');
    check((turnEnd.cards.find(c=>c.id===choice)?.powerModifier??0)===0,'Power did not expire');
   }});
  }

  const rest=body.match(/^Rest up to 1 of your opponent's Characters with a cost of (\d+) or less\.$/);
  if(rest){
   const limit=Number(rest[1]);
   for(const choice of ['at-limit','over-limit','own-card','leader','skip'])result.push({name:`${timing}: rest cost <= ${limit} / ${choice}`,run(doc){
    const state=board();
    state.cards.push({id:'legal-alternative',owner:'opponent',zone:'character',type:'Character',cost:0,rested:false},
     {id:'victim',owner:choice==='own-card'?'player':'opponent',zone:choice==='leader'?'leader':'character',type:choice==='leader'?'Leader':'Character',cost:choice==='over-limit'?limit+1:limit,rested:false});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Rest must request a target');
    const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:['victim'],...(choice==='skip'?{}:{targetId:'victim'})});
    const victim=done.execution.state.cards.find(c=>c.id==='victim');
    if(!['at-limit','skip'].includes(choice)){check(done.error,'Illegal rest target accepted');check(!victim?.rested,'Illegal target was rested');return;}
    check(done.complete&&!done.error,'Legal rest choice failed');
    check(victim?.rested===(choice==='at-limit'),'Incorrect rested state');
    check(victim?.zone==='character','Rest moved the Character');
   }});
  }
  const drawDiscard=body.match(/^Draw (\d+) cards? (?:and|then) trash (\d+) cards? from your hand\.$/i);
  if(drawDiscard){
   const drawCount=Number(drawDiscard[1]),discardCount=Number(drawDiscard[2]);
   for(const choice of ['drawn-cards','old-hand','too-few','opponent-card'])result.push({name:`${timing}: draw ${drawCount} then discard ${discardCount} / ${choice}`,run(doc){
    const state=board();
    for(let i=0;i<discardCount;i++)state.cards.push({id:`h${i}`,owner:'player',zone:'hand',type:'Character'});
    state.cards.push({id:'enemy-hand',owner:'opponent',zone:'hand',type:'Character'});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection&&!started.error,'Must pause for discard after drawing');
    check(started.execution.state.cards.filter(c=>c.owner==='player'&&c.zone==='hand').length===drawCount+discardCount,'Wrong hand before discard');
    const ids=Array.from({length:discardCount},(_,i)=>choice==='drawn-cards'&&i<drawCount?`d${i}`:`h${i}`);
    if(choice==='too-few')ids.pop();if(choice==='opponent-card')ids[0]='enemy-hand';
    const done=advanceEffectExecution(started.execution,{cardIds:ids});
    if(choice==='too-few'||choice==='opponent-card'){
     check(!done.complete&&!!(done.error||done.requiresSelection),'Invalid mandatory discard accepted');
     check(done.execution.state.cards.every(c=>c.zone!=='trash'),'Invalid discard partially paid');return;
    }
    check(done.complete&&!done.error,'Valid discard failed');
    check(done.execution.state.cards.filter(c=>c.zone==='trash').map(c=>c.id).sort().join(',')===ids.sort().join(','),'Wrong cards discarded');
    check(done.execution.state.cards.filter(c=>c.owner==='player'&&c.zone==='hand').length===drawCount,'Wrong final hand size');
    check(done.execution.state.cards.filter(c=>c.zone==='deck').length===12-drawCount,'Draw repeated when resuming discard');
   }});
  }
  const ko=body.match(/^K\.O\. up to 1 of your opponent's (rested )?Characters with (?:a cost of (\d+)|(\d+) power) or less\.$/);
  if(ko){
   const field=ko[2]?'cost':'power',limit=Number(ko[2]??ko[3]),rested=!!ko[1];
   for(const choice of ['at-limit','over-limit','own-card','leader','skip',...(rested?['active']:[])])result.push({name:`${timing}: KO ${field} <= ${limit} / ${choice}`,run(doc){
    const state=board();
    state.cards.push({id:'legal-alternative',owner:'opponent',zone:'character',type:'Character',cost:0,power:0,rested:true});
    state.cards.push({id:'victim',owner:choice==='own-card'?'player':'opponent',zone:choice==='leader'?'leader':'character',type:choice==='leader'?'Leader':'Character',cost:0,power:0,[field]:choice==='over-limit'?limit+1:limit,rested:choice!=='active'});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'KO must request a target');
    const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:['victim'],...(choice==='skip'?{}:{targetId:'victim'})});
    if(!['at-limit','skip'].includes(choice)){
     check(done.error,'Illegal KO target accepted');
     check(done.execution.state.cards.find(c=>c.id==='victim')?.zone===(choice==='leader'?'leader':'character'),'Illegal KO changed zone');return;
    }
    check(done.complete&&!done.error,'Legal KO choice failed');
    check(done.execution.state.cards.find(c=>c.id==='victim')?.zone===(choice==='skip'?'character':'trash'),'Incorrect KO zone');
   }});
  }
  const draw=body.match(/^Draw (\d+) cards?\.?$/i);
  if(draw){
   const count=Number(draw[1]);
   for(const remaining of [12,Math.max(0,count-1)])result.push({name:`${timing}: draw ${count}, deck has ${remaining}`,run(doc){
    const state=board();state.cards=state.cards.slice(0,remaining);
    const done=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(done.complete&&!done.error,'Draw did not complete');
    const expected=Array.from({length:Math.min(count,remaining)},(_,i)=>`d${i}`).join(',');
    check(done.execution.state.cards.filter(c=>c.zone==='hand').map(c=>c.id).join(',')===expected,'Incorrect top cards drawn');
    check(done.execution.state.cards.filter(c=>c.zone==='deck').length===Math.max(0,remaining-count),'Incorrect deck count');
   }});
  }
  const search=body.match(/^Look at (\d+) cards from the top of your deck; reveal up to 1 (?:"([^"\n]+)"|\[([^\]\n]+)\]|\{([^}\n]+)\}) type card(?: other than \[([^\]]+)\])? and add it to your hand\. Then, place the rest at the bottom of your deck in any order\.$/);
  if(search){
   const count=Number(search[1]),trait=search[2]??search[3]??search[4],excluded=search[5];
   for(const choice of ['eligible','wrong-trait','outside-window','skip',...(excluded?['excluded-name']:[])])result.push({name:`${timing}: ${trait} search / ${choice}`,run(doc){
    const state=board();state.cards[0].traits=[trait];state.cards[count].traits=[trait];
    if(excluded){state.cards[1].traits=[trait];state.cards[1].name=excluded;}
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Search must request a selection');
    const chosen=choice==='skip'?[]:[choice==='eligible'?'d0':choice==='outside-window'?`d${count}`:choice==='excluded-name'?'d1':'d2'];
    const done=advanceEffectExecution(started.execution,{cardIds:chosen});
    if(['wrong-trait','outside-window','excluded-name'].includes(choice)){
     check(done.error,'Illegal search choice accepted');
     check(done.execution.state.cards.every(c=>c.zone==='deck'),'Illegal choice mutated card zones');return;
    }
    check(done.complete&&!done.error,'Legal search did not complete');
    check(done.execution.state.cards.filter(c=>c.zone==='hand').map(c=>c.id).join(',')===chosen.join(','),'Incorrect cards added to hand');
    const deck=done.execution.state.cards.filter(c=>c.zone==='deck');
    check(deck[0].id===`d${count}`,'Looked-at remainder did not move to bottom');
    check(deck.length===12-chosen.length,'Search lost or duplicated cards');
   }});
  }
 }
 if(!executionTiming){
  const parts=text.split(/\r?\n|(?<=\.)\s*(?=\[(?:On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block)\])/);
  for(const part of parts){
   const reference=part.trim().match(/^\[Trigger\] Activate this card's \[(Main|Counter|On Play)\] effect\.$/);
   if(!reference)continue;
   const source=parts.filter(p=>p.trim().startsWith(`[${reference[1]}]`));
   if(source.length===1)result.push(...familyScenarios(source[0],'trigger'));
  }
 }
 return result;
}
