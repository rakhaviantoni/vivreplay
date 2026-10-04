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

test('continuous aura conditions check exact DON, opposing cost, and paired Trash names',()=>{
 const board:MatchEffectState={...state,cards:[...state.cards,
  {id:'don-2',owner:'player',zone:'cost-area',type:'DON!!'},
  {id:'enemy-zero',owner:'opponent',zone:'character',type:'Character',cost:0},
  {id:'kuromarimo',owner:'player',zone:'trash',name:'Kuromarimo'},
  {id:'chess',owner:'player',zone:'trash',name:'Chess'},
 ]};
 assert.equal(evaluateEffectCondition('you have 2 DON!! cards on your field',board,'player'),true);
 assert.equal(evaluateEffectCondition('your opponent has a Character with a cost of 0',board,'player'),true);
 assert.equal(evaluateEffectCondition('you have [Kuromarimo] and [Chess] in your trash',board,'player'),true);
 const extraDon={...board,cards:[...board.cards,{id:'don-3',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const}]};
 assert.equal(evaluateEffectCondition('you have 2 DON!! cards on your field',extraDon,'player'),false);
 const exactDon={...board,cards:board.cards.filter(card=>card.id!=='don-2')};
 assert.equal(evaluateEffectCondition('you have 1 DON!! cards on your field',exactDon,'player'),true);
 assert.equal(evaluateEffectCondition('your opponent has a Character with a cost of 1',board,'player'),false);
 const missingChess={...board,cards:board.cards.filter(card=>card.id!=='chess')};
 assert.equal(evaluateEffectCondition('you have [Kuromarimo] and [Chess] in your trash',missingChess,'player'),false);
});

test('source rested and active conditions read the live source card state',()=>{
 const sourceState:MatchEffectState={...state,cards:[...state.cards,{id:'source',owner:'player',zone:'character',rested:true}]};
 assert.equal(evaluateEffectCondition('this Character is rested',sourceState,'player','source'),true);
 assert.equal(evaluateEffectCondition('this Character is active',sourceState,'player','source'),false);
 const active={...sourceState,cards:sourceState.cards.map(card=>card.id==='source'?{...card,rested:false}:card)};
 assert.equal(evaluateEffectCondition('this Character is rested',active,'player','source'),false);
 assert.equal(evaluateEffectCondition('this Character is active',active,'player','source'),true);
});

test('powered-character count conditions check the printed owner, threshold and exact minimum',()=>{
 const board:MatchEffectState={...state,cards:[...state.cards,
  {id:'enemy-1',owner:'opponent',zone:'character',type:'Character',power:5000},
  {id:'enemy-2',owner:'opponent',zone:'character',type:'Character',power:6000},
  {id:'enemy-low',owner:'opponent',zone:'character',type:'Character',power:4000},
  {id:'own-high',owner:'player',zone:'character',type:'Character',power:12000},
 ]};
 const condition='your opponent has 2 or more Characters with a base power of 5000 or more';
 assert.equal(evaluateEffectCondition(condition,board,'player'),true);
 const oneEligible={...board,cards:board.cards.filter(card=>card.id!=='enemy-2')};
 assert.equal(evaluateEffectCondition(condition,oneEligible,'player'),false);
 assert.equal(evaluateEffectCondition('there is a Character with 12000 base power or more',board,'player'),true);
 assert.equal(evaluateEffectCondition('your opponent has 1 or more Characters with a base power of 12000 or more',board,'player'),false);
});
