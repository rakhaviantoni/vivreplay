import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument,parseEffects,type EffectAction} from '../packages/domain/effect-rules';
import type {Card} from '../packages/card-data/catalog';
import {isPlayableSet} from '../packages/domain/release-availability';
import {executeEffectCommands,resolveEffectTiming} from '../packages/domain/effect-runtime';
import {beginEffectExecution} from '../packages/domain/effect-controller';
import {applyEffectAction,expireEffectModifiers,hasCardKeyword,type MatchEffectState} from '../packages/domain/match-effect-state';

const card=(effect:string)=>({id:'effect-test',code:'TEST-001',name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect} as Card);

test('DON!! prerequisites gate only their own timing ability',()=>{
 const state:MatchEffectState={turn:'player',cards:[{id:'gated-top',owner:'player',zone:'deck',type:'Character'},{id:'don',owner:'player',zone:'don-deck',type:'DON!!'}],turnEffects:[],restrictions:[],delayed:[]};
 const commands=[
  {abilityId:0,requiredAttachedDon:1,kind:'resolve-action' as const,value:{kind:'draw' as const,amount:1}},
  {abilityId:1,requiredAttachedDon:0,kind:'resolve-action' as const,value:{kind:'add-don' as const,amount:1,rested:false}},
 ];
 const gated=beginEffectExecution(state,'player','source','main',commands);
 assert.equal(gated.complete,true);assert.deepEqual(gated.execution.disabledAbilityIds,[0]);
 assert.equal(gated.execution.state.cards.find(item=>item.id==='gated-top')?.zone,'deck');
 assert.equal(gated.execution.state.cards.find(item=>item.id==='don')?.zone,'cost-area');
 const direct=executeEffectCommands(state,'player',commands,[],'source');assert.equal(direct.state.cards.find(item=>item.id==='gated-top')?.zone,'deck');assert.equal(direct.state.cards.find(item=>item.id==='don')?.zone,'cost-area');
 const paid=beginEffectExecution({...state,cards:[...state.cards,{id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'source'}]},'player','source','main',commands);
 assert.equal(paid.execution.disabledAbilityIds?.length,0);assert.equal(paid.execution.state.cards.find(item=>item.id==='gated-top')?.zone,'hand');assert.equal(paid.execution.state.cards.find(item=>item.id==='don')?.zone,'cost-area');
});

test('On K.O. can return its source from Trash to hand',()=>{
 const document=compileEffectDocument(card('[On K.O.] Add this Character card from your trash to your hand.'));
 const commands=resolveEffectTiming(document,'on-ko').commands;
 assert.equal(commands.length,1);assert.equal(commands[0].value.kind,'return-source-to-hand');
 const state:MatchEffectState={turn:'player',cards:[{id:'source',owner:'player',zone:'trash',type:'Character'}],turnEffects:[],restrictions:[],delayed:[]};
 const result=beginEffectExecution(state,'player','source','on-ko',commands);
 assert.equal(result.complete,true);assert.equal(result.execution.state.cards[0].zone,'hand');
 const invalid=applyEffectAction({...state,cards:[{...state.cards[0],zone:'character'}]},'player',commands[0].value as Extract<EffectAction,{kind:'return-source-to-hand'}>,{sourceCardId:'source'});
 assert.match(invalid.error??'',/Life or Trash/);
});

test('opponent Rest distinguishes exact cost from cost-or-less and enforces both in play',()=>{
 const exact=parseEffects(card("[On Play] Rest up to 1 of your opponent's Characters with a cost of 0."))[0].actions.find(action=>action.kind==='rest');
 assert.deepEqual(exact,{kind:'rest',scope:'opponent-character',exactCost:0,selection:{min:0,max:1}});
 const state:MatchEffectState={turn:'player',cards:[{id:'zero',owner:'opponent',zone:'character',type:'Character',cost:0},{id:'one',owner:'opponent',zone:'character',type:'Character',cost:1}],turnEffects:[],restrictions:[],delayed:[]};
 const accepted=applyEffectAction(state,'player',exact!,{cardIds:['zero']});assert.equal(accepted.error,undefined);assert.equal(accepted.state.cards.find(item=>item.id==='zero')?.rested,true);
 const rejected=applyEffectAction(state,'player',exact!,{cardIds:['one']});assert.ok(rejected.error);assert.equal(rejected.state.cards.find(item=>item.id==='one')?.rested,undefined);
 const bounded=parseEffects(card("[On Play] Rest up to 1 of your opponent's Characters with a cost of 1 or less."))[0].actions.find(action=>action.kind==='rest');
 assert.deepEqual(bounded,{kind:'rest',scope:'opponent-character',maxCost:1,selection:{min:0,max:1}});
});

test('resting a Stage and turning Life face-up are both paid costs before its effect',()=>{
 const document=compileEffectDocument(card('[Activate: Main] You may rest this Stage and turn 1 card from the top of your Life cards face-up: Up to 1 of your Characters gains +1000 power until the end of your opponent\'s next turn.'));
 const ability=document.ast.find(effect=>effect.trigger==='activate-main');assert.ok(ability);
 assert.deepEqual(ability?.costs.map(cost=>cost.kind),['rest','turn-life']);assert.equal(ability?.actions.some(action=>action.kind==='rest'&&action.scope==='self'),false);
 const sequence=document.normalized.find(effect=>effect.timing==='activate-main')?.sequence??[];assert.deepEqual(sequence.map(step=>step.type),['PAY_COST','PAY_COST','RESOLVE']);
});

test('opponent Rest resolves its cost cap from the current Life count',()=>{
 const action=parseEffects(card("[On Play] Rest up to 1 of your opponent's Characters with a cost equal to or less than the number of your opponent's Life cards."))[0].actions.find(effect=>effect.kind==='rest');
 assert.deepEqual(action,{kind:'rest',scope:'opponent-character',maxCostFromLife:'opponent',selection:{min:0,max:1}});
 const state:MatchEffectState={turn:'player',cards:[{id:'life-1',owner:'opponent',zone:'life',type:'Character'},{id:'life-2',owner:'opponent',zone:'life',type:'Character'},{id:'cost-2',owner:'opponent',zone:'character',type:'Character',cost:2},{id:'cost-3',owner:'opponent',zone:'character',type:'Character',cost:3}],turnEffects:[],restrictions:[],delayed:[]};
 const accepted=applyEffectAction(state,'player',action!,{cardIds:['cost-2']});assert.equal(accepted.error,undefined);assert.equal(accepted.state.cards.find(item=>item.id==='cost-2')?.rested,true);
 const rejected=applyEffectAction(state,'player',action!,{cardIds:['cost-3']});assert.ok(rejected.error);assert.equal(rejected.state.cards.find(item=>item.id==='cost-3')?.rested,undefined);
 const fewerLives={...state,cards:state.cards.filter(item=>item.id!=='life-2')};const stale=applyEffectAction(fewerLives,'player',action!,{cardIds:['cost-2']});assert.ok(stale.error);assert.equal(stale.state.cards.find(item=>item.id==='cost-2')?.rested,undefined);
});

