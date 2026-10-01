import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument,parseEffects} from '../packages/domain/effect-rules';
import type {Card} from '../packages/card-data/catalog';
import {isPlayableSet} from '../packages/domain/release-availability';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';
import {applyEffectAction,type MatchEffectState} from '../packages/domain/match-effect-state';

const card=(effect:string)=>({id:'effect-test',code:'TEST-001',name:'Test',color:'Black',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect} as Card);

test('activated self-trash is a payment and the power reduction is the resolving effect',()=>{
 const effect=parseEffects(card('[Activate: Main] You may trash this Character: Give up to 1 of your opponent\'s 0 cost Characters -3000 power during this turn.'))[0];
 assert.ok(effect.costs.some(cost=>cost.kind==='trash'&&cost.scope==='self'));
 assert.ok(effect.actions.some(action=>action.kind==='power'&&action.amount===-3000&&action.target==='opponent-character'));
 assert.ok(!effect.actions.some(action=>action.kind==='trash'&&action.scope==='self'));
});

test('targeted removal preserves its printed restrictions',()=>{
 const actions=parseEffects(card('[On Play] K.O. up to 1 of your opponent\'s rested Characters with a cost of 4 or less.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='ko'),{kind:'ko',maxCost:4,maxPower:undefined,restedOnly:true,selection:{min:0,max:1}});
});

test('search, DON, and zone movement effects become reusable actions',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; add up to 1 DON!! card from your DON!! deck and rest it. Then, trash 2 cards from the top of your deck.'))[0].actions;
 assert.ok(actions.some(action=>action.kind==='search'&&action.amount===5));
 assert.ok(actions.some(action=>action.kind==='add-don'&&action.amount===1&&action.rested));
 assert.ok(actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===2));
});

test('search preserves the printed type and trait restriction',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; reveal up to 1 {Straw Hat Crew} type Character card and add it to your hand. Place the rest at the bottom of your deck in any order.'))[0].actions;
 assert.deepEqual(actions.find(action=>action.kind==='search'),{kind:'search',amount:5,choose:1,destination:'deck-bottom',cardType:'Character',trait:'Straw Hat Crew'});
});

test('power gains preserve a trait restriction across Leader and Character recipients',()=>{
 const action=parseEffects(card('[On Play] Up to 1 of your [Land of Wano] type Leader or Character cards gains +1000 power during this turn.'))[0].actions.find(action=>action.kind==='power');
 assert.deepEqual(action,{kind:'power',amount:1000,until:'turn-end',selection:{min:0,max:1},trait:'Land of Wano',target:'own-card'});
});

test('next-Refresh restrictions preserve all, rested-only, and cost filters',()=>{
 const document=compileEffectDocument(card("[Main] All of your opponent's rested Characters with a cost of 7 or less will not become active in your opponent's next Refresh Phase."));
 const action=document.ast[0].actions[0];
 assert.deepEqual(action,{kind:'prevent-ready',scope:'opponent-character',until:'opponent-next-refresh',maxCost:7,restedOnly:true,selection:{min:0,max:'all'}});
 const state:MatchEffectState={turn:'player',cards:[{id:'eligible',owner:'opponent',zone:'character',type:'Character',cost:7,rested:true},{id:'active',owner:'opponent',zone:'character',type:'Character',cost:7,rested:false},{id:'over-cost',owner:'opponent',zone:'character',type:'Character',cost:8,rested:true},{id:'own',owner:'player',zone:'character',type:'Character',cost:7,rested:true}],turnEffects:[],restrictions:[],delayed:[]};
 const resolved=applyEffectAction(state,'player',action,{cardIds:[]});
 assert.equal(resolved.error,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='eligible')?.cannotReady,true);
 assert.equal(resolved.state.cards.find(item=>item.id==='active')?.cannotReady,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='over-cost')?.cannotReady,undefined);
 assert.equal(resolved.state.cards.find(item=>item.id==='own')?.cannotReady,undefined);
});

