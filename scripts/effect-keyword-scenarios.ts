import type {EffectDocument} from '../packages/domain/effect-rules';
import {declareAttack,declareBlock,resolveBattle,type MatchEffectState} from '../packages/domain/match-effect-state';
export type KeywordScenario={name:string;run:(document:EffectDocument)=>void};
const check=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};

// Only a leading printed keyword is unconditional. Later gained keywords need their own condition/activation scenarios.
export function keywordScenarios(text:string):KeywordScenario[]{
 const match=text.trim().match(/^\[(Blocker|Rush|Double Attack|Banish)\](?:\s*\([^)]*\))?(?=\s*(?:\[|$))/i);
 if(!match)return [];
 const keyword=match[1].toLowerCase().replace(' ','-');
 const state=(document:EffectDocument):MatchEffectState=>({turn:'player',turnNumber:2,firstPlayer:'player',playedThisTurn:['source'],turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player',zone:'character',type:'Character',power:6000,effectSchema:document},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader',power:5000},
  {id:'character',owner:'opponent',zone:'character',type:'Character',power:5000,rested:true},
  ...Array.from({length:3},(_,i)=>({id:`life${i}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const,keywords:['trigger']})),
 ]});
 if(keyword==='blocker')return [...['active','rested','wrong-owner','hand','negated'].map(choice=>({name:`keyword Blocker: ${choice}`,run(document:EffectDocument){
  const board=state(document);board.cards.push({id:'blocker',owner:choice==='wrong-owner'?'player':'opponent',zone:choice==='hand'?'hand':'character',type:'Character',rested:choice==='rested',effectNegated:choice==='negated',effectSchema:document});
  const result=declareBlock(board,'opponent','blocker');
  if(choice==='active'){check(!result.error,'Active printed Blocker rejected');check(result.state.cards.find(card=>card.id==='blocker')?.rested,'Blocker did not rest');}
  else {check(result.error,`Illegal Blocker accepted (${choice})`);check(result.state===board,'Rejected block mutated state');}
 }})),{name:'keyword Blocker: schema isolation',run(document:EffectDocument){
  const keywordAbilities=document.ast.filter(ability=>ability.actions.some(action=>action.kind==='blocker'));
  check(keywordAbilities.length===1&&/^\[Blocker\](?:\s*\([^)]*\))?\s*$/i.test(keywordAbilities[0].rawText.trim()),'Printed Blocker must be isolated from the card’s other ability text');
  const timing=keywordAbilities[0].trigger,window=document.normalized.find(effect=>effect.timing===timing);
  check(Boolean(window?.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='blocker')),'Isolated Blocker timing has no runtime action');
  check(document.normalized.filter(effect=>effect.timing!==timing).every(effect=>effect.sequence.every(step=>step.type!=='RESOLVE'||step.action.kind!=='blocker')),'Blocker leaked into another timing window');
 }}];
 if(keyword==='rush')return ['new-character','rested','first-turn','negated','wrong-turn','active-target'].map(choice=>({name:`keyword Rush: ${choice}`,run(document){
  const board=state(document);
  if(choice==='rested')board.cards[0].rested=true;
  if(choice==='negated')board.cards[0].effectNegated=true;
  if(choice==='first-turn')board.turnNumber=1;
  if(choice==='wrong-turn')board.turn='opponent';
  if(choice==='active-target')board.cards[2].rested=false;
  const result=declareAttack(board,'player','source',choice==='active-target'?'character':'leader');
  if(choice==='new-character'){check(!result.error,'Printed Rush did not allow a newly played Character to attack');check(result.state.cards[0].rested,'Rush attacker did not rest');}
  else {check(result.error,`Rush bypassed ${choice} attack restriction`);check(result.state===board,'Rejected attack changed state');}
 }}));
 return ['damage','negated','losing-battle','character-battle','empty-life','one-life'].map(choice=>({name:`keyword ${match[1]}: ${choice}`,run(document){
  const board=state(document);
  if(choice==='negated')board.cards[0].effectNegated=true;
  if(choice==='losing-battle')board.cards[0].power=4000;
  if(choice==='empty-life')board.cards=board.cards.filter(card=>card.zone!=='life');
  if(choice==='one-life')board.cards=board.cards.filter(card=>card.zone!=='life'||card.id==='life0');
  const result=resolveBattle(board,'source',choice==='character-battle'?'character':'leader');
  check(!result.error,'Battle failed');
  if(choice==='losing-battle'){check(result.state===board&&!result.leaderDamaged,'Losing attack caused damage');return;}
  if(choice==='character-battle'){check(result.state.cards.find(c=>c.id==='character')?.zone==='trash','Character was not K.O.d');check(result.state.cards.filter(c=>c.zone==='life').length===3,'Keyword dealt Life damage during Character battle');return;}
  if(choice==='empty-life'){check(result.gameOver==='opponent','Damage at zero Life did not end game');return;}
  const amount=keyword==='double-attack'&&choice!=='negated'?2:1;
  const expectedCount=choice==='one-life'?1:amount;
  check(result.lifeCardIds?.join(',')===Array.from({length:expectedCount},(_,i)=>`life${i}`).join(','),'Wrong number/order of Life cards damaged');
  const destination=keyword==='banish'&&choice!=='negated'?'trash':'hand';
  for(let i=0;i<expectedCount;i++)check(result.state.cards.find(c=>c.id===`life${i}`)?.zone===destination,`Life damage did not go to ${destination}`);
  check(result.triggerAvailable===(destination==='hand'),'Banish/normal damage produced wrong Trigger availability');
  // Official keyword Q&A: Double Attack against one Life does not win: https://en.onepiece-cardgame.com/pdf/qa_rules.pdf
  check(!result.gameOver,'An attack against remaining Life incorrectly ended the game');
 }}));
}