test('opponent power effects retain their printed target count and Leader-or-Character scope',()=>{
 const characters=compileEffectDocument(card("[When Attacking] Give up to 1 of your opponent's Characters 1000 power during this turn.")).ast.find(ability=>ability.trigger==='when-attacking')!.actions[0];
 assert.deepEqual(characters,{kind:'power',amount:1000,until:'turn-end',selection:{min:0,max:1},target:'opponent-character'});
 const allCards=compileEffectDocument(card("[Counter] Give up to 1 of your opponent's Leader or Character cards -2000 power during this turn.")).ast.find(ability=>ability.trigger==='counter')!.actions[0];
 assert.deepEqual(allCards,{kind:'power',amount:-2000,until:'turn-end',selection:{min:0,max:1},target:'opponent-card'});
 const state:MatchEffectState={turn:'player',cards:[{id:'leader',owner:'opponent',zone:'leader',type:'Leader',power:5000},{id:'character',owner:'opponent',zone:'character',type:'Character',power:3000},{id:'other',owner:'opponent',zone:'character',type:'Character',power:2000},{id:'own',owner:'player',zone:'character',type:'Character',power:2000}],turnEffects:[],restrictions:[],delayed:[]};
 const prompt=applyEffectAction(state,'player',allCards);assert.ok(prompt.requiresSelection);
 const valid=applyEffectAction(state,'player',allCards,{cardIds:['leader']});assert.equal(valid.error,undefined);assert.equal(valid.state.cards.find(item=>item.id==='leader')?.powerModifier,-2000);
 const tooMany=applyEffectAction(state,'player',allCards,{cardIds:['leader','character']});assert.ok(tooMany.error);assert.ok(state.cards.every(item=>!item.powerModifier));
 const own=applyEffectAction(state,'player',allCards,{cardIds:['own']});assert.ok(own.error);
});

test('numbered optional Leader-rest wording remains an Activate: Main payment',()=>{
 const effect=parseEffects(card("[Activate:Main] You may rest your 1 Leader: Give up to 1 of your opponent's Characters -4 cost during this turn."))[0];
 assert.ok(effect.costs.some(cost=>cost.kind==='rest'&&cost.scope==='leader'&&cost.amount===1&&cost.optional));
 assert.ok(effect.actions.some(action=>action.kind==='cost'&&action.amount===-4&&action.target==='opponent-character'));
});

test('opponent Rest target filters do not capture an earlier payment cost',()=>{
 const effect=parseEffects(card("[Activate: Main] You may place 1 Stage with a cost of 1 at the bottom of the owner's deck: Rest up to 1 of your opponent's Characters with a cost of 4 or less."))[0];
 assert.ok(effect.actions.some(action=>action.kind==='rest'&&action.scope==='opponent-character'&&action.maxCost===4&&action.exactCost===undefined));
});

