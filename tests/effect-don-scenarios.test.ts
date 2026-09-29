import {test} from 'node:test';
import assert from 'node:assert/strict';
import {donScenarios} from '../scripts/effect-don-scenarios';
import {compileEffectDocument} from '../packages/domain/effect-rules';
const compile=(effect:string)=>compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Purple',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect});
test('DON templates exclude conditions, combined abilities and follow-up clauses',()=>{
 for(const text of ['[On Play] If your Leader is [Sanji], add up to 1 DON!! card from your DON!! deck and rest it.','[On Play] Add up to 1 DON!! card from your DON!! deck and rest it. Then, draw 1 card.','[On Play] DON!! -1: Draw 1 card and trash 1 card from your hand.'])assert.equal(donScenarios(text).length,0);
});
test('DON scenarios detect automatic maximum addition instead of optional selection',()=>{
 const text='[On Play] Add up to 2 DON!! cards from your DON!! deck and rest them.';
 const cases=donScenarios(text);assert.equal(cases.length,10);
 const broken=compile(text);for(const effect of broken.normalized)for(const step of effect.sequence)if(step.type==='RESOLVE'&&step.action.kind==='add-don')delete step.action.selection;
 assert.throws(()=>cases.find(s=>s.name.endsWith('/ skip'))!.run(broken),/Optional DON addition|Added DON before/);
});
test('DON draw cost scenarios reject missing payment and draw-before-payment',()=>{
 const text='[On Play] DON!! -1: Draw 1 card.';
 const cases=donScenarios(text);assert.equal(cases.length,9);
 const broken=compile(text);for(const ability of broken.normalized)ability.sequence=ability.sequence.filter(step=>step.type!=='PAY_COST');
 assert.throws(()=>cases[0].run(broken),/Must select DON payment|Drew before/);
});
