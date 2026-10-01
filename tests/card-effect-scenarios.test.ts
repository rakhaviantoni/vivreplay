import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument,type EffectAction} from '../packages/domain/effect-rules';
import {applyEffectAction} from '../packages/domain/match-effect-state';
import {advanceEffectExecution,beginEffectExecution} from '../packages/domain/effect-controller';
import {executeEffectCommands,resolveEffectTiming} from '../packages/domain/effect-runtime';
import {scenarios} from '../scripts/card-effect-scenarios';

test('KO-protection scenarios enforce DON, source attributes and printed conditions',()=>{
 const cases=[
  ['ST06-004','Ulti',`This Character cannot be K.O.'d by effects. [DON!! x1] If there is a Character with a cost of 0, this Character gains [Double Attack]. (This card deals 2 damage.)`,1],
  ['OP01-099','', `Kurozumi Clan type Characters other than your [Kurozumi Semimaru] cannot be K.O.'d in battle.`,1],
  ['OP07-069','', `If the number of DON!! cards on your field is equal to or less than the number on your opponent's field, your [Foxy Pirates] type Characters other than [Pickles] cannot be K.O.'d by your opponent's effects.`,1],
  ['OP06-052','', `[DON!! x1] If you have 4 or less cards in your hand, this Character cannot be K.O.'d in battle.`,1],
  ['ST05-008','', `If you have 8 or more DON!! cards on your field, this Character cannot be K.O.'d in battle.`,1],
  ['OP02-100','', `If you have [Fullbody], this Character cannot be K.O.'d in battle.`,1],
  ['OP09-045','', `If you have a [Buggy] or [Mohji] Character, this Character cannot be K.O.'d in battle.`,1],
  ['ST09-004','', `[DON!! x1] If you have 2 or less Life cards, this Character cannot be K.O.'d in battle.`,1],
  ['OP10-104','', `[DON!! x1] If your Leader has the "Supernovas" type and your opponent has 3 or more Life cards, this Character cannot be K.O.'d in battle.`,1],
  ['OP02-027','', `If all of your DON!! cards are rested, this Character cannot be removed from the field by your opponent's effects.`,1],
  ['OP13-080','', `If you have 7 or more cards in your trash, this Character cannot be removed from the field by your opponent's effects and gains [Rush].`,1],
  ['OP07-033','', `If you have 3 or more Characters, your Characters with a cost of 3 or less other than [Monkey.D.Luffy] cannot be K.O.'d by your opponent's effects.`,1],
  ['OP04-119','', `[Opponent's Turn] If this Character is rested, your active Characters with a base cost of 5 cannot be K.O.'d by effects. [On Play] You may rest this Character: Play up to 1 green Character card with a cost of 5 from your hand.`,1],
  ['OP08-029','', `If this Character is active, your {Minks} type Characters with a cost of 3 or less other than [Pekoms] cannot be K.O.'d by effects.`,1],
  ['P-007','', `[DON!! x1] This Character cannot be K.O.'d in battle by "Strike" attribute Leaders or Characters.`,1],
  ['P-025','', `[DON!! x1] This Character cannot be K.O.'d in battle by Characters without the "Special" attribute.`,1],
  ['OP09-025','', `If your Leader has the "ODYSSEY" type, this Character cannot be K.O.'d in battle by Leaders.`,1],
  ['OP14-003','', `This Character cannot be K.O.'d by effects of your opponent's Characters with 5000 base power or less.`,1],
  ['P-052','Dracule Mihawk','[DON!! x1] This Character cannot be K.O.\'d in battle by "Slash" attribute cards.',1],
  ['OP06-012','Bear.King','If your opponent has a Leader or Character with a base power of 6000 or more, this Character cannot be K.O.\'d in battle.',1],
  ['P-104','Shanks','If either you or your opponent has 10 DON!! cards on the field, this Character cannot be removed from the field by your opponent\'s effects.',1],
  ['OP13-091','St. Marcus Mars','If you have 7 or more cards in your trash, this Character cannot be removed from the field by your opponent\'s effects and gains [Blocker].\n[On Play] You may trash 1 card from your hand: K.O. up to 1 of your opponent\'s Characters with a base cost of 5 or less.',1],
  ['OP11-005','OP11-005',"[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)\n[DON!! x1] This Character cannot be K.O.'d by effects of Characters without the (Special) attribute.",7],
 ] as const;
 for(const [code,name,effect,count] of cases){
  const document=compileEffectDocument({id:code,code,name,color:'',type:'Character',cost:0,power:0,counter:0,rarity:'',art:0,effect});
  const cardCases=scenarios({id:code,code,name,color:'',card_type:'Character',cost:0,power:0,effect_text:effect});
  assert.equal(cardCases.length,count,`${code} scenario coverage changed`);
  for(const scenario of cardCases)scenario.run(document);
 }
});

