import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryScenarios} from '../scripts/effect-recovery-scenarios';
import {compileEffectDocument} from '../packages/domain/effect-rules';
const compile=(effect:string)=>compileEffectDocument({id:'test',code:'TEST',name:'Test',color:'Black',type:'Character',cost:1,power:1000,rarity:'C',art:0,effect});
test('reorder fixtures check exact permutation, short decks, and actual resulting order',()=>{
 const text='[On Play] Look at 3 cards from the top of your deck and place them at the top of your deck in any order.';
 const scenarios=recoveryScenarios(text);assert.equal(scenarios.length,5);
 for(const scenario of scenarios)scenario.run(compile(text));
});
test('recovery fixtures reject conditions and follow-up clauses rather than omitting them',()=>{
 for(const text of ['[On Play] If your Leader is [Sanji], add up to 1 Event from your trash to your hand.','[On Play] Add up to 1 Event from your trash to your hand. Then, draw 1 card.','[DON!! x1] [When Attacking] Add up to 1 Event from your trash to your hand.'])assert.equal(recoveryScenarios(text).length,0);
});
test('recovery fixtures exercise type, color, exact cost, name, and trait restrictions',()=>{
 const scenarios=recoveryScenarios('[On Play] Add up to 1 blue Event with a cost of 1 from your trash to your hand.');
 for(const suffix of ['wrong-type','wrong-color','mixed-color','over-cost','under-cost'])assert(scenarios.some(c=>c.name.endsWith(suffix)));
 assert(recoveryScenarios('[Trigger] Add up to 1 [Yamato] from your trash to your hand.').some(c=>c.name.endsWith('wrong-name')));
 assert(recoveryScenarios('[On K.O.] Add up to 1 Character card with a type including "Baroque Works" and a cost of 8 or less from your trash to your hand.').some(c=>c.name.endsWith('wrong-trait')));
});
test('recovery scenarios detect real missing type and name restrictions',()=>{
 const text='[On K.O.] Add up to 1 Event from your trash to your hand.';
 const document=compile(text),broken=structuredClone(document);
 for(const ability of broken.normalized)for(const step of ability.sequence)if(step.type==='RESOLVE'&&step.action.kind==='recover'){
  const action=step.action as unknown as Record<string,unknown>;delete action.cardType;delete action.name;
 }
 assert.throws(()=>recoveryScenarios(text).find(c=>c.name.endsWith('wrong-type'))!.run(broken),/Illegal recovery accepted/);
});
