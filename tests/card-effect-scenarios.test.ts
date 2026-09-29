import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument} from '../packages/domain/effect-rules';
import {scenarios} from '../scripts/card-effect-scenarios';

test('OP02-030 pays its Main cost and correctly selects a deck Character on K.O.',()=>{
 const effect='[Activate: Main] [Once Per Turn] ③ (You may rest the specified number of DON!! cards in your cost area.): Set this Character as active.\n[On K.O.] Play up to 1 green {Land of Wano} type Character card with a cost of 3 from your deck. Then, shuffle your deck.';
 const document=compileEffectDocument({id:'test',code:'OP02-030',name:'Kouzuki Oden',color:'Green',type:'Character',cost:8,power:8000,counter:0,rarity:'',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP02-030',name:'Kouzuki Oden',color:'Green',card_type:'Character',cost:8,power:8000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='play')step.action.exactCost=4;
 assert.throws(()=>cases[1].run(broken),/Valid Character failed/);
});

test('OP02-085 pays own DON before opponent DON return and gates its K.O. effect to the opponent turn',()=>{
 const effect='[On Play] DON!! −1 (You may return the specified number of DON!! cards from your field to your DON!! deck.): Your opponent returns 1 DON!! card from their field to their DON!! deck.\n[Opponent\'s Turn] When this Character is K.O.\'d, your opponent returns 2 DON!! cards from their field to their DON!! deck.';
 const document=compileEffectDocument({id:'test',code:'OP02-085',name:'Magellan',color:'Purple',type:'Character',cost:5,power:6000,counter:0,rarity:'',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP02-085',name:'Magellan',color:'Purple',card_type:'Character',cost:5,power:6000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='return-don'&&step.action.owner==='opponent')step.action.amount=1;
 assert.throws(()=>cases[1].run(broken),/did not return exactly two DON/);
});

test('OP11-022 enforces its Leader restriction and full optional activation sequence',()=>{
 const effect='This Leader cannot attack.\n[Activate: Main] [Once Per Turn] You may rest 1 of your DON!! cards and turn 1 card from the top of your Life cards face-up: Play up to 1 "Neptunian" type Character card or "Megalo" with a cost equal to or less than the number of DON!! cards on your field from your hand.';
 const document=compileEffectDocument({id:'test',code:'OP11-022',name:'Shirahoshi',color:'Blue',type:'Leader',cost:5,power:5000,counter:0,rarity:'',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP11-022',name:'Shirahoshi',color:'Blue',card_type:'Leader',cost:5,power:5000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const window of broken.ast)for(const action of window.actions)if(action.kind==='attack-prohibition')action.scope='own-character';
 for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='play')step.action.alternatives=[];
 assert.throws(()=>cases[0].run(broken),/cannot-attack text attacked/);
 assert.throws(()=>cases[1].run(broken),/Unlisted Character/);
});

test('EB04-043 mills two cards on play and scenario-tests its optional once-per-turn K.O. replacement',()=>{
 const effect='[Once Per Turn] If your black Character with a base cost of 5 or less would be K.O.’d by your opponent’s effect, you may place 3 cards from your trash at the bottom of your deck in any order instead.\n[On Play] Trash 2 cards from the top of your deck.';
 const document=compileEffectDocument({id:'test',code:'EB04-043',name:'Kaku',color:'Black',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'EB04-043',name:'Kaku',color:'Black',card_type:'Character',cost:3,power:4000,effect_text:effect});
 assert.equal(cases.length,3);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const replacement=broken.ast.find(window=>window.trigger==='continuous')?.actions.find(action=>action.kind==='replacement');
 if(replacement?.kind==='replacement'&&replacement.cost.kind==='bottom-deck-trash')replacement.cost.amount=2;
 assert.throws(()=>cases[1].run(broken),/Exactly three Trash cards should pay the replacement/);
});

test('EB04-054 respects the Life threshold and moves only selected top Life cards',()=>{
 const effect="[On Play] If you have 2 or less Life cards, add up to 1 card from the top of your deck to the top of your Life cards.\n[On K.O.] Add up to 1 card from the top of your opponent's Life cards to the owner's hand.";
 const document=compileEffectDocument({id:'test',code:'EB04-054',name:'Bartholomew Kuma',color:'Yellow',type:'Character',cost:7,power:7000,counter:0,rarity:'',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'EB04-054',name:'Bartholomew Kuma',color:'Yellow',card_type:'Character',cost:7,power:7000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const life=broken.ast.find(window=>window.trigger==='on-ko')?.actions.find(action=>action.kind==='life');
 if(life?.kind==='life')life.operation='add-to-hand';
 assert.throws(()=>cases[1].run(broken),/Kuma must not select below the top Life card/);
});

test('OP01-024 enforces its DON threshold and Strike-only battle protection, and attaches rested DON to self',()=>{
 const effect='[DON!! x2] This Character cannot be K.O.\'d in battle by "Strike" attribute Characters. [Activate:Main] [Once Per Turn] Give this Character up to 2 rested DON!! cards.';
 const document=compileEffectDocument({id:'test',code:'OP01-024',name:'Monkey.D.Luffy',color:'Red',type:'Character',cost:2,power:3000,counter:0,rarity:'C',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-024',name:'Monkey.D.Luffy',color:'Red',card_type:'Character',cost:2,power:3000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const protect=broken.ast.find(window=>window.trigger==='unknown')?.actions.find(action=>action.kind==='prevent-ko');if(protect?.kind==='prevent-ko')protect.requiresAttachedDon=1;
 assert.throws(()=>cases[0].run(broken),/exact attribute or DON threshold/);
});

test('OP01-120 only suppresses opponent Blockers at 2,000 power or less during the current battle',()=>{
 const effect='[When Attacking] Your opponent cannot activate a [Blocker] Character that has 2,000 or less power during this battle.';
 const document=compileEffectDocument({id:'test',code:'OP01-120',name:'Shanks',color:'Red',type:'Character',cost:9,power:10000,counter:0,rarity:'SR',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-120',name:'Shanks',color:'Red',card_type:'Character',cost:9,power:10000,effect_text:effect});
 assert.equal(cases.length,1);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const action=broken.ast.find(window=>window.trigger==='when-attacking')?.actions.find(item=>item.kind==='prevent-keyword-activation');
 if(action?.kind==='prevent-keyword-activation')action.maxPower=3000;
 assert.throws(()=>cases[0].run(broken),/Blocker above 2,000 power should remain usable/);
});

test('OP01-086 resolves both Counter and Trigger target scopes from its errata text',()=>{
 const effect="[Counter] Up to 1 of your Leader or Character cards gains +4000 power during this battle. Then, return up to 1 active Character with a cost of 3 or less to the owner's hand. [Trigger] Return up to 1 card with a cost of 4 or less to the owner's hand. This card has been officially errata'd.";
 const document=compileEffectDocument({id:'test',code:'OP01-086',name:'Overheat',color:'Blue',type:'Event',cost:2,power:0,counter:0,rarity:'UC',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-086',name:'Overheat',color:'Blue',card_type:'Event',cost:2,power:0,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const trigger=broken.ast.find(window=>window.trigger==='trigger')?.actions.find(action=>action.kind==='return-to-hand');
 if(trigger?.kind==='return-to-hand')trigger.maxCost=6;
 assert.throws(()=>cases[1].run(broken),/Trigger accepted a card above 4 cost/);
});

test('OP01-112 enforces its DON return cost and temporary active-target attack permission',()=>{
 const effect="[Activate:Main] [Once Per Turn] DON!! -1 (You may return the specified number of DON!! cards from your field to your DON!! deck.): This Character can also attack your opponent's active Characters during this turn.";
 const document=compileEffectDocument({id:'test',code:'OP01-112',name:'Page One',color:'Purple',type:'Character',cost:4,power:5000,counter:0,rarity:'C',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-112',name:'Page One',color:'Purple',card_type:'Character',cost:4,power:5000,effect_text:effect});
 assert.equal(cases.length,1);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const action=broken.ast.find(window=>window.trigger==='activate-main')?.actions.find(item=>item.kind==='attack-permission');
 if(action?.kind==='attack-permission')action.activeTargets=false;
 assert.throws(()=>cases[0].run(broken),/could not attack the active opponent Character/);
});

test('OP01-080 parses and resolves singular On K.O. draw wording',()=>{
 const effect='[On K.O.] Draw a card.';
 const document=compileEffectDocument({id:'test',code:'OP01-080',name:'Miss Doublefinger(Zala)',color:'Blue',type:'Character',cost:3,power:4000,counter:0,rarity:'C',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-080',name:'Miss Doublefinger(Zala)',color:'Blue',card_type:'Character',cost:3,power:4000,effect_text:effect});
 assert.equal(cases.length,1);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const draw=broken.ast.find(window=>window.trigger==='on-ko')?.actions.find(action=>action.kind==='draw');
 if(draw?.kind==='draw')draw.amount=2;
 assert.throws(()=>cases[0].run(broken),/Drew more than one card/);
});

test('OP01-038 enforces DON!! ×1 and its opponent-selected On K.O. hand trash',()=>{
 const effect="[DON!! x1] [When Attacking] K.O. up to 1 of your opponent's rested Characters with a cost of 2 or less. [On K.O.] Your opponent chooses 1 card from your hand; trash that card. This card has been officially errata'd.";
 const document=compileEffectDocument({id:'test',code:'OP01-038',name:'Kanjuro',color:'Green',type:'Character',cost:2,power:3000,counter:0,rarity:'C',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP01-038',name:'Kanjuro',color:'Green',card_type:'Character',cost:2,power:3000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const cost=broken.ast.find(window=>window.trigger==='when-attacking')?.actions.find(action=>action.kind==='attach-don-required');
 if(cost?.kind==='attach-don-required')cost.amount=2;
 assert.throws(()=>cases[0].run(broken),/DON!! ×1 should enable Kanjuro’s When Attacking effect/);
});

test('OP04-090 resolves its optional seven-card Trash payment, active attack permission and skipped refresh',()=>{
 const effect='This Character can also attack active Characters. [Activate:Main] [Once Per Turn] You may return 7 cards from your trash to the bottom of your deck in any order: Set this Character as active. Then, this Character will not become active in your next Refresh Phase.';
 const document=compileEffectDocument({id:'test',code:'OP04-090',name:'Monkey.D.Luffy (090)',color:'Black',type:'Character',cost:7,power:7000,counter:0,rarity:'SR',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP04-090',name:'Monkey.D.Luffy (090)',color:'Black',card_type:'Character',cost:7,power:7000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const missingPermission=structuredClone(document);const permission=missingPermission.ast.find(window=>window.trigger==='unknown')?.actions.find(action=>action.kind==='attack-permission');
 if(permission?.kind==='attack-permission')permission.activeTargets=false;
 assert.throws(()=>cases[0].run(missingPermission),/static effect should permit attacks/);
 const broken=structuredClone(document);const skip=broken.ast.find(window=>window.trigger==='activate-main')?.actions.find(action=>action.kind==='skip-next-refresh');
 if(skip?.kind==='skip-next-refresh'){broken.ast.find(window=>window.trigger==='activate-main')!.actions=broken.ast.find(window=>window.trigger==='activate-main')!.actions.filter(action=>action.kind!=='skip-next-refresh');broken.normalized.find(window=>window.timing==='activate-main')!.sequence=broken.normalized.find(window=>window.timing==='activate-main')!.sequence.filter(step=>step.type!=='RESOLVE'||step.action.kind!=='skip-next-refresh');}
 assert.throws(()=>cases[1].run(broken),/Next Refresh skip was not registered/);
});

test('OP04-082 applies the Rebecca-gated On Play sequence and its rest-to-replace-K.O. choice',()=>{
 const effect="If this Character would be K.O.'d, you may rest your Leader or 1 [Corrida Coliseum] instead. [On Play] If your Leader is [Rebecca], K.O. up to 1 of your opponent's Characters with a cost of 1 or less. Then, trash 1 card from the top of your deck.";
 const document=compileEffectDocument({id:'test',code:'OP04-082',name:'Kyros',color:'Black',type:'Character',cost:3,power:5000,counter:0,rarity:'R',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP04-082',name:'Kyros',color:'Black',card_type:'Character',cost:3,power:5000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const replacement=broken.ast.find(window=>window.trigger==='unknown')?.actions.find(action=>action.kind==='replacement');
 if(replacement?.kind==='replacement'&&replacement.cost.kind==='rest-leader-or-stage')replacement.cost.stageName='Marine Base';
 assert.throws(()=>cases[1].run(broken),/Resting Corrida Coliseum did not replace the K.O./);
});

test('OP04-094 uses the 15-Trash Main threshold and resolves Trigger rest cost before its K.O.',()=>{
 const effect="[Main] Choose up to 1 of your opponent's Characters with a cost of 4 or less and K.O. it. If you have 15 or more cards in your trash, choose up to 1 of your opponent's Characters with a cost of 6 or less instead of a Character with a cost of 4 or less. [Trigger] You may rest your Leader: K.O. up to 1 of your opponent's Characters with a cost of 5 or less.";
 const document=compileEffectDocument({id:'test',code:'OP04-094',name:'Trueno Bastardo',color:'Purple',type:'Event',cost:4,power:0,counter:0,rarity:'R',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 const cases=scenarios({id:'test',code:'OP04-094',name:'Trueno Bastardo',color:'Purple',card_type:'Event',cost:4,power:0,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const main=broken.ast.find(window=>window.trigger==='main')?.actions.find(action=>action.kind==='ko');if(main?.kind==='ko'&&main.conditionalMaxCost)main.conditionalMaxCost.amount=5;
 assert.throws(()=>cases[0].run(broken),/Cost-6 target should be legal/);
 const missingCost=structuredClone(document);const trigger=missingCost.normalized.find(window=>window.timing==='trigger');if(trigger)trigger.sequence=trigger.sequence.filter(step=>step.type!=='PAY_COST'||step.cost.kind!=='rest');
 assert.throws(()=>cases[1].run(missingCost),/Trigger must offer the optional Leader rest/);
});