test('effect timing markers split after reminder text and slash-separated timing windows',()=>{
 const reminder='[Main] You may add 1 card from the top or bottom of your Life cards to your hand: Up to 1 of your [Land of Wano] type Characters gains [Double Attack] during this turn. (This card deals 2 damage.) [Trigger] Up to 1 of your Leader or Character cards gains +1000 power during this turn.';
 const reminderDoc=compileEffectDocument({id:'test-reminder',code:'OP04-115',name:'Gun Modoki',color:'Green',type:'Event',cost:4,power:0,counter:0,rarity:'',art:0,effect:reminder});
 assert.deepEqual(reminderDoc.ast.map(ability=>ability.trigger),['main','trigger']);
 assert.equal(reminderDoc.ast[1].actions.filter(action=>action.kind==='power').length,1);
 const slash='[On Play] / [On K.O.] K.O. up to 1 of your opponent\'s rested Characters with a cost of 4 or less.';
 const slashDoc=compileEffectDocument({id:'test-slash',code:'OP06-036',name:'Hannyabal',color:'Black',type:'Character',cost:3,power:4000,counter:1000,rarity:'',art:0,effect:slash});
 assert.deepEqual(slashDoc.ast.map(ability=>ability.trigger),['on-play','on-ko']);
 const cases=scenarios({id:'test-slash',code:'OP06-036',name:'Hannyabal',color:'Black',card_type:'Character',cost:3,power:4000,effect_text:slash});
 assert.equal(cases.filter(scenario=>scenario.name.startsWith('schema-ko')).length,1);
 for(const scenario of cases)scenario.run(slashDoc);
});

