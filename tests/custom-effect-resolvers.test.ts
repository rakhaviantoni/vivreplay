import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {customEffectDefinitions,resolveCustomEffect} from '../packages/domain/custom-effect-resolvers';
import type {Card} from '../packages/card-data/catalog';

const card=(code:string,effect:string)=>({id:code,code,name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect} as Card);

test('custom resolver plans preserve ordered select, branch, and play instructions',()=>{
 const plan=resolveCustomEffect('OP06_086_ON_PLAY');
 assert.equal(plan.status,'ready');
 assert.deepEqual(plan.instructions.map(instruction=>instruction.kind),['choose','choose','choose-one','play-selected','play-selected']);
 assert.equal(plan.instructions[4].kind==='play-selected'&&plan.instructions[4].rested,true);
});

test('delayed and replacement custom effects stay explicit contracts',()=>{
 const delayed=resolveCustomEffect('PRB02_005_ON_PLAY');
 const replacement=resolveCustomEffect('OP10_074_CONTINUOUS');
 assert.equal(delayed.status,'ready');
 assert.equal(delayed.instructions[0].kind==='delayed'&&delayed.instructions[0].when,'next-main-phase');
 assert.equal(replacement.instructions[0].kind==='delayed'&&replacement.instructions[0].when,'replacement');
});

test('tested custom handlers resolve through the normal timing API',()=>{
 const document=compileEffectDocument(card('OP06-092','[On Play] Choose one: • Trash up to 1 of your opponent\'s Characters with a cost of 4 or less. • Your opponent places 3 cards from their trash at bottom of their deck in any order.'));
 assert.equal(document.resolver.type,'CUSTOM');
 assert.equal(document.implementationStatus,'TESTED');
 const resolution=resolveEffectTiming(document,'on-play');
 assert.equal(resolution.status,'ready');
 assert.equal(resolution.instructions?.[0].kind,'choose-one');
});

test('implemented custom handlers resolve through the shared runtime contract',()=>{
 const plan=resolveCustomEffect('OP02_025_ACTIVATE_MAIN');
 assert.equal(plan.status,'ready');
 assert.equal(plan.instructions[0]?.kind,'apply');
 const document=compileEffectDocument(card('OP02-025','[Activate: Main] [Once Per Turn] If you have 1 or less Characters, the next time you play a {Land of Wano} type Character card with a cost of 3 or more from your hand during this turn, the cost will be reduced by 1.'));
 assert.equal(document.implementationStatus,'IMPLEMENTED');
});

test('unknown custom handlers remain blocked from execution',()=>{
 const plan=resolveCustomEffect('NOT_A_HANDLER');
 assert.equal(plan.status,'custom');
 assert.equal(plan.instructions.length,0);
});

test('every tested resolver has a non-empty, timing-bound instruction plan',()=>{
 const implemented=customEffectDefinitions().filter(definition=>definition.status==='TESTED'||definition.status==='IMPLEMENTED');
 assert.ok(implemented.length>0);
 for(const definition of implemented){
  const resolved=resolveCustomEffect(definition.handler);
  assert.equal(resolved.status,'ready',definition.handler);
  assert.ok(resolved.instructions.length,definition.handler);
 }
});
