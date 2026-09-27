import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveCardEffect,resolveEffectTiming} from '../packages/domain/effect-runtime';
import type {MatchEffectState} from '../packages/domain/match-effect-state';

import {beginEffectExecution,advanceEffectExecution} from '../packages/domain/effect-controller';

test('effect controller pauses for each selection and resumes the printed order',()=>{
 const document=compileEffectDocument({id:'test',code:'TEST-002',name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect:'[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 2 cards.'});
 const commands=resolveCardEffect(document,'on-play').commands;
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player',zone:'character',type:'Character'},
  {id:'trigger',owner:'player',zone:'hand',type:'Event',keywords:['trigger']},
  {id:'deck-1',owner:'player',zone:'deck',type:'Character'},
  {id:'deck-2',owner:'player',zone:'deck',type:'Character'},
 ]};
 const paused=beginEffectExecution(state,'player','source','on-play',commands);
 assert.equal(paused.complete,false);
 assert.match(paused.requiresSelection??'',/Select 1 card/);
 const done=advanceEffectExecution(paused.execution,{cardIds:['trigger']});
 assert.equal(done.complete,true);
 assert.equal(done.execution.state.cards.find(card=>card.id==='trigger')?.zone,'trash');
 assert.equal(done.execution.state.cards.filter(card=>card.zone==='hand').length,2);
});

test('an optional paid effect can be declined without applying its later commands',()=>{
 const document=compileEffectDocument({id:'test',code:'TEST-003',name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect:'[On Play] You may trash 1 card from your hand: Draw 2 cards.'});
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player',zone:'character',type:'Character'},
  {id:'hand',owner:'player',zone:'hand',type:'Event'},
  {id:'deck-1',owner:'player',zone:'deck',type:'Character'},
  {id:'deck-2',owner:'player',zone:'deck',type:'Character'},
 ]};
 const paused=beginEffectExecution(state,'player','source','on-play',resolveCardEffect(document,'on-play').commands);
 const declined=advanceEffectExecution(paused.execution,{choice:'decline'});
 assert.equal(declined.complete,true);
 assert.equal(declined.execution.state.cards.find(card=>card.id==='hand')?.zone,'hand');
 assert.equal(declined.execution.state.cards.filter(card=>card.zone==='hand').length,1);
});

test('source-bound self costs and actions resolve without a redundant target selection',()=>{
 const document=compileEffectDocument({id:'test',code:'TEST-004',name:'Test',color:'Green',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect:'[Activate: Main] You may rest this Character: Draw 1 card.'});
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player',zone:'character',type:'Character'},
  {id:'deck',owner:'player',zone:'deck',type:'Character'},
 ]};
 const resolved=beginEffectExecution(state,'player','source','activate-main',resolveCardEffect(document,'activate-main').commands);
 assert.equal(resolved.complete,true);
 assert.equal(resolved.execution.state.cards.find(card=>card.id==='source')?.rested,true);
 assert.equal(resolved.execution.state.cards.find(card=>card.id==='deck')?.zone,'hand');
});

import {commandsForTiming} from '../packages/domain/match-effect-state';

test('timing discovery exposes the same ordered queue for On K.O. and opponent-attack effects',()=>{
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'ko-card',owner:'player',zone:'character',type:'Character',effectText:'[On K.O.] You may trash 1 card from your hand: Draw 2 cards.'},
  {id:'defender',owner:'player',zone:'character',type:'Character',effectText:'[On Your Opponent\'s Attack] You may trash 1 card from your hand: Give this Character +1000 power during this battle.'},
 ]};
 assert.deepEqual(commandsForTiming(state,'ko-card','on-ko').map(command=>command.kind),['pay-cost','resolve-action','resolve-action']);
 assert.deepEqual(commandsForTiming(state,'defender','opponent-attack').map(command=>command.kind),['pay-cost','resolve-action','resolve-action']);
});

test('a negated Character does not expose printed timing commands',()=>{
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'negated',owner:'player',zone:'character',type:'Character',effectNegated:true,effectText:'[On K.O.] Draw 1 card.'},
 ]};
 assert.deepEqual(commandsForTiming(state,'negated','on-ko'),[]);
});

test('custom On Play does not replace a separate activated draw window',()=>{
 const document=compileEffectDocument({id:'mixed',code:'OP06-092',name:'Test',color:'Black',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect:'[On Play] Choose one: Do something unique.\n[Activate: Main] Draw 1 card.'});
 const resolution=resolveEffectTiming(document,'activate-main');
 assert.equal(resolution.status,'ready');
 assert.equal(resolution.instructions,undefined);
 assert.ok(resolution.commands.some(command=>command.kind==='resolve-action'&&command.value.kind==='draw'));
 const absent=resolveEffectTiming(document,'on-block');
 assert.deepEqual(absent.commands,[]);
 assert.equal(absent.instructions,undefined);
});

