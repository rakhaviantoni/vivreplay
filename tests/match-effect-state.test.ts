import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applyEffectAction,beginTurn,declareAttack,declareBlock,effectiveCardPower,effectivePlayCost,expireEffectModifiers,payEffectCost,playCard,playCounters,resolveBattle,type MatchEffectState} from '../packages/domain/match-effect-state';
import {executeEffectCommands,resolveCardEffect} from '../packages/domain/effect-runtime';
import {compileEffectDocument,type EffectAction} from '../packages/domain/effect-rules';
import type {Card} from '../packages/card-data/catalog';

const state=():MatchEffectState=>({turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
 {id:'own-leader',owner:'player',zone:'leader',type:'Leader'},
 {id:'own-don-1',owner:'player',zone:'cost-area',type:'DON!!'},
 {id:'own-don-2',owner:'player',zone:'cost-area',type:'DON!!'},
 {id:'own-hand',owner:'player',zone:'hand',type:'Character'},
 {id:'deck-1',owner:'player',zone:'deck',type:'Character'},
 {id:'deck-2',owner:'player',zone:'deck',type:'Character'},
 {id:'enemy-rested',owner:'opponent',zone:'character',type:'Character',cost:4,power:4000,rested:true},
 {id:'enemy-active',owner:'opponent',zone:'character',type:'Character',cost:6,power:7000},
]});

test('the effect state applies a selected K.O. only when its printed restrictions hold',()=>{
 const killed=applyEffectAction(state(),'player',{kind:'ko',maxCost:4,restedOnly:true},{targetId:'enemy-rested'});
 assert.equal(killed.state.cards.find(card=>card.id==='enemy-rested')?.zone,'trash');
 const rejected=applyEffectAction(state(),'player',{kind:'ko',maxCost:4,restedOnly:true},{targetId:'enemy-active'});
 assert.match(rejected.error??'',/cost limit/);
});

test('OP12-036 blocks effect play and applies Slash-gated self power and battle protection',()=>{
 const doc=compileEffectDocument({id:'op12-036',code:'OP12-036',name:'Roronoa Zoro',type:'Character',color:'Green',cost:5,power:6000,counter:0,rarity:'',art:0,effect:'This card in your hand cannot be played by effects.\nIf your Leader has the (Slash) attribute, this Character cannot be K.O.’d in battle by (Slash) attribute cards and gains +1000 power.'});
 const prohibition=doc.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='effect-play-prohibition');assert.ok(prohibition);
 const play=applyEffectAction({...state(),cards:[{id:'zoro',owner:'player',zone:'hand',type:'Character',effectSchema:doc}]},'player',{kind:'play',source:'hand',cardType:'Character'},{targetId:'zoro'});assert.match(play.error??'',/cannot be played by an effect/);
 const leader={id:'leader',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,attributes:['Slash']};
 const zoro={id:'zoro',owner:'player' as const,zone:'character' as const,type:'Character' as const,power:6000,attributes:['Slash'],effectSchema:doc};
 const slashAttacker={id:'enemy-slash',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,power:7000,attributes:['Slash']};
 const protectedState:MatchEffectState={turn:'opponent',cards:[leader,zoro,slashAttacker],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(effectiveCardPower(protectedState,'zoro'),7000,'Zoro should gain +1000 only while the Leader has Slash');
 const protectedBattle=resolveBattle(protectedState,'enemy-slash','zoro');assert.equal(protectedBattle.state.cards.find(card=>card.id==='zoro')?.zone,'character','Slash battle must not K.O. Zoro');
 const unprotectedBattle=resolveBattle({...protectedState,cards:protectedState.cards.map(card=>card.id==='leader'?{...card,attributes:['Wisdom']}:card)},'enemy-slash','zoro');assert.equal(unprotectedBattle.state.cards.find(card=>card.id==='zoro')?.zone,'trash','Non-Slash Leader must not grant protection');
});

test('OP12-070 scales power per five Events and can pay DON!! to replace opponent-effect removal',()=>{
 const doc=compileEffectDocument({id:'op12-070',code:'OP12-070',name:'Sanji',type:'Character',color:'Blue',cost:5,power:6000,counter:0,rarity:'',art:0,effect:'This Character gains +1000 power for every 5 Events in your trash.\nIf this Character would be removed from the field by your opponent’s effect, you may return 1 DON!! card from your field to your DON!! deck instead.'});
 const sanji={id:'sanji',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,power:6000,effectSchema:doc};
 const make=(events:number):MatchEffectState=>({turn:'player',cards:[sanji,...Array.from({length:events},(_,i)=>({id:`event-${i}`,owner:'opponent' as const,zone:'trash' as const,type:'Event' as const})),{id:'don',owner:'opponent',zone:'cost-area',type:'DON!!'}],turnEffects:[],restrictions:[],delayed:[]});
 assert.equal(effectiveCardPower(make(4),'sanji'),6000);assert.equal(effectiveCardPower(make(5),'sanji'),7000);assert.equal(effectiveCardPower(make(10),'sanji'),8000);
 const removal=make(5),action:EffectAction={kind:'ko',scope:'opponent-character'};const offer=applyEffectAction(removal,'player',action,{targetId:'sanji'});assert.match(offer.requiresSelection??'',/may pay its removal replacement/);const paid=applyEffectAction(removal,'player',action,{targetId:'sanji',choice:'accept',cardIds:['don']});assert.equal(paid.state.cards.find(card=>card.id==='sanji')?.zone,'character');assert.equal(paid.state.cards.find(card=>card.id==='don')?.zone,'don-deck');
});

test('OP17-095 replacement protects any own Character by bottom-decking exactly three Trash cards',()=>{
 const doc=compileEffectDocument({id:'op17-095',code:'OP17-095',name:'Roronoa Zoro',type:'Character',color:'Red',cost:6,power:7000,counter:0,rarity:'',art:0,effect:'If there is a Character with a cost of 12 or more, this Character gains +3000 power.\nIf one of your Characters would be removed from the field by your opponent’s effect, you may place 3 cards from your trash at the bottom of your deck in any order instead.'});
 const defender={id:'defender',owner:'player' as const,zone:'character' as const,type:'Character' as const,cost:4,power:5000};const protector={id:'protector',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:doc};
 const cards:MatchEffectState['cards']=[defender,protector,...Array.from({length:3},(_,i)=>({id:`trash-${i}`,owner:'player' as const,zone:'trash' as const,type:'Event' as const})),{id:'enemy',owner:'opponent',zone:'character',type:'Character'}];const board:MatchEffectState={turn:'opponent',cards,turnEffects:[],restrictions:[],delayed:[]};
 const action:EffectAction={kind:'ko',scope:'opponent-character'};const offer=applyEffectAction(board,'opponent',action,{targetId:'defender'});assert.match(offer.requiresSelection??'',/may pay its removal replacement/);const paid=applyEffectAction(board,'opponent',action,{targetId:'defender',choice:'accept',cardIds:['trash-0','trash-1','trash-2']});assert.equal(paid.state.cards.find(card=>card.id==='defender')?.zone,'character');assert.equal(paid.state.cards.filter(card=>card.owner==='player'&&card.zone==='deck').length,3);
});

test('an attack can prevent every opposing Blocker for the battle without a power threshold',()=>{
 const text='[When Attacking] Your opponent cannot activate a [Blocker] during this battle.';
 const schema=compileEffectDocument({id:'attacker',code:'ST01-012',name:'Monkey.D.Luffy',type:'Character',color:'Red',cost:1,power:5000,rarity:'C',art:0,effect:text});
 const action=schema.ast.find(ability=>ability.trigger==='when-attacking')?.actions.find(item=>item.kind==='prevent-keyword-activation');
 assert.deepEqual(action,{kind:'prevent-keyword-activation',keyword:'blocker',scope:'opponent-character',until:'battle'});
 const board:MatchEffectState={...state(),cards:[...state().cards,{id:'enemy-blocker',owner:'opponent',zone:'character',type:'Character',keywords:['blocker']}]};
 const locked=applyEffectAction(board,'player',action!);
 assert.equal(declareBlock(locked.state,'opponent','enemy-blocker').error,'This Blocker cannot activate during this battle.');
 const afterBattle={...locked.state,turnEffects:locked.state.turnEffects.filter(effect=>effect.expires!=='battle')};
 assert.equal(declareBlock(afterBattle,'opponent','enemy-blocker').error,undefined);
});