import {createMatchSnapshot,rulesetForDate,type Ruleset} from '../packages/domain/match-ruleset';
test('a match keeps the ruleset in force on its start date',()=>{
 const rulesets:Ruleset[]=[
  {id:'old',code:'opcg-2026-01',rulesRevision:'1',effectiveFrom:'2026-01-01',effectiveTo:'2026-05-31',status:'retired',rules:{}},
  {id:'current',code:'opcg-2026-06',rulesRevision:'2',effectiveFrom:'2026-06-01',status:'published',rules:{}},
 ];
 const ruleset=rulesetForDate(rulesets,'2026-09-24');
 assert.equal(ruleset?.id,'current');
 assert.equal(createMatchSnapshot(ruleset!,['a'],['b']).rulesetId,'current');
});

test('trigger-card hand costs remain explicit before an On Play draw resolves',()=>{
 const effect=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'))[0];
 assert.ok(effect.costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand'&&cost.amount===1&&cost.requiresTrigger));
 assert.ok(effect.actions.some(action=>action.kind==='draw'&&action.amount===3));
 assert.ok(!effect.actions.some(action=>action.kind==='trash'&&action.scope==='hand'));
});


test('separate printed triggers become separate executable effect schemas',()=>{
 const effects=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.\n[Trigger] Look at 5 cards from the top of your deck; reveal up to 1 {Big Mom Pirates} type card and add it to your hand. Then, place the rest at the bottom of your deck in any order.'));
 assert.equal(effects.length,2);
 assert.equal(effects[0].trigger,'on-play');
 assert.ok(effects[0].costs.some(cost=>cost.kind==='trash'&&cost.requiresTrigger));
 assert.ok(effects[0].actions.some(action=>action.kind==='draw'&&action.amount===3));
 assert.equal(effects[1].trigger,'trigger');
 assert.ok(effects[1].actions.some(action=>action.kind==='search'&&action.trait==='Big Mom Pirates'));
});

test('life placement, DON payments, and effect negation preserve their targets',()=>{
 const actions=parseEffects(card('[Main] You may rest 2 of your DON!! cards: Negate the effect of up to 1 of your opponent\'s Characters with a cost of 5 or less during this turn. Add up to 1 Character with a cost of 9 or less to the top or bottom of the owner\'s Life cards face-down.'))[0].actions;
 const costs=parseEffects(card('[Main] You may rest 2 of your DON!! cards: Negate the effect of up to 1 of your opponent\'s Characters with a cost of 5 or less during this turn.'))[0].costs;
 assert.ok(costs.some(cost=>cost.kind==='rest'&&cost.scope==='don'&&cost.amount===2));
 assert.ok(actions.some(action=>action.kind==='negate-effect'&&action.scope==='opponent-character'));
 assert.ok(actions.some(action=>action.kind==='move-to-life'&&action.scope==='own'&&action.position==='choice'&&action.faceUp===false));
});

test('persistent effect documents preserve the four parser layers and custom escape hatch',()=>{
 const document=compileEffectDocument(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'));
 assert.equal(document.parserVersion,'0.4.0');
 assert.equal(document.resolver.type,'DSL');
 assert.equal(document.implementationStatus,'PARSED');
 assert.equal(document.ast[0].rawText,document.rawEffectText);
 assert.deepEqual(document.normalized[0].sequence.map(step=>step.type),['PAY_COST','RESOLVE']);
 const custom=compileEffectDocument(card('[On Play] Choose one:\n• Do something uniquely worded.'));
 assert.equal(custom.resolver.type,'CUSTOM');
 assert.equal(custom.implementationStatus,'RAW');
 assert.match(custom.resolver.type==='CUSTOM'?custom.resolver.handler:'',/^TEST_001_ON_PLAY$/);
});

test('incomplete releases stay outside player-facing card pools',()=>{
 assert.equal(isPlayableSet('OP19'),false);
 assert.equal(isPlayableSet('OP-19'),false);
 assert.equal(isPlayableSet('EB06'),false);
 assert.equal(isPlayableSet('EB-06'),false);
 assert.equal(isPlayableSet('OP18'),true);
 assert.equal(isPlayableSet('OP-18'),true);
 assert.equal(isPlayableSet('EB05'),true);
 assert.equal(isPlayableSet('EB-05'),true);
 assert.equal(isPlayableSet('OP17'),true);
});

test('runtime preserves cost before the ordered effect actions',()=>{
 const document=compileEffectDocument(card('[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 3 cards.'));
 const resolved=resolveEffectTiming(document,'on-play');
 assert.equal(resolved.status,'ready');
 assert.deepEqual(resolved.commands.map(command=>command.kind),['pay-cost','resolve-action']);
});

test('Black Trash play retains color, trait, cost, rest, and self-exclusion restrictions',()=>{
 const effects=parseEffects(card('[On Play] Play up to 1 black {Thriller Bark Pirates} type Character card with a cost of 2 or less other than [Perona] from your trash rested.'))[0].actions;
 const play=effects.find((action):action is Extract<typeof action,{kind:'play'}>=>action.kind==='play');
 assert.deepEqual(play,{kind:'play',source:'trash',amount:1,maxCost:2,rested:true,cardType:'Character',trait:'Thriller Bark Pirates',color:'black',excludeName:'Perona'});
});

test('deck plays retain exact cost, color, trait, and shuffle as ordered actions',()=>{
 const parsed=parseEffects(card('[On K.O.] Play up to 1 green {Land of Wano} type Character card with a cost of 3 from your deck. Then, shuffle your deck.'))[0];
 assert.deepEqual(parsed.actions.find(action=>action.kind==='play'),{kind:'play',source:'deck',amount:1,exactCost:3,trait:'Land of Wano',color:'green',cardType:'Character'});
 assert.deepEqual(parsed.actions.filter(action=>action.kind==='shuffle'),[{kind:'shuffle',scope:'self'}]);
});

test('circled DON cost pays the printed amount before the activated effect',()=>{
 const parsed=parseEffects(card('[Activate: Main] ③ (You may rest the specified number of DON!! cards in your cost area.): Set this Character as active.'))[0];
 assert.deepEqual(parsed.costs.find(cost=>cost.kind==='rest'),{kind:'rest',scope:'don',amount:3,optional:false});
});

test('Kaku replacement is parsed separately from its On Play mill',()=>{
 const document=compileEffectDocument({...card('[Once Per Turn] If your black Character with a base cost of 5 or less would be K.O.’d by your opponent’s effect, you may place 3 cards from your trash at the bottom of your deck in any order instead.\n[On Play] Trash 2 cards from the top of your deck.'),code:'EB04-043'});
 assert.equal(document.resolver.type,'DSL');
 const replacement=document.ast.find(effect=>effect.trigger==='continuous')?.actions.find(action=>action.kind==='replacement');
 assert.deepEqual(replacement,{kind:'replacement',event:'ko-by-effect',cost:{kind:'bottom-deck-trash',amount:3},eligibility:{color:'black',cardType:'Character',maxBaseCost:5},oncePerTurn:true});
 assert.ok(document.ast.find(effect=>effect.trigger==='on-play')?.actions.some(action=>action.kind==='trash'&&action.scope==='deck'&&action.amount===2));
});

test('Kuma separates thresholded deck-to-Life and On K.O. opponent-Life movement',()=>{
 const document=compileEffectDocument({...card("[On Play] If you have 2 or less Life cards, add up to 1 card from the top of your deck to the top of your Life cards.\n[On K.O.] Add up to 1 card from the top of your opponent's Life cards to the owner's hand."),code:'EB04-054'});
 assert.equal(document.resolver.type,'DSL');
 const onPlay=document.ast.find(effect=>effect.trigger==='on-play');
 assert.deepEqual(onPlay?.actions.find(action=>action.kind==='move-to-life'),{kind:'move-to-life',scope:'own',amount:1,position:'top',source:'deck-top',selection:{min:0,max:1}});
 assert.equal(document.ast.find(effect=>effect.trigger==='on-ko')?.actions.find(action=>action.kind==='life'&&action.operation==='opponent-top-to-owner-hand')?.kind,'life');
});

test('Monkey.D.Luffy attaches rested DON and limits battle protection by Strike attribute and DON count',()=>{
 const document=compileEffectDocument({...card('[DON!! x2] This Character cannot be K.O.\'d in battle by "Strike" attribute Characters. [Activate:Main] [Once Per Turn] Give this Character up to 2 rested DON!! cards.'),code:'OP01-024'});
 assert.equal(document.resolver.type,'DSL');
 const protection=document.ast.find(effect=>effect.trigger==='unknown')?.actions.find(action=>action.kind==='prevent-ko');
 assert.deepEqual(protection,{kind:'prevent-ko',scope:'own-character',by:'battle',attribute:'Strike',byCardType:'Character',requiresAttachedDon:2});
 assert.deepEqual(document.ast.find(effect=>effect.trigger==='activate-main')?.actions.find(action=>action.kind==='attach-don'),{kind:'attach-don',amount:2,source:'cost-area',rested:true,recipient:'self',selection:{min:0,max:2}});
});

test('hand-trash costs preserve printed color, trait, type, and cost restrictions',()=>{
 const parsed=parseEffects(card('[On Play] You may trash 2 black "Navy" type Character cards with a cost of 4 or less from your hand: Draw 3 cards.'))[0];
 const cost=parsed.costs.find((item):item is Extract<typeof item,{kind:'trash'}>=>item.kind==='trash');
 assert.deepEqual(cost,{kind:'trash',scope:'hand',amount:2,requiresTrigger:false,optional:true,color:'black',trait:'Navy',cardType:'Character',maxCost:4});
});

test('a dual-timing Event keeps Main search and Counter battle power separate',()=>{
 const event={...card('[Main] Look at 5 cards from the top of your deck; reveal up to 1 card with a type including "Red-Haired Pirates" and add it to your hand. Then, place the rest at the bottom of your deck in any order.\n[Counter] You may rest 1 of your cards: Up to 1 of your Leader or Characters gains +3000 power during this battle.'),type:'Event',code:'OP17-037',name:'Are You That Afraid of the New Era?!'} as Card;
 const effects=parseEffects(event);
 const main=effects.find(effect=>effect.trigger==='main');
 const counter=effects.find(effect=>effect.trigger==='counter');
 const search=main?.actions.find(action=>action.kind==='search');
 assert.equal(search?.kind,'search');
 assert.equal(search?.amount,5);
 assert.equal(search?.choose,1);
 assert.equal(search?.destination,'deck-bottom');
 assert.equal(search?.trait,'Red-Haired Pirates');
 assert.ok(counter?.actions.some(action=>action.kind==='power'&&action.amount===3000&&action.until==='battle'));
 assert.match(counter?.source??'',/rest 1 of your cards/i);
});

test('mixed-trait and colour searches keep their alternatives separate',()=>{
 const actions=parseEffects(card('[On Play] Look at 5 cards from the top of your deck; reveal up to 1 [Monkey.D.Luffy] or red Event and add it to your hand. Then, place the rest at the bottom of your deck in any order.'))[0].actions;
 const search=actions.find((action):action is Extract<typeof action,{kind:'search'}>=>action.kind==='search');
 assert.deepEqual(search,{kind:'search',amount:5,choose:1,destination:'deck-bottom',cardType:undefined,trait:undefined,alternatives:[{name:'Monkey.D.Luffy'},{color:'red',cardType:'Event'}]});
});

test('deck search keeps included type alternatives and each printed selection cap',()=>{
 const included=parseEffects(card('[Main] Look at 4 cards from the top of your deck; reveal up to 1 "Cross Guild" type card or card with a type including "Baroque Works" and add it to your hand. Then, place the rest at the bottom of your deck in any order.'))[0].actions.find(action=>action.kind==='search');
 assert.ok(included?.kind==='search');
 assert.deepEqual(included.alternatives,[{trait:'Cross Guild'},{trait:'Baroque Works'}]);
 const document=compileEffectDocument(card('[Main] Look at 3 cards from the top of your deck; reveal up to 1 [Monkey.D.Luffy] or up to 1 card with a type including "Whitebeard Pirates" and add it to your hand. Then, place the rest at the bottom of your deck in any order.'));
 const search=document.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='search');
 assert.ok(search?.kind==='search');assert.equal(search.choose,2);
 const state:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'luffy',owner:'player',zone:'deck',type:'Character',name:'Monkey.D.Luffy'},
  {id:'luffy-2',owner:'player',zone:'deck',type:'Character',name:'Monkey.D.Luffy'},
  {id:'whitebeard',owner:'player',zone:'deck',type:'Character',name:'Ace',traits:['Whitebeard Pirates']},
  {id:'other',owner:'player',zone:'deck',type:'Character',name:'Other'},
 ]};
 const valid=applyEffectAction(state,'player',search,{cardIds:['luffy','whitebeard']});assert.equal(valid.error,undefined);assert.deepEqual(valid.state.cards.filter(item=>item.zone==='hand').map(item=>item.id).sort(),['luffy','whitebeard']);
 const repeated=applyEffectAction(state,'player',search,{cardIds:['luffy','luffy-2']});assert.ok(repeated.error);
});

