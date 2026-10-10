import {test} from 'node:test';
import assert from 'node:assert/strict';
import {familyScenarios} from '../scripts/effect-family-scenarios';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {executeEffectCommands,resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution} from '../packages/domain/effect-controller';
import {advanceEffectExecution} from '../packages/domain/effect-controller';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
import {customEffectBranch} from '../packages/domain/custom-effect-resolvers';
import {scenarios} from '../scripts/card-effect-scenarios';

test('search scenarios enforce each printed trait notation, exclusions and deck window',()=>{
 for(const trait of ['[Kid Pirates]','"Kid Pirates"','{Kid Pirates}']){
  const effect=`[On Play] Look at 5 cards from the top of your deck; reveal up to 1 ${trait} type card other than [Killer] and add it to your hand. Then, place the rest at the bottom of your deck in any order.`;
  const document=compileEffectDocument({id:'test',code:'TEST',name:'Killer',color:'Purple',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect});
  const cases=familyScenarios(effect);assert.equal(cases.length,5);
  for(const scenario of cases)scenario.run(document);
  const broken=structuredClone(document);
  for(const ability of broken.normalized)for(const step of ability.sequence)if(step.type==='RESOLVE'&&step.action.kind==='search')delete step.action.trait;
  assert.throws(()=>cases.find(c=>c.name.endsWith('wrong-trait'))!.run(broken),/Illegal search choice accepted/);
 }
});
test('cost-limited search validates the threshold, look window, bottom placement and referenced Trigger timing',()=>{
 const effect="[Main] Look at 4 cards from the top of your deck; reveal up to 1 card with a cost of 4 or more and add it to your hand. Then, place the rest at the bottom of your deck in any order.\n[Trigger] Activate this card's [Main] effect.";
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Search Event',color:'Purple',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='search')step.action.minCost=6;
 assert.throws(()=>cases.find(scenario=>scenario.name.startsWith('main:'))!.run(broken),/Boundary-cost card should be eligible/);
});
test('family tests do not silently drop conditions or follow-up clauses',()=>{
 assert.equal(familyScenarios('[On Play] If your Leader is [Sanji], draw 1 card.').length,0);
 assert.equal(familyScenarios('[On Play] Draw 1 card. Then, trash 1 card from your hand.').length,0);
});
test('OP06-092 branches resolve legal opposing trash targets or order exactly three opposing Trash cards',()=>{
 const state=()=>({turn:'player' as const,cards:[
  {id:'brook',owner:'player' as const,zone:'character' as const,type:'Character' as const},
  {id:'legal',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:4},
  {id:'over-cost',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:5},
  {id:'opp-a',owner:'opponent' as const,zone:'trash' as const,type:'Event' as const},
  {id:'opp-b',owner:'opponent' as const,zone:'trash' as const,type:'Character' as const},
  {id:'opp-c',owner:'opponent' as const,zone:'trash' as const,type:'Stage' as const},
  {id:'own-trash',owner:'player' as const,zone:'trash' as const,type:'Event' as const},
  {id:'opp-deck',owner:'opponent' as const,zone:'deck' as const,type:'Event' as const},
 ],turnEffects:[],restrictions:[],delayed:[]});
 const trashBranch=customEffectBranch('OP06_092_ON_PLAY',0)!;assert.equal(trashBranch[0].kind,'trash-character');
 const trashStart=beginEffectExecution(state(),'player','brook','on-play',trashBranch.map((value,abilityId)=>({kind:'resolve-action' as const,value,abilityId})));
 assert.ok(trashStart.requiresSelection,'The first choice must ask for an optional legal target');
 const trashed=advanceEffectExecution(trashStart.execution,{cardIds:['legal']});
 assert.ok(trashed.complete&&!trashed.error,'The selected opposing Character should be trashed');
 assert.equal(trashed.execution.state.cards.find(card=>card.id==='legal')?.zone,'trash');
 assert.equal(trashed.execution.state.cards.find(card=>card.id==='over-cost')?.zone,'character');
 const skipped=advanceEffectExecution(trashStart.execution,{cardIds:[]});assert.ok(skipped.complete&&!skipped.error,'The up-to-one branch should allow choosing none');

 const bottomBranch=customEffectBranch('OP06_092_ON_PLAY',1)!;assert.equal(bottomBranch[0].kind,'bottom-deck');
 const bottomStart=beginEffectExecution(state(),'player','brook','on-play',bottomBranch.map((value,abilityId)=>({kind:'resolve-action' as const,value,abilityId})));
 assert.ok(bottomStart.requiresSelection,'The second choice must request the exact ordered cards');
 const ordered=advanceEffectExecution(bottomStart.execution,{cardIds:['opp-b','opp-a','opp-c']});
 assert.ok(ordered.complete&&!ordered.error,'The three-card bottom-deck branch should resolve');
 assert.deepEqual(ordered.execution.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='deck').map(card=>card.id),['opp-deck','opp-b','opp-a','opp-c']);
 assert.equal(ordered.execution.state.cards.find(card=>card.id==='own-trash')?.zone,'trash','The opponent branch must not move your Trash cards');
 const short=advanceEffectExecution(bottomStart.execution,{cardIds:['opp-a','opp-b']});assert.ok(short.error,'The exact-three instruction must reject fewer than three cards');
});

