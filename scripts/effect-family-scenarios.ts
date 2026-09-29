import type {EffectDocument,EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import {declareBlock,effectiveCardPower,resolveBattle,expireEffectModifiers,type MatchEffectState} from '../packages/domain/match-effect-state';
export type Scenario={name:string;run:(document:EffectDocument)=>void};
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
const board=():MatchEffectState=>({turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:Array.from({length:12},(_,i)=>({id:`d${i}`,owner:'player',zone:'deck',type:'Character',name:`Other ${i}`,traits:['Other']}))});
const timingNames:Record<string,EffectTrigger>={'On Play':'on-play',Main:'main',Counter:'counter',Trigger:'trigger','When Attacking':'when-attacking','On K.O.':'on-ko','On Block':'on-block','End of Your Turn':'end-turn'};

// These deliberately narrow printed-text templates are independent of the production parser.
// A scenario covers its named timing only; other abilities on the card remain unverified.
export function familyScenarios(text:string,executionTiming?:EffectTrigger):Scenario[]{
 if(/^Your Turn \+1000$/.test(text.trim()))return ['attached','two-attached','opponent-turn','unattached','foreign-owner','battle'].map(choice=>({name:`don: ${choice}`,run(document){
  const state=board();state.turn=choice==='opponent-turn'?'opponent':'player';
  state.cards.push({id:'fighter',owner:'player',zone:'character',type:'Character',power:5000},{id:'defender',owner:'opponent',zone:'character',type:'Character',power:6000,rested:true},
   {id:'don',owner:choice==='foreign-owner'?'opponent':'player',zone:'cost-area',type:'DON!!',attachedTo:choice==='unattached'?undefined:'fighter',effectSchema:document});
  if(choice==='two-attached')state.cards.push({id:'don2',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'fighter',effectSchema:document});
  const expected=choice==='two-attached'?7000:['attached','battle'].includes(choice)?6000:5000;
  check(effectiveCardPower(state,'fighter')===expected,'Incorrect turn/attachment DON power');
  if(choice==='battle'){
   const result=resolveBattle(state,'fighter','defender');
   check(!result.error&&result.state.cards.find(c=>c.id==='defender')?.zone==='trash','DON bonus did not affect equal-power battle');
   check(result.state.cards.find(c=>c.id==='fighter')?.zone==='character','Attacker incorrectly removed');
  }
 }}));
 if(/^\[Blocker\](?:\s*\(After your opponent declares an attack, you may rest this card to make it the new target of the attack\.\))?\s*$/.test(text.trim()))return ['active','rested','wrong-owner','hand','negated'].map(choice=>({name:`blocker: ${choice}`,run(document){
  const state=board();state.cards.push({id:'blocker',owner:choice==='wrong-owner'?'player':'opponent',zone:choice==='hand'?'hand':'character',type:'Character',rested:choice==='rested',effectNegated:choice==='negated',effectSchema:document});
  const result=declareBlock(state,'opponent','blocker');
  if(choice==='active'){check(!result.error,'Active printed Blocker rejected');check(result.state.cards.find(c=>c.id==='blocker')?.rested,'Blocker did not rest');}
  else {check(result.error,'Illegal Blocker accepted');check(result.state===state,'Rejected block mutated state');}
 }}));
 if(!text.trim()||/^NULL$/i.test(text.trim()))return [{name:'no-effect: no commands in any timing window',run(document){
  for(const timing of ['on-play','when-attacking','activate-main','main','trigger','counter','on-ko','on-block','opponent-attack','end-turn','continuous','unknown'] as EffectTrigger[]){
   const resolution=resolveEffectTiming(document,timing);
   check(resolution.status==='ready'&&!resolution.instructions?.length&&!resolution.commands.length,`Unexpected effect at ${timing}`);
  }
 }}];
 const result:Scenario[]=[];
 for(const line of text.split(/\r?\n|(?<=\.)\s*(?=\[(?:On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block|End of Your Turn)\])/)){
  const window=line.trim().match(/^\[(On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block|End of Your Turn)\]\s*(.+)$/);
  if(!window)continue;
  const timing=executionTiming??timingNames[window[1]],body=window[2];
  const triggerPlay=body.match(/^(?:If your Leader is (\[[^\]]+\]|multicolored), )?Play this card\.$/i);
  if(triggerPlay&&timing==='trigger'){
   const requiredLeader=triggerPlay[1];
   for(const choice of [...(requiredLeader?['condition-met','condition-unmet']:['condition-met']),'wrong-zone','wrong-type'])result.push({name:`trigger: play this card ${requiredLeader?`(${requiredLeader}) `:''}/ ${choice}`,run(doc){
    const state=board(),leaderName=requiredLeader?.startsWith('[')?requiredLeader.slice(1,-1):'Test Leader';
    state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',name:choice==='condition-unmet'?'Other Leader':leaderName,color:requiredLeader?.toLowerCase()==='multicolored'?(choice==='condition-unmet'?'Red':'Red/Blue'):'Red'});
    const source={id:'source',owner:'player' as const,zone:choice==='wrong-zone'?'hand' as const:'life' as const,type:choice==='wrong-type'?'Event' as const:'Character' as const,name:'Source',cost:2,power:3000};state.cards.push(source);
    const started=beginEffectExecution(state,'player','source','trigger',resolveEffectTiming(doc,'trigger').commands);
    if(choice==='condition-unmet'){check(started.complete&&!started.error,'Failed trigger condition did not skip');check(started.execution.state.cards.find(card=>card.id==='source')?.zone==='life','Failed trigger condition moved the card');return;}
    check(started.requiresSelection&&!started.error,'Trigger play must ask which card to play');
    const result=advanceEffectExecution(started.execution,{targetId:'source'});
    if(choice==='wrong-zone'||choice==='wrong-type'){check(result.error&&!result.complete,'Illegal trigger card was played');check(result.execution.state.cards.find(card=>card.id==='source')?.zone===source.zone,'Rejected trigger play mutated the card');return;}
    check(result.complete&&!result.error,'Eligible trigger card did not play');check(result.execution.state.cards.find(card=>card.id==='source')?.zone==='character','Trigger card entered the wrong zone');
   }});
  }
  const readyAndRest=body.match(/^Set up to (\d+) of your DON!! cards as active\. Then, rest all of your opponent's Characters\.$/i);
  if(readyAndRest){const amount=Number(readyAndRest[1]);for(const choice of ['maximum','skip','too-many','enemy-don','active-don','foreign-don'])result.push({name:`${timing}: ready up to ${amount} DON then rest all opposing Characters / ${choice}`,run(doc){
   const state=board();state.cards.push(...Array.from({length:amount+1},(_,i)=>({id:`rested-don-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:true})),{id:'active-don',owner:'player',zone:'cost-area',type:'DON!!',rested:false},{id:'enemy-don',owner:'opponent',zone:'cost-area',type:'DON!!',rested:true},{id:'foreign-don',owner:'opponent',zone:'cost-area',type:'DON!!',rested:false},{id:'op1',owner:'opponent',zone:'character',type:'Character',rested:false},{id:'op2',owner:'opponent',zone:'character',type:'Character',rested:true},{id:'opLeader',owner:'opponent',zone:'leader',type:'Leader',rested:false});
   const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);check(started.requiresSelection&&!started.error,'Optional ready targets must be chosen before resting opponents');
   const ids=choice==='maximum'?Array.from({length:amount},(_,i)=>`rested-don-${i}`):choice==='skip'?[]:choice==='too-many'?Array.from({length:amount+1},(_,i)=>`rested-don-${i}`):[choice];const done=advanceEffectExecution(started.execution,{cardIds:ids});
   if(!['maximum','skip'].includes(choice)){check(done.error&&!done.complete,'Illegal DON!! target was accepted');check(done.execution.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='character'&&!card.rested).length===1,'Invalid selection partially resolved the remaining effect');return;}
   check(done.complete&&!done.error,'Combined ready/rest effect did not finish');check(done.execution.state.cards.filter(card=>card.id.startsWith('rested-don-')&&!card.rested).length===ids.length,'Wrong DON!! cards were readied');check(done.execution.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='character').every(card=>card.rested),'Did not rest every opposing Character');check(done.execution.state.cards.find(card=>card.id==='opLeader')?.rested===false,'Rested an opponent Leader');
  }});}
  const donKo=body.match(/^DON!!\s*[-−]\s*(\d+)(?:\s*\([^)]*\))?\s*:\s*K\.O\. up to 1 of your opponent's Characters? with a cost of (\d+) or less\.$/i);
  if(donKo){
   const payment=Number(donKo[1]),limit=Number(donKo[2]);
   for(const choice of ['eligible','skip','over-cost','enemy-don','not-don','short-payment','duplicate'])result.push({name:`${timing}: pay ${payment} DON before KO cost <= ${limit} / ${choice}`,run(doc){
    const state=board();state.cards.push(...Array.from({length:payment+1},(_,i)=>({id:`cost-don-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const})),{id:'enemy-don',owner:'opponent',zone:'cost-area',type:'DON!!'}, {id:'not-don',owner:'player',zone:'cost-area',type:'Character'}, {id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:limit,rested:true},{id:'over-cost',owner:'opponent',zone:'character',type:'Character',cost:limit+1,rested:true});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection&&!started.error,'DON!! payment must be requested before K.O.');
    check(!started.execution.state.cards.some(card=>card.id==='eligible'&&card.zone==='trash'),'K.O. happened before payment');
    const ids=choice==='short-payment'?Array.from({length:Math.max(0,payment-1)},(_,i)=>`cost-don-${i}`):choice==='duplicate'?Array.from({length:payment+1},()=> 'cost-don-0'):choice==='enemy-don'||choice==='not-don'?[choice,...Array.from({length:payment-1},(_,i)=>`cost-don-${i}`)]:Array.from({length:payment},(_,i)=>`cost-don-${i}`);
    const paid=advanceEffectExecution(started.execution,{cardIds:ids});
    if(['short-payment','duplicate','enemy-don','not-don'].includes(choice)){check(!paid.complete&&!!(paid.error||paid.requiresSelection),'Illegal DON!! payment accepted');check(JSON.stringify(paid.execution.state.cards)===JSON.stringify(state.cards),'Invalid DON!! payment mutated state');return;}
    check(paid.requiresSelection&&!paid.error,'K.O. target was not requested after payment');
    const target=choice==='eligible'?'eligible':choice==='over-cost'?'over-cost':undefined;
    const done=advanceEffectExecution(paid.execution,{...(target?{targetId:target}:{cardIds:[]})});
    if(choice==='over-cost'){check(!!done.error&&!done.complete,'Over-cost Character was accepted for K.O.');check(done.execution.state.cards.find(card=>card.id==='over-cost')?.zone==='character','Rejected K.O. mutated the target');return;}
    check(done.complete&&!done.error,'Paid K.O. effect did not complete');
    check(done.execution.state.cards.find(card=>card.id==='eligible')?.zone===(target==='eligible'?'trash':'character'),'Wrong eligible target resolution');
    check(done.execution.state.cards.find(card=>card.id==='over-cost')?.zone==='character','Over-cost Character was K.O.d.');
   }});
  }
  const boost=body.match(/^Up to 1 of your Leader or Character cards gains \+(\d+) power during this battle\. Then, if you have (\d+) or (less|more) (Life cards|cards in your trash|cards in your hand), that card gains an additional \+(\d+) power during this battle\.$/i);
  if(boost){
   const base=Number(boost[1]),threshold=Number(boost[2]),extra=Number(boost[5]),zone=boost[4].toLowerCase().includes('trash')?'trash':boost[4].toLowerCase().includes('hand')?'hand':'life';
   for(const count of [...new Set([Math.max(0,threshold-1),threshold,threshold+1])])for(const target of ['leader','character','skip'])result.push({name:`${timing}: conditional power ${zone}=${count} / ${target}`,run(doc){
    const state=board();state.cards.push({id:'leader',owner:'player',zone:'leader',type:'Leader',power:5000},{id:'character',owner:'player',zone:'character',type:'Character',power:3000});
    for(let i=0;i<count;i++)state.cards.push({id:`condition-${i}`,owner:'player',zone,type:'Character'});
    const start=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(start.requiresSelection,'Base boost must remain available when bonus condition is false');
    const done=advanceEffectExecution(start.execution,{cardIds:target==='skip'?[]:[target],...(target==='skip'?{}:{targetId:target})});
    check(done.complete&&!done.error,'Conditional boost must resolve on the original target without a second choice');
    const bonus=boost[3].toLowerCase()==='less'?count<=threshold:count>=threshold;
    for(const id of ['leader','character'])check((done.execution.state.cards.find(c=>c.id===id)?.powerModifier??0)===(id===target?base+(bonus?extra:0):0),'Wrong base/bonus power or target');
    check(expireEffectModifiers(done.execution.state,'battle').cards.every(c=>!c.powerModifier),'Conditional boost did not expire');
   }});
  }
  const ready=body.match(/^Set up to (\d+) of your DON!! cards as active\.$/i);
  if(ready){
   const amount=Number(ready[1]);
   for(const choice of ['maximum','skip','attached','enemy','character','too-many','unknown'])result.push({name:`${timing}: ready up to ${amount} DON / ${choice}`,run(doc){
    const state=board();
    for(let i=0;i<=amount;i++)state.cards.push({id:`don${i}`,owner:'player',zone:'cost-area',type:'DON!!',rested:true});
    state.cards.push({id:'attached',owner:'player',zone:'cost-area',type:'DON!!',rested:true,attachedTo:'fighter'}, {id:'enemy',owner:'opponent',zone:'cost-area',type:'DON!!',rested:true},{id:'character',owner:'player',zone:'character',type:'Character',rested:true});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Ready effect must request a selection');
    const ids=choice==='maximum'?Array.from({length:amount},(_,i)=>`don${i}`):choice==='too-many'?Array.from({length:amount+1},(_,i)=>`don${i}`):choice==='skip'?[]:[choice];
    const done=advanceEffectExecution(started.execution,{cardIds:ids});
    if(!['maximum','skip'].includes(choice)){check(done.error,'Illegal ready choice accepted');check(done.execution.state.cards.filter(c=>c.type==='DON!!').every(c=>c.rested),'Invalid choice readied DON');return;}
    check(done.complete&&!done.error,'Legal ready choice failed');
    check(done.execution.state.cards.filter(c=>c.type==='DON!!'&&!c.rested).map(c=>c.id).join(',')===ids.join(','),'Wrong DON readied');
   }});
  }

  const bounce=body.match(/^Return up to 1 of your opponent's Characters with a cost of (\d+) or less to the owner's hand\.$/i);
  if(bounce){
   const limit=Number(bounce[1]);
   for(const choice of ['eligible','over-cost','own','leader','skip'])result.push({name:`${timing}: return Character cost <= ${limit} / ${choice}`,run(doc){
    const state=board();state.cards.push({id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:limit,powerModifier:2000},{id:'over-cost',owner:'opponent',zone:'character',type:'Character',cost:limit+1},{id:'own',owner:'player',zone:'character',type:'Character',cost:0},{id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:0},{id:'attached',owner:'opponent',zone:'cost-area',type:'DON!!',attachedTo:'eligible'});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Return must request a target');
    const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:[choice],...(choice==='skip'?{}:{targetId:choice})});
    if(!['eligible','skip'].includes(choice)){check(done.error,'Illegal return target accepted');check(done.execution.state.cards.find(c=>c.id===choice)?.zone===(choice==='leader'?'leader':'character'),'Invalid target moved');return;}
    check(done.complete&&!done.error,'Legal return or skip failed');
    const target=done.execution.state.cards.find(c=>c.id==='eligible');
    check(target?.zone===(choice==='skip'?'character':'hand'),'Wrong return destination');
    if(choice==='eligible'){
     check(!target?.powerModifier,'Returned card retained temporary power');
     const don=done.execution.state.cards.find(c=>c.id==='attached');check(!don?.attachedTo&&don?.rested,'Attached DON did not return rested');
    }
   }});
  }
  const cost=body.match(/^Give up to 1 of your opponent's Characters [-−](\d+) cost during this turn\.$/i);
  if(cost){
   const amount=Number(cost[1]);
   for(const choice of ['character','own','leader','skip'])result.push({name:`${timing}: reduce cost ${amount} / ${choice}`,run(doc){
    const state=board();state.cards.push({id:'character',owner:'opponent',zone:'character',type:'Character',cost:5},{id:'own',owner:'player',zone:'character',type:'Character',cost:5},{id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:5});
    const started=beginEffectExecution(state,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Cost effect must request a target');
    const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:[choice],...(choice==='skip'?{}:{targetId:choice})});
    if(choice==='own'||choice==='leader'){check(done.error,'Illegal cost target accepted');check(done.execution.state.cards.every(c=>!c.costModifier),'Illegal choice changed costs');return;}
    check(done.complete&&!done.error,'Valid cost selection failed');
    check((done.execution.state.cards.find(c=>c.id==='character')?.costModifier??0)===(choice==='skip'?0:-amount),'Wrong cost change');
    const expired=expireEffectModifiers(done.execution.state,'turn-end');
    check((expired.cards.find(c=>c.id==='character')?.costModifier??0)===0,'Cost reduction did not expire');
   }});
  }
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
  const parts=text.split(/\r?\n|(?<=\.)\s*(?=\[(?:On Play|Main|Counter|Trigger|When Attacking|On K\.O\.|On Block|End of Your Turn)\])/);
  for(const part of parts){
   const reference=part.trim().match(/^\[Trigger\] Activate this card's \[(Main|Counter|On Play)\] effect\.$/);
   if(!reference)continue;
   const source=parts.filter(p=>p.trim().startsWith(`[${reference[1]}]`));
   if(source.length===1)result.push(...familyScenarios(source[0],'trigger'));
  }
 }
 return result;
}
