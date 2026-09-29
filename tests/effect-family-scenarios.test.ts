import {test} from 'node:test';
import assert from 'node:assert/strict';
import {familyScenarios} from '../scripts/effect-family-scenarios';
import {compileEffectDocument} from '../packages/domain/effect-rules';

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
test('family tests do not silently drop conditions or follow-up clauses',()=>{
 assert.equal(familyScenarios('[On Play] If your Leader is [Sanji], draw 1 card.').length,0);
 assert.equal(familyScenarios('[On Play] Draw 1 card. Then, trash 1 card from your hand.').length,0);
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
 const cases=familyScenarios(effect);assert.equal(cases.length,5);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);broken.ast[0].actions=[];
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