test('inline timing markers do not merge Main with Trigger',()=>{
 const effects=parseEffects(card('[Main] Draw 1 card.[Trigger] Draw 2 cards.'));
 assert.deepEqual(effects.map(effect=>effect.trigger),['main','trigger']);
 assert.deepEqual(effects.map(effect=>effect.actions.filter(action=>action.kind==='draw').map(action=>action.amount)),[[1],[2]]);
});

test('Shalria searches before discarding from hand and does not make the discard an activation cost',()=>{
 const document=compileEffectDocument(card('[On Play] Look at 3 cards from the top of your deck; reveal up to 1 "Celestial Dragons" type card other than [Saint Shalria] and add it to your hand. Then, trash the rest and trash 1 card from your hand.'));
 assert.deepEqual(document.normalized[0].sequence.map(step=>step.type==='RESOLVE'?step.action.kind:'cost'),['search','trash']);
});

test('DON!! additions distinguish active and rested instructions',()=>{
 const active=parseEffects(card('[On Play] Add up to 1 DON!! card from your DON!! deck and set it as active.'))[0].actions.find(action=>action.kind==='add-don');
 const rested=parseEffects(card('[On Play] Add up to 2 DON!! cards from your DON!! deck and rest them.'))[0].actions.find(action=>action.kind==='add-don');
 assert.equal(active?.kind==='add-don'&&active.rested,false);
 assert.equal(rested?.kind==='add-don'&&rested.rested,true);
 const ready=parseEffects(card('[Main] Set up to 2 of your DON!! cards as active.'))[0].actions.find(action=>action.kind==='ready');
 assert.deepEqual(ready,{kind:'ready',scope:'own-don',amount:2,selection:{min:0,max:2}});
});

