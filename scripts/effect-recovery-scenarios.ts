import type {EffectTrigger} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState,MatchCard} from '../packages/domain/match-effect-state';
import type {Scenario} from './effect-family-scenarios';
const check=(ok:unknown,message:string)=>{if(!ok)throw new Error(message);};
const windows:Record<string,EffectTrigger>={'On Play':'on-play','On K.O.':'on-ko',Trigger:'trigger',Main:'main',Counter:'counter','When Attacking':'when-attacking'};
const state=():MatchEffectState=>({turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[]});

// Match complete, unconditional printed abilities, independently of compiled actions.
export function recoveryScenarios(text:string):Scenario[]{
 const scenarios:Scenario[]=[];
 const chunks=text.split(/(?=\[(?:On Play|On K\.O\.|Trigger|Main|Counter|When Attacking|Activate: ?Main|DON!!|Your Turn|Opponent's Turn)\])/);
 for(let index=0;index<chunks.length;index++){
  if(index>0&&/\[(?:DON!![^\]]*|Your Turn|Opponent's Turn)\]\s*$/.test(chunks[index-1]))continue;
  const match=chunks[index].trim().match(/^\[(On Play|On K\.O\.|Trigger|Main|Counter|When Attacking)\]\s*([\s\S]+)$/);
  if(!match)continue;
  const timing=windows[match[1]],body=match[2].trim();
  const reorder=body.match(/^Look at (\d+) cards from the top of your deck and place them at the (top|top or bottom) of (?:your|the) deck in any order\.$/);
  if(reorder){
   const amount=Number(reorder[1]);
   for(const choice of ['reverse','duplicate','outside','missing','short-deck',...(reorder[2]==='top or bottom'?['bottom']:[])])scenarios.push({name:`${timing}: reorder ${amount} / ${choice}`,run(doc){
    const initial=state(),count=choice==='short-deck'?Math.max(1,amount-1):amount+2;
    initial.cards=Array.from({length:count},(_,i)=>({id:`d${i}`,owner:'player',zone:'deck',type:'Character'}));
    const started=beginEffectExecution(initial,'player','source',timing,resolveEffectTiming(doc,timing).commands);
    check(started.requiresSelection,'Reorder must request order');
    const inspected=Array.from({length:Math.min(amount,count)},(_,i)=>`d${i}`),ids=[...inspected].reverse();
    if(choice==='duplicate')ids[0]=ids[1];if(choice==='outside')ids[0]=`d${amount}`;if(choice==='missing')ids.pop();
    const done=advanceEffectExecution(started.execution,{cardIds:ids,position:choice==='bottom'?'bottom':'top'});
    if(['duplicate','outside','missing'].includes(choice)){check(done.error,'Illegal deck order accepted');check(JSON.stringify(done.execution.state.cards)===JSON.stringify(initial.cards),'Invalid order changed cards');return;}
    check(done.complete&&!done.error,'Valid reorder did not complete');
    const rest=initial.cards.filter(c=>!inspected.includes(c.id)).map(c=>c.id),expected=choice==='bottom'?[...rest,...ids]:[...ids,...rest];
    check(done.execution.state.cards.filter(c=>c.zone==='deck').map(c=>c.id).join(',')===expected.join(','),'Incorrect reordered deck');
    check(done.execution.state.cards.every(c=>c.zone==='deck'),'Reorder moved cards out of deck');
   }});
  }
  const recovery=body.match(/^Add up to 1 (.+) from your trash to your hand\.$/);
  if(!recovery)continue;
  let phrase=recovery[1].replace(/^of your /,'');
  let cost:number|undefined,exact=false;
  const costMatch=phrase.match(/(?: with| and) a cost of (\d+)( or less)?/);
  if(costMatch){cost=Number(costMatch[1]);exact=!costMatch[2];phrase=phrase.replace(costMatch[0],'');}
  const color=phrase.match(/^(black|blue|red|green|purple|yellow) /i)?.[1];if(color)phrase=phrase.slice(color.length+1);
  const traitMatch=phrase.match(/^(?:\{([^}]+)\}|"([^"]+)"|\[([^\]]+)\]) type /)||phrase.match(/ with a type including "([^"]+)"$/);
  const trait=traitMatch?.slice(1).find(Boolean);if(traitMatch)phrase=phrase.replace(traitMatch[0],'');
  let name:string|undefined,type:MatchCard['type'];
  if(/^\[[^\]]+\]$/.test(phrase))name=phrase.slice(1,-1);
  else if(/^(Character|Event|Stage)(?: cards?)?$/.test(phrase))type=phrase.split(' ')[0] as MatchCard['type'];
  else if(!/^cards?$/.test(phrase))continue;
  const choices=['eligible','skip','enemy','hand','unknown','too-many',...(type?['wrong-type']:[]),...(trait?['wrong-trait']:[]),...(color?['wrong-color','mixed-color']:[]),...(name?['wrong-name']:[]),...(cost!==undefined?['over-cost',...(exact&&cost>0?['under-cost']:[])]:[])];
  for(const choice of choices)scenarios.push({name:`${timing}: recover ${recovery[1]} / ${choice}`,run(doc){
   const initial=state();const candidate:MatchCard={id:'target',owner:'player',zone:'trash',type:type??'Character',name:name??'Eligible',color:color??'Black',traits:trait?[trait]:[],cost:cost??1};
   initial.cards.push(candidate,{...candidate,id:'second'});
   if(choice==='enemy')candidate.owner='opponent';if(choice==='hand')candidate.zone='hand';if(choice==='wrong-type')candidate.type=type==='Event'?'Character':'Event';if(choice==='wrong-trait')candidate.traits=['Other'];if(choice==='wrong-color')candidate.color=color==='Red'?'Blue':'Red';if(choice==='mixed-color')candidate.color=`${color}/Yellow`;if(choice==='wrong-name')candidate.name='Other';if(choice==='over-cost')candidate.cost=cost!+1;if(choice==='under-cost')candidate.cost=cost!-1;
   const started=beginEffectExecution(initial,'player','source',timing,resolveEffectTiming(doc,timing).commands);
   check(started.requiresSelection,'Recovery must ask for a choice');
   const done=advanceEffectExecution(started.execution,{cardIds:choice==='skip'?[]:choice==='unknown'?['unknown']:choice==='too-many'?['target','second']:['target']});
   if(!['eligible','skip','mixed-color'].includes(choice)){check(done.error,'Illegal recovery accepted');check(JSON.stringify(done.execution.state.cards)===JSON.stringify(initial.cards),'Invalid recovery moved cards');return;}
   check(done.complete&&!done.error,'Valid recovery must complete exactly once');
   check(done.execution.state.cards.find(c=>c.id==='target')?.zone===(choice==='skip'?'trash':'hand'),'Wrong recovery destination');
   check(done.execution.state.cards.find(c=>c.id==='second')?.zone==='trash','Unselected card moved');
  }});
 }
 return scenarios;
}