test('Kaku replaces one eligible opponent-effect K.O. by bottom-decking exactly three own Trash cards',()=>{
 const match=state();
 const schema=compileEffectDocument({id:'kaku',code:'EB04-043',name:'Kaku',color:'Black',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect:'[Once Per Turn] If your black Character with a base cost of 5 or less would be K.O.’d by your opponent’s effect, you may place 3 cards from your trash at the bottom of your deck in any order instead.\n[On Play] Trash 2 cards from the top of your deck.'});
 match.cards.push({id:'kaku',owner:'opponent',zone:'character',type:'Character',name:'Kaku',color:'Black',cost:3,effectSchema:schema},{id:'saved',owner:'opponent',zone:'character',type:'Character',name:'Black target',color:'Black',cost:5},{id:'too-costly',owner:'opponent',zone:'character',type:'Character',color:'Black',cost:6},...['trash-a','trash-b','trash-c','trash-d'].map(id=>({id,owner:'opponent' as const,zone:'trash' as const,type:'Character' as const})));
 const offer=applyEffectAction(match,'player',{kind:'ko'},{targetId:'saved'});
 assert.match(offer.requiresSelection??'',/may place 3 cards/);assert.equal(offer.state,match);
 const bad=applyEffectAction(match,'player',{kind:'ko'},{targetId:'saved',choice:'accept',cardIds:['trash-a','trash-b']});
 assert.match(bad.error??'',/exactly 3/);assert.equal(bad.state,match);
 const paid=applyEffectAction(match,'player',{kind:'ko'},{targetId:'saved',choice:'accept',cardIds:['trash-a','trash-c','trash-d']});
 assert.equal(paid.state.cards.find(card=>card.id==='saved')?.zone,'character');
 assert.equal(paid.state.cards.find(card=>card.id==='trash-a')?.zone,'deck');
 assert.equal(paid.state.cards.find(card=>card.id==='trash-b')?.zone,'trash');
 assert.deepEqual(paid.state.cards.filter(card=>['trash-a','trash-c','trash-d'].includes(card.id)).map(card=>card.id),['trash-a','trash-c','trash-d']);
 const second=applyEffectAction(paid.state,'player',{kind:'ko'},{targetId:'too-costly'});
 assert.equal(second.state.cards.find(card=>card.id==='too-costly')?.zone,'trash','Out-of-range cost should bypass Kaku replacement.');
 const another=applyEffectAction(paid.state,'player',{kind:'ko'},{targetId:'saved'});
 assert.equal(another.state.cards.find(card=>card.id==='saved')?.zone,'trash','Once-per-turn replacement must not be used twice.');
});

test('effect costs require the exact legal DON!! selection',()=>{
 const missing=payEffectCost(state(),'player',{kind:'rest',scope:'don',amount:2,optional:true},{cardIds:['own-don-1']});
 assert.match(missing.requiresSelection??'',/2 active DON/);
 const paid=payEffectCost(state(),'player',{kind:'rest',scope:'don',amount:2,optional:true},{cardIds:['own-don-1','own-don-2']});
 assert.ok(paid.state.cards.filter(card=>card.id.startsWith('own-don')).every(card=>card.rested));
});

test('draw moves exactly the requested top cards from deck to hand',()=>{
 const drawn=applyEffectAction(state(),'player',{kind:'draw',amount:2});
 assert.equal(drawn.state.cards.filter(card=>card.zone==='hand').length,3);
 assert.equal(drawn.state.cards.filter(card=>card.zone==='deck').length,0);
});

test('search enforces printed trait and self-exclusion restrictions',()=>{
 const searchState:MatchEffectState={...state(),cards:[
  {id:'festival',owner:'player',zone:'character',type:'Character',name:'Buena Festa'},
  {id:'film',owner:'player',zone:'deck',type:'Character',name:'Uta',traits:['FILM']},
  {id:'self-copy',owner:'player',zone:'deck',type:'Character',name:'Buena Festa',traits:['FILM']},
  {id:'other',owner:'player',zone:'deck',type:'Character',name:'Random',traits:['Navy']},
 ]};
 const legal=applyEffectAction(searchState,'player',{kind:'search',amount:3,choose:1,destination:'hand',trait:'FILM',excludeName:'Buena Festa'},{cardIds:['film']});
 assert.equal(legal.state.cards.find(card=>card.id==='film')?.zone,'hand');
 const rejected=applyEffectAction(searchState,'player',{kind:'search',amount:3,choose:1,destination:'hand',trait:'FILM',excludeName:'Buena Festa'},{cardIds:['self-copy']});
 assert.match(rejected.error??'',/printed search restriction/);
});

test('a full-deck search with amount zero can select a qualifying card below the top cards',()=>{
 const match=state();match.cards.push({id:'late-film',owner:'player',zone:'deck',type:'Character',name:'Film Character',traits:['FILM']});
 const result=applyEffectAction(match,'player',{kind:'search',amount:0,choose:1,destination:'hand',trait:'FILM'},{cardIds:['late-film']});
 assert.equal(result.error,undefined);assert.equal(result.state.cards.find(card=>card.id==='late-film')?.zone,'hand');
 assert.deepEqual(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='deck').map(card=>card.id),['deck-1','deck-2']);
});

