import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseEffects} from '../packages/domain/effect-rules';
import type {Card} from '../packages/card-data/catalog';

const card=(effect:string)=>({id:'effect-test',code:'TEST-001',name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect} as Card);

test('activated sacrifice and power reduction expose distinct board actions',()=>{
 const actions=parseEffects(card('[Activate: Main] You may trash this Character: Give up to 1 of your opponent\'s 0 cost Characters -3000 power during this turn.'))[0].actions;
 assert.ok(actions.some(action=>action.kind==='trash'&&action.scope==='self'));
 assert.ok(actions.some(action=>action.kind==='power'&&action.amount===-3000&&action.target==='opponent-character'));
});

test('targeted removal preserves its printed restrictions',()=>{
 const actions=parseEffects(card('[On Play] K.O. up to 1 of your opponent\'s rested Characters with a cost of 4 or less.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='ko'),{kind:'ko',maxCost:4,maxPower:undefined,restedOnly:true});
});

test('search, DON, and zone movement effects become reusable actions',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; add up to 1 DON!! card from your DON!! deck and rest it. Then, trash 2 cards from the top of your deck.'))[0].actions;
 assert.ok(actions.some(action=>action.kind==='search'&&action.amount===5));
 assert.ok(actions.some(action=>action.kind==='add-don'&&action.amount===1&&action.rested));
 assert.ok(actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===2));
});

test('search preserves the printed type and trait restriction',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type Character card and add it to your hand. Place the rest at the bottom of your deck in any order.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='search'),{kind:'search',amount:5,choose:1,destination:'deck-bottom',cardType:'Character',trait:'Straw Hat Crew'});
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
 const actions=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'))[0].actions;
 assert.ok(actions.some(action=>action.kind==='trash'&&action.scope==='hand'&&action.amount===1&&action.requiresTrigger));
 assert.ok(actions.some(action=>action.kind==='draw'&&action.amount===3));
});


test('separate printed triggers become separate executable effect schemas',()=>{
 const effects=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.\n[Trigger] Look at 5 cards from the top of your deck; reveal up to 1 {Big Mom Pirates} type card and add it to your hand. Then, place the rest at the bottom of your deck in any order.'));
 assert.equal(effects.length,2);
 assert.equal(effects[0].trigger,'on-play');
 assert.ok(effects[0].actions.some(action=>action.kind==='trash'&&action.requiresTrigger));
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