test('adjacent timing labels share the same ability body and preserve printed keywords',()=>{
 const parsed=parseEffects(card('[Blocker][On Play][When Attacking] Draw 1 card.'));
 assert.ok(parsed.some(effect=>effect.actions.some(action=>action.kind==='blocker')));
 for(const timing of ['on-play','when-attacking'])assert.deepEqual(parsed.find(effect=>effect.trigger===timing)?.actions,[{kind:'draw',amount:1}]);
});

test('a Trigger requirement in the middle of an ability is not a new timing window',()=>{
 const parsed=parseEffects(card('[On Play] You may trash 1 card with a [Trigger] and a cost of 3 or less from your hand: Draw 2 cards. [Trigger] Draw 1 card.'));
 assert.equal(parsed.length,2);
 assert.equal(parsed[0].trigger,'on-play');
 assert.equal(parsed[0].costs[0]?.kind,'trash');
 assert.equal(parsed[1].trigger,'trigger');
 assert.deepEqual(parsed[1].actions,[{kind:'draw',amount:1}]);
});

test('hand reset owns its shuffle and draw instead of emitting a second draw',()=>{
 const parsed=parseEffects(card('[Main] You return all cards in your hand to your deck, shuffle your deck, then draw 5 cards.'))[0];
 assert.deepEqual(parsed.actions,[{kind:'hand-reset',scope:'self',draw:5,shuffle:true}]);
});

test('a separate natural-language once-per-turn ability does not contaminate On Play',()=>{
 const document=compileEffectDocument(card('[On Play] Draw 1 card.\n[Once Per Turn] When your Leader with a type including "Rocks Pirates" attacks or is attacked, you may trash 1 card from your hand to activate this effect. Your Leader gains +3000 power during this battle.'));
 const commands=resolveEffectTiming(document,'on-play').commands;
 assert.deepEqual(commands.map(c=>c.value),[{kind:'draw',amount:1}]);
 assert.equal(document.normalized.length,2);
});