test('printed DON!! reminder text becomes a rest payment before the effect',()=>{
 const document=compileEffectDocument(card("[On Your Opponent's Attack] (2) (You may rest the specified number of DON!! cards in your cost area.): Rest up to 1 of your opponent's DON!! cards."));
 const ability=document.ast.find(effect=>effect.trigger==='opponent-attack');assert.ok(ability?.costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'&&cost.amount===2&&cost.optional));
 const sequence=document.normalized.find(effect=>effect.timing==='opponent-attack')?.sequence??[];assert.equal(sequence[0]?.type,'PAY_COST');assert.equal(sequence[1]?.type,'RESOLVE');
});

test('opponent-attack activation wording is not parsed as a continuous aura',()=>{
 const document=compileEffectDocument(card("[Once Per Turn] This effect can be activated when your opponent attacks. Give up to 1 of your opponent's Leader or Character cards 1000 power during this turn."));
 const ability=document.ast.find(effect=>effect.trigger==='opponent-attack');assert.ok(ability);
 assert.equal(document.ast.some(effect=>effect.trigger==='continuous'),false);
 assert.equal(ability?.actions.length,1);assert.equal(ability?.actions[0].kind,'power');
 assert.equal(ability?.actions[0].kind==='power'&&ability.actions[0].target,'opponent-card');
 assert.equal(ability?.actions[0].kind==='power'&&ability.actions[0].selection?.max,1);
 assert.equal(document.normalized.find(effect=>effect.timing==='opponent-attack')?.sequence.length,1);
});

test('positive DON!! return reminder becomes a mandatory payment before resolution',()=>{
 const document=compileEffectDocument(card('[On Play] DON!! 1 (You may return the specified number of DON!! cards from your field to your DON!! deck.): Draw 1 card.'));
 const ability=document.ast.find(effect=>effect.trigger==='on-play');assert.ok(ability?.costs.some(cost=>cost.kind==='return-don'&&cost.amount===1&&!cost.optional));
 const sequence=document.normalized.find(effect=>effect.timing==='on-play')?.sequence??[];assert.equal(sequence[0]?.type,'PAY_COST');assert.equal(sequence[0]?.type==='PAY_COST'&&sequence[0].cost.kind==='return-don',true);assert.equal(sequence[1]?.type,'RESOLVE');
});

test('DON!!-gated Blocker reminder is a keyword rule, not a second rest action',()=>{
 const document=compileEffectDocument(card('[DON!! x1] This Character gains [Blocker].\n(After your opponent declares an attack, you may rest this card to make it the new target of the attack.)\n[On K.O.] Play up to 1 Character card with a type including "CP" and a cost of 4 or less from your trash rested.'));
 const passive=document.ast.find(ability=>ability.trigger==='unknown'),ko=document.ast.find(ability=>ability.trigger==='on-ko');assert.ok(passive);assert.deepEqual(passive.actions.map(action=>action.kind),['attach-don-required','grant-keyword']);assert.equal(ko?.actions[0]?.kind,'play');
 const cardInPlay={id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:document};const state:MatchEffectState={turn:'player',cards:[cardInPlay],turnEffects:[],restrictions:[],delayed:[]};assert.equal(hasCardKeyword(cardInPlay,'blocker',state),false);
 state.cards.push({id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'source'});assert.equal(hasCardKeyword(cardInPlay,'blocker',state),true);
});

test('legacy bare Rush and Blocker actions still honor attached-DON gates',()=>{
 for(const keyword of ['rush','blocker'] as const){
  const document=compileEffectDocument(card(`[DON!! x1] This Character gains [${keyword==='rush'?'Rush':'Blocker'}].`));
  const legacy=structuredClone(document);const ability=legacy.ast.find(effect=>effect.trigger==='unknown');assert.ok(ability);ability!.actions=ability!.actions.filter(action=>action.kind!=='grant-keyword');ability!.actions.push({kind:keyword});
  const source={id:`${keyword}-source`,owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:legacy};const state:MatchEffectState={turn:'player',cards:[source],turnEffects:[],restrictions:[],delayed:[]};assert.equal(hasCardKeyword(source,keyword,state),false,`${keyword} activated without its required attached DON!!`);
  state.cards.push({id:`${keyword}-don`,owner:'player',zone:'cost-area',type:'DON!!',attachedTo:source.id});assert.equal(hasCardKeyword(source,keyword,state),true,`${keyword} stayed disabled after its required attached DON!!`);
 }
});

test('resting this Leader is paid as an Activate: Main cost',()=>{
 const document=compileEffectDocument(card("[Activate: Main] You may rest this Leader: Give up to 1 of your opponent's Characters 2000 power during this turn. Then, up to 1 of your Characters without a [When Attacking] effect gains [Rush] during this turn."));
 const ability=document.ast.find(effect=>effect.trigger==='activate-main');assert.ok(ability?.costs.some(cost=>cost.kind==='rest'&&cost.scope==='self'&&cost.amount===1&&cost.optional));
 assert.equal(ability?.actions.length,2);const sequence=document.normalized.find(effect=>effect.timing==='activate-main')?.sequence??[];assert.equal(sequence[0]?.type,'PAY_COST');assert.equal(sequence[1]?.type,'RESOLVE');
});

test('EB01-059 trashes only Life above one and uses both Life totals for Trigger K.O.',()=>{
 const document=compileEffectDocument(card("[Main] K.O. up to 1 of your opponent's Characters. Then, trash cards from the top of your Life cards until you have 1 Life card.[Trigger] K.O. up to 1 of your opponent's Characters with a cost equal to or less than the total of your and your opponent's Life cards."));
 const main=document.ast.find(effect=>effect.trigger==='main')!,ko=main.actions[0],life=main.actions[1];
 let state:MatchEffectState={turn:'player',cards:[{id:'target',owner:'opponent',zone:'character',type:'Character',cost:3},...Array.from({length:4},(_,index)=>({id:`life-${index}`,owner:'player' as const,zone:'life' as const,type:'Character' as const}))],turnEffects:[],restrictions:[],delayed:[]};
 state=applyEffectAction(state,'player',ko,{targetId:'target'}).state;state=applyEffectAction(state,'player',life).state;assert.equal(state.cards.filter(item=>item.owner==='player'&&item.zone==='life').length,1);assert.equal(state.cards.filter(item=>item.owner==='player'&&item.zone==='trash').length,3);
 const trigger=document.ast.find(effect=>effect.trigger==='trigger')!.actions[0];assert.equal(trigger.kind,'ko');state={turn:'player',cards:[...Array.from({length:2},(_,index)=>({id:`own-${index}`,owner:'player' as const,zone:'life' as const,type:'Character' as const})),...Array.from({length:3},(_,index)=>({id:`enemy-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const})),{id:'five',owner:'opponent',zone:'character',type:'Character',cost:5},{id:'six',owner:'opponent',zone:'character',type:'Character',cost:6}],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(applyEffectAction(state,'player',trigger,{targetId:'five'}).state.cards.find(item=>item.id==='five')?.zone,'trash');assert.ok(applyEffectAction(state,'player',trigger,{targetId:'six'}).error);
});

test('OP14-048 resolves opposing return before trashing every card in hand',()=>{
 const document=compileEffectDocument(card("[On Play] Return up to 1 of your opponent's Characters to the owner's hand. Then, trash all cards from your hand.")),actions=document.ast.find(effect=>effect.trigger==='on-play')!.actions;
 assert.equal(actions.length,2);assert.equal(actions[1].kind,'trash');if(actions[1].kind==='trash')assert.equal(actions[1].all,true);
 const state:MatchEffectState={turn:'player',cards:[{id:'target',owner:'opponent',zone:'character',type:'Character',cost:4},{id:'hand-a',owner:'player',zone:'hand',type:'Character'},{id:'hand-b',owner:'player',zone:'hand',type:'Event'},{id:'deck-card',owner:'player',zone:'deck',type:'Character'}],turnEffects:[],restrictions:[],delayed:[]};
 const returned=applyEffectAction(state,'player',actions[0],{targetId:'target'});assert.equal(returned.state.cards.find(item=>item.id==='target')?.zone,'hand');const trashed=applyEffectAction(returned.state,'player',actions[1]);assert.equal(trashed.state.cards.filter(item=>item.owner==='player'&&item.zone==='hand').length,0);assert.equal(trashed.state.cards.find(item=>item.id==='deck-card')?.zone,'deck');
});

test('trait-restricted K.O. rejects a wrong trait before applying its cost cap',()=>{
 const action=parseEffects(card('[Main] K.O. up to 1 of your opponent\'s "The Seven Warlords of the Sea" type Characters with a cost of 8 or less.'))[0].actions[0];assert.equal(action.kind,'ko');
 const state=(cost:number,traits:string[]):MatchEffectState=>({turn:'player',cards:[{id:'target',owner:'opponent',zone:'character',type:'Character',cost,traits}],turnEffects:[],restrictions:[],delayed:[]});
 const valid=applyEffectAction(state(8,['The Seven Warlords of the Sea']),'player',action,{targetId:'target'});assert.equal(valid.state.cards[0].zone,'trash');
 const wrongTrait=applyEffectAction(state(2,['Straw Hat Crew']),'player',action,{targetId:'target'});assert.ok(wrongTrait.error);assert.equal(wrongTrait.state.cards[0].zone,'character');
 const overCost=applyEffectAction(state(9,['The Seven Warlords of the Sea']),'player',action,{targetId:'target'});assert.ok(overCost.error);assert.equal(overCost.state.cards[0].zone,'character');
});

test('activated self-trash is a payment and the power reduction is the resolving effect',()=>{
 const effect=parseEffects(card('[Activate: Main] You may trash this Character: Give up to 1 of your opponent\'s 0 cost Characters -3000 power during this turn.'))[0];
 assert.ok(effect.costs.some(cost=>cost.kind==='trash'&&cost.scope==='self'));
 assert.ok(effect.actions.some(action=>action.kind==='power'&&action.amount===-3000&&action.target==='opponent-character'));
 assert.ok(!effect.actions.some(action=>action.kind==='trash'&&action.scope==='self'));
});

test('targeted removal preserves its printed restrictions',()=>{
 const actions=parseEffects(card('[On Play] K.O. up to 1 of your opponent\'s rested Characters with a cost of 4 or less.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='ko'),{kind:'ko',maxCost:4,maxPower:undefined,restedOnly:true,selection:{min:0,max:1}});
});

test('K.O. with an exact printed cost rejects Characters above or below that cost',()=>{
 const action=parseEffects(card('[On Play] K.O. up to 1 of your opponent\'s Characters with a cost of 0.'))[0].actions.find(action=>action.kind==='ko')!;
 assert.deepEqual(action,{kind:'ko',exactCost:0,maxPower:undefined,restedOnly:false,selection:{min:0,max:1}});
 const state:MatchEffectState={turn:'player',cards:[{id:'zero',owner:'opponent',zone:'character',type:'Character',cost:0},{id:'one',owner:'opponent',zone:'character',type:'Character',cost:1}],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(applyEffectAction(state,'player',action,{targetId:'zero'}).error,undefined);
 assert.match(applyEffectAction(state,'player',action,{targetId:'one'}).error??'',/outside the printed effect target/);
});

test('search, DON, and zone movement effects become reusable actions',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; add up to 1 DON!! card from your DON!! deck and rest it. Then, trash 2 cards from the top of your deck.'))[0].actions;
 assert.ok(actions.some(action=>action.kind==='search'&&action.amount===5));
 assert.ok(actions.some(action=>action.kind==='add-don'&&action.amount===1&&action.rested));
 assert.ok(actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===2));
});

test('search preserves the printed type and trait restriction',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type Character card and add it to your hand. Place the rest at the bottom of your deck in any order.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='search'),{kind:'search',amount:5,choose:1,destination:'deck-bottom',remainderPosition:'bottom',remainderOrder:true,cardType:'Character',trait:'Straw Hat Crew'});
});

test('power gains preserve a trait restriction across Leader and Character recipients',()=>{
 const action=parseEffects(card('[On Play] Up to 1 of your [Land of Wano] type Leader or Character cards gains +1000 power during this turn.'))[0].actions.find(action=>action.kind==='power');
 assert.deepEqual(action,{kind:'power',amount:1000,until:'turn-end',selection:{min:0,max:1},trait:'Land of Wano',target:'own-card'});
});

test('Magura preserves and enforces its red exact-cost power target',()=>{
 const action=parseEffects(card('[On Play] Up to 1 of your red Characters with a cost of 1 gains +3000 power during this turn.'))[0].actions.find(action=>action.kind==='power');
 assert.deepEqual(action,{kind:'power',amount:3000,until:'turn-end',selection:{min:0,max:1},color:'red',exactCost:1,target:'own-character'});
 assert.ok(action&&action.kind==='power');
 const state:MatchEffectState={turn:'player',cards:[{id:'red-one',owner:'player',zone:'character',type:'Character',color:'Red',cost:1},{id:'blue-one',owner:'player',zone:'character',type:'Character',color:'Blue',cost:1},{id:'red-two',owner:'player',zone:'character',type:'Character',color:'Red',cost:2}],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(applyEffectAction(state,'player',action,{targetId:'red-one'}).error,undefined);
 assert.match(applyEffectAction(state,'player',action,{targetId:'blue-one'}).error??'',/outside the printed effect target/);
 assert.match(applyEffectAction(state,'player',action,{targetId:'red-two'}).error??'',/outside the printed effect target/);
});

test('Double Attack grants preserve and enforce red exact-cost eligibility',()=>{
 const action=parseEffects(card('[On Play] Up to 1 of your red Characters with a cost of 1 gains [Double Attack] during this turn.'))[0].actions.find(action=>action.kind==='grant-keyword');
 assert.deepEqual(action,{kind:'grant-keyword',keyword:'double-attack',until:'turn-end',scope:'own-character',selection:{min:0,max:1},color:'red',exactCost:1});
 assert.ok(action&&action.kind==='grant-keyword');
 const state:MatchEffectState={turn:'player',cards:[{id:'red-one',owner:'player',zone:'character',type:'Character',color:'Red',cost:1},{id:'blue-one',owner:'player',zone:'character',type:'Character',color:'Blue',cost:1},{id:'red-two',owner:'player',zone:'character',type:'Character',color:'Red',cost:2}],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(applyEffectAction(state,'player',action,{targetId:'red-one'}).error,undefined);
 assert.match(applyEffectAction(state,'player',action,{targetId:'blue-one'}).error??'',/outside the printed effect target/);
 assert.match(applyEffectAction(state,'player',action,{targetId:'red-two'}).error??'',/outside the printed effect target/);
});

test('next-Refresh restrictions preserve all, rested-only, and cost filters',()=>{
 const document=compileEffectDocument(card("[Main] All of your opponent's rested Characters with a cost of 7 or less will not become active in your opponent's next Refresh Phase."));
 const action=document.ast[0].actions[0];
 assert.deepEqual(action,{kind:'prevent-ready',scope:'opponent-character',until:'opponent-next-refresh',maxCost:7,restedOnly:true,selection:{min:0,max:'all'}});
 const state:MatchEffectState={turn:'player',cards:[{id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:7,rested:true},{id:'active',owner:'opponent',zone:'character',type:'Character',cost:7,rested:false},{id:'over-cost',owner:'opponent',zone:'character',type:'Character',cost:8,rested:true},{id:'own',owner:'player',zone:'character',type:'Character',cost:7,rested:true}],turnEffects:[],restrictions:[],delayed:[]};
 const resolved=applyEffectAction(state,'player',action,{cardIds:[]});
 assert.equal(resolved.error,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='eligible')?.cannotReady,true);
 assert.equal(resolved.state.cards.find(item=>item.id==='active')?.cannotReady,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='over-cost')?.cannotReady,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='own')?.cannotReady,undefined);
});

import {createMatchSnapshot,rulesetForDate,type Ruleset} from '../packages/domain/match-ruleset';
test('a match keeps the ruleset in force on its start date',()=>{
 const rulesets:Ruleset[]=[
  {id:'old',code:'opcg-2026-01',rulesRevision:'1',effectiveFrom:'2026-01-01',effectiveTo:'2026-05-31',status:'retired',rules:{}},
  {id:'current',code:'opcg-2026-06',rulesRevision:'2',effectiveFrom:'2026-06-01',status:'published',rules:{}},
 ];
 const ruleset=rulesetForDate(rulesets,'2026-09-24');
 assert.equal(ruleset?.id,'current');
 assert.equal(createMatchSnapshot(ruleset!,['a'],['b']).rulesetId,'current');
});

test('trigger-card hand costs remain explicit before an On Play draw resolves',()=>{
 const effect=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'))[0];
 assert.ok(effect.costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand'&&cost.amount===1&&cost.requiresTrigger));
 assert.ok(effect.actions.some(action=>action.kind==='draw'&&action.amount===3));
 assert.ok(!effect.actions.some(action=>action.kind==='trash'&&action.scope==='hand'));
});


test('separate printed triggers become separate executable effect schemas',()=>{
 const effects=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.\n[Trigger] Look at 5 cards from the top of your deck; reveal up to 1 {Big Mom Pirates} type card and add it to your hand. Then, place the rest at the bottom of your deck in any order.'));
 assert.equal(effects.length,2);
 assert.equal(effects[0].trigger,'on-play');
 assert.ok(effects[0].costs.some(cost=>cost.kind==='trash'&&cost.requiresTrigger));
 assert.ok(effects[0].actions.some(action=>action.kind==='draw'&&action.amount===3));
 assert.equal(effects[1].trigger,'trigger');
 assert.ok(effects[1].actions.some(action=>action.kind==='search'&&action.trait==='Big Mom Pirates'));
});

test('life placement, DON payments, and effect negation preserve their targets',()=>{
 const actions=parseEffects(card('[Main] You may rest 2 of your DON!! cards: Negate the effect of up to 1 of your opponent\'s Characters with a cost of 5 or less during this turn. Add up to 1 Character with a cost of 9 or less to the top or bottom of the owner\'s Life cards face-down.'))[0].actions;
 const costs=parseEffects(card('[Main] You may rest 2 of your DON!! cards: Negate the effect of up to 1 of your opponent\'s Characters with a cost of 5 or less during this turn.'))[0].costs;
 assert.ok(costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'&&cost.amount===2));
 assert.ok(actions.some(action=>action.kind==='negate-effect'&&action.scope==='opponent-character'));
 assert.ok(actions.some(action=>action.kind==='move-to-life'&&action.scope==='own'&&action.position==='choice'&&action.faceUp===false));
});

test('persistent effect documents preserve the four parser layers and custom escape hatch',()=>{
 const document=compileEffectDocument(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'));
 assert.equal(document.parserVersion,'0.6.0');
 assert.equal(document.resolver.type,'DSL');
 assert.equal(document.implementationStatus,'PARSED');
 assert.equal(document.ast[0].rawText,document.rawEffectText);
 assert.deepEqual(document.normalized[0].sequence.map(step=>step.type),['PAY_COST','RESOLVE']);
 const custom=compileEffectDocument(card('[On Play] Choose one:\n• Do something uniquely worded.'));
 assert.equal(custom.resolver.type,'CUSTOM');
 assert.equal(custom.implementationStatus,'RAW');
 assert.match(custom.resolver.type==='CUSTOM'?custom.resolver.handler:'',/^TEST_001_ON_PLAY$/);
});

test('incomplete releases stay outside player-facing card pools',()=>{
 assert.equal(isPlayableSet('OP19'),false);
 assert.equal(isPlayableSet('OP-19'),false);
 assert.equal(isPlayableSet('EB06'),false);
 assert.equal(isPlayableSet('EB-06'),false);
 assert.equal(isPlayableSet('OP18'),true);
 assert.equal(isPlayableSet('OP-18'),true);
 assert.equal(isPlayableSet('EB05'),true);
 assert.equal(isPlayableSet('EB-05'),true);
 assert.equal(isPlayableSet('OP17'),true);
});

test('runtime preserves cost before the ordered effect actions',()=>{
 const document=compileEffectDocument(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'));
 const resolved=resolveEffectTiming(document,'on-play');
 assert.equal(resolved.status,'ready');
 assert.deepEqual(resolved.commands.map(command=>command.kind),['pay-cost','resolve-action']);
});

test('Black Trash play retains color, trait, cost, rest, and self-exclusion restrictions',()=>{
 const effects=parseEffects(card('[On Play] Play up to 1 black {Thriller Bark Pirates} type Character card with a cost of 2 or less other than [Perona] from your trash rested.'))[0].actions;
 const play=effects.find((action):action is Extract<typeof action,{kind:'play'}>=>action.kind==='play');
 assert.deepEqual(play,{kind:'play',source:'trash',amount:1,maxCost:2,rested:true,cardType:'Character',trait:'Thriller Bark Pirates',color:'black',excludeName:'Perona'});
});

test('deck plays retain exact cost, color, trait, and shuffle as ordered actions',()=>{
 const parsed=parseEffects(card('[On K.O.] Play up to 1 green {Land of Wano} type Character card with a cost of 3 from your deck. Then, shuffle your deck.'))[0];
 assert.deepEqual(parsed.actions.find(action=>action.kind==='play'),{kind:'play',source:'deck',amount:1,exactCost:3,trait:'Land of Wano',color:'green',cardType:'Character'});
 assert.deepEqual(parsed.actions.filter(action=>action.kind==='shuffle'),[{kind:'shuffle',scope:'self'}]);
});

test('circled DON cost pays the printed amount before the activated effect',()=>{
 const parsed=parseEffects(card('[Activate: Main] ③ (You may rest the specified number of DON!! cards in your cost area.): Set this Character as active.'))[0];
 assert.deepEqual(parsed.costs.find(cost=>cost.kind==='rest'),{kind:'rest',scope:'don',amount:3,optional:false});
});

test('Kaku replacement is parsed separately from its On Play mill',()=>{
 const document=compileEffectDocument({...card('[Once Per Turn] If your black Character with a base cost of 5 or less would be K.O.’d by your opponent’s effect, you may place 3 cards from your trash at the bottom of your deck in any order instead.\n[On Play] Trash 2 cards from the top of your deck.'),code:'EB04-043'});
 assert.equal(document.resolver.type,'DSL');
 const replacement=document.ast.find(effect=>effect.trigger==='continuous')?.actions.find(action=>action.kind==='replacement');
 assert.deepEqual(replacement,{kind:'replacement',event:'ko-by-effect',cost:{kind:'bottom-deck-trash',amount:3},eligibility:{color:'black',cardType:'Character',maxBaseCost:5},oncePerTurn:true});
 assert.ok(document.ast.find(effect=>effect.trigger==='on-play')?.actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===2));
});

test('Kuma separates thresholded deck-to-Life and On K.O. opponent-Life movement',()=>{
 const document=compileEffectDocument({...card("[On Play] If you have 2 or less Life cards, add up to 1 card from the top of your deck to the top of your Life cards.\n[On K.O.] Add up to 1 card from the top of your opponent's Life cards to the owner's hand."),code:'EB04-054'});
 assert.equal(document.resolver.type,'DSL');
 const onPlay=document.ast.find(effect=>effect.trigger==='on-play');
 assert.deepEqual(onPlay?.actions.find(action=>action.kind==='move-to-life'),{kind:'move-to-life',scope:'own',amount:1,position:'top',source:'deck-top',selection:{min:0,max:1}});
 assert.equal(document.ast.find(effect=>effect.trigger==='on-ko')?.actions.find(action=>action.kind==='life'&&action.operation==='opponent-top-to-owner-hand')?.kind,'life');
});

test('Monkey.D.Luffy attaches rested DON and limits battle protection by Strike attribute and DON count',()=>{
 const document=compileEffectDocument({...card('[DON!! x2] This Character cannot be K.O.\'d in battle by "Strike" attribute Characters. [Activate:Main] [Once Per Turn] Give this Character up to 2 rested DON!! cards.'),code:'OP01-024'});
 assert.equal(document.resolver.type,'DSL');
 const protection=document.ast.find(effect=>effect.trigger==='unknown')?.actions.find(action=>action.kind==='prevent-ko');
 assert.deepEqual(protection,{kind:'prevent-ko',scope:'own-character',by:'battle',attribute:'Strike',byCardType:'Character',requiresAttachedDon:2});
 assert.deepEqual(document.ast.find(effect=>effect.trigger==='activate-main')?.actions.find(action=>action.kind==='attach-don'),{kind:'attach-don',amount:2,source:'cost-area',rested:true,recipient:'self',selection:{min:0,max:2}});
});

test('hand-trash costs preserve printed color, trait, type, and cost restrictions',()=>{
 const parsed=parseEffects(card('[On Play] You may trash 2 black "Navy" type Character cards with a cost of 4 or less from your hand: Draw 3 cards.'))[0];
 const cost=parsed.costs.find((item):item is Extract<typeof item,{kind:'trash'}>=>item.kind==='trash');
 assert.deepEqual(cost,{kind:'trash',scope:'hand',amount:2,requiresTrigger:false,optional:true,color:'black',trait:'Navy',cardType:'Character',maxCost:4});
});

test('a dual-timing Event keeps Main search and Counter battle power separate',()=>{
 const event={...card('[Main] Look at 5 cards from the top of your deck; reveal up to 1 card with a type including "Red-Haired Pirates" and add it to your hand. Then, place the rest at the bottom of your deck in any order.\n[Counter] You may rest 1 of your cards: Up to 1 of your Leader or Characters gains +3000 power during this battle.'),type:'Event',code:'OP17-037',name:'Are You That Afraid of the New Era?!'} as Card;
 const effects=parseEffects(event);
 const main=effects.find(effect=>effect.trigger==='main');
 const counter=effects.find(effect=>effect.trigger==='counter');
 const search=main?.actions.find(action=>action.kind==='search');
 assert.equal(search?.kind,'search');
 assert.equal(search?.amount,5);
 assert.equal(search?.choose,1);
 assert.equal(search?.destination,'deck-bottom');
 assert.equal(search?.trait,'Red-Haired Pirates');
 assert.ok(counter?.actions.some(action=>action.kind==='power'&&action.amount===3000&&action.until==='battle'));
 assert.match(counter?.source??'',/rest 1 of your cards/i);
});

test('mixed-trait and colour searches keep their alternatives separate',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; reveal up to 1 [Monkey.D.Luffy] or red Event and add it to your hand. Then, place the rest at the bottom of your deck in any order.'))[0].actions;
 const search=actions.find((action):action is Extract<typeof action,{kind:'search'}>=>action.kind==='search');
 assert.deepEqual(search,{kind:'search',amount:5,choose:1,destination:'deck-bottom',remainderPosition:'bottom',remainderOrder:true,cardType:undefined,trait:undefined,alternatives:[{name:'Monkey.D.Luffy'},{color:'red',cardType:'Event'}]});
});

test('deck search keeps included type alternatives and each printed selection cap',()=>{
 const included=parseEffects(card('[Main] Look at 4 cards from the top of your deck; reveal up to 1 "Cross Guild" type card or card with a type including "Baroque Works" and add it to your hand. Then, place the rest at the bottom of your deck in any order.'))[0].actions.find(action=>action.kind==='search');
 assert.ok(included?.kind==='search');
 assert.deepEqual(included.alternatives,[{trait:'Cross Guild'},{trait:'Baroque Works'}]);
 const document=compileEffectDocument(card('[Main] Look at 3 cards from the top of your deck; reveal up to 1 [Monkey.D.Luffy] or up to 1 card with a type including "Whitebeard Pirates" and add it to your hand. Then, place the rest at the bottom of your deck in any order.'));
 const search=document.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='search');
 assert.ok(search?.kind==='search');assert.equal(search.choose,2);
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'luffy',owner:'player',zone:'deck',type:'Character',name:'Monkey.D.Luffy'},
  {id:'luffy-2',owner:'player',zone:'deck',type:'Character',name:'Monkey.D.Luffy'},
  {id:'whitebeard',owner:'player',zone:'deck',type:'Character',name:'Ace',traits:['Whitebeard Pirates']},
  {id:'other',owner:'player',zone:'deck',type:'Character',name:'Other'},
 ]};
 const valid=applyEffectAction(state,'player',search,{cardIds:['luffy','whitebeard'],deckOrder:['luffy-2']});assert.equal(valid.error,undefined);assert.deepEqual(valid.state.cards.filter(item=>item.zone==='hand').map(item=>item.id).sort(),['luffy','whitebeard']);
 const repeated=applyEffectAction(state,'player',search,{cardIds:['luffy','luffy-2']});assert.ok(repeated.error);
});

test('search parses a top-deck remainder and preserves the specified ordering',()=>{
 const search=parseEffects(card('[On Play] Look at 3 cards from the top of your deck; reveal up to 1 {East Blue} type card and add it to your hand. Then, place the rest at the top of your deck in any order.'))[0].actions.find(action=>action.kind==='search');
 assert.ok(search?.kind==='search');assert.equal(search.remainderPosition,'top');assert.equal(search.remainderOrder,true);
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'pick',owner:'player',zone:'deck',type:'Character',name:'Eligible',traits:['East Blue']},
  {id:'second',owner:'player',zone:'deck',type:'Character',name:'Second'},
  {id:'third',owner:'player',zone:'deck',type:'Character',name:'Third'},
  {id:'fourth',owner:'player',zone:'deck',type:'Character',name:'Fourth'},
 ]};
 const result=applyEffectAction(state,'player',search,{cardIds:['pick'],deckOrder:['third','second']});
 assert.equal(result.error,undefined);assert.deepEqual(result.state.cards.filter(item=>item.zone==='deck').map(item=>item.id),['third','second','fourth']);
 const incomplete=applyEffectAction(state,'player',search,{cardIds:['pick'],deckOrder:['second']});assert.equal(incomplete.error,'Order each remaining inspected card exactly once.');
 const choice=parseEffects(card('[On Play] Look at 3 cards from the top of your deck; reveal up to 1 {East Blue} type card and add it to your hand. Then, place the rest at the top or bottom of your deck in any order.'))[0].actions.find(action=>action.kind==='search');
 assert.ok(choice?.kind==='search');assert.equal(choice.remainderPosition,'choice');
 const bottom=applyEffectAction(state,'player',choice,{cardIds:['pick'],deckOrder:['second','third'],position:'bottom'});assert.equal(bottom.error,undefined);assert.deepEqual(bottom.state.cards.filter(item=>item.zone==='deck').map(item=>item.id),['fourth','second','third']);
});

test('OP16-118 keeps bottom-deck ordering despite the source-text typo',()=>{
 const abilities=parseEffects(card('[On Play]/[On K.O.] Look at 5 cards from the top of your deck; reveal up to 1 [Monkey.D.Luffy] or up to 1 card with a type including "Whitebeard Pirates" and add it to your hand. Then, place the rest a the bottom of your deck in any order.'));
 assert.deepEqual(abilities.map(ability=>ability.trigger),['on-play','on-ko']);
 for(const ability of abilities){const search=ability.actions.find(action=>action.kind==='search');assert.ok(search?.kind==='search');assert.equal(search.remainderPosition,'bottom');assert.equal(search.remainderOrder,true);assert.equal(search.choose,2);}
});

test('inline timing markers do not merge Main with Trigger',()=>{
 const effects=parseEffects(card('[Main] Draw 1 card.[Trigger] Draw 2 cards.'));
 assert.deepEqual(effects.map(effect=>effect.trigger),['main','trigger']);
 assert.deepEqual(effects.map(effect=>effect.actions.filter(action=>action.kind==='draw').map(action=>action.amount)),[[1],[2]]);
});

test('Trigger can reference the same card\'s On K.O. ability',()=>{
 const document=compileEffectDocument(card("[On K.O.] Draw 1 card.\n[Trigger] Activate this card's [On K.O.] effect."));
 const trigger=document.ast.find(ability=>ability.trigger==='trigger');
 assert.deepEqual(trigger?.actions,[{kind:'activate-referenced-effect',trigger:'on-ko'}]);
});

test('power grants lasting through the opponent turn retain that duration',()=>{
 const document=compileEffectDocument(card('[On Play] Up to 1 of your Leader gains +1000 power until the end of your opponent\'s next turn.'));
 const action=document.ast.find(ability=>ability.trigger==='on-play')?.actions[0];
 assert.deepEqual(action,{kind:'power',amount:1000,until:'opponent-next-turn',selection:{min:0,max:1},target:'own-leader'});
});

test('power duration remains through the opponent turn in the runtime',()=>{
 const document=compileEffectDocument(card("[On Play] Up to 1 of your Leader gains +1000 power until the end of your opponent's next turn."));
 const action=document.ast.find(ability=>ability.trigger==='on-play')?.actions[0];if(action?.kind!=='power')throw new Error('Expected power action');
 const state:MatchEffectState={turn:'player',cards:[{id:'leader',owner:'player',zone:'leader',type:'Leader',power:5000}],turnEffects:[],restrictions:[],delayed:[]};
 const applied=applyEffectAction(state,'player',action,{targetId:'leader',cardIds:['leader']});assert.equal(applied.error,undefined);assert.equal(applied.state.turnEffects[0]?.expires,'opponent-next-turn');
 const afterOwnTurn=expireEffectModifiers(applied.state,'turn-end');assert.equal(afterOwnTurn.cards[0]?.powerModifier,1000);
 const afterOpponentTurn=expireEffectModifiers(afterOwnTurn,'opponent-next-turn','player');assert.equal(afterOpponentTurn.cards[0]?.powerModifier,undefined);
});

test('Shalria searches before discarding from hand and does not make the discard an activation cost',()=>{
 const document=compileEffectDocument(card('[On Play] Look at 3 cards from the top of your deck; reveal up to 1 "Celestial Dragons" type card other than [Saint Shalria] and add it to your hand. Then, trash the rest and trash 1 card from your hand.'));
 assert.deepEqual(document.normalized[0].sequence.map(step=>step.type==='RESOLVE'?step.action.kind:'cost'),['search','trash']);
});

test('DON!! additions distinguish active and rested instructions',()=>{
 const active=parseEffects(card('[On Play] Add up to 1 DON!! card from your DON!! deck and set it as active.'))[0].actions.find(action=>action.kind==='add-don');
 const rested=parseEffects(card('[On Play] Add up to 2 DON!! cards from your DON!! deck and rest them.'))[0].actions.find(action=>action.kind==='add-don');
 assert.equal(active?.kind==='add-don'&&active.rested,false);
 assert.equal(rested?.kind==='add-don'&&rested.rested,true);
 const ready=parseEffects(card('[Main] Set up to 2 of your DON!! cards as active.'))[0].actions.find(action=>action.kind==='ready');
 assert.deepEqual(ready,{kind:'ready',scope:'own-don',amount:2,selection:{min:0,max:2}});
});

test('adjacent timing labels share the same ability body and preserve printed keywords',()=>{
 const parsed=parseEffects(card('[Blocker][On Play][When Attacking] Draw 1 card.'));
 assert.ok(parsed.some(effect=>effect.actions.some(action=>action.kind==='blocker')));
 for(const timing of ['on-play','when-attacking'])assert.deepEqual(parsed.find(effect=>effect.trigger===timing)?.actions,[{kind:'draw',amount:1}]);
});

test('turn qualifier before a printed timing stays on that timing instead of becoming a continuous duplicate',()=>{
 const document=compileEffectDocument(card('[Your Turn] [On Play] Play up to 1 {Big Mom Pirates} type Character card with a cost of 6 or less from your hand. Then, this Character gains [Rush] during this turn. [Trigger] Play this card.'));
 const onPlay=document.ast.filter(ability=>ability.trigger==='on-play'),continuous=document.ast.filter(ability=>ability.trigger==='continuous'),trigger=document.ast.filter(ability=>ability.trigger==='trigger');assert.equal(onPlay.length,1);assert.equal(continuous.length,0);assert.equal(trigger.length,1);assert.equal(onPlay[0].conditions[0]?.text,'it is your turn');assert.deepEqual(onPlay[0].actions.map(action=>action.kind),['play','grant-keyword']);assert.equal(trigger[0].actions[0]?.kind,'play');
});

test('a Trigger requirement in the middle of an ability is not a new timing window',()=>{
 const parsed=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] and a cost of 3 or less from your hand: Draw 2 cards. [Trigger] Draw 1 card.'));
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].trigger,'on-play');
 assert.equal(parsed[0].costs[0]?.kind,'trash');
 assert.equal(parsed[1].trigger,'trigger');
 assert.deepEqual(parsed[1].actions,[{kind:'draw',amount:1}]);
});

test('hand reset owns its shuffle and draw instead of emitting a second draw',()=>{
 const parsed=parseEffects(card('[Main] You return all cards in your hand to your deck, shuffle your deck, then draw 5 cards.'))[0];
 assert.deepEqual(parsed.actions,[{kind:'hand-reset',scope:'self',draw:5,shuffle:true}]);
});

test('a separate natural-language once-per-turn ability does not contaminate On Play',()=>{
 const document=compileEffectDocument(card('[On Play] Draw 1 card.\n[Once Per Turn] When your Leader with a type including "Rocks Pirates" attacks or is attacked, you may trash 1 card from your hand to activate this effect. Your Leader gains +3000 power during this battle.'));
 const commands=resolveEffectTiming(document,'on-play').commands;
 assert.deepEqual(commands.map(c=>c.value),[{kind:'draw',amount:1}]);
 assert.equal(document.normalized.length,2);
});

test('blocker locks parse the printed limit and expiry window across official wordings',()=>{
 const cases=[
  {effect:"[When Attacking] If there is a Character with a cost of 0, your opponent cannot activate the [Blocker] of any Character with a cost of 5 or less during this battle.",trigger:'when-attacking',maxCost:5,until:'battle'},
  {effect:"[When Attacking] If you have 1 or less cards in your hand, your opponent cannot activate the [Blocker] of any Character with a cost of 5 or less during this battle.",trigger:'when-attacking',maxCost:5,until:'battle'},
  {effect:"[On Play] Your opponent cannot activate up to 1 [Blocker] Character that has 4,000 power or less during this turn.",trigger:'on-play',maxPower:4000,until:'turn-end',count:1},
  {effect:'[On Play]/[When Attacking] Your opponent cannot activate [Blocker] during this turn.',trigger:'on-play',until:'turn-end'},
  {effect:"[On Play] Up to 1 of your opponent's Characters with a base cost of 4 or less cannot activate [Blocker] during this turn.",trigger:'on-play',maxCost:4,baseCost:true,until:'turn-end',count:1},
  {effect:"[Activate: Main] Up to 1 of your opponent's Characters cannot activate [Blocker] during this turn.",trigger:'activate-main',until:'turn-end',count:1},
  {effect:"[When Attacking] All of your opponent's Characters with 2,000 power or less cannot activate [Blocker] during this turn.",trigger:'when-attacking',maxPower:2000,until:'turn-end'},
 ];
 for(const item of cases){
  const document=compileEffectDocument({...card(item.effect),code:'TEST-BLOCKER'});
  assert.equal(document.resolver.type,'DSL',item.effect);
  const ability=document.ast.find(window=>window.trigger===item.trigger);
  if(item.effect.includes('/[When Attacking]'))assert.ok(document.ast.some(window=>window.trigger==='when-attacking'));
  const action=ability?.actions.find(value=>value.kind==='prevent-keyword-activation');
  assert.ok(action,item.effect);
  if(action?.kind==='prevent-keyword-activation'){
   assert.equal(action.maxCost,item.maxCost);
   assert.equal(action.maxPower,item.maxPower);
   assert.equal(action.baseCost,item.baseCost);
   assert.equal(action.until,item.until);
   assert.deepEqual(action.selection,item.count?{min:0,max:item.count}:undefined);
  }
 }
});

test('conditional blocker locks execute only when their printed field or hand condition is true',()=>{
 const effects=[
  "[When Attacking] If there is a Character with a cost of 0, your opponent cannot activate the [Blocker] of any Character with a cost of 5 or less during this battle.",
  "[When Attacking] If you have 1 or less cards in your hand, your opponent cannot activate the [Blocker] of any Character with a cost of 5 or less during this battle.",
 ];
 const base={turn:'player' as const,turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const},
  {id:'zero',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:0},
  {id:'blocker',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:5,power:4000,keywords:['blocker']},
  {id:'hand-card',owner:'player' as const,zone:'hand' as const,type:'Character' as const},
 ]};
 for(const effect of effects){
  const document=compileEffectDocument({...card(effect),code:'TEST-CONDITIONAL-BLOCK'});
  const commands=resolveEffectTiming(document,'when-attacking').commands;
  assert.ok(commands.length);
  const active=executeEffectCommands(base,'player',commands,[],'source');
  assert.equal(active.state.turnEffects.some(item=>item.kind==='prevent-keyword-activation'&&item.target==='blocker'),true,effect);
  const falseState=effect.includes('cost of 0')?{...base,cards:base.cards.filter(item=>item.id!=='zero')}:{...base,cards:[...base.cards,{id:'second-hand-card',owner:'player' as const,zone:'hand' as const,type:'Character' as const}]};
  const inactive=executeEffectCommands(falseState,'player',commands,[],'source');
  assert.equal(inactive.state.turnEffects.some(item=>item.kind==='prevent-keyword-activation'),false,effect);
 }
});

test('a turn-long global Blocker lock applies to every opposing Blocker',()=>{
 const effect='[On Play]/[When Attacking] Your opponent cannot activate [Blocker] during this turn.';
 const document=compileEffectDocument({...card(effect),code:'P-097'});
 const commands=resolveEffectTiming(document,'on-play').commands;
 const state={turn:'player' as const,turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const},
  {id:'blocker-a',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,keywords:['blocker']},
  {id:'blocker-b',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,keywords:['blocker']},
  {id:'plain',owner:'opponent' as const,zone:'character' as const,type:'Character' as const},
 ]};
 const result=executeEffectCommands(state,'player',commands,[],'source');
 assert.deepEqual(result.state.turnEffects.map(item=>item.target),['blocker-a','blocker-b']);
 assert.ok(result.state.turnEffects.every(item=>item.expires==='turn-end'));
});

test('rules-name clauses remain continuous rules and do not force a custom resolver',()=>{
 const document=compileEffectDocument(card("Also treat this card's name as [Tony Tony.Chopper] according to the rules.\n[On Play] Play up to 1 {Animal} type Character card with a cost of 3 or less from your hand."));
 assert.equal(document.resolver.type,'DSL');
 assert.deepEqual(document.ast.map(ability=>ability.trigger),['on-play']);
 assert.equal(document.ast[0].actions[0]?.kind,'play');
});