test('top-deck reorder survives serialization and controls the next draw without adding cards to hand',()=>{
 const card={id:'buggy',code:'ST17-003',name:'Buggy',color:'Blue',type:'Character' as const,cost:1,power:2000,rarity:'C',art:0,effect:'[On Play] Look at 3 cards from the top of your deck and place them at the top of your deck in any order.'};
 const document=JSON.parse(JSON.stringify(compileEffectDocument(card)));
 const commands=resolveCardEffect(document,'on-play').commands;
 assert.equal(commands.length,1);assert.equal(commands[0].value.kind,'reorder-deck');
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:['a','b','c','d'].map(id=>({id,owner:'player',zone:'deck'}))};
 const started=beginEffectExecution(state,'player','buggy','on-play',commands);
 assert.ok(started.requiresSelection);
 assert.ok(advanceEffectExecution(started.execution,{cardIds:['a','a','b']}).error);
 const finished=advanceEffectExecution(started.execution,{cardIds:['c','a','b']});
 assert.equal(finished.complete,true);
 assert.deepEqual(finished.execution.state.cards.map(card=>card.id),['c','a','b','d']);
 assert.ok(finished.execution.state.cards.every(card=>card.zone==='deck'));
 const draw=beginEffectExecution(finished.execution.state,'player','source','on-play',[{kind:'resolve-action',value:{kind:'draw',amount:1}}]);
 assert.equal(draw.execution.state.cards.find(card=>card.id==='c')?.zone,'hand');
});

test('search then discard can discard the newly found card and finishes only after that choice',()=>{
 const document=compileEffectDocument({id:'shalria',code:'OP13-086',name:'Saint Shalria',color:'Black',type:'Character',cost:1,power:0,rarity:'C',art:0,effect:'[On Play] Look at 3 cards from the top of your deck; reveal up to 1 "Celestial Dragons" type card other than [Saint Shalria] and add it to your hand. Then, trash the rest and trash 1 card from your hand.'});
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'found',owner:'player',zone:'deck',name:'Saint Charlos',traits:['Celestial Dragons']},{id:'miss-a',owner:'player',zone:'deck'},{id:'miss-b',owner:'player',zone:'deck'},{id:'next',owner:'player',zone:'deck'}]};
 const started=beginEffectExecution(state,'player','shalria','on-play',resolveCardEffect(document,'on-play').commands);
 assert.ok(started.requiresSelection);
 const searched=advanceEffectExecution(started.execution,{cardIds:['found']});
 assert.equal(searched.complete,false);assert.ok(searched.requiresSelection);
 assert.equal(searched.execution.state.cards.find(card=>card.id==='found')?.zone,'hand');
 assert.equal(searched.execution.state.cards.filter(card=>card.zone==='trash').length,2);
 const finished=advanceEffectExecution(searched.execution,{cardIds:['found']});
 assert.equal(finished.complete,true);
 assert.equal(finished.execution.state.cards.filter(card=>card.zone==='trash').length,3);
 assert.deepEqual(finished.execution.state.cards.filter(card=>card.zone==='deck').map(card=>card.id),['next']);
});

test('declining a Shalria search still requests the mandatory hand discard',()=>{
 const document=compileEffectDocument({id:'shalria',code:'OP13-086',name:'Saint Shalria',color:'Black',type:'Character',cost:1,power:0,counter:1000,rarity:'C',art:0,effect:'[On Play] Look at 3 cards from the top of your deck; reveal up to 1 {Celestial Dragons} type card other than [Saint Shalria] and add it to your hand. Then, trash the rest and trash 1 card from your hand.'});
 const initial:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'shalria',owner:'player',zone:'character',type:'Character'},
  {id:'held',owner:'player',zone:'hand',type:'Character'},
  ...['a','b','c','next'].map(id=>({id,owner:'player' as const,zone:'deck' as const,type:'Character' as const,traits:['Navy']})),
 ]};
 const search=beginEffectExecution(initial,'player','shalria','on-play',resolveCardEffect(document,'on-play').commands);
 const discard=advanceEffectExecution(search.execution,{cardIds:[]});
 assert.equal(discard.complete,false);
 assert.match(discard.requiresSelection??'',/Select 1/);
 assert.deepEqual(discard.execution.state.cards.filter(card=>card.zone==='trash').map(card=>card.id),['a','b','c']);
 const completed=advanceEffectExecution(discard.execution,{cardIds:['held']});
 assert.equal(completed.complete,true);
 assert.equal(completed.execution.state.cards.filter(card=>card.zone==='trash').length,4);
 assert.deepEqual(completed.execution.state.cards.filter(card=>card.zone==='deck').map(card=>card.id),['next']);
});

