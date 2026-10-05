import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {customEffectDefinitions,customEffectBranch,hasCustomBoardExecutor,resolveCustomEffect} from '../packages/domain/custom-effect-resolvers';
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

test('Brook choose-one has an explicit board adapter while preserving its timing plan',()=>{
 const document=compileEffectDocument(card('OP06-092','[On Play] Choose one: • Trash up to 1 of your opponent\'s Characters with a cost of 4 or less. • Your opponent places 3 cards from their trash at bottom of their deck in any order.'));
 assert.equal(document.resolver.type,'CUSTOM');
 assert.equal(document.implementationStatus,'IMPLEMENTED');
 assert.equal(hasCustomBoardExecutor('OP06_092_ON_PLAY'),true);
 const resolution=resolveEffectTiming(document,'on-play');
 assert.equal(resolution.status,'custom');
 assert.equal(resolution.instructions?.[0].kind,'choose-one');
});

test('Charlotte Pudding choose-one exposes both board-executable Life branches',()=>{
 const document=compileEffectDocument(card('EB01-052','[On Play] Choose one: Look at all of your opponent’s Life cards and place them back in their Life area in any order. Turn all of your Life cards face-down.'));
 assert.equal(document.implementationStatus,'IMPLEMENTED');assert.equal(hasCustomBoardExecutor('EB01_052_ON_PLAY'),true);assert.equal(customEffectBranch('EB01_052_ON_PLAY',0)?.[0]?.kind,'reorder-life');assert.equal(customEffectBranch('EB01_052_ON_PLAY',1)?.[0]?.kind,'set-life-face');assert.equal(resolveEffectTiming(document,'on-play').instructions?.[0]?.kind,'choose-one');
});

test('implemented custom handlers resolve through the shared runtime contract',()=>{
 const plan=resolveCustomEffect('OP02_025_ACTIVATE_MAIN');
 assert.equal(plan.status,'ready');
 assert.equal(plan.instructions[0]?.kind,'apply');
 const document=compileEffectDocument(card('OP02-025','[Activate: Main] [Once Per Turn] If you have 1 or less Characters, the next time you play a {Land of Wano} type Character card with a cost of 3 or more from your hand during this turn, the cost will be reduced by 1.'));
 assert.equal(document.implementationStatus,'REVIEWED');
});

test('custom handler audits use the handler timing when another window appears first',()=>{
 const document=compileEffectDocument(card('OP11-031','[On Play] If your Leader has the "Fish-Man" or "Merfolk" type, rest up to 1 of your opponent\'s Characters with a cost of 5 or less.\n[Activate: Main] [Once Per Turn] Up to 1 of your "Fish-Man" or "Merfolk" type Characters can attack Characters on the turn in which it is played.'));
 assert.equal(document.resolver.type,'CUSTOM');
 const handler=document.resolver.type==='CUSTOM'?document.resolver.handler:undefined;
 const timing=handler?customEffectDefinitions().find(item=>item.handler===handler)?.timing:undefined;
 assert.equal(timing,'activate-main');
 const resolution=resolveEffectTiming(document,timing!);
 assert.equal(resolution.status,'custom');assert.ok(resolution.instructions?.length);
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