test('OP05-059 Trigger draw requires a multicolored Leader',()=>{
 const effect='[Main] If your Leader is multicolored, draw 1 card. Then, return up to 1 Character with a cost of 5 or less to the owner\'s hand. [Trigger] If your Leader is multicolored, draw 2 cards.';
 const document=compileEffectDocument({id:'test',code:'OP05-059',name:'Test Character',color:'Blue',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'OP05-059',name:'Test Character',color:'Blue',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-conditional-draw'));
 assert.equal(cases.length,1);
 cases[0].run(document);
});

test('EB04-032 pays rested DON before adding a rested DON under its Leader condition',()=>{
 const effect='[On Play] You may trash 1 {Animal Kingdom Pirates} type card from your hand: Draw 2 cards.\n[Activate: Main] [Once Per Turn] You may rest 2 of your DON!! cards: If your Leader has the {Animal Kingdom Pirates} type, add up to 1 DON!! card from your DON!! deck and rest it.';
 const document=compileEffectDocument({id:'test',code:'EB04-032',name:'Test Character',color:'Green',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'EB04-032',name:'Test Character',color:'Green',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-rested-don-addition'));
 assert.equal(cases.length,1);
 cases[0].run(document);
});

test('EB01-012 Ready-DON excludes itself from the no-other-Cavendish condition',()=>{
 const effect='[On Play]/[When Attacking] If your Leader has the [Supernovas] type and you have no other [Cavendish] Characters, set up to 2 of your DON!! cards as active.';
 const document=compileEffectDocument({id:'test',code:'EB01-012',name:'Cavendish',color:'Green',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'EB01-012',name:'Cavendish',color:'Green',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-ready-don-gate'));
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
});

test('up-to Life trash asks for a count without revealing face-down Life cards',()=>{
 const effect='[On K.O.] Trash up to 1 card from the top of your opponent\'s Life cards.';
 const document=compileEffectDocument({id:'test',code:'EB03-057',name:'Test Character',color:'Green',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'EB03-057',name:'Test Character',color:'Green',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-trash-life'));
 assert.equal(cases.length,1);
 cases[0].run(document);
});

test('EB03-028 pays its optional self-trash before checking the post-cost hand-size condition',()=>{
 const effect='[Activate: Main] You may trash this Character: If you have 4 or less cards in your hand, draw 2 cards.';
 const document=compileEffectDocument({id:'test',code:'EB03-028',name:'Yu',color:'Blue',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'test',code:'EB03-028',name:'Yu',color:'Blue',card_type:'Character',cost:3,power:4000,effect_text:effect}).find(item=>item.name.startsWith('schema-self-trash-conditional-draw'));
 assert.ok(scenario);scenario.run(document);
});

test('P-163 pays a chosen field-card rest and only attaches rested DON with a 5-cost Character present',()=>{
 const effect='[Activate: Main] [Once Per Turn] You may rest 1 of your cards: If there is a Character with a cost of 5 or more, give up to 3 rested DON!! cards to this Leader.';
 const document=compileEffectDocument({id:'test',code:'P-163',name:'Dracule Mihawk',color:'Black',type:'Leader',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'test',code:'P-163',name:'Dracule Mihawk',color:'Black',card_type:'Leader',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('schema-mihawk-rested-don'));
 assert.ok(scenario);scenario.run(document);
});

test('OP17 Main effects treat rested-DON plus hand-trash as one optional cost package',()=>{
 for(const [code,restAmount] of [['OP17-078',2],['OP17-077',3]] as const){
  const effect=`[Main] You may rest ${restAmount} of your DON!! cards and trash 2 cards from your hand: If your Leader has the {Animal Kingdom Pirates} type, add up to 3 DON!! cards as rested from your DON!! deck.`;
  const document=compileEffectDocument({id:code,code,name:'Test Event',color:'Purple',type:'Event',cost:0,power:0,counter:0,rarity:'',art:0,effect});
  const scenario=scenarios({id:code,code,name:'Test Event',color:'Purple',card_type:'Event',cost:0,power:0,effect_text:effect}).find(item=>item.name.startsWith('schema-compound-rest-hand-add-don'));
  assert.ok(scenario);scenario.run(document);
 }
});

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

test('rest effects require the exact attached-DON threshold printed on the opposing Character',()=>{
 for(const [code,effect,required] of [
  ['OP15-001',"[Activate: Main] Rest up to 1 of your opponent's Characters that has 2 or more DON!! cards given.",2],
  ['OP15-027',"[On Play] Rest up to 1 of your opponent's Characters with a DON!! card given.",1],
 ] as const){
  const document=compileEffectDocument({id:code,code,name:'Test',color:'Black',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
  const action=document.ast[0]?.actions[0];assert.equal(action?.kind,'rest');if(action?.kind!=='rest')continue;assert.equal(action.minAttachedDon,required);
  const state={turn:'player' as const,cards:[{id:'target',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:3}],turnEffects:[],restrictions:[],delayed:[]};
  const ineligible=applyEffectAction(state,'player',action,{targetId:'target',cardIds:['target']});assert.ok(ineligible.error);assert.equal(state.cards[0].zone,'character');
  const eligible={...state,cards:[...state.cards,...Array.from({length:required},(_,index)=>({id:`don-${index}`,owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'target'}))]};
  const result=applyEffectAction(eligible,'player',action,{targetId:'target',cardIds:['target']});assert.equal(result.error,undefined);assert.equal(result.state.cards.find(card=>card.id==='target')?.rested,true);
 }
});

test('keyword grants enforce the printed recipient, trait, cost, and target count',()=>{
 const cards=[
  {code:'EB03-050',effect:'[On Play] Up to 1 of your {Sky Island} type Characters gains [Double Attack] during this turn.'},
  {code:'PRB01-001',effect:'[Activate:Main] [Once Per Turn] Up to 1 of your Characters without an [On Play] effect and with a cost of 8 or less gains [Rush] during this turn.'},
  {code:'test-self-rush',effect:'[On Play] This Character gains [Rush] during this turn.'},
 ];
 for(const item of cards){const document=compileEffectDocument({id:item.code,code:item.code,name:'Test',color:'Red',type:'Character',cost:3,power:5000,counter:0,rarity:'',art:0,effect:item.effect});const cases=scenarios({id:item.code,code:item.code,name:'Test',color:'Red',card_type:'Character',cost:3,power:5000,effect_text:item.effect}).filter(scenario=>scenario.name.includes('grant-keyword-target:'));assert.equal(cases.length,1,item.code);for(const scenario of cases)scenario.run(document);}
 const traitAction=compileEffectDocument({id:'trait',code:'trait',name:'Test',color:'Red',type:'Character',cost:3,power:5000,counter:0,rarity:'',art:0,effect:cards[0].effect}).ast[0].actions[0];assert.equal(traitAction.kind,'grant-keyword');if(traitAction.kind!=='grant-keyword')throw new Error('Expected keyword grant');assert.equal(traitAction.trait,'Sky Island');assert.deepEqual(traitAction.selection,{min:0,max:1});
 const selfDocument=compileEffectDocument({id:'self',code:'self',name:'Rush Giver',color:'Red',type:'Character',cost:3,power:5000,counter:0,rarity:'',art:0,effect:cards[2].effect}),selfState={turn:'player' as const,cards:[{id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:selfDocument},{id:'leader',owner:'opponent' as const,zone:'leader' as const,type:'Leader' as const}],turnEffects:[],restrictions:[],delayed:[]},selfExecution=beginEffectExecution(selfState,'player','source','on-play',resolveEffectTiming(selfDocument,'on-play').commands);assert(selfExecution.complete&&!selfExecution.error&&!selfExecution.requiresSelection,'A self-granted keyword must resolve without asking the player to target its source');assert(selfExecution.execution.state.cards.find(card=>card.id==='source')?.temporaryKeywords?.includes('rush'),'Self-granted Rush was not applied to its source');
 const chainedText='[Main] Play up to 1 Character with a cost of 3 or less from your deck. That Character gains [Rush] during this turn.',chained=compileEffectDocument({id:'chain',code:'chain',name:'Chain Test',color:'Blue',type:'Event',cost:1,power:0,counter:0,rarity:'',art:0,effect:chainedText}),chainedState={turn:'player' as const,cards:[{id:'event',owner:'player' as const,zone:'hand' as const,type:'Event' as const,effectSchema:chained},{id:'deck-character',owner:'player' as const,zone:'deck' as const,type:'Character' as const,cost:3},{id:'opponent-leader',owner:'opponent' as const,zone:'leader' as const,type:'Leader' as const}],turnEffects:[],restrictions:[],delayed:[]},commands=resolveEffectTiming(chained,'main').commands,controllerStart=beginEffectExecution(chainedState,'player','event','main',commands);assert(controllerStart.requiresSelection,'Play effect must ask the player to choose a legal deck Character');const chainedController=advanceEffectExecution(controllerStart.execution,{cardIds:['deck-character']});assert(chainedController.complete&&!chainedController.error&&!chainedController.requiresSelection,'The following grant should resolve onto the Character just played');assert(chainedController.execution.state.cards.find(card=>card.id==='deck-character')?.temporaryKeywords?.includes('rush'),'The played Character did not receive Rush');const direct=executeEffectCommands(chainedState,'player',commands,[{cardIds:['deck-character']},{}],'event');assert(!direct.error&&!direct.requiresSelection&&direct.state.cards.find(card=>card.id==='deck-character')?.temporaryKeywords?.includes('rush'),'Direct command runtime did not preserve the newly played target');
});

test('multi-target K.O. effects select zero through the printed maximum and reject excess targets',()=>{
 const effect="[Main] K.O. up to 2 of your opponent's rested Characters with a cost of 3 or less.";
 const document=compileEffectDocument({id:'test',code:'OP06-040',name:'Shark Arrows',color:'Blue',type:'Event',cost:3,power:0,counter:0,rarity:'R',art:0,effect});
 const scenario=scenarios({id:'test',code:'OP06-040',name:'Shark Arrows',color:'Blue',card_type:'Event',cost:3,power:0,effect_text:effect}).find(item=>item.name.startsWith('schema-ko main: up to 2'));
 assert.ok(scenario);scenario.run(document);
 const broken=structuredClone(document),action=broken.ast[0]?.actions.find(item=>item.kind==='ko');if(action?.kind==='ko'&&action.selection)action.selection.max=1;
 assert.throws(()=>scenario.run(broken),/optional count do not match printed text/);
});

test('Trigger references execute the selected Main K.O. sequence',()=>{
 const effect="[Main] K.O. up to 2 of your opponent's rested Characters with a cost of 3 or less.\n[Trigger] Activate this card's [Main] effect.";
 const document=compileEffectDocument({id:'test',code:'OP06-040',name:'Shark Arrows',color:'Blue',type:'Event',cost:3,power:0,counter:0,rarity:'R',art:0,effect});
 const scenario=scenarios({id:'test',code:'OP06-040',name:'Shark Arrows',color:'Blue',card_type:'Event',cost:3,power:0,effect_text:effect}).find(item=>item.name.startsWith('schema-reference trigger:'));
 assert.ok(scenario);scenario.run(document);
 const broken=structuredClone(document);broken.ast=broken.ast.filter(ability=>ability.trigger!=='trigger');broken.normalized=broken.normalized.filter(ability=>ability.timing!=='trigger');
 assert.throws(()=>scenario.run(broken),/Trigger does not reference the Main effect/);
});

test('OP05-116 uses opponent Life as its K.O. cap in Main and Trigger windows',()=>{
 const effect="[Main] K.O. up to 1 of your opponent's Characters with a cost equal to or less than the number of your opponent's Life cards.\n[Trigger] Activate this card's [Main] effect.",row={id:'OP05-116',code:'OP05-116',name:'Test Event',color:'Blue',card_type:'Event' as const,cost:4,power:0,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:4,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios(row),mainCase=cases.find(item=>item.name.startsWith('schema-ko main: up to 1, cost cap equals opponent Life')),triggerCase=cases.find(item=>item.name.startsWith('schema-reference trigger:'));
 assert.ok(mainCase);assert.ok(triggerCase);mainCase.run(document);triggerCase.run(document);
 const broken=structuredClone(document),main=broken.ast.find(ability=>ability.trigger==='main'),action=main?.actions.find(item=>item.kind==='ko');if(action?.kind==='ko')delete action.maxCostFromLife;
 assert.throws(()=>mainCase.run(broken),/current opponent Life/);
});

test('OP08-094 pays its optional Trash cost before the shared Main and Trigger K.O. sequence',()=>{
 const effect="[Main]/[Counter] You may place 3 cards from your trash at the bottom of your deck in any order: K.O. up to 1 of your opponent's Characters with a cost of 2 or less. [Trigger] Activate this card's [Main] effect.",row={id:'OP08-094',code:'OP08-094',name:'Imperial Flame',color:'Blue',card_type:'Event' as const,cost:2,power:0,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:2,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios(row);assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document),main=broken.ast.find(ability=>ability.trigger==='main');if(main)main.costs=[];
 assert.throws(()=>cases[0].run(broken),/complete supported cost and K\.O\. sequence/);
});

test('Counter power schemas preserve printed card names and traits',()=>{
 const cards=[
  {code:'EB03-029',effect:'[Counter] Up to 1 of your [Boa Hancock] cards gains +3000 power during this battle.',name:'Boa Hancock',target:'name' as const},
  {code:'OP15-038',effect:'[Counter] Up to 1 of your [Krieg] cards gains +4000 power during this battle.',name:'Krieg',target:'name' as const},
  {code:'OP11-038',effect:'[Counter] Up to 1 of your Leader gains +3000 power during this battle.',name:'Leader',target:'scope' as const},
  {code:'OP10-019',effect:'[Counter] Up to 1 of your Leader gains +3000 power during this battle.',name:'Leader',target:'scope' as const},
  {code:'OP17-036',effect:'[Counter] Up to 1 of your [Shanks] gains +4000 power during this battle.',name:'Shanks',target:'name' as const},
  {code:'OP17-117',effect:'[Counter] Up to 1 of your [Charlotte Linlin] gains +3000 power during this battle.',name:'Charlotte Linlin',target:'name' as const},
  {code:'OP17-078',effect:'[Counter] Up to 1 of your Leader or Characters gains +4000 power during this battle.',name:'Leader or Character',target:'scope' as const},
  {code:'TEST-TRAIT-COUNTER',effect:'[Counter] Up to 1 of your [Revolutionary Army] type Characters gains +2000 power during this battle.',name:'Revolutionary Army',target:'trait' as const},
 ];
 for(const card of cards){const document=compileEffectDocument({id:card.code,code:card.code,name:card.name,color:'Blue',type:'Event',cost:1,power:0,counter:0,rarity:'R',art:0,effect:card.effect}),action=document.ast.find(ability=>ability.trigger==='counter')?.actions[0];assert.ok(action);assert.equal(action.kind,'power');if(action.kind!=='power')throw new Error('Expected power action');const selector=card.target==='scope'?'target':card.target;assert.equal(action[selector],card.target==='scope'?(card.name==='Leader'?'own-leader':'own-card'):card.name);const scenario=scenarios({id:card.code,code:card.code,name:card.name,color:'Blue',card_type:'Event',cost:1,power:0,effect_text:card.effect}).find(item=>item.name.startsWith('schema-power counter:'));assert.ok(scenario);scenario.run(document);const broken=structuredClone(document);const brokenAction=broken.ast.find(ability=>ability.trigger==='counter')?.actions[0];if(brokenAction?.kind==='power')delete brokenAction[selector];assert.throws(()=>scenario.run(broken),/Counter power/);}
});

test('OP12-058 only gives Rush to an eligible top card actually played from deck',()=>{
 const effect='[Main] If your Leader\'s type includes "Whitebeard Pirates", reveal 1 card from the top of your deck. If that card is a Character card with a type including "Whitebeard Pirates" and a cost of 9 or less, you may play that card. If you do, that Character gains [Rush] during this turn.\n[Trigger] Draw 1 card.',document=compileEffectDocument({id:'OP12-058',code:'OP12-058',name:'I Will Make Whitebeard the King of the Pirates',color:'Blue',type:'Event',cost:1,power:0,counter:0,rarity:'',art:0,effect}),cases=scenarios({id:'OP12-058',code:'OP12-058',name:'I Will Make Whitebeard the King of the Pirates',color:'Blue',card_type:'Event',cost:1,power:0,effect_text:effect});assert.equal(cases.length,1);for(const scenario of cases)scenario.run(document);
});

test('OP10-099 readies only the printed Supernovas target and retains Blocker through the opponent turn',()=>{
 const effect='[End of Your Turn] You may turn 1 card from the top of your Life face-up: Set up to 1 of your "Supernovas" type Characters with a cost of 3 to 8 as active. That Character gains [Blocker] until the end of your opponent\'s next turn.';
 const document=compileEffectDocument({id:'test',code:'OP10-099',name:'Test Character',color:'Purple',type:'Character',cost:3,power:4000,counter:1000,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'OP10-099',name:'Test Character',color:'Purple',card_type:'Character',cost:3,power:4000,effect_text:effect});
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
});

test('ready effects preserve OR traits, printed attributes, cost limits and rested-only filters',()=>{
 const effect='[On Play] Set up to 1 of your "Supernovas" or "Heart Pirates" type rested Characters with a cost of 5 or less as active.';
 const document=compileEffectDocument({id:'test',code:'ST02-009',name:'Test Character',color:'Red',type:'Character',cost:3,power:4000,counter:1000,rarity:'',art:0,effect});
 const action=document.ast[0].actions[0];assert.equal(action.kind,'ready');if(action.kind!=='ready')throw new Error('Expected ready action');assert.deepEqual(action.traits,['Supernovas','Heart Pirates']);assert.equal(action.restedOnly,true);assert.equal(action.maxCost,5);
 const state={turn:'player' as const,cards:[{id:'supernova',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Supernovas'],cost:4,rested:true},{id:'heart-pirate',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Heart Pirates'],cost:5,rested:true},{id:'wrong-trait',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Navy'],cost:4,rested:true},{id:'already-active',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Supernovas'],cost:4,rested:false},{id:'too-expensive',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Heart Pirates'],cost:6,rested:true}],turnEffects:[],restrictions:[],delayed:[]};
 for(const id of ['supernova','heart-pirate'])assert(!applyEffectAction(state,'player',action,{targetId:id,cardIds:[id]}).error,`${id} should match one of the printed OR traits`);
 for(const id of ['wrong-trait','already-active','too-expensive'])assert(Boolean(applyEffectAction(state,'player',action,{targetId:id,cardIds:[id]}).error),`${id} should be ineligible`);
});

test('up-to no-ready effects preserve timing, target count, rested state and cost filter',()=>{
 const effect='[On Play]/[When Attacking] Up to 1 of your opponent\'s rested Characters with a cost of 7 or less will not become active in your opponent\'s next Refresh Phase.',document=compileEffectDocument({id:'test',code:'OP08-023',name:'Carrot',color:'Yellow',type:'Character',cost:3,power:5000,counter:1000,rarity:'',art:0,effect});assert.equal(document.ast.length,2);for(const ability of document.ast){const action=ability.actions[0];assert.equal(action.kind,'prevent-ready');if(action.kind!=='prevent-ready')throw new Error('Expected prevent-ready action');assert.equal(action.scope,'opponent-character');assert.equal(action.restedOnly,true);assert.equal(action.maxCost,7);assert.deepEqual(action.selection,{min:0,max:1});}
 const cases=scenarios({id:'test',code:'OP08-023',name:'Carrot',color:'Yellow',card_type:'Character',cost:3,power:5000,effect_text:effect}).filter(item=>item.name.startsWith('schema-prevent-ready'));assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
});

test('opponent power effects preserve target limits, sign, ownership and duration',()=>{
 const effect='[On Play] Give up to 1 of your opponent\'s Characters -2000 power during this turn.',document=compileEffectDocument({id:'test',code:'OP04-015',name:'Roronoa Zoro',color:'Red',type:'Character',cost:3,power:4000,counter:1000,rarity:'',art:0,effect}),action=document.ast[0].actions[0];assert.equal(action.kind,'power');if(action.kind!=='power')throw new Error('Expected power action');assert.equal(action.target,'opponent-character');assert.equal(action.amount,-2000);assert.deepEqual(action.selection,{min:0,max:1});
 const scenario=scenarios({id:'test',code:'OP04-015',name:'Roronoa Zoro',color:'Red',card_type:'Character',cost:3,power:4000,effect_text:effect}).find(item=>item.name.startsWith('schema-opponent-power'));assert.ok(scenario);scenario.run(document);
});

test('generic rested-card no-ready effects allow up-to targets across opponent field zones',()=>{
 const effect='[On K.O.] Up to 2 of your opponent\'s rested cards will not become active in your opponent\'s next Refresh Phase.',document=compileEffectDocument({id:'test',code:'OP15-023',name:'Arlong',color:'Red',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect}),action=document.ast[0].actions[0];assert.equal(action.kind,'prevent-ready');if(action.kind!=='prevent-ready')throw new Error('Expected prevent-ready action');assert.equal(action.scope,'opponent-card');assert.deepEqual(action.selection,{min:0,max:2});
 const scenario=scenarios({id:'test',code:'OP15-023',name:'Arlong',color:'Red',card_type:'Character',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('schema-prevent-ready'));assert.ok(scenario);scenario.run(document);
});

test('no-ready effects enforce attached DON!! thresholds on opponent Characters',()=>{
 const effect='[Main] Up to 1 of your opponent\'s rested Characters with a cost of 8 or less that has 2 or more DON!! cards given will not become active in your opponent\'s next Refresh Phase.',document=compileEffectDocument({id:'test',code:'OP15-038',name:'Test Event',color:'Black',type:'Event',cost:1,power:0,counter:0,rarity:'',art:0,effect});const action=document.ast[0].actions[0];assert.equal(action.kind,'prevent-ready');if(action.kind!=='prevent-ready')throw new Error('Expected prevent-ready action');assert.equal(action.scope,'opponent-character');assert.equal(action.maxCost,8);assert.equal(action.minAttachedDon,2);
 const scenario=scenarios({id:'test',code:'OP15-038',name:'Test Event',color:'Black',card_type:'Event',cost:1,power:0,effect_text:effect}).find(item=>item.name.startsWith('schema-prevent-ready'));assert.ok(scenario);scenario.run(document);
});

test('ready effects preserve trailing type-including filters',()=>{
 const effect='[End of Your Turn] Set up to 1 of your Characters with a type including "Red-Haired Pirates" as active.';
 const document=compileEffectDocument({id:'test',code:'OP17-031',name:'Yasopp',color:'Red',type:'Character',cost:4,power:5000,counter:1000,rarity:'',art:0,effect}),action=document.ast[0].actions[0];assert.equal(action.kind,'ready');if(action.kind!=='ready')throw new Error('Expected ready action');assert.equal(action.trait,'Red-Haired Pirates');
 const scenario=scenarios({id:'test',code:'OP17-031',name:'Yasopp',color:'Red',card_type:'Character',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('schema-ready-target'));assert.ok(scenario);scenario.run(document);
});

test('OP16-079 grants Rush when an eligible Character is played from its owner’s Trash',()=>{
 const effect='When a {Land of Wano} type Character card is played from your trash, that Character gains [Rush] during this turn.\n(This card can attack on the turn in which it is played.)';
 const document=compileEffectDocument({id:'listener',code:'OP16-079',name:'Test Listener',color:'Green',type:'Character',cost:2,power:4000,counter:1000,rarity:'',art:0,effect});
 const ability=document.ast[0];assert.equal(ability.trigger,'character-played-from-trash');const grant=ability.actions.find(action=>action.kind==='grant-keyword');assert(grant?.kind==='grant-keyword');if(grant?.kind!=='grant-keyword')throw new Error('Missing triggered Rush grant');assert.equal(grant.scope,'previous-played');assert.equal(grant.trait,'Land of Wano');
 const state={turn:'player' as const,cards:[{id:'listener',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:document},{id:'eligible',owner:'player' as const,zone:'trash' as const,type:'Character' as const,traits:['Land of Wano']},{id:'wrong',owner:'player' as const,zone:'trash' as const,type:'Character' as const,traits:['Navy']}],turnEffects:[],restrictions:[],delayed:[]};
 const play:EffectAction={kind:'play',source:'trash',amount:1,cardType:'Character',trait:'Land of Wano'};const result=applyEffectAction(state,'player',play,{cardIds:['eligible']});assert(!result.error&&!result.requiresSelection);assert.equal(result.state.cards.find(card=>card.id==='eligible')?.zone,'character');assert(result.state.cards.find(card=>card.id==='eligible')?.temporaryKeywords?.includes('rush'));assert(!result.state.cards.find(card=>card.id==='wrong')?.temporaryKeywords?.includes('rush'));
 const noListener={...state,cards:state.cards.filter(card=>card.id!=='listener')};const plain=applyEffectAction(noListener,'player',play,{cardIds:['eligible']});assert(!plain.error&&!plain.requiresSelection);assert(!plain.state.cards.find(card=>card.id==='eligible')?.temporaryKeywords?.includes('rush'));
});