test('an empty hand after a failed search does not deadlock the effect',()=>{
 const commands=resolveCardEffect(compileEffectDocument({id:'test',code:'TEST-EMPTY',name:'Test',color:'Black',type:'Character',cost:1,power:0,counter:0,rarity:'C',art:0,effect:'[On Play] Look at 3 cards from the top of your deck; reveal up to 1 {Navy} type card and add it to your hand. Then, trash the rest and trash 1 card from your hand.'}),'on-play').commands;
 const initial:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'a',owner:'player',zone:'deck',traits:['FILM']}]};
 const search=beginEffectExecution(initial,'player','source','on-play',commands);
 const done=advanceEffectExecution(search.execution,{cardIds:[]});
 assert.equal(done.complete,true);
 assert.equal(done.execution.state.cards[0].zone,'trash');
});

test('Tsuru cost reduction changes subsequent removal eligibility in the same match',()=>{
 const document=compileEffectDocument({id:'tsuru',code:'OP02-106',name:'Tsuru',color:'Black',type:'Character',cost:1,power:0,counter:2000,rarity:'C',art:0,effect:"[On Play] Give up to 1 of your opponent's Characters −2 cost during this turn."});
 const initial:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'tsuru',owner:'player',zone:'character',type:'Character'},
  {id:'enemy',owner:'opponent',zone:'character',type:'Character',cost:4,power:5000},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader',cost:0,power:5000},
 ]};
 const pending=beginEffectExecution(initial,'player','tsuru','on-play',resolveCardEffect(document,'on-play').commands);
 assert.equal(pending.complete,false);
 const invalid=advanceEffectExecution(pending.execution,{targetId:'leader'});
 assert.ok(invalid.error);
 const reduced=advanceEffectExecution(pending.execution,{targetId:'enemy'});
 assert.equal(reduced.complete,true);
 assert.equal(reduced.execution.state.cards.find(card=>card.id==='enemy')?.costModifier,-2);
 const removal=beginEffectExecution(reduced.execution.state,'player','tsuru','on-play',[{kind:'resolve-action',value:{kind:'ko',maxCost:2}}]);
 const killed=advanceEffectExecution(removal.execution,{targetId:'enemy'});
 assert.equal(killed.complete,true);
 assert.equal(killed.execution.state.cards.find(card=>card.id==='enemy')?.zone,'trash');
});

test('up-to-two K.O. is one command with an atomic multi-target choice',()=>{
 const doc=compileEffectDocument({id:'source',code:'TEST-MULTI',name:'Test',color:'Black',type:'Character',cost:1,power:0,counter:0,rarity:'C',art:0,effect:"[On Play] K.O. up to 2 of your opponent's Characters with a cost of 4 or less."});
 const commands=resolveCardEffect(doc,'on-play').commands;
 assert.equal(commands.length,1);
 const initial:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'a',owner:'opponent',zone:'character',cost:2},{id:'b',owner:'opponent',zone:'character',cost:4},{id:'illegal',owner:'opponent',zone:'character',cost:5}]};
 const paused=beginEffectExecution(initial,'player','source','on-play',commands);
 assert.equal(paused.complete,false);
 const rejected=advanceEffectExecution(paused.execution,{cardIds:['a','illegal']});
 assert.ok(rejected.error);
 assert.deepEqual(rejected.execution.state,initial);
 const done=advanceEffectExecution(paused.execution,{cardIds:['a','b']});
 assert.equal(done.complete,true);
 assert.equal(done.execution.state.cards.filter(card=>card.zone==='trash').length,2);
 const declined=advanceEffectExecution(paused.execution,{cardIds:[]});
 assert.equal(declined.complete,true);
 assert.deepEqual(declined.execution.state,initial);
});

test('rest all resolves every eligible card without a target prompt',()=>{
 const doc=compileEffectDocument({id:'source',code:'TEST-ALL',name:'Test',color:'Green',type:'Event',cost:1,power:0,counter:0,rarity:'C',art:0,effect:"[Main] Rest all of your opponent's Characters with a cost of 4 or less."});
 const initial:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'a',owner:'opponent',zone:'character',cost:2},{id:'b',owner:'opponent',zone:'character',cost:4},{id:'large',owner:'opponent',zone:'character',cost:5},{id:'own',owner:'player',zone:'character',cost:1}]};
 const done=beginEffectExecution(initial,'player','source','main',resolveCardEffect(doc,'main').commands);
 assert.equal(done.complete,true);
 assert.deepEqual(done.execution.state.cards.filter(card=>card.rested).map(card=>card.id),['a','b']);
});