test('life and trash movements mutate card zones through the shared resolver',()=>{
 const movement:MatchEffectState={...state(),cards:[
  {id:'life-card',owner:'player',zone:'life',type:'Character'},
  {id:'trash-card',owner:'player',zone:'trash',type:'Character',cost:2,traits:['FILM']},
  {id:'hand-card',owner:'player',zone:'hand',type:'Character'},
 ]};
 const life=applyEffectAction(movement,'player',{kind:'life',operation:'add-to-hand',amount:1});
 assert.equal(life.state.cards.find(card=>card.id==='life-card')?.zone,'hand');
 const recovered=applyEffectAction(life.state,'player',{kind:'recover',source:'trash',destination:'hand',amount:1,maxCost:2,trait:'FILM'},{cardIds:['trash-card']});
 assert.equal(recovered.state.cards.find(card=>card.id==='trash-card')?.zone,'hand');
 const reset=applyEffectAction(recovered.state,'player',{kind:'bottom-deck-hand',scope:'self',amount:'all'});
 assert.equal(reset.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand').length,0);
});

test('hand reset returns the full hand to the deck before drawing the printed amount',()=>{
 const resetState:MatchEffectState={...state(),cards:[
  {id:'hand-1',owner:'player',zone:'hand',type:'Character'},
  {id:'hand-2',owner:'player',zone:'hand',type:'Character'},
  {id:'deck-1',owner:'player',zone:'deck',type:'Character'},
 ]};
 const reset=applyEffectAction(resetState,'player',{kind:'hand-reset',scope:'self',draw:2});
 assert.equal(reset.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand').length,2);
 assert.equal(reset.state.cards.filter(card=>card.owner==='player'&&card.zone==='deck').length,1);
});

test('dynamic hand reset draws exactly the cards returned, shuffling before drawing',()=>{
 const input:MatchEffectState={...state(),cards:[
  {id:'hand-a',owner:'player',zone:'hand',type:'Character'},
  {id:'hand-b',owner:'player',zone:'hand',type:'Character'},
  {id:'hand-c',owner:'player',zone:'hand',type:'Character'},
  {id:'deck-a',owner:'player',zone:'deck',type:'Character'},
  {id:'deck-b',owner:'player',zone:'deck',type:'Character'},
 ]};
 const action=compileEffectDocument({id:'reset',code:'OP04-048',name:'Sasaki',type:'Character',color:'Green',cost:4,power:5000,counter:0,rarity:'R',art:0,effect:'[On Play] Return all cards in your hand to your deck and shuffle your deck. Then, draw cards equal to the number you returned to your deck.'}).ast[0].actions[0];
 assert.equal(action.kind,'hand-reset');if(action.kind!=='hand-reset')throw new Error('Expected a hand reset action');
 const result=applyEffectAction(input,'player',action);
 assert.equal(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='hand').length,3);
 assert.equal(result.state.cards.filter(card=>card.owner==='player'&&card.zone==='deck').length,2);
});

test('bottom-deck effects can legally select an opponent hand or Trash card',()=>{
 const zones:MatchEffectState={...state(),cards:[
  {id:'opp-hand',owner:'opponent',zone:'hand',type:'Character'},
  {id:'opp-trash',owner:'opponent',zone:'trash',type:'Character'},
 ]};
 assert.equal(applyEffectAction(zones,'player',{kind:'bottom-deck',scope:'opponent-hand'},{targetId:'opp-hand'}).state.cards.find(card=>card.id==='opp-hand')?.zone,'deck');
 assert.equal(applyEffectAction(zones,'opponent',{kind:'bottom-deck',scope:'trash'},{targetId:'opp-trash'}).state.cards.find(card=>card.id==='opp-trash')?.zone,'deck');
});

test('an active Blocker rests and becomes a legal battle defender',()=>{
 const battle:MatchEffectState={...state(),cards:[
  {id:'attacker',owner:'player',zone:'character',type:'Character',power:5000},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader',power:5000},
  {id:'blocker',owner:'opponent',zone:'character',type:'Character',power:5000,keywords:['blocker']},
 ]};
 const blocked=declareBlock(battle,'opponent','blocker');
 assert.equal(blocked.state.cards.find(card=>card.id==='blocker')?.rested,true);
 const resolved=resolveBattle(blocked.state,'attacker','blocker',5000,5000);
 assert.equal(resolved.state.cards.find(card=>card.id==='blocker')?.zone,'trash');
 const rejected=declareBlock({...battle,cards:battle.cards.map(card=>card.id==='blocker'?{...card,rested:true}:card)},'opponent','blocker');
 assert.match(rejected.error??'',/rested/);
});

test('a Leader takes Life on equal power and loses with no Life remaining',()=>{
 const leaderBattle:MatchEffectState={...state(),cards:[
  {id:'attacker',owner:'player',zone:'character',type:'Character'},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader'},
  {id:'life',owner:'opponent',zone:'life',type:'Character'},
 ]};
 const hit=resolveBattle(leaderBattle,'attacker','leader',5000,5000);
 assert.equal(hit.state.cards.find(card=>card.id==='life')?.zone,'hand');
 assert.equal(hit.leaderDamaged,'opponent');
 const finalHit=resolveBattle({...leaderBattle,cards:leaderBattle.cards.filter(card=>card.id!=='life')},'attacker','leader',5000,5000);
 assert.equal(finalHit.gameOver,'opponent');
});


test('Trigger-only hand costs and DON attachments enforce their printed selections',()=>{
 const effectState:MatchEffectState={...state(),cards:[
  {id:'leader',owner:'player',zone:'leader',type:'Leader'},
  {id:'trigger',owner:'player',zone:'hand',type:'Event',keywords:['trigger']},
  {id:'plain',owner:'player',zone:'hand',type:'Event'},
  {id:'don',owner:'player',zone:'cost-area',type:'DON!!'},
 ]};
 const rejected=payEffectCost(effectState,'player',{kind:'trash',scope:'hand',amount:1,requiresTrigger:true,optional:false},{cardIds:['plain']});
 assert.match(rejected.error??'',/outside the legal zone|cannot pay this cost/);
 const paid=payEffectCost(effectState,'player',{kind:'trash',scope:'hand',amount:1,requiresTrigger:true,optional:false},{cardIds:['trigger']});
 assert.equal(paid.state.cards.find(card=>card.id==='trigger')?.zone,'trash');
 const attached=applyEffectAction(effectState,'player',{kind:'attach-don',amount:1,source:'cost-area'},{targetId:'leader',cardIds:['don']});
 assert.equal(attached.state.cards.find(card=>card.id==='don')?.attachedTo,'leader');
});


test('runtime executes parsed costs and actions in their printed order',()=>{
 const document=compileEffectDocument({id:'test',code:'TEST-001',name:'Test',color:'Blue',type:'Character',cost:1,power:1000,counter:0,rarity:'C',art:0,effect:'[On Play] You may trash 1 card with a [Trigger] from your hand: Draw 2 cards.'});
 const commands=resolveCardEffect(document,'on-play').commands;
 const effectState:MatchEffectState={...state(),cards:[
  {id:'trigger',owner:'player',zone:'hand',type:'Event',keywords:['trigger']},
  {id:'deck-1',owner:'player',zone:'deck',type:'Character'},
  {id:'deck-2',owner:'player',zone:'deck',type:'Character'},
 ]};
 const resolved=executeEffectCommands(effectState,'player',commands,[{cardIds:['trigger']},{}]);
 assert.equal(resolved.error,undefined);
 assert.equal(resolved.state.cards.find(card=>card.id==='trigger')?.zone,'trash');
 assert.equal(resolved.state.cards.filter(card=>card.zone==='hand').length,2);
});

test('Trash play and recovery enforce Black card, trait, cost, and self-exclusion rules',()=>{
 const blackState:MatchEffectState={...state(),cards:[
  {id:'perona',owner:'player',zone:'character',type:'Character',name:'Perona',color:'Black'},
  {id:'eligible',owner:'player',zone:'trash',type:'Character',name:'Cindry',color:'Black',cost:2,traits:['Thriller Bark Pirates']},
  {id:'wrong-trait',owner:'player',zone:'trash',type:'Character',name:'Navy Card',color:'Black',cost:2,traits:['Navy']},
  {id:'wrong-color',owner:'player',zone:'trash',type:'Character',name:'Purple Card',color:'Purple',cost:2,traits:['Thriller Bark Pirates']},
 ]};
 const play={kind:'play',source:'trash',amount:1,maxCost:2,rested:true,trait:'Thriller Bark Pirates',color:'Black'} as const;
 const rejected=applyEffectAction(blackState,'player',play,{targetId:'wrong-trait'});
 assert.match(rejected.error??'',/printed play restriction/);
 const resolved=applyEffectAction(blackState,'player',play,{targetId:'eligible'});
 assert.equal(resolved.state.cards.find(card=>card.id==='eligible')?.zone,'character');
 assert.equal(resolved.state.cards.find(card=>card.id==='eligible')?.rested,true);
 const recovery=applyEffectAction(blackState,'player',{kind:'recover',source:'trash',destination:'hand',amount:1,maxCost:4,color:'Black',excludeName:'Perona'},{targetId:'perona'});
 assert.match(recovery.error??'',/printed recovery restriction/);
});

test('turn start returns attached DON!!, readies the field, draws, and adds the correct DON!! count',()=>{
 const turnState:MatchEffectState={...state(),turn:'opponent',firstPlayer:'player',turnNumber:0,cards:[
  {id:'leader',owner:'player',zone:'leader',type:'Leader',rested:true},
  {id:'character',owner:'player',zone:'character',type:'Character',rested:true},
  {id:'attached',owner:'player',zone:'cost-area',type:'DON!!',rested:false,attachedTo:'character'},
  {id:'spent',owner:'player',zone:'cost-area',type:'DON!!',rested:true},
  {id:'don-1',owner:'player',zone:'don-deck',type:'DON!!'},
  {id:'don-2',owner:'player',zone:'don-deck',type:'DON!!'},
  {id:'deck',owner:'player',zone:'deck',type:'Character'},
 ]};
 const first=beginTurn(turnState,'player',1);
 assert.equal(first.drawnCardId,undefined);
 assert.deepEqual(first.addedDonIds,['don-1']);
 assert.equal(first.state.cards.find(card=>card.id==='attached')?.attachedTo,undefined);
 assert.ok(first.state.cards.filter(card=>card.owner==='player'&&['leader','character','cost-area'].includes(card.zone)).every(card=>!card.rested));
 const later=beginTurn({...turnState,turnNumber:1},'player',2);
 assert.equal(later.drawnCardId,'deck');
 assert.equal(later.addedDonIds.length,2);
});

test('OP13-003 attaches only a DON!! placed after its DON!! Phase condition is already true and powers down at ten DON!!',()=>{
 const effect='If you have any DON!! cards on your field, 1 DON!! card placed during your DON!! Phase is given to your Leader.\nIf you have 9 or less DON!! cards on your field, give this Leader 2000 power.';
 const schema=compileEffectDocument({id:'roger',code:'OP13-003',name:'Gol.D.Roger',type:'Leader',color:'Purple/Red',cost:0,power:5000,rarity:'L',art:0,effect});
 const makeState=(fieldDon:number):MatchEffectState=>({turn:'player',firstPlayer:'opponent',turnNumber:1,turnEffects:[],restrictions:[],delayed:[],cards:[{id:'leader',owner:'player',zone:'leader',type:'Leader',power:5000,effectSchema:schema},...Array.from({length:fieldDon},(_,i)=>({id:`field-${i}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const})),{id:'placed-1',owner:'player',zone:'don-deck',type:'DON!!'},{id:'placed-2',owner:'player',zone:'don-deck',type:'DON!!'},{id:'deck-top',owner:'player',zone:'deck',type:'Character'}]});
 const firstTurn=beginTurn({...makeState(0),firstPlayer:'player',turnNumber:0},'player',1);assert.equal(firstTurn.state.cards.find(card=>card.id==='placed-1')?.attachedTo,undefined,'First-turn DON!! must not auto-attach without a DON!! present before the DON!! Phase');
 const nine=beginTurn(makeState(7),'player',2);assert.equal(nine.state.cards.find(card=>card.id==='placed-1')?.attachedTo,'leader','Exactly one newly placed DON!! must auto-attach to Roger');assert.equal(nine.state.cards.find(card=>card.id==='placed-2')?.attachedTo,undefined,'Only one DON!! from the DON!! Phase may be attached');assert.equal(effectiveCardPower(nine.state,'leader'),8000,'Roger must gain +2000 power as well as the +1000 from his attached DON!! while his field has nine DON!!');
 const ten=beginTurn(makeState(8),'player',2);assert.equal(ten.state.cards.find(card=>card.id==='placed-1')?.attachedTo,'leader','The DON!! replacement continues at ten total DON!!');assert.equal(effectiveCardPower(ten.state,'leader'),6000,'Roger must lose the conditional 2000 power at ten DON!! but keep the +1000 from attached DON!!');
});

test('drawing the final deck card loses the game',()=>{
 const result=beginTurn({...state(),firstPlayer:'opponent',turnNumber:2,cards:[{id:'deck',owner:'player',zone:'deck',type:'Character'}]},'player',3);
 assert.equal(result.gameOver,'player');
 assert.equal(result.state.cards.find(card=>card.id==='deck')?.zone,'hand');
});

test('normal plays pay active DON!!, replace a Stage, and trash Events',()=>{
 const playState:MatchEffectState={...state(),phase:'main',cards:[
  {id:'don-1',owner:'player',zone:'cost-area',type:'DON!!'},
  {id:'don-2',owner:'player',zone:'cost-area',type:'DON!!'},
  {id:'old-stage',owner:'player',zone:'stage',type:'Stage'},
  {id:'new-stage',owner:'player',zone:'hand',type:'Stage',cost:2},
  {id:'event',owner:'player',zone:'hand',type:'Event',cost:0,keywords:['main']},
 ]};
 const stage=playCard(playState,'player','new-stage');
 assert.equal(stage.state.cards.find(card=>card.id==='new-stage')?.zone,'stage');
 assert.equal(stage.state.cards.find(card=>card.id==='old-stage')?.zone,'trash');
 assert.ok(stage.state.cards.filter(card=>card.type==='DON!!').every(card=>card.rested));
 const event=playCard(stage.state,'player','event');
 assert.equal(event.state.cards.find(card=>card.id==='event')?.zone,'trash');
});

test('attack declarations and counter cards enforce core battle legality',()=>{
 const battle:MatchEffectState={...state(),turn:'player',phase:'main',turnNumber:2,firstPlayer:'opponent',playedThisTurn:['new-character'],cards:[
  {id:'attacker',owner:'player',zone:'character',type:'Character'},
  {id:'new-character',owner:'player',zone:'character',type:'Character'},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader'},
  {id:'active-character',owner:'opponent',zone:'character',type:'Character'},
  {id:'counter',owner:'opponent',zone:'hand',type:'Character',counter:1000},
 ]};
 const valid=declareAttack(battle,'player','attacker','leader');
 assert.equal(valid.state.cards.find(card=>card.id==='attacker')?.rested,true);
 assert.match(declareAttack(battle,'player','new-character','leader').error??'',/without Rush/);
 assert.match(declareAttack(battle,'player','attacker','active-character').error??'',/rested/);
 const counter=playCounters(valid.state,'opponent',['counter']);
 assert.equal(counter.total,1000);
 assert.equal(counter.state.cards.find(card=>card.id==='counter')?.zone,'trash');
});

test('OP17-063 grants +1000 Counter only to Character cards in its owner hand without printed Counter',()=>{
 const schema=compileEffectDocument({id:'op17-063',code:'OP17-063',name:'Boa Hancock',type:'Character',color:'Blue',cost:5,power:5000,counter:0,rarity:'R',art:0,effect:'All Character cards in your hand without a Counter have a +1000 Counter.\n[Activate: Main] [Once Per Turn] DON!! -1: If this Character was played on this turn, negate the effect of up to 1 of your opponent\'s Characters with a cost of 6 or less during this turn, and K.O. it.'});
 const match:MatchEffectState={...state(),cards:[
  {id:'source',owner:'player',zone:'character',type:'Character',effectSchema:schema},
  {id:'eligible',owner:'player',zone:'hand',type:'Character',counter:0},
  {id:'printed',owner:'player',zone:'hand',type:'Character',counter:2000},
  {id:'event',owner:'player',zone:'hand',type:'Event',counter:0},
  {id:'enemy-card',owner:'opponent',zone:'hand',type:'Character',counter:0},
 ]};
 const counter=playCounters(match,'player',['eligible']);assert.equal(counter.total,1000);assert.equal(counter.state.cards.find(card=>card.id==='eligible')?.zone,'trash');
 assert.equal(playCounters(match,'player',['printed']).total,2000,'An existing printed Counter remains usable without receiving an additional +1000');
 assert.match(playCounters(match,'player',['event']).error??'',/not legal Counter/);
 assert.match(playCounters(match,'opponent',['enemy-card']).error??'',/not legal Counter/);
 assert.equal(playCounters({...match,cards:match.cards.map(card=>card.id==='source'?{...card,effectNegated:true}:card)},'player',['eligible']).error!==undefined,true);
});

test('OP11-046 protects itself from opponent K.O. and rest effects only while all your Characters are GERMA',()=>{
 const schema=compileEffectDocument({id:'op11-046',code:'OP11-046',name:'GERMA Soldier',type:'Character',color:'Blue',cost:4,power:4000,counter:0,rarity:'R',art:0,effect:'[Blocker]\nIf you only have Characters with a type including "GERMA", this Character cannot be K.O.\'d or rested by your opponent\'s effects.'});
 const board:MatchEffectState={...state(),cards:[{id:'protected',owner:'player',zone:'character',type:'Character',traits:['GERMA'],effectSchema:schema},{id:'enemy-source',owner:'opponent',zone:'character',type:'Character',effectSchema:compileEffectDocument({id:'x',code:'X',name:'X',type:'Character',color:'Black',cost:1,power:1,counter:0,rarity:'C',art:0,effect:''})}]};
 const ko=applyEffectAction(board,'opponent',{kind:'ko'},{targetId:'protected',sourceCardId:'enemy-source'});assert.match(ko.error??'',/cannot be K\.O/);
 const rest=applyEffectAction(board,'opponent',{kind:'rest',scope:'opponent-character'},{targetId:'protected',sourceCardId:'enemy-source'});assert.match(rest.error??'',/cannot be rested/);
 const brokenCondition={...board,cards:[...board.cards,{id:'non-germa',owner:'player' as const,zone:'character' as const,type:'Character' as const,traits:['Straw Hat Crew']}]};
 const allowed=applyEffectAction(brokenCondition,'opponent',{kind:'rest',scope:'opponent-character'},{targetId:'protected',sourceCardId:'enemy-source'});assert.equal(allowed.error,undefined);assert.equal(allowed.state.cards.find(card=>card.id==='protected')?.rested,true);
});

test('OP09-118 wins only when the opponent actually activates Blocker and either player has zero Life',()=>{
 const schema=compileEffectDocument({id:'op09-118',code:'OP09-118',name:'Silvers Rayleigh',type:'Character',color:'Purple',cost:9,power:10000,counter:0,rarity:'SEC',art:0,effect:'[Rush] (This card can attack on the turn in which it is played.)\nWhen your opponent activates [Blocker], if either you or your opponent has 0 Life cards, you win the game.'});
 const make=(playerLife:number,opponentLife:number)=>({...state(),cards:[{id:'rayleigh',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:schema},{id:'blocker',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,keywords:['blocker']},...Array.from({length:playerLife},(_,index)=>({id:`plife-${index}`,owner:'player' as const,zone:'life' as const,type:'Character' as const})),...Array.from({length:opponentLife},(_,index)=>({id:`olife-${index}`,owner:'opponent' as const,zone:'life' as const,type:'Character' as const}))]});
 assert.equal(declareBlock(make(1,1),'opponent','blocker').gameOver,undefined);
 assert.equal(declareBlock(make(0,1),'opponent','blocker').gameOver,'player');
 assert.equal(declareBlock(make(1,0),'opponent','blocker').gameOver,'player');
 assert.equal(declareBlock(make(0,1),'player','blocker').gameOver,undefined,'Your own Blocker is not an activation by your opponent');
});

test('Counter Events pay their active DON!! cost and attachments return rested when their card leaves play',()=>{
 const counterState:MatchEffectState={...state(),cards:[
  {id:'leader',owner:'player',zone:'leader',type:'Leader'},
  {id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'leader'},
  {id:'enemy',owner:'opponent',zone:'character',type:'Character',cost:1},
  {id:'counter-event',owner:'opponent',zone:'hand',type:'Event',cost:1,counter:1000,keywords:['counter']},
  {id:'counter-don',owner:'opponent',zone:'cost-area',type:'DON!!'},
 ]};
 const counter=playCounters(counterState,'opponent',['counter-event'],['counter-don']);
 assert.equal(counter.total,1000);
 assert.equal(counter.state.cards.find(card=>card.id==='counter-don')?.rested,true);
 const returned=applyEffectAction(counterState,'player',{kind:'ko',maxCost:1},{targetId:'enemy'});
 assert.equal(returned.state.cards.find(card=>card.id==='attached')?.attachedTo,'leader');
 const moved=applyEffectAction(counterState,'player',{kind:'return-to-hand',scope:'own-character'},{targetId:'leader'});
 assert.match(moved.error??'',/outside the printed effect target/);
 const leaving=resolveBattle({...counterState,cards:counterState.cards.map(card=>card.id==='leader'?{...card,zone:'character'}:card)},'enemy','leader',5000,5000);
 assert.equal(leaving.state.cards.find(card=>card.id==='attached')?.attachedTo,undefined);
 assert.equal(leaving.state.cards.find(card=>card.id==='attached')?.rested,true);
});

test('a damaged Leader exposes a Trigger choice only for a Life card with Trigger',()=>{
 const battle:MatchEffectState={...state(),cards:[
  {id:'attacker',owner:'player',zone:'character',type:'Character'},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader'},
  {id:'life-trigger',owner:'opponent',zone:'life',type:'Event',keywords:['trigger']},
 ]};
 const result=resolveBattle(battle,'attacker','leader',5000,5000);
 assert.equal(result.lifeCardId,'life-trigger');
 assert.equal(result.triggerAvailable,true);
 assert.equal(result.state.cards.find(card=>card.id==='life-trigger')?.zone,'hand');
});

test('hand-trash costs reject cards outside printed color, trait, type, and cost restrictions',()=>{
 const effectState:MatchEffectState={...state(),cards:[
  {id:'eligible',owner:'player',zone:'hand',type:'Character',color:'Black',cost:4,traits:['Navy']},
  {id:'wrong-color',owner:'player',zone:'hand',type:'Character',color:'Blue',cost:4,traits:['Navy']},
  {id:'wrong-trait',owner:'player',zone:'hand',type:'Character',color:'Black',cost:4,traits:['Straw Hat Crew']},
  {id:'wrong-type',owner:'player',zone:'hand',type:'Event',color:'Black',cost:4,traits:['Navy']},
  {id:'wrong-cost',owner:'player',zone:'hand',type:'Character',color:'Black',cost:5,traits:['Navy']},
 ]};
 const cost={kind:'trash',scope:'hand',amount:1,optional:true,color:'black',trait:'Navy',cardType:'Character',maxCost:4} as const;
 const rejected=payEffectCost(effectState,'player',cost,{cardIds:['wrong-trait']});
 assert.match(rejected.error??'',/outside the legal zone|cannot pay this cost/);
 const paid=payEffectCost(effectState,'player',cost,{cardIds:['eligible']});
 assert.equal(paid.state.cards.find(card=>card.id==='eligible')?.zone,'trash');
});

test('temporary power, keywords, and restrictions update card state and expire on its next Refresh',()=>{
 const effectState:MatchEffectState={...state(),cards:[
  {id:'leader',owner:'player',zone:'leader',type:'Leader'},
  {id:'ally',owner:'player',zone:'character',type:'Character',power:5000},
  {id:'enemy',owner:'opponent',zone:'character',type:'Character',power:5000},
 ]};
 const powered=applyEffectAction(effectState,'player',{kind:'power',amount:2000,until:'turn-end',target:'own-character'},{targetId:'ally'}).state;
 assert.equal(powered.cards.find(card=>card.id==='ally')?.powerModifier,2000);
 const rushed=applyEffectAction(powered,'player',{kind:'grant-keyword',keyword:'rush',until:'turn-end'},{targetId:'ally'}).state;
 assert.deepEqual(rushed.cards.find(card=>card.id==='ally')?.temporaryKeywords,['rush']);
 const restricted=applyEffectAction(rushed,'player',{kind:'attack-restriction',scope:'opponent-character',until:'turn-end'},{targetId:'enemy'}).state;
 assert.equal(restricted.cards.find(card=>card.id==='enemy')?.cannotAttack,true);
 const refreshed=beginTurn(restricted,'player',2).state;
 assert.equal(refreshed.cards.find(card=>card.id==='ally')?.powerModifier,undefined);
 assert.equal(refreshed.cards.find(card=>card.id==='ally')?.temporaryKeywords,undefined);
});

test('copy-base-power and swap-power mutate both selected cards instead of only logging',()=>{
 const match:MatchEffectState={...state(),cards:[
  {id:'ally',owner:'player',zone:'character',type:'Character',power:3000},
  {id:'enemy',owner:'opponent',zone:'character',type:'Character',power:7000},
  {id:'enemy-two',owner:'opponent',zone:'character',type:'Character',power:5000},
 ]};
 const copied=applyEffectAction(match,'player',{kind:'copy-base-power',target:'own-character',from:'opponent-character',until:'turn-end'},{targetId:'ally',cardIds:['enemy']}).state;
 assert.equal(copied.cards.find(card=>card.id==='ally')?.power,7000);
 assert.equal(expireEffectModifiers(copied,'turn-end').cards.find(card=>card.id==='ally')?.power,3000);
 const leaderCopy=applyEffectAction({...match,cards:[...match.cards,{id:'enemy-leader',owner:'opponent',zone:'leader',type:'Leader',power:8000}]},'player',{kind:'copy-base-power',target:'own-character',from:'opponent-leader',until:'turn-end'},{targetId:'ally'});
 assert.equal(leaderCopy.state.cards.find(card=>card.id==='ally')?.power,8000);
 assert.equal(expireEffectModifiers(leaderCopy.state,'turn-end').cards.find(card=>card.id==='ally')?.power,3000);
 const swapped=applyEffectAction(copied,'player',{kind:'swap-power',until:'turn-end'},{targetId:'ally',cardIds:['enemy-two']}).state;
 assert.equal(swapped.cards.find(card=>card.id==='ally')?.power,5000);
 assert.equal(swapped.cards.find(card=>card.id==='enemy-two')?.power,7000);
});

test('temporary Rush and attack restrictions affect attack legality',()=>{
 const match:MatchEffectState={...state(),turn:'player',phase:'main',playedThisTurn:['new'],cards:[
  {id:'new',owner:'player',zone:'character',type:'Character',temporaryKeywords:['rush']},
  {id:'restricted',owner:'player',zone:'character',type:'Character',cannotAttack:true},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader'},
 ]};
 assert.equal(declareAttack(match,'player','new','leader').error,undefined);
 assert.match(declareAttack(match,'player','restricted','leader').error??'',/cannot attack/);
});

test('Double Attack damages two Life cards while Banish trashes Life without a Trigger',()=>{
 const battle:MatchEffectState={...state(),cards:[
  {id:'attacker',owner:'player',zone:'character',type:'Character',keywords:['double-attack','banish']},
  {id:'leader',owner:'opponent',zone:'leader',type:'Leader'},
  {id:'life-1',owner:'opponent',zone:'life',type:'Character',keywords:['trigger']},
  {id:'life-2',owner:'opponent',zone:'life',type:'Character'},
 ]};
 const hit=resolveBattle(battle,'attacker','leader',6000,5000);
 assert.deepEqual(hit.lifeCardIds,['life-1','life-2']);
 assert.equal(hit.state.cards.find(card=>card.id==='life-1')?.zone,'trash');
 assert.equal(hit.state.cards.find(card=>card.id==='life-2')?.zone,'trash');
 assert.equal(hit.triggerAvailable,false);
});

test('effect-granted K.O. protection blocks effect and battle removal until Refresh',()=>{
 const match:MatchEffectState={...state(),cards:[
  {id:'ally',owner:'player',zone:'character',type:'Character'},
  {id:'enemy',owner:'opponent',zone:'character',type:'Character'},
 ]};
 const protectedState=applyEffectAction(match,'player',{kind:'prevent-ko',scope:'own-character',by:'any'},{targetId:'ally'}).state;
 assert.match(applyEffectAction(protectedState,'opponent',{kind:'ko'},{targetId:'ally'}).error??'',/cannot be K.O/);
 const battle={...protectedState,cards:[...protectedState.cards,{id:'attacker',owner:'opponent' as const,zone:'character' as const,type:'Character' as const}]};
 const result=resolveBattle(battle,'attacker','ally',5000,5000);
 assert.equal(result.state.cards.find(card=>card.id==='ally')?.zone,'character');
});

test('rested DON grant accepts zero or two rested cost-area DON and rejects active DON',()=>{
 const board=state();board.cards=board.cards.map(card=>card.id.startsWith('own-don')?{...card,rested:true}:card);
 const action={kind:'attach-don' as const,amount:2,source:'cost-area' as const,rested:true};
 const attached=applyEffectAction(board,'player',action,{targetId:'own-leader',cardIds:['own-don-1','own-don-2']});
 assert.equal(attached.error,undefined);
 assert.equal(attached.state.cards.filter(card=>card.attachedTo==='own-leader').length,2);
 const skipped=applyEffectAction(board,'player',action,{targetId:'own-leader',cardIds:[]});
 assert.equal(skipped.requiresSelection,undefined);assert.deepEqual(skipped.state,board);
 assert.ok(applyEffectAction(state(),'player',action,{targetId:'own-leader',cardIds:['own-don-1']}).error);
});

test('bottom deck removal preserves next draw and returns attached DON rested',()=>{
 const board:MatchEffectState={...state(),cards:[
  {id:'target',owner:'opponent',zone:'character',type:'Character'},
  {id:'attached',owner:'opponent',zone:'cost-area',type:'DON!!',attachedTo:'target'},
  {id:'top',owner:'opponent',zone:'deck'},
  {id:'next',owner:'opponent',zone:'deck'},
 ]};
 const result=applyEffectAction(board,'player',{kind:'bottom-deck',scope:'opponent-character'},{targetId:'target'});
 assert.equal(result.error,undefined);
 assert.deepEqual(result.state.cards.filter(card=>card.zone==='deck').map(card=>card.id),['top','next','target']);
 assert.equal(result.state.cards.find(card=>card.id==='attached')?.attachedTo,undefined);
 assert.equal(result.state.cards.find(card=>card.id==='attached')?.rested,true);
 const draw=applyEffectAction(result.state,'opponent',{kind:'draw',amount:1});
 assert.equal(draw.state.cards.find(card=>card.id==='top')?.zone,'hand');
});

test('top deck removal becomes the next draw',()=>{
 const board=state();board.cards.push({id:'enemy-deck',owner:'opponent',zone:'deck'});
 const result=applyEffectAction(board,'player',{kind:'return-to-deck',scope:'opponent-character',position:'top'},{targetId:'enemy-rested'});
 const draw=applyEffectAction(result.state,'opponent',{kind:'draw',amount:1});
 assert.equal(draw.state.cards.find(card=>card.id==='enemy-rested')?.zone,'hand');
 assert.equal(draw.state.cards.find(card=>card.id==='enemy-deck')?.zone,'deck');
});

test('rest effects cannot target a Leader when the text only permits Characters',()=>{
 const board=state();board.cards.push({id:'enemy-leader',owner:'opponent',zone:'leader',type:'Leader'});
 const result=applyEffectAction(board,'player',{kind:'rest',scope:'opponent-character'},{targetId:'enemy-leader'});
 assert.ok(result.error);assert.deepEqual(result.state,board);
 assert.equal(applyEffectAction(board,'player',{kind:'rest',scope:'opponent-leader'},{targetId:'enemy-leader'}).state.cards.find(card=>card.id==='enemy-leader')?.rested,true);
});

test('two DON payment cannot reuse a single DON twice',()=>{
 const board=state();
 const result=payEffectCost(board,'player',{kind:'rest',scope:'don',amount:2,optional:false},{cardIds:['own-don-1','own-don-1']});
 assert.ok(result.error);assert.deepEqual(result.state,board);
});

test('return DON payment cannot select a DON already in the DON deck',()=>{
 const board=state();board.cards.push({id:'reserve',owner:'player',zone:'don-deck',type:'DON!!'});
 const result=payEffectCost(board,'player',{kind:'return-don',amount:1,optional:false},{cardIds:['reserve']});
 assert.ok(result.error);assert.deepEqual(result.state,board);
});

test('mandatory trash resolves what is possible, but an activation cost cannot be underpaid',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'held',owner:'player',zone:'hand',type:'Character'}]};
 const discard=applyEffectAction(initial,'player',{kind:'trash',scope:'hand',amount:2},{cardIds:['held']});
 assert.equal(discard.error,undefined);
 assert.equal(discard.state.cards[0].zone,'trash');
 const cost=payEffectCost(initial,'player',{kind:'trash',scope:'hand',amount:2,optional:true},{cardIds:['held']});
 assert.match(cost.error??'',/exactly 2/);
 assert.deepEqual(cost.state,initial);
});

test('milling takes the actual top of the deck without letting the player choose cards',()=>{
 const milled=applyEffectAction(state(),'player',{kind:'trash',scope:'deck',amount:1},{cardIds:['deck-2']});
 assert.equal(milled.state.cards.find(card=>card.id==='deck-1')?.zone,'trash');
 assert.equal(milled.state.cards.find(card=>card.id==='deck-2')?.zone,'deck');
});

test('searching moves all unselected cards below the untouched deck before the next draw',()=>{
 const initial:MatchEffectState={...state(),cards:['a','b','c','next','last'].map(id=>({id,owner:'player',zone:'deck',type:'Character',traits:['Navy']}))};
 const searched=applyEffectAction(initial,'player',{kind:'search',amount:3,choose:2,destination:'deck-bottom',trait:'Navy'},{cardIds:['a','c']});
 assert.deepEqual(searched.state.cards.filter(card=>card.zone==='deck').map(card=>card.id),['next','last','b']);
 const drawn=applyEffectAction(searched.state,'player',{kind:'draw',amount:1});
 assert.equal(drawn.state.cards.find(card=>card.id==='next')?.zone,'hand');
 assert.equal(drawn.state.cards.find(card=>card.id==='b')?.zone,'deck');
});

test('readying DON!! accepts multiple cost-area cards but rejects attached DON!! and Characters',()=>{
 const initial:MatchEffectState={...state(),cards:[
  {id:'a',owner:'player',zone:'cost-area',type:'DON!!',rested:true},
  {id:'b',owner:'player',zone:'cost-area',type:'DON!!',rested:true},
  {id:'attached',owner:'player',zone:'cost-area',type:'DON!!',rested:true,attachedTo:'source'},
  {id:'source',owner:'player',zone:'character',type:'Character',rested:true},
 ]};
 const ready=applyEffectAction(initial,'player',{kind:'ready',scope:'own-don',amount:2},{cardIds:['a','b']});
 assert.equal(ready.error,undefined);
 assert.ok(ready.state.cards.filter(card=>['a','b'].includes(card.id)).every(card=>!card.rested));
 assert.equal(ready.state.cards.find(card=>card.id==='source')?.rested,true);
 for(const id of ['source','attached'])assert.ok(applyEffectAction(initial,'player',{kind:'ready',scope:'own-don',amount:2},{cardIds:[id]}).error);
});

test('unknown payment IDs cannot satisfy a hand-trash cost when the hand is empty',()=>{
 const initial:MatchEffectState={...state(),cards:[]};
 const payment=payEffectCost(initial,'player',{kind:'trash',scope:'hand',amount:1,optional:true},{cardIds:['missing']});
 assert.ok(payment.error);
 assert.deepEqual(payment.state,initial);
});

test('battle bonuses expire independently of turn bonuses on either player',async()=>{
 const {expireEffectModifiers}=await import('../packages/domain/match-effect-state');
 let current:MatchEffectState={...state(),cards:[{id:'ally',owner:'player',zone:'character',power:5000},{id:'enemy',owner:'opponent',zone:'character',cost:5}]};
 current=applyEffectAction(current,'player',{kind:'power',amount:2000,target:'own-character',until:'turn-end'},{targetId:'ally'}).state;
 current=applyEffectAction(current,'player',{kind:'power',amount:1000,target:'own-character',until:'battle'},{targetId:'ally'}).state;
 current=applyEffectAction(current,'player',{kind:'cost',amount:-2,target:'opponent-character'},{targetId:'enemy'}).state;
 const battle=expireEffectModifiers(current,'battle');
 assert.equal(battle.cards[0].powerModifier,2000);
 assert.equal(battle.cards[1].costModifier,-2);
 const turn=expireEffectModifiers(battle,'turn-end');
 assert.equal(turn.cards[0].powerModifier,undefined);
 assert.equal(turn.cards[1].costModifier,undefined);
 assert.equal(turn.turnEffects.length,0);
 assert.deepEqual(expireEffectModifiers(turn,'turn-end'),turn);
});

test('a card leaving play loses its modifiers without corrupting later expiry',async()=>{
 const {expireEffectModifiers}=await import('../packages/domain/match-effect-state');
 const initial:MatchEffectState={...state(),cards:[{id:'ally',owner:'player',zone:'character',power:5000},{id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'ally'}]};
 const buff=applyEffectAction(initial,'player',{kind:'power',amount:2000,target:'own-character',until:'turn-end'},{targetId:'ally'}).state;
 const returned=applyEffectAction(buff,'player',{kind:'return-to-hand',scope:'own-character'},{targetId:'ally'}).state;
 assert.equal(returned.cards[0].zone,'hand');
 assert.equal(returned.cards[0].powerModifier,undefined);
 assert.equal(returned.cards[1].attachedTo,undefined);
 assert.equal(returned.cards[1].rested,true);
 assert.equal(returned.turnEffects.length,0);
 assert.equal(expireEffectModifiers(returned,'turn-end').cards[0].powerModifier,undefined);
});

test('overlapping keyword grants expire only after the last applicable grant',async()=>{
 const {expireEffectModifiers}=await import('../packages/domain/match-effect-state');
 const initial:MatchEffectState={...state(),cards:[{id:'ally',owner:'player',zone:'character',keywords:['blocker']}]};
 const battle=applyEffectAction(initial,'player',{kind:'grant-keyword',keyword:'rush',until:'battle'},{targetId:'ally'}).state;
 const turn=applyEffectAction(battle,'player',{kind:'grant-keyword',keyword:'rush',until:'turn-end'},{targetId:'ally'}).state;
 const afterBattle=expireEffectModifiers(turn,'battle');
 assert.deepEqual(afterBattle.cards[0].temporaryKeywords,['rush']);
 const afterTurn=expireEffectModifiers(afterBattle,'turn-end');
 assert.equal(afterTurn.cards[0].temporaryKeywords,undefined);
 assert.deepEqual(afterTurn.cards[0].keywords,['blocker']);
});

test('Life placement respects top and bottom and releases attached DON!!',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'character',owner:'player',zone:'character',type:'Character'},{id:'don',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'character'},{id:'life',owner:'player',zone:'life'},{id:'hand',owner:'player',zone:'hand'}]};
 const top=applyEffectAction(initial,'player',{kind:'move-to-life',scope:'own',amount:1,faceUp:true,position:'top'},{cardIds:['character']});
 assert.deepEqual(top.state.cards.filter(card=>card.zone==='life').map(card=>card.id),['character','life']);
 assert.equal(top.state.cards.find(card=>card.id==='character')?.faceUp,true);
 assert.equal(top.state.cards.find(card=>card.id==='don')?.attachedTo,undefined);
 assert.equal(top.state.cards.find(card=>card.id==='don')?.rested,true);
 const bottom=applyEffectAction(top.state,'player',{kind:'move-to-life',scope:'own',amount:1,position:'bottom'},{cardIds:['hand']});
 assert.deepEqual(bottom.state.cards.filter(card=>card.zone==='life').map(card=>card.id),['character','life','hand']);
 const taken=applyEffectAction(bottom.state,'player',{kind:'life',operation:'add-to-hand',amount:1});
 assert.equal(taken.state.cards.find(card=>card.id==='character')?.zone,'hand');
});

test('Life placement requires a choice and rejects foreign or unknown cards',()=>{
 const action={kind:'move-to-life',scope:'own',amount:1,position:'choice'} as const;
 assert.ok(applyEffectAction(state(),'player',action).requiresSelection);
 assert.ok(applyEffectAction(state(),'player',action,{cardIds:['own-hand']}).requiresSelection);
 for(const id of ['missing','enemy-active'])assert.ok(applyEffectAction(state(),'player',action,{cardIds:[id],position:'top'}).error);
 assert.deepEqual(applyEffectAction(state(),'player',action,{cardIds:[]}).state,state());
});

test('reordered opponent Life determines the next damage card without changing your Life',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'attacker',owner:'player',zone:'leader'},{id:'defender',owner:'opponent',zone:'leader'},{id:'own-life',owner:'player',zone:'life'},...['a','b','c'].map(id=>({id,owner:'opponent' as const,zone:'life' as const}))]};
 const action={kind:'reorder-life',scope:'either',amount:2} as const;
 assert.ok(applyEffectAction(initial,'player',action).requiresSelection);
 assert.ok(applyEffectAction(initial,'player',action,{owner:'opponent',cardIds:['a','c']}).error);
 const reordered=applyEffectAction(initial,'player',action,{owner:'opponent',cardIds:['b','a']});
 assert.deepEqual(reordered.state.cards.filter(card=>card.zone==='life'&&card.owner==='opponent').map(card=>card.id),['b','a','c']);
 const hit=resolveBattle(reordered.state,'attacker','defender',5000,5000);
 assert.equal(hit.lifeCardId,'b');
 assert.equal(hit.state.cards.find(card=>card.id==='own-life')?.zone,'life');
});

test('recovery pauses for a choice and validates mixed-colour and unknown cards',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'mixed',owner:'player',zone:'trash',type:'Character',color:'Black/Yellow',cost:2}]};
 const action={kind:'recover',source:'trash',destination:'hand',amount:1,color:'Black'} as const;
 assert.ok(applyEffectAction(initial,'player',action).requiresSelection);
 assert.ok(applyEffectAction(initial,'player',action,{cardIds:['missing']}).error);
 assert.deepEqual(applyEffectAction(initial,'player',action,{cardIds:[]}).state,initial);
 assert.equal(applyEffectAction(initial,'player',action,{cardIds:['mixed']}).state.cards[0].zone,'hand');
});

test('a Character played by an effect cannot attack immediately without Rush',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'played',owner:'player',zone:'trash',type:'Character',cost:2},{id:'leader',owner:'opponent',zone:'leader',type:'Leader'}]};
 const result=applyEffectAction(initial,'player',{kind:'play',source:'trash',amount:1,maxCost:2},{cardIds:['played']});
 assert.equal(result.error,undefined);
 assert.deepEqual(result.state.playedThisTurn,['played']);
 assert.match(declareAttack(result.state,'player','played','leader').error??'',/without Rush/);
});

test('effect plays reject Events and replace an existing Stage',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'event',owner:'player',zone:'hand',type:'Event'},{id:'new-stage',owner:'player',zone:'hand',type:'Stage'},{id:'old-stage',owner:'player',zone:'stage',type:'Stage'}]};
 const action={kind:'play',source:'hand',amount:1} as const;
 assert.ok(applyEffectAction(initial,'player',action,{cardIds:['event']}).error);
 const result=applyEffectAction(initial,'player',action,{cardIds:['new-stage']});
 assert.equal(result.state.cards.find(card=>card.id==='old-stage')?.zone,'trash');
 assert.equal(result.state.cards.find(card=>card.id==='new-stage')?.zone,'stage');
});

test('play-from-hand selection enforces a printed Trigger keyword restriction',()=>{
 const initial:MatchEffectState={...state(),cards:[
  {id:'trigger-character',owner:'player',zone:'hand',type:'Character',cost:4,keywords:['trigger']},
  {id:'plain-character',owner:'player',zone:'hand',type:'Character',cost:4},
 ]};
 const action={kind:'play' as const,source:'hand' as const,amount:1,cardType:'Character' as const,maxCost:4,triggerOnly:true};
 assert.ok(applyEffectAction(initial,'player',action,{targetId:'plain-character'}).error);
 const chosen=applyEffectAction(initial,'player',action,{targetId:'trigger-character'});
 assert.equal(chosen.error,undefined);
 assert.equal(chosen.state.cards.find(card=>card.id==='trigger-character')?.zone,'character');
});

test('full-field normal play waits for replacement without paying DON!! early',()=>{
 const initial:MatchEffectState={...state(),cards:[...Array.from({length:5},(_,i)=>({id:`c${i}`,owner:'player' as const,zone:'character' as const,type:'Character' as const})),{id:'new',owner:'player',zone:'hand',type:'Character',cost:1},{id:'don',owner:'player',zone:'cost-area',type:'DON!!'},{id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'c0'}]};
 const pending=playCard(initial,'player','new');
 assert.ok(pending.requiresSelection);
 assert.deepEqual(pending.state,initial);
 assert.ok(playCard(initial,'player','new',['new']).error);
 const played=playCard(initial,'player','new',['c0']);
 assert.equal(played.error,undefined);
 assert.equal(played.state.cards.filter(card=>card.zone==='character').length,5);
 assert.equal(played.state.cards.find(card=>card.id==='c0')?.zone,'trash');
 assert.equal(played.state.cards.find(card=>card.id==='attached')?.attachedTo,undefined);
 assert.equal(played.state.cards.find(card=>card.id==='don')?.rested,true);
});

test('full-field effect play validates replacement before mutating either card',()=>{
 const initial:MatchEffectState={...state(),cards:[...Array.from({length:5},(_,i)=>({id:`c${i}`,owner:'player' as const,zone:'character' as const,type:'Character' as const})),{id:'new',owner:'player',zone:'trash',type:'Character',cost:2},{id:'enemy',owner:'opponent',zone:'character',type:'Character'}]};
 const action={kind:'play',source:'trash',amount:1,maxCost:2,rested:true} as const;
 assert.ok(applyEffectAction(initial,'player',action,{cardIds:['new']}).requiresSelection);
 const invalid=applyEffectAction(initial,'player',action,{cardIds:['new'],replacementIds:['enemy']});
 assert.ok(invalid.error);assert.deepEqual(invalid.state,initial);
 const played=applyEffectAction(initial,'player',action,{cardIds:['new'],replacementIds:['c2']});
 assert.equal(played.state.cards.find(card=>card.id==='c2')?.zone,'trash');
 assert.equal(played.state.cards.find(card=>card.id==='new')?.rested,true);
 assert.equal(played.state.cards.filter(card=>card.owner==='player'&&card.zone==='character').length,5);
});

test('attached DON!! cannot pay a normal play or an activation rest cost',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'incoming',owner:'player',zone:'hand',type:'Character',cost:1},{id:'attached',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'leader',rested:false}]};
 assert.ok(playCard(initial,'player','incoming').error);
 assert.ok(payEffectCost(initial,'player',{kind:'rest',scope:'don',amount:1,optional:true},{cardIds:['attached']}).error);
});

test('shuffle changes only the selected owner’s deck and preserves every card',async()=>{
 const {shuffleDeck}=await import('../packages/domain/match-effect-state');
 const initial:MatchEffectState={...state(),cards:[{id:'a',owner:'player',zone:'deck'},{id:'enemy',owner:'opponent',zone:'deck'},{id:'b',owner:'player',zone:'deck'},{id:'hand',owner:'player',zone:'hand'},{id:'c',owner:'player',zone:'deck'}]};
 const shuffled=shuffleDeck(initial,'player',()=>0);
 assert.deepEqual(shuffled.cards.filter(card=>card.owner==='player'&&card.zone==='deck').map(card=>card.id),['b','c','a']);
 assert.equal(shuffled.cards[1],initial.cards[1]);
 assert.equal(shuffled.cards[3],initial.cards[3]);
 assert.deepEqual([...shuffled.cards.map(card=>card.id)].sort(),[...initial.cards.map(card=>card.id)].sort());
 assert.deepEqual(initial.cards.map(card=>card.id),['a','enemy','b','hand','c']);
});

test('hand reset keeps returned cards below the remaining deck when no shuffle is printed',()=>{
 const initial:MatchEffectState={...state(),cards:[{id:'held',owner:'player',zone:'hand'},...['a','b','c'].map(id=>({id,owner:'player' as const,zone:'deck' as const}))]};
 const result=applyEffectAction(initial,'player',{kind:'hand-reset',scope:'self',draw:1});
 assert.deepEqual(result.state.cards.filter(card=>card.zone==='deck').map(card=>card.id),['b','c','held']);
 assert.deepEqual(result.state.cards.filter(card=>card.zone==='hand').map(card=>card.id),['a']);
});

test('shared displayed and battle power combines modifiers and DON without going below zero',async()=>{
 const {effectiveCardPower}=await import('../packages/domain/match-effect-state');
 const board:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'fighter',owner:'player',zone:'character',type:'Character',power:5000,powerModifier:-2000},
  {id:'don',owner:'player',zone:'cost-area',type:'DON!!',attachedTo:'fighter'},
 ]};
 assert.equal(effectiveCardPower(board,'fighter'),4000);
 assert.equal(effectiveCardPower({...board,turn:'opponent'},'fighter'),3000);
 const reduced={...board,cards:board.cards.map(c=>c.id==='fighter'?{...c,powerModifier:-9000}:c)};
 assert.equal(effectiveCardPower(reduced,'fighter'),0);
 assert.equal(effectiveCardPower(board,'missing'),0);
});

test('cost reductions filter by type, trait and printed minimum, apply to payment, stack, and expire',()=>{
 const reductionDoc=compileEffectDocument({id:'reduction',code:'OP05-097',name:'Mary Geoise',type:'Character',color:'Black',cost:2,power:0,counter:0,rarity:'R',art:0,effect:'[Activate: Main] The cost of playing [Navy] type Character cards with a cost of 5 or more from your hand will be reduced by 2.'});
 const reduction=reductionDoc.ast.flatMap(ability=>ability.actions).find(action=>action.kind==='cost-reduction');assert.ok(reduction);if(!reduction||reduction.kind!=='cost-reduction')throw new Error('Expected parsed cost reduction');
 const board:MatchEffectState={turn:'player',phase:'main',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'stage',owner:'player',zone:'stage',type:'Stage',effectSchema:reductionDoc},
  {id:'five-navy',owner:'player',zone:'hand',type:'Character',cost:5,traits:['Navy']},
  {id:'four-navy',owner:'player',zone:'hand',type:'Character',cost:4,traits:['Navy']},
  {id:'five-other',owner:'player',zone:'hand',type:'Character',cost:5,traits:['Other']},
  ...Array.from({length:3},(_,index)=>({id:`reduction-don-${index}`,owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const})),
 ]};
 const applied=applyEffectAction(board,'player',reduction,{sourceCardId:'stage'});assert.equal(applied.error,undefined);
 assert.equal(effectivePlayCost(applied.state,'player',applied.state.cards.find(card=>card.id==='five-navy')!),3);
 assert.equal(effectivePlayCost(applied.state,'player',applied.state.cards.find(card=>card.id==='four-navy')!),4);
 assert.equal(effectivePlayCost(applied.state,'player',applied.state.cards.find(card=>card.id==='five-other')!),5);
 const played=playCard(applied.state,'player','five-navy');assert.equal(played.error,undefined);assert.equal(played.state.cards.find(card=>card.id==='five-navy')?.zone,'character');assert.equal(played.state.cards.filter(card=>card.type==='DON!!'&&card.rested).length,3);
 const expired=expireEffectModifiers(applied.state,'turn-end');assert.equal(effectivePlayCost(expired,'player',expired.cards.find(card=>card.id==='five-navy')!),5);
 const continuous=compileEffectDocument({id:'continuous-reduction',code:'OP05-097',name:'Mary Geoise',type:'Character',color:'Black',cost:2,power:0,counter:0,rarity:'R',art:0,effect:'[DON!! x1] [Your Turn] The cost of playing [Navy] type Character cards with a cost of 5 or more from your hand will be reduced by 1.'});
 const passiveState:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'passive-source',owner:'player',zone:'character',type:'Character',effectSchema:continuous},{id:'candidate',owner:'player',zone:'hand',type:'Character',cost:5,traits:['Navy']}]};
 assert.equal(effectivePlayCost(passiveState,'player',passiveState.cards.find(card=>card.id==='candidate')!),5);
 const passiveWithDon={...passiveState,cards:[...passiveState.cards,{id:'passive-don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'passive-source'}]};
 assert.equal(effectivePlayCost(passiveWithDon,'player',passiveWithDon.cards.find(card=>card.id==='candidate')!),4);
 assert.equal(effectivePlayCost({...passiveWithDon,turn:'opponent'},'player',passiveWithDon.cards.find(card=>card.id==='candidate')!),5);
});

test('negate-effect accepts only the printed opponent target and suppresses its effects',()=>{
 const match:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'enemy',owner:'opponent',zone:'character',type:'Character',effectText:'[On Play] Draw 1 card.'},{id:'own',owner:'player',zone:'character',type:'Character'}]};
 const action=compileEffectDocument({id:'black-vortex',code:'OP09-097',name:'Black Vortex',type:'Event',color:'Black',cost:1,power:0,counter:0,rarity:'R',art:0,effect:"[Trigger] Negate the effect of up to 1 of your opponent's Leader or Character cards during this turn."}).ast[0].actions[0];
 assert.equal(action.kind,'negate-effect');const negated=applyEffectAction(match,'player',action,{targetId:'enemy'});assert.equal(negated.error,undefined);assert.equal(negated.state.cards.find(card=>card.id==='enemy')?.effectNegated,true);
 assert.equal(expireEffectModifiers(negated.state,'turn-end').cards.find(card=>card.id==='enemy')?.effectNegated,false);
 assert.match(applyEffectAction(match,'player',action,{targetId:'own'}).error??'',/outside the printed effect target/);
});

test('negate-then-K.O. applies the cost limit and suppresses the K.O.d Character’s effect',()=>{
 const document=compileEffectDocument({id:'negate-ko',code:'OP17-063',name:'Jozu',type:'Character',color:'Blue',cost:4,power:5000,counter:0,rarity:'R',art:0,effect:"[Activate: Main] DON!! -1: If this Character was played on this turn, negate the effect of up to 1 of your opponent's Characters with a cost of 6 or less during this turn, and K.O. it."});
 const action=document.ast.flatMap(ability=>ability.actions).find(value=>value.kind==='negate-effect');assert.ok(action);if(!action||action.kind!=='negate-effect')throw new Error('Expected negate-and-K.O. action');assert.equal(action.maxCost,6);assert.equal(action.andKo,true);
 const board:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[{id:'target',owner:'opponent',zone:'character',type:'Character',cost:6,effectText:'[On Play] Draw 1 card.'},{id:'too-costly',owner:'opponent',zone:'character',type:'Character',cost:7}]};
 const resolved=applyEffectAction(board,'player',action,{targetId:'target'});assert.equal(resolved.error,undefined);assert.equal(resolved.state.cards.find(card=>card.id==='target')?.zone,'trash');assert.equal(resolved.state.cards.find(card=>card.id==='target')?.effectNegated,true);
 const rejected=applyEffectAction(board,'player',action,{targetId:'too-costly'});assert.ok(rejected.error);assert.equal(rejected.state.cards.find(card=>card.id==='too-costly')?.zone,'character');
});

test('active-Character attack permission honors the ability’s attached-DON requirement',()=>{
 const document=compileEffectDocument({id:'active-attack',code:'OP01-021',name:'Franky',type:'Character',color:'Blue',cost:3,power:4000,counter:0,rarity:'R',art:0,effect:"[DON!! x1] This Character can also attack your opponent's active Characters."});
 const initial:MatchEffectState={turn:'player',phase:'main',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'franky',owner:'player',zone:'character',type:'Character',rested:false,effectSchema:document},
  {id:'active-target',owner:'opponent',zone:'character',type:'Character',rested:false},
 ]};
 assert.match(declareAttack(initial,'player','franky','active-target').error??'',/must be rested/);
 const attached={...initial,cards:[...initial.cards,{id:'attached-don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'franky'}]};
 assert.equal(declareAttack(attached,'player','franky','active-target').error,undefined);
});

test('selected Blocker restrictions enforce target filters and last through the printed window',()=>{
 const match:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'source',owner:'player',zone:'character',type:'Character'},
  {id:'small-blocker',owner:'opponent',zone:'character',type:'Character',cost:2,power:3000,keywords:['blocker'],effectText:'[Blocker]'},
  {id:'large-blocker',owner:'opponent',zone:'character',type:'Character',cost:5,power:5000,keywords:['blocker'],effectText:'[Blocker]'},
 ]};
 const card={id:'source',code:'OP09-014',name:'Limejuice',color:'Red',type:'Character',cost:3,power:4000,counter:0,rarity:'C',art:0,effect:'[On Play] Your opponent cannot activate up to 1 [Blocker] Character that has 4,000 power or less during this turn.'} as Card;
 const action=compileEffectDocument(card).ast[0].actions.find(value=>value.kind==='prevent-keyword-activation');
 assert.ok(action);
 const blocked=applyEffectAction(match,'player',action!,{cardIds:['small-blocker']});
 assert.equal(blocked.error,undefined);
 assert.match(declareBlock(blocked.state,'opponent','small-blocker').error??'',/cannot activate during this battle/);
 assert.equal(declareBlock(blocked.state,'opponent','large-blocker').error,undefined);
 const invalid=applyEffectAction(match,'player',action!,{cardIds:['large-blocker']});
 assert.match(invalid.error??'',/outside the printed effect target/);
});

test('base-cost and power-limited Blocker locks select only legal Characters',()=>{
 const base:MatchEffectState={turn:'player',turnEffects:[],restrictions:[],delayed:[],cards:[
  {id:'cost-four',owner:'opponent',zone:'character',type:'Character',cost:4,costModifier:3,power:6000,keywords:['blocker']},
  {id:'cost-five',owner:'opponent',zone:'character',type:'Character',cost:5,costModifier:-2,power:2000,keywords:['blocker']},
  {id:'power-two',owner:'opponent',zone:'character',type:'Character',cost:2,power:2000,keywords:['blocker']},
  {id:'power-four',owner:'opponent',zone:'character',type:'Character',cost:2,power:4000,keywords:['blocker']},
 ]};
 const baseCostAction=compileEffectDocument({id:'x',code:'OP12-051',name:'Hina',color:'Black',type:'Character',cost:3,power:4000,counter:0,rarity:'R',art:0,effect:"[Activate: Main] Up to 1 of your opponent's Characters with a base cost of 4 or less cannot activate [Blocker] during this turn."}).ast[0].actions[0];
 const accepted=applyEffectAction(base,'player',baseCostAction,{targetId:'cost-four'});
 assert.equal(accepted.error,undefined);
 const rejected=applyEffectAction(base,'player',baseCostAction,{targetId:'cost-five'});
 assert.ok(rejected.error);
 const powerAction=compileEffectDocument({id:'x',code:'OP11-013',name:'Test',color:'Blue',type:'Leader',cost:0,power:5000,counter:0,rarity:'L',art:0,effect:"[When Attacking] All of your opponent's Characters with 2000 power or less cannot activate [Blocker] during this turn."}).ast[0].actions[0];
 const powerLocked=applyEffectAction(base,'player',powerAction);
 assert.deepEqual(powerLocked.state.turnEffects.map(item=>item.target),['cost-five','power-two']);
});