test('EB01-052 choose-one reorders opposing Life or turns every own Life card face-down',()=>{
 const makeState=()=>({turn:'player' as const,cards:[{id:'eb01-052',owner:'player' as const,zone:'character' as const,type:'Character' as const},...['opp-top','opp-next','opp-bottom'].map(id=>({id,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),{id:'own-life',owner:'player' as const,zone:'life' as const,type:'Character' as const,faceUp:true}],turnEffects:[],restrictions:[],delayed:[]});
 const reorder=customEffectBranch('EB01_052_ON_PLAY',0)!;assert.equal(reorder[0].kind,'reorder-life');const reorderStart=beginEffectExecution(makeState(),'player','eb01-052','on-play',reorder.map((value,abilityId)=>({kind:'resolve-action' as const,value,abilityId})));assert(reorderStart.requiresSelection,'The first branch must ask to order opposing Life');const ordered=advanceEffectExecution(reorderStart.execution,{cardIds:['opp-bottom','opp-top','opp-next']});assert(ordered.complete&&!ordered.error,'The opponent Life order was rejected');assert.deepEqual(ordered.execution.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='life').map(card=>card.id),['opp-bottom','opp-top','opp-next']);assert(ordered.execution.state.cards.find(card=>card.id==='own-life')?.faceUp,'Reordering opponent Life changed your own Life');
 const faceDown=customEffectBranch('EB01_052_ON_PLAY',1)!;assert.equal(faceDown[0].kind,'set-life-face');const turned=beginEffectExecution(makeState(),'player','eb01-052','on-play',faceDown.map((value,abilityId)=>({kind:'resolve-action' as const,value,abilityId})));assert(turned.complete&&!turned.error,'Turning own Life face-down did not resolve');assert.equal(turned.execution.state.cards.find(card=>card.id==='own-life')?.faceUp,false);assert(turned.execution.state.cards.filter(card=>card.owner==='opponent'&&card.zone==='life').every(card=>card.faceUp===undefined),'The branch changed the opponent Life cards');
});
test('ST13-002 end of turn trashes every face-up own Life card, not face-down Life',()=>{
 const doc=compileEffectDocument({id:'st13-002',code:'ST13-002',name:'Test',color:'Black',type:'Character',cost:5,power:5000,rarity:'C',art:0,effect:'[DON!! x2][Activate: Main][Once Per Turn] Look at 5 cards from the top of your deck and add up to 1 Character card with a cost of 5 to the top of your Life cards face-up. Then, place the rest at the bottom of your deck in any order.\n[End of Your Turn] Trash all your face-up Life cards.'});
 assert.equal(doc.resolver.type,'DSL','Both timing windows must compile without a custom fallback');
 const commands=resolveEffectTiming(doc,'end-turn').commands;assert.deepEqual(commands.map(command=>command.kind==='resolve-action'?command.value.kind:command.kind),['trash-life']);
 const state:MatchEffectState={turn:'player',cards:[{id:'source',owner:'player',zone:'character',type:'Character',effectSchema:doc},{id:'face-up-top',owner:'player',zone:'life',type:'Character',faceUp:true},{id:'face-down',owner:'player',zone:'life',type:'Character',faceUp:false},{id:'face-up-bottom',owner:'player',zone:'life',type:'Character',faceUp:true},{id:'opponent-face-up',owner:'opponent',zone:'life',type:'Character',faceUp:true}],turnEffects:[],restrictions:[],delayed:[]};
 const result=executeEffectCommands(state,'player',commands,[],'source');assert.equal(result.error,undefined);assert.deepEqual(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='trash').map(card=>card.id),['face-up-top','face-up-bottom']);assert.equal(result.state.cards.find(card=>card.id==='face-down')?.zone,'life');assert.equal(result.state.cards.find(card=>card.id==='opponent-face-up')?.zone,'life');
});
test('OP12-039 readies only a matching Roronoa Zoro Leader',()=>{
 const branch=customEffectBranch('OP12_039_MAIN',0)!;assert.equal(branch[0].kind,'ready');
 const state=()=>({turn:'player' as const,cards:[{id:'event',owner:'player' as const,zone:'hand' as const,type:'Event' as const},{id:'zoro',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,name:'Roronoa Zoro',rested:true},{id:'other',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,name:'Other Leader',rested:true},{id:'character',owner:'player' as const,zone:'character' as const,type:'Character' as const,name:'Roronoa Zoro',rested:true}],turnEffects:[],restrictions:[],delayed:[]});
 const start=beginEffectExecution(state(),'player','event','main',branch.map((value,abilityId)=>({kind:'resolve-action' as const,value,abilityId})));assert(start.requiresSelection,'Main must ask the player to choose the matching Leader');
 const done=advanceEffectExecution(start.execution,{targetId:'zoro'});assert(done.complete&&!done.error,'The Zoro Leader should become active');assert.equal(done.execution.state.cards.find(card=>card.id==='zoro')?.rested,false);assert.equal(done.execution.state.cards.find(card=>card.id==='other')?.rested,true);assert.equal(done.execution.state.cards.find(card=>card.id==='character')?.rested,true);
 const illegal=advanceEffectExecution(start.execution,{targetId:'other'});assert(illegal.error&&!illegal.complete,'A non-Zoro Leader must not be accepted');assert.equal(illegal.execution.state.cards.find(card=>card.id==='other')?.rested,true);
});
test('OP17-116 offers the optional two-DON cost before choosing an opponent Stage',()=>{
 const document=compileEffectDocument({id:'test',code:'OP17-116',name:'Fulgora',color:'Blue',type:'Event',cost:3,power:0,rarity:'C',art:0,effect:"[Main] You may rest 2 of your DON!! cards: K.O. up to 1 of your opponent's Stages.\n[Counter] Up to 1 of your Leader or Characters gains +4000 power during this battle."});
 assert.equal(document.resolver.type,'DSL');
 const commands=resolveEffectTiming(document,'main').commands;
 const state=()=>({turn:'player' as const,cards:[{id:'event',owner:'player' as const,zone:'hand' as const,type:'Event' as const},{id:'don-1',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false},{id:'don-2',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false},{id:'stage',owner:'opponent' as const,zone:'stage' as const,type:'Stage' as const},{id:'character',owner:'opponent' as const,zone:'character' as const,type:'Character' as const}],turnEffects:[],restrictions:[],delayed:[]});
 const start=beginEffectExecution(state(),'player','event','main',commands);assert(start.requiresSelection,'Optional cost must be offered before the K.O.');const declined=advanceEffectExecution(start.execution,{choice:'decline'});assert(declined.complete&&!declined.error,'Declining the optional cost should end the effect');assert(declined.execution.state.cards.every(card=>card.type!=='DON!!'||!card.rested));assert.equal(declined.execution.state.cards.find(card=>card.id==='stage')?.zone,'stage');
 const offered=advanceEffectExecution(start.execution,{choice:'accept'});assert(offered.requiresSelection&&!offered.error,'Accepting must request two DON!! cards');const paid=advanceEffectExecution(offered.execution,{cardIds:['don-1','don-2']});assert(paid.requiresSelection&&!paid.error,'K.O. target must be chosen after payment');assert(paid.execution.state.cards.filter(card=>card.type==='DON!!'&&card.rested).length===2);const ko=advanceEffectExecution(paid.execution,{cardIds:['stage']});assert(ko.complete&&!ko.error,'Selected opponent Stage should be K.O.d');assert.equal(ko.execution.state.cards.find(card=>card.id==='stage')?.zone,'trash');assert.equal(ko.execution.state.cards.find(card=>card.id==='character')?.zone,'character');
 const skipped=advanceEffectExecution(paid.execution,{cardIds:[]});assert(skipped.complete&&!skipped.error,'Up-to-one Stage K.O. may be skipped after paying');assert.equal(skipped.execution.state.cards.find(card=>card.id==='stage')?.zone,'stage');
});
test('KO scenarios exercise cost boundaries, ownership, rested state and optional skip',()=>{
 const effect="[Trigger] K.O. up to 1 of your opponent's rested Characters with a cost of 3 or less.";
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Green',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,6);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const ability of broken.normalized)for(const step of ability.sequence)if(step.type==='RESOLVE'&&step.action.kind==='ko')delete step.action.maxCost;
 assert.throws(()=>cases.find(c=>c.name.endsWith('over-limit'))!.run(broken),/Illegal KO target accepted/);
});
test('draw/discard scenarios verify new-card choices and reject unpaid mandatory discards',()=>{
 const effect='[Trigger] Draw 2 cards and trash 1 card from your hand.';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Blue',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,4);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 broken.normalized[0].sequence.reverse();
 assert.throws(()=>cases[0].run(broken),/Wrong hand before discard/);
});
test('Counter hand-trash payment completes before the selected Leader or Character battle boost',()=>{
 const effect='[Counter] You may trash 1 card from your hand: Up to 1 of your Leader or Character cards gains +3000 power during this battle.';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Counter',color:'Blue',type:'Event',cost:2,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,1);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='power')step.action.amount=2000;
 assert.throws(()=>cases[0].run(broken),/Wrong power boost applied/);
});
test('rested DON grant chooses one recipient before legal rested DON cards',()=>{
 const effect='[Trigger] Give up to 2 rested DON!! cards to your Leader or 1 of your Characters.';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Grant',color:'Purple',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,1);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);for(const step of broken.normalized[0].sequence)if(step.type==='RESOLVE'&&step.action.kind==='attach-don')step.action.rested=false;
 assert.throws(()=>cases[0].run(broken),/Active DON!! was accepted/);
});
test('DON!! timing qualifier belongs to the following ability, not the preceding On Play',()=>{
 const effect='[On Play] Give up to 1 rested DON!! card to your Leader or 1 of your Characters. [DON!!×1] [When Attacking] Draw 1 card.';
 const document=compileEffectDocument({id:'test',code:'P-139',name:'Nami',color:'Green',type:'Character',cost:3,power:4000,rarity:'P',art:0,effect});
 const onPlay=document.normalized.find(window=>window.timing==='on-play')!,attacking=document.normalized.find(window=>window.timing==='when-attacking')!;
 assert.deepEqual(onPlay.sequence.filter(step=>step.type==='RESOLVE').map(step=>step.action.kind),['attach-don']);
 assert.ok(!onPlay.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='attach-don-required'));
 assert.ok(document.ast.find(window=>window.trigger==='when-attacking')?.actions.some(action=>action.kind==='attach-don-required'&&action.amount===1));
 assert.ok(!attacking.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='attach-don-required'));
 assert.ok(attacking.sequence.some(step=>step.type==='RESOLVE'&&step.action.kind==='draw'&&step.action.amount===1));
 const state=(attached=false)=>({turn:'player' as const,cards:[{id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:document},{id:'top',owner:'player' as const,zone:'deck' as const,type:'Character' as const},...(attached?[{id:'attached',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'source'}]:[])],turnEffects:[],restrictions:[],delayed:[]});
 const onPlayExecution=beginEffectExecution(state(),'player','source','on-play',resolveEffectTiming(document,'on-play').commands);
 assert.equal(onPlayExecution.requiresSelection,'Select your Leader or Character.');
 const gatedAttack=beginEffectExecution(state(),'player','source','when-attacking',resolveEffectTiming(document,'when-attacking').commands);
 assert.ok(gatedAttack.complete&&!gatedAttack.error,'When Attacking draw incorrectly ran without its attached DON!! prerequisite');
 const paidAttack=beginEffectExecution(state(true),'player','source','when-attacking',resolveEffectTiming(document,'when-attacking').commands);
 assert.ok(paidAttack.complete&&!paidAttack.error&&paidAttack.execution.state.cards.some(card=>card.zone==='hand'),'Attached DON!! did not unlock the When Attacking draw');
});
test('mixed-text Blocker cards get their own combat scenarios without claiming their other effects',()=>{
 const effect='[Blocker]\n[On Play] Draw 1 card.';
 const card={id:'test',code:'TEST-BLOCKER',name:'Blocker',color:'Black',type:'Character' as const,cost:3,power:4000,rarity:'C',art:0,effect};
 const document=compileEffectDocument(card),cases=scenarios({code:card.code,effect_text:effect} as Parameters<typeof scenarios>[0]);
 const blocker=cases.filter(scenario=>scenario.name.startsWith('keyword Blocker:')&&!scenario.name.endsWith('schema isolation'));
 const isolation=cases.find(scenario=>scenario.name.endsWith('schema isolation'))!;
 assert.equal(blocker.length,5);assert.ok(cases.some(scenario=>scenario.name.startsWith('on-play:')));
 for(const scenario of blocker)scenario.run(document);
 isolation.run(document);
 const stale=structuredClone(document);stale.ast=[{rawText:effect,trigger:'on-play',conditions:[],costs:[],actions:[{kind:'blocker'},{kind:'draw',amount:1}]}];
 for(const scenario of blocker)scenario.run(stale);
 assert.throws(()=>isolation.run(stale),/isolated from the card’s other ability text/);
});
test('deck-mill scenarios take exactly the printed number of top cards in On Play and On K.O. windows',()=>{
 const effect='[On Play] Trash 3 cards from the top of your deck. [On K.O.] Trash 1 card from the top of your deck.';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Black',type:'Character',cost:3,power:4000,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='trash')step.action.amount++;
 assert.throws(()=>cases[0].run(broken),/Effect did not trash exactly the top cards/);
});
test('same-line timing windows retain their own complete scenario text',()=>{
 const effect="[Main] K.O. up to 1 of your opponent's Characters with a cost of 1 or less. [Trigger] Draw 2 cards and trash 1 card from your hand.";
 const cases=familyScenarios(effect);
 assert.equal(cases.filter(c=>c.name.startsWith('main:')).length,5);
 assert.equal(cases.filter(c=>c.name.startsWith('trigger:')).length,4);
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Black',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 for(const scenario of cases)scenario.run(document);
});
test('rest scenarios reject own cards, Leaders and over-cost targets without moving cards',()=>{
 const effect="[Trigger] Rest up to 1 of your opponent's Characters with a cost of 3 or less.";
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Green',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,5);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const ability of broken.normalized)for(const step of ability.sequence)if(step.type==='RESOLVE'&&step.action.kind==='rest')delete step.action.maxCost;
 assert.throws(()=>cases.find(c=>c.name.endsWith('over-limit'))!.run(broken),/Illegal rest target accepted/);
});
test('power choices support Characters and Leaders, optional skip, and printed expiry',()=>{
 for(const duration of ['battle','turn']){
  const effect=`[Counter] Up to 1 of your Leader or Character cards gains +3000 power during this ${duration}.`;
  const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Red',type:'Event',cost:1,power:0,rarity:'C',art:0,effect});
  const cases=familyScenarios(effect);assert.equal(cases.length,5);
  for(const scenario of cases)scenario.run(document);
 }
});
test('family coverage retains DON and turn qualifiers rather than treating effects as unconditional',()=>{
 assert.equal(familyScenarios('[DON!!×1] [When Attacking] Draw 1 card.').length,0);
 assert.equal(familyScenarios('[Your Turn] [On Play] Draw 1 card.').length,0);
});
test('cost reduction selects only opposing Characters, allows skipping and expires',()=>{
 const effect="[On Play] Give up to 1 of your opponent's Characters -2 cost during this turn.";
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Black',type:'Character',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,4);
 for(const scenario of cases)scenario.run(document);
});
test('returning an opponent Character prompts once, detaches DON and allows zero targets',()=>{
 const effect="[On K.O.] Return up to 1 of your opponent's Characters with a cost of 4 or less to the owner's hand.";
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Blue',type:'Character',cost:1,power:0,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,5);
 for(const scenario of cases)scenario.run(document);
 assert.equal(document.ast[0].actions.filter(a=>a.kind==='return-to-hand').length,1);
});
test('effectless-card coverage rejects phantom commands in stored schemas',()=>{
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Blue',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect:''});
 const cases=familyScenarios('');assert.equal(cases.length,1);cases[0].run(document);
 document.normalized[0].sequence.push({type:'RESOLVE',action:{kind:'draw',amount:1}});
 assert.throws(()=>cases[0].run(document),/Unexpected effect/);
});
test('printed Blocker schema supports legal blocking and respects negation',()=>{
 const effect='[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Green',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect});
 const cases=scenarios({code:'TEST',effect_text:effect} as Parameters<typeof scenarios>[0]);assert.equal(cases.length,8);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);broken.ast[0].actions=[];broken.rawEffectText='';
 assert.throws(()=>cases[0].run(broken),/Active printed Blocker rejected/);
});
test('DON schemas contribute power only to their own attached card on their own turn',()=>{
 const effect='Your Turn +1000';
 const document=compileEffectDocument({id:'test',code:'DON_TEST',name:'DON!!',color:'',type:'Character',cost:0,power:0,rarity:'',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,6);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);broken.ast[0].actions=[];
 assert.throws(()=>cases[0].run(broken),/Incorrect turn\/attachment DON power/);
});
test('ready-DON scenarios reject attachments, enemy cards and excessive selection',()=>{
 const effect='[End of Your Turn] Set up to 2 of your DON!! cards as active.';
 const document=compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Green',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect});
 const cases=familyScenarios(effect);assert.equal(cases.length,7);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const step of broken.normalized[0].sequence)if(step.type==='RESOLVE'&&step.action.kind==='ready')step.action.scope='own-character';
 assert.throws(()=>cases[0].run(broken),/Legal ready choice failed/);
});
