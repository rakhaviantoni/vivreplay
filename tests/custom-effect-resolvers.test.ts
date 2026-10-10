import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {customEffectDefinitions,customEffectBranch,hasCustomBoardExecutor,resolveCustomEffect} from '../packages/domain/custom-effect-resolvers';
import type {Card} from '../packages/card-data/catalog';

const card=(code:string,effect:string)=>({id:code,code,name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect} as Card);

test('OP06-086 has an ordered DSL sequence for its active and rested Trash plays',()=>{
 const document=compileEffectDocument(card('OP06-086','[On Play] Choose up to 1 Character card with a cost of 4 or less and up to 1 Character card with a cost of 2 or less from your trash. Play 1 card and play the other card rested.'));
 const actions=document.ast.find(item=>item.trigger==='on-play')?.actions;
 assert.equal(document.resolver.type,'DSL');
 assert.deepEqual(actions,[{kind:'play',source:'trash',amount:1,maxCost:4,selection:{min:0,max:1}},{kind:'play',source:'trash',amount:1,maxCost:2,restedIfPreviousPlayed:true,selection:{min:0,max:1}}]);
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

test('Kin’emon’s next-play reduction is parsed into the executable DSL',()=>{
 const document=compileEffectDocument(card('OP02-025','[Activate: Main] [Once Per Turn] If you have 1 or less Characters, the next time you play a {Land of Wano} type Character card with a cost of 3 or more from your hand during this turn, the cost will be reduced by 1.'));
 assert.equal(document.resolver.type,'DSL');
 assert.equal(document.implementationStatus,'PARSED');
 assert.deepEqual(document.ast[0].actions,[{kind:'cost-reduction',trait:'Land of Wano',cardType:'Character',minimumCost:3,amount:1,nextOnly:true,oncePerTurn:true,activationKey:'OP02-025:activate-main'}]);
});

test('OP11-031 attack permission stays in the Activate Main timing when another window appears first',()=>{
 const document=compileEffectDocument(card('OP11-031','[On Play] If your Leader has the "Fish-Man" or "Merfolk" type, rest up to 1 of your opponent\'s Characters with a cost of 5 or less.\n[Activate: Main] [Once Per Turn] Up to 1 of your "Fish-Man" or "Merfolk" type Characters can attack Characters on the turn in which it is played.'));
 assert.equal(document.resolver.type,'DSL');
 const resolution=resolveEffectTiming(document,'activate-main');
 assert.equal(resolution.status,'ready');
 assert.ok(resolution.commands.some(command=>command.kind==='resolve-action'&&command.value.kind==='attack-permission'));
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
