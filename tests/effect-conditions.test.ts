import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateEffectCondition} from '../packages/domain/effect-conditions';
import {executeEffectCommands} from '../packages/domain/effect-runtime';
import type {MatchEffectState} from '../packages/domain/match-effect-state';
const state:MatchEffectState={turn:'player',cards:[{id:'leader',owner:'player',zone:'leader',name:'Sanji'},{id:'draw',owner:'player',zone:'deck'},{id:'don',owner:'player',zone:'cost-area',type:'DON!!',rested:true}],turnEffects:[],restrictions:[],delayed:[]};
test('Sora combined condition fails when Sanji has more field DON than opponent',()=>{
 assert.equal(evaluateEffectCondition("your Leader is [Sanji] and the number of DON!! cards on your field is equal to or less than the number on your opponent's field",state,'player'),false);
});
test('failed leader condition leaves the next draw in deck',()=>{
 const result=executeEffectCommands(state,'player',[{kind:'resolve-action',conditions:['your Leader is [Luffy]'],value:{kind:'draw',amount:1}}]);
 assert.equal(result.state.cards.find(card=>card.id==='draw')?.zone,'deck');
});
test('unknown prerequisites stop resolution before moving cards',()=>{
 const result=executeEffectCommands(state,'player',[{kind:'resolve-action',conditions:['a special unimplemented prerequisite'],value:{kind:'draw',amount:1}}]);
 assert.ok(result.error);assert.deepEqual(result.state,state);
});

test('Sora draws after adding DON even though the addition changes the original threshold',()=>{
 const equal:MatchEffectState={...state,cards:[...state.cards,{id:'enemy-don',owner:'opponent',zone:'cost-area',type:'DON!!'},{id:'reserve',owner:'player',zone:'don-deck',type:'DON!!'}]};
 const conditions=["your Leader is [Sanji] and the number of DON!! cards on your field is equal to or less than the number on your opponent's field"];
 const result=executeEffectCommands(equal,'player',[{kind:'resolve-action',conditions,value:{kind:'add-don',amount:1,rested:true}},{kind:'resolve-action',conditions,value:{kind:'draw',amount:1}}]);
 assert.equal(result.error,undefined);
 assert.equal(result.state.cards.find(card=>card.id==='reserve')?.zone,'cost-area');
 assert.equal(result.state.cards.find(card=>card.id==='reserve')?.rested,true);
 assert.equal(result.state.cards.find(card=>card.id==='draw')?.zone,'hand');
});
