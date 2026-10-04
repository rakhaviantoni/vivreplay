import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {keywordScenarios} from '../scripts/effect-keyword-scenarios';
const compile=(effect:string)=>compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Red',type:'Character',cost:1,power:6000,rarity:'C',art:0,effect});
test('keyword scenario selection excludes conditional and gained keywords',()=>{
 for(const text of ['[On Play] This Character gains [Rush] during this turn.','[DON!! x1] [Banish]','If you have 2 Life cards, this Character gains [Double Attack].'])assert.equal(keywordScenarios(text).length,0);
 assert.equal(keywordScenarios('[Rush] (This card can attack on the turn in which it is played.) [On Play] Draw 1 card.').length,7);
});
for(const text of ['[Rush] (This card can attack on the turn in which it is played.)','[Double Attack] (This card deals 2 damage.)','[Banish] (When this card deals damage, the target card is trashed without activating its Trigger.)']){
 test(`printed schema drives actual ${text.split(']')[0]}] battles`,()=>{for(const scenario of keywordScenarios(text))scenario.run(compile(text));});
 test(`missing printed schema cannot pass ${text.split(']')[0]}] positive scenario`,()=>assert.throws(()=>keywordScenarios(text)[0].run(compile(''))));
}
