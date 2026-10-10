import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compileEffectDocument,type EffectAction} from '../packages/domain/effect-rules';
import {applyEffectAction,declareAttack,beginTurn,effectiveCardCost,effectiveCardPower,playCard} from '../packages/domain/match-effect-state';
import {advanceEffectExecution,beginEffectExecution} from '../packages/domain/effect-controller';
import {executeEffectCommands,resolveEffectTiming} from '../packages/domain/effect-runtime';
import {scenarios} from '../scripts/card-effect-scenarios';

test('Sai, Charlotte Katakuri and Miss Doublefinger resolve conditional power and cost effects to exact recipients',()=>{
 const rows=[
  {id:'OP06-088',code:'OP06-088',name:'Sai',color:'Green',card_type:'Character' as const,cost:3,power:4000,effect_text:'If your Leader has the [Dressrosa] type and is active, this Character gains +2000 power.'},
  {id:'ST16-003',code:'ST16-003',name:'Charlotte Katakuri',color:'Purple',card_type:'Character' as const,cost:4,power:5000,effect_text:'If your Leader has the "FILM" type and you have 6 or more rested cards, this Character gains +2000 power.'},
  {id:'OP14-086',code:'OP14-086',name:'Miss Doublefinger(Zala)',color:'Black',card_type:'Character' as const,cost:4,power:5000,effect_text:'If you have 7 or more cards in your trash, this Character gains +1000 power, and all of your Characters with a type including "Baroque Works" gain +2 cost.'},
 ];
 for(const row of rows){const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});const scenario=scenarios(row).find(item=>item.name.startsWith(`${row.code} real play:`));assert.ok(scenario,`${row.code} needs a card-specific scenario`);scenario.run(document);}
});

test('OP12-061 compiles both Law-only effects and consumes the named next-play discount',()=>{
 const row={id:'OP12-061',code:'OP12-061',name:'Donquixote Rosinante',color:'Purple Yellow',card_type:'Leader' as const,cost:0,power:5000,effect_text:"[Once Per Turn] If your [Trafalgar Law] would be K.O.'d, you may add 1 card from the top of your Life cards to your hand instead.\n[Activate: Main] [Once Per Turn] DON!! 1: The next time you play [Trafalgar Law] with a cost of 4 or more from your hand during this turn, the cost will be reduced by 2."};
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Leader',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});assert.equal(document.resolver.type,'DSL');const scenario=scenarios(row).find(item=>item.name.startsWith('OP12-061 real play:'));assert.ok(scenario);scenario.run(document);
});

test('OP17-018 resolves its Stage K.O. Main and gated Counter independently',()=>{
 const row={id:'OP17-018',code:'OP17-018',name:'Ice Age',color:'Blue',card_type:'Event' as const,cost:2,power:0,effect_text:"[Main] You may rest 2 of your DON!! cards: K.O. up to 1 of your opponent's Stages. [Counter] If you have 2 or more Characters with 8000 base power or more, up to 1 of your Leader or Characters gains +4000 power during this battle."};
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:row.cost,power:0,counter:0,rarity:'',art:0,effect:row.effect_text});const scenario=scenarios(row).find(item=>item.name.startsWith('OP17-018 real play:'));assert.ok(scenario);scenario.run(document);
});

test('ST30-014 activation rests itself and allows per-Character rested DON!! distribution',()=>{
 const row={id:'ST30-014',code:'ST30-014',name:'Mr.3(Galdino)',color:'Blue',card_type:'Character' as const,cost:3,power:5000,effect_text:'[Activate: Main] You may rest this Character: Give up to 2 of your Characters with 6000 base power up to 2 rested DON!! cards each.'};
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const scenario=scenarios(row).find(item=>item.name.startsWith('ST30-014 real play:'));assert.ok(scenario);scenario.run(document);
});

test('ST30-012 only rests Blocker Characters, EB04-007 grants conditional Rush: Character once, and ST01-016 accepts a Leader',()=>{
 const rows=[
  {id:'ST30-012',code:'ST30-012',name:'Monkey.D.Luffy',color:'Green',card_type:'Character' as const,cost:4,power:6000,effect_text:"[On Play] You may rest 1 of your DON!! cards: This Character gains [Rush] during this turn. (This card can attack on the turn in which it is played.)\n[When Attacking] Rest up to 1 of your opponent's [Blocker] Characters."},
  {id:'EB04-007',code:'EB04-007',name:'Roronoa Zoro',color:'Red',card_type:'Character' as const,cost:7,power:9000,effect_text:"[On Play] Your Leader gains +2000 power until the end of your opponent's next End Phase.\n[Activate: Main] [Once Per Turn] If your opponent has a Character with 8000 power or more, this Character gains [Rush: Character] during this turn."},
  {id:'ST01-016',code:'ST01-016',name:'Diable Jambe',color:'Red',card_type:'Event' as const,cost:1,power:0,effect_text:"[Main] Select up to 1 of your {Straw Hat Crew} type Leader or Character cards. Your opponent cannot activate [Blocker] if that Leader or Character attacks during this turn. [Trigger] K.O. up to 1 of your opponent's [Blocker] Characters with a cost of 3 or less."},
  {id:'ST32-004',code:'ST32-004',name:'Silvers Rayleigh',color:'Green',card_type:'Character' as const,cost:4,power:5000,effect_text:'If your Leader has the attribute, this Character gains [Rush: Character]. (This card can attack Characters on the turn in which it is played.) [On Play] Rest up to 2 of your opponent\'s Characters with a cost of 2 or less.'},
 ];
 for(const row of rows){const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});const scenario=scenarios(row).find(item=>item.name.startsWith(`${row.code} real play:`));assert.ok(scenario,`${row.code} needs a whole-effect gameplay scenario`);scenario.run(document);}
});

test('conditional and rested-trigger catalog cards resolve complete timing windows against qualifying boards',()=>{
 const rows=[
  {id:'OP01-032',code:'OP01-032',name:'Ashura Doji',color:'Green',card_type:'Character' as const,cost:4,power:5000,effect_text:'[DON!! x1] If your opponent has 2 or more rested Characters, this Character gains +2000 power.'},
  {id:'OP01-083',code:'OP01-083',name:'Mr.1 (Daz.Bonez)',color:'Green',card_type:'Character' as const,cost:3,power:4000,effect_text:'[DON!! x1] [Your Turn] If your Leader has the "Baroque Works" type, this Character gains +1000 power for every 2 Events in your trash.'},
  {id:'OP15-051',code:'OP15-051',name:'Monkey.D.Luffy',color:'Purple',card_type:'Character' as const,cost:4,power:5000,effect_text:'[Opponent\'s Turn] If your Leader has the "Dressrosa" type, this Character gains +3000 power.'},
  {id:'ST16-005',code:'ST16-005',name:'Monkey.D.Luffy',color:'Purple',card_type:'Character' as const,cost:5,power:6000,effect_text:'If you have a rested [Uta], this Character gains +1000 power.'},
  {id:'OP03-026',code:'OP03-026',name:'Kuroobi',color:'Blue',card_type:'Character' as const,cost:2,power:3000,effect_text:"[On Play] If your Leader has the {East Blue} type, rest up to 1 of your opponent's Characters."},
  {id:'OP14-032',code:'OP14-032',name:'Humandrill',color:'Blue',card_type:'Character' as const,cost:3,power:4000,effect_text:"[Your Turn] When this Character becomes rested, rest up to 1 of your opponent's Characters with a cost of 4 or less."},
  {id:'OP14-035',code:'OP14-035',name:'Yosaku',color:'Blue',card_type:'Character' as const,cost:3,power:4000,effect_text:"[Your Turn] When this Character becomes rested, up to 1 of your opponent's rested Characters with a cost of 4 or less will not become active in your opponent's next Refresh Phase."},
  {id:'OP17-091',code:'OP17-091',name:'Brook',color:'Blue',card_type:'Character' as const,cost:4,power:4000,effect_text:"If there is a Character with a cost of 12 or more, this Character gains +3000 power. [On Play] If there is a Character with a cost of 12 or more, your opponent trashes 1 card from their hand."},
 ];
 for(const row of rows){const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});const scenario=scenarios(row).find(item=>item.name.startsWith(`${row.code} real play:`));assert.ok(scenario,`${row.code} needs a complete gameplay scenario`);scenario.run(document);}
});

test('OP03-098, OP03-120 and OP13-108 resolve their full gated sequences in real play',()=>{
 const rows=[
  {id:'OP03-098',code:'OP03-098',name:'Kalifa',color:'Black',card_type:'Stage' as const,cost:3,power:0,effect_text:'[Activate: Main] You may rest this Stage: If your Leader\'s type includes "CP", give up to 1 of your opponent\'s Characters -2 cost during this turn.'},
  {id:'OP03-120',code:'OP03-120',name:'Six King Pistol',color:'Black',card_type:'Event' as const,cost:4,power:0,effect_text:'[Main] If your opponent has 4 or more Life cards, trash up to 1 card from the top of your opponent\'s Life cards.'},
  {id:'OP13-108',code:'OP13-108',name:'Nami',color:'Red',card_type:'Character' as const,cost:4,power:5000,effect_text:'[On Play] If your Leader has the "Egghead" type, this Character gains [Rush] during this turn. Then, your opponent adds 1 card from the top of their Life cards to their hand.\n[Trigger] If you have 1 or less Life cards, rest up to 1 of your opponent\'s Characters with a cost of 7 or less.'},
 ];
 for(const row of rows){const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});const scenario=scenarios(row).find(item=>item.name.startsWith(`${row.code} real play:`));assert.ok(scenario,`${row.code} needs a card-specific sequence scenario`);scenario.run(document);}
});

test('ST04-001 Kaido returns seven DON!! before optionally trashing the top opponent Life card',()=>{
 const row={id:'ST04-001',code:'ST04-001',name:'Kaido',color:'Purple',card_type:'Leader' as const,cost:0,power:5000,effect_text:"[Activate: Main] [Once Per Turn] DON!! -7 (You may return the specified number of DON!! cards from your field to your DON!! deck.): Trash up to 1 of your opponent's Life cards."};const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Leader',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});assert.equal(document.resolver.type,'DSL');const scenario=scenarios(row).find(item=>item.name.startsWith('ST04-001 Activate: Main gameplay:'));assert.ok(scenario);scenario.run(document);
});

test('P-084 Buggy restricts attacks only at costs three/four while its controller has a Buggy Leader',()=>{
 const row={id:'P-084',code:'P-084',name:'Buggy',color:'Blue',card_type:'Character' as const,cost:4,power:4000,effect_text:'This Character cannot attack.If your Leader is [Buggy], all Characters with a cost of 3 or 4 cannot attack.[On Play] Play up to 1 "Cross Guild" type Character card with a cost of 6 or less from your hand.'};const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});assert.equal(document.resolver.type,'DSL');const scenario=scenarios(row).find(item=>item.name.startsWith('P-084 continuous gameplay:'));assert.ok(scenario);scenario.run(document);
});

test('OP15-026 trashes itself before transferring only a rested opponent DON!!',()=>{
 const effect='[On Play] Look at 3 cards from the top of your deck; reveal up to 1 {East Blue} type card and add it to your hand. Then, place the rest at the bottom of your deck in any order.\n[Activate: Main] You may trash this Character: Give up to 1 of your opponent\'s rested DON!! cards to 1 of your opponent\'s Characters.';
 const row={id:'OP15-026',code:'OP15-026',name:'Jango',color:'Blue',card_type:'Character' as const,cost:2,power:3000,effect_text:effect};const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});const scenario=scenarios(row).find(item=>item.name.startsWith('OP15-026 real play:'));assert.ok(scenario);scenario.run(document);
});

test('OP14-027 separates its becomes-rested trigger from the conditional passive',()=>{
 const effect="[Your Turn] When this Character becomes rested, rest up to 1 of your opponent's Characters with 7000 base power or less.\n[Opponent's Turn] If this Character is rested, give all of your opponent's Characters +1000 power.";
 const row={id:'OP14-027',code:'OP14-027',name:'Shanks',color:'Red',card_type:'Character' as const,cost:5,power:6000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name.startsWith('OP14-027 real play:'));
 assert.ok(scenario);scenario.run(document);
});

test('conditional passive followed by a printed keyword is not duplicated into an unresolved window',()=>{
 const effect="If the number of DON!! cards on your field is equal to or less than the number on your opponent's field, this Character gains +1000 power.\n[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)";
 const row={id:'OP06-067',code:'OP06-067',name:'Vinsmoke Yonji',color:'Green',card_type:'Character' as const,cost:4,power:5000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 assert.deepEqual(document.ast.map(ability=>[ability.trigger,ability.actions.map(action=>action.kind)]),[['unknown',['power']],['continuous',['blocker']]]);
 const aura=scenarios(row).find(scenario=>scenario.name.startsWith('engine-aura unknown:'));
 assert.ok(aura);aura.run(document);
 const state={turn:'player' as const,cards:[{id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,name:row.name,power:row.power,effectSchema:document},{id:'target',owner:'player' as const,zone:'character' as const,type:'Character' as const,power:5000},{id:'own-don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const},{id:'opponent-don',owner:'opponent' as const,zone:'cost-area' as const,type:'DON!!' as const}],turnEffects:[],restrictions:[],delayed:[]};
 assert.equal(effectiveCardPower(state,'target'),6000);
 const blocker=document.ast.find(ability=>ability.actions.some(action=>action.kind==='blocker'));
 assert.equal(blocker?.conditions.length,0);
});

test('printed Blocker ability redirects an attack and cannot activate while rested',()=>{
 const effect='[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)';
 const row={id:'test-blocker',code:'test-blocker',name:'Blocker Test',color:'Blue',card_type:'Character' as const,cost:2,power:3000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name.includes('Blocker redirects an attack'));
 assert.ok(scenario);scenario.run(document);
});

test('OP15-092 applies each continuous Trash threshold independently during real play',()=>{
 const effect="Apply each of the following effects based on the number of cards in your trash:\n• If there are 10 or more cards, this Character's base power becomes 9000 and it gains +10 cost.\n• If you have 20 or more cards, during your opponent's turn, your Leader's base power becomes 7000.\n• If you have 30 or more cards, this Character gains +1000 power.";
 const row={id:'OP15-092',code:'OP15-092',name:'Lafitte',color:'Black',card_type:'Character' as const,cost:4,power:5000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 assert.deepEqual(document.ast.map(ability=>ability.trigger),['continuous','continuous','continuous']);
 const scenario=scenarios(row).find(item=>item.name.startsWith('OP15-092 real play:'));
 assert.ok(scenario);scenario.run(document);
 assert.equal(effectiveCardCost({turn:'player',cards:[{id:'source',owner:'player',zone:'character',type:'Character',cost:4,effectSchema:document},...Array.from({length:10},(_,i)=>({id:`trash-${i}`,owner:'player' as const,zone:'trash' as const,type:'Character' as const}))],turnEffects:[],restrictions:[],delayed:[]},{id:'source',owner:'player',zone:'character',type:'Character',cost:4,effectSchema:document}),14);
});

test('OP17-094 applies its +12 cost only while your Leader has the Elbaph type',()=>{
 const effect='If your Leader has the {Elbaph} type, this Character gains +12 cost.';
 const row={id:'OP17-094',code:'OP17-094',name:'Gerd',color:'Yellow',card_type:'Character' as const,cost:3,power:4000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name==='OP17-094 real play: conditional self-cost applies only under its printed condition');
 assert.ok(scenario,'A typed-Leader cost aura needs a real-play condition scenario');scenario.run(document);
});

test('OP12-015 enforces the Event reveal cost and preserves its play-then-DON sequence',()=>{
 const effect='If you have a total of 2 or more given DON!! cards, this Character gains +2000 power.\n[On Play] You may reveal 2 Events from your hand: Play up to 1 red Character card with 3000 power or less from your hand. Then, give up to 1 rested DON!! card to your Leader or 1 of your Characters.';
 const row={id:'OP12-015',code:'OP12-015',name:'Koala',color:'Red',card_type:'Character' as const,cost:4,power:5000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name.startsWith('OP12-015 real play:'));
 assert.ok(scenario);scenario.run(document);
});

test('EB03-042 On K.O. accepts only its printed card options from hand or Trash',()=>{
 const effect="If your Leader has the {Revolutionary Army} type, this Character gains +4 cost. [Opponent's Turn] [On K.O.] Play up to 1 {Revolutionary Army} type Character card with a cost of 6 or less other than [Koala] or up to 1 [Nico Robin] with a cost of 6 or less from your hand or trash.";
 const row={id:'EB03-042',code:'EB03-042',name:'Belo Betty',color:'Red',card_type:'Character' as const,cost:4,power:5000,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name.startsWith('EB03-042 real play:'));
 assert.ok(scenario);scenario.run(document);
});

test('EB04-011 applies Rush: Character and resolves its Neptunian draw-then-trash count',()=>{
 const effect='[Rush: Character] (This card can attack Characters on the turn in which it is played.)\n[On Play] Draw a card for each of your {Neptunian} type Characters. Then, trash the same number of cards from your hand.';
 const document=compileEffectDocument({id:'EB04-011',code:'EB04-011',name:'Scaled Neptunian',color:'Blue',type:'Character',cost:1,power:2000,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'EB04-011',code:'EB04-011',name:'Scaled Neptunian',color:'Blue',card_type:'Character',cost:1,power:2000,effect_text:effect}).find(item=>item.name.includes('Neptunians'));
 assert.ok(scenario);scenario.run(document);
});

test('OP02-118 Counter pays its optional hand-trash cost before choosing one Character to protect',()=>{
 const effect='[Counter] You may trash 1 card from your hand: Select up to 1 of your Characters. The selected Character cannot be K.O.\'d during this battle.';
 const row={id:'OP02-118',code:'OP02-118',name:'Yasakani Sacred Jewel',color:'Black',card_type:'Event' as const,cost:0,power:0,effect_text:effect};
 const document=compileEffectDocument({id:row.code,code:row.code,name:row.name,color:'Black',type:'Event',cost:0,power:0,counter:0,rarity:'C',art:0,effect});
 assert.equal(document.resolver.type,'DSL');
 assert.equal(document.normalized[0].sequence[0].type,'PAY_COST');
 const action=document.ast[0].actions[0];assert.equal(action.kind,'prevent-ko');
 if(action.kind==='prevent-ko')assert.deepEqual(action.selection,{min:0,max:1});
 const scenario=scenarios(row).find(item=>item.name.includes('engine-action counter prevent-ko'));
 assert.ok(scenario);scenario.run(document);
});

test('move-to-Life destination choice survives optional-target eligibility and resolution',()=>{
 const action:EffectAction={kind:'move-to-life',scope:'opponent',source:'character',amount:1,maxCost:3,position:'choice',faceUp:true,selection:{min:0,max:1}};
 const state={turn:'player' as const,cards:[{id:'target',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:3}],turnEffects:[],restrictions:[],delayed:[]};
 const result=applyEffectAction(state,'player',action,{cardIds:['target'],position:'bottom'});
 assert.equal(result.error,undefined);assert.equal(result.requiresSelection,undefined);
 const moved=result.state.cards.find(card=>card.id==='target');assert.equal(moved?.zone,'life');assert.equal(moved?.faceUp,true);
});

test('KO-protection scenarios enforce DON, source attributes and printed conditions',()=>{
 const cases=[
  ['ST06-004','Ulti',`This Character cannot be K.O.'d by effects. [DON!! x1] If there is a Character with a cost of 0, this Character gains [Double Attack]. (This card deals 2 damage.)`,2],
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
  ['OP13-091','St. Marcus Mars','If you have 7 or more cards in your trash, this Character cannot be removed from the field by your opponent\'s effects and gains [Blocker].\n[On Play] You may trash 1 card from your hand: K.O. up to 1 of your opponent\'s Characters with a base cost of 5 or less.',2],
  ['OP11-005','OP11-005',"[Blocker] (After your opponent declares an attack, you may rest this card to make it the new target of the attack.)\n[DON!! x1] This Character cannot be K.O.'d by effects of Characters without the (Special) attribute.",7],
 ] as const;
 for(const [code,name,effect,count] of cases){
  const document=compileEffectDocument({id:code,code,name,color:'',type:'Character',cost:0,power:0,counter:0,rarity:'',art:0,effect});
  const cardCases=scenarios({id:code,code,name,color:'',card_type:'Character',cost:0,power:0,effect_text:effect});
  assert.ok(cardCases.length>=count,`${code} lost previously verified scenario coverage`);
  for(const scenario of cardCases)scenario.run(document);
 }
});

test('PRB02-005 has card-specific delayed-rest scenario coverage',()=>{
 const effect='[Your Turn] [On Play] If your Leader is multicolored and your opponent has 7 or less DON!! cards on their field, your opponent rests 1 of their active DON!! cards at the start of their next Main Phase.';
 const row={id:'prb02-005',code:'PRB02-005',name:'Monkey.D.Luffy',color:'Red/Green',card_type:'Character' as const,cost:3,power:4000,effect_text:effect};
 const doc=compileEffectDocument({...row,type:row.card_type,counter:0,rarity:'',art:0,effect});const cases=scenarios(row).filter(scenario=>scenario.name.startsWith('PRB02-005 delayed'));
 assert.equal(cases.length,1);for(const scenario of cases)scenario.run(doc);
});

test('OP02-066 has card-specific optional hand-trash and up-to-draw scenario coverage',()=>{
 const effect='[Main] You may trash 2 cards from your hand: If your Leader has the [Impel Down] type, draw up to 2 cards. [Trigger] Draw 2 cards.';
 const row={id:'op02-066',code:'OP02-066',name:'Test Event',color:'Black',card_type:'Event' as const,cost:1,power:0,effect_text:effect};
 const doc=compileEffectDocument({...row,type:row.card_type,counter:0,rarity:'',art:0,effect});const cases=scenarios(row).filter(scenario=>scenario.name.startsWith('OP02-066 Main pays'));
 assert.equal(cases.length,1);for(const scenario of cases)scenario.run(doc);
});

test('Kujyaku continuously raises only your eligible SWORD Characters during the opponent turn',()=>{
 const effect="[Opponent's Turn] All of your {SWORD} type Characters with a cost of 6 or less gain +2000 power.\n[On Play] You may trash 1 {Navy} type card from your hand: Draw 2 cards.";
 const document=compileEffectDocument({id:'test',code:'EB03-041',name:'Kujyaku',color:'Blue',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'EB03-041',name:'Kujyaku',color:'Blue',card_type:'Character',cost:3,power:4000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-continuous-power:'));
 assert.equal(cases.length,1);cases[0].run(document);
 const broken=structuredClone(document),action=broken.ast.find(ability=>ability.trigger==='continuous')?.actions[0];if(action?.kind==='power')action.maxCost=5;
 assert.throws(()=>cases[0].run(broken),/Kujyaku must continuously grant/);
});

test('conditional continuous auras check their live conditions and attached-DON gates',()=>{
 const cases=[
  {code:'P-027',name:'Shanks',type:'Character' as const,color:'Red',cost:4,power:5000,effect:"[Opponent's Turn] This Character gains +1000 power."},
  {code:'EB04-001',name:'Sanji',type:'Leader' as const,color:'Blue',cost:5,power:5000,effect:'[Opponent\'s Turn] If you have 1 or less Life cards, your Leader gains +2000 power.'},
  {code:'OP13-099',name:'Sabo',type:'Leader' as const,color:'Black',cost:5,power:5000,effect:'[Your Turn] If you have 19 or more cards in your trash, your Leader gains +1000 power.'},
 ];
 for(const card of cases){
  const document=compileEffectDocument({id:card.code,code:card.code,name:card.name,color:card.color,type:card.type,cost:card.cost,power:card.power,counter:0,rarity:'',art:0,effect:card.effect});
  const scenario=scenarios({id:card.code,code:card.code,name:card.name,color:card.color,card_type:card.type,cost:card.cost,power:card.power,effect_text:card.effect}).find(item=>item.name.startsWith('engine-aura'));
  assert.ok(scenario,`${card.code} should receive a state-based aura scenario`);scenario.run(document);
  const broken=structuredClone(document);broken.ast[0].conditions=[];assert.throws(()=>scenario.run(broken),/aura conditions or action differ/);
 }
});

test('OP15-018 Mohji K.O. requires an opposing Character at 3000 power or less with attached DON!!',()=>{
 const effect="[When Attacking] K.O. up to 1 of your opponent's Characters with 3000 power or less with a DON!! card given.";
 const document=compileEffectDocument({id:'OP15-018',code:'OP15-018',name:'Mohji',color:'Red',type:'Character',cost:2,power:3000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'OP15-018',code:'OP15-018',name:'Mohji',color:'Red',card_type:'Character',cost:2,power:3000,effect_text:effect});assert.equal(cases.filter(scenario=>scenario.name.startsWith('schema-don-ko')).length,1);for(const scenario of cases.filter(scenario=>scenario.name.startsWith('schema-don-ko')))scenario.run(document);
 const action=document.ast.find(ability=>ability.trigger==='when-attacking')?.actions[0];assert.equal(action?.kind,'ko');if(action?.kind==='ko')assert.equal(action.minAttachedDon,1);
});

test('K.O. by base cost ignores temporary cost modifiers and respects the printed limit',()=>{
 for(const [code,effect,expected] of [
  ['OP14-081',"[On K.O.] K.O. up to 1 of your opponent's Characters with a base cost of 1.",'exactBaseCost'],
  ['EB03-036',"[On Play] K.O. up to 2 of your opponent's Characters with a base cost of 3 or less.",'maxBaseCost'],
 ] as const){
  const document=compileEffectDocument({id:code,code,name:'Base Cost Test',color:'Black',type:'Character',cost:3,power:4000,counter:0,rarity:'',art:0,effect});
  const action=document.ast[0].actions.find(item=>item.kind==='ko');assert.equal(action?.kind,'ko');if(action?.kind==='ko')assert.equal(action[expected],expected==='exactBaseCost'?1:3);
  const scenario=scenarios({id:code,code,name:'Base Cost Test',color:'Black',card_type:'Character',cost:3,power:4000,effect_text:effect}).find(item=>item.name.startsWith('schema-ko'));
  assert.ok(scenario);scenario.run(document);
 }
});

test('OP09-059 Counter trashes the chosen hand count from the top of the deck after power resolves',()=>{
 const effect='[Counter] Up to 1 of your Leader or Character cards gains +3000 power during this battle. Then, trash up to 2 cards from your hand. Trash the same number of cards from the top of your deck as you did from your hand. [Trigger] Draw 1 card.';
 const document=compileEffectDocument({id:'OP09-059',code:'OP09-059',name:'Murder at the Steam Bath',color:'Blue',type:'Event',cost:2,power:0,counter:0,rarity:'C',art:0,effect});
 const scenario=scenarios({id:'OP09-059',code:'OP09-059',name:'Murder at the Steam Bath',color:'Blue',card_type:'Event',cost:2,power:0,effect_text:effect}).find(item=>item.name.startsWith('Counter: resolve power choice'));
 assert.ok(scenario);scenario.run(document);
});

test('OP16-073 On Play separately chooses active and rested DON!! from the DON!! deck',()=>{
 const effect='[On Play] Add up to 1 DON!! card from your DON!! deck and set it as active, and add up to 1 additional DON!! card and rest it. [End of Your Turn] DON!! -2: Set this Character as active. Then, this Character gains [Blocker] until the end of your opponent\'s next End Phase.';
 const document=compileEffectDocument({id:'OP16-073',code:'OP16-073',name:'Borsalino',color:'Black',type:'Character',cost:5,power:6000,counter:0,rarity:'R',art:0,effect});
 const scenario=scenarios({id:'OP16-073',code:'OP16-073',name:'Borsalino',color:'Black',card_type:'Character',cost:5,power:6000,effect_text:effect}).find(item=>item.name.startsWith('schema-add-don on-play: active then additional rested'));
 assert.ok(scenario);scenario.run(document);
});

test('OP05-040 Birdcage prevents eligible Characters from refreshing for either player',()=>{
 const effect='[End of Your Turn] K.O. all of your opponent\'s rested Characters with a cost of 5 or less.\nIf your Leader is [Donquixote Doflamingo], all Characters with a cost of 5 or less do not become active in your and your opponent\'s Refresh Phases.';
 const doc=compileEffectDocument({id:'OP05-040',code:'OP05-040',name:'Birdcage',color:'Purple',type:'Character',cost:6,power:0,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'OP05-040',code:'OP05-040',name:'Birdcage',color:'Purple',card_type:'Stage',cost:6,power:0,effect_text:effect});
 assert.ok(doc.ast.some(ability=>ability.actions.some(action=>action.kind==='refresh-prohibition')),'Birdcage refresh text must compile to a continuous prohibition');
 const stage={id:'stage',owner:'player' as const,zone:'stage' as const,type:'Stage' as const,effectSchema:doc},leader={id:'leader',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,name:'Donquixote Doflamingo'},ownFive={id:'own-five',owner:'player' as const,zone:'character' as const,type:'Character' as const,cost:5,rested:true},ownSix={id:'own-six',owner:'player' as const,zone:'character' as const,type:'Character' as const,cost:6,rested:true},oppFour={id:'opp-four',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:4,rested:true};
 const start={turn:'player' as const,firstPlayer:'player' as const,turnNumber:1,cards:[stage,leader,ownFive,ownSix,oppFour,{id:'deck-p',owner:'player' as const,zone:'deck' as const,type:'Character' as const},{id:'deck-o',owner:'opponent' as const,zone:'deck' as const,type:'Character' as const}],turnEffects:[],restrictions:[],delayed:[]};
 const ownTurn=beginTurn(start,'player',2);assert(ownTurn.state.cards.find(card=>card.id==='own-five')?.rested,'Birdcage must leave own 5-cost Character rested');assert(!ownTurn.state.cards.find(card=>card.id==='own-six')?.rested,'Birdcage must allow 6-cost Character to refresh');
 const opponentTurn=beginTurn(ownTurn.state,'opponent',3);assert(opponentTurn.state.cards.find(card=>card.id==='opp-four')?.rested,'Birdcage must also leave opponent 4-cost Character rested');
 const wrongLeader=beginTurn({...start,cards:start.cards.map(card=>card.id==='leader'?{...card,name:'Other'}:card)},'player',2);assert(!wrongLeader.state.cards.find(card=>card.id==='own-five')?.rested,'Birdcage refresh prohibition must require Donquixote Doflamingo Leader');
});

test('OP09-022 makes Character plays enter rested while its Leader effect is active',()=>{
 const effect='Your Character cards are played rested.\n[Activate: Main] [Once Per Turn] You may rest 3 of your DON!! cards: Draw 1 card.';
 const doc=compileEffectDocument({id:'OP09-022',code:'OP09-022',name:'Charlotte Pudding',color:'Yellow',type:'Leader',cost:5,power:5000,counter:0,rarity:'',art:0,effect});
 assert.ok(doc.ast.some(ability=>ability.trigger==='continuous'&&ability.actions.some(action=>action.kind==='characters-enter-rested')),'The replacement rule must compile as a continuous action');
 const leader={id:'leader',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,effectSchema:doc},character={id:'character',owner:'player' as const,zone:'hand' as const,type:'Character' as const,cost:1},don={id:'don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,rested:false};
 const state={turn:'player' as const,phase:'main' as const,cards:[leader,character,don],turnEffects:[],restrictions:[],delayed:[]};const played=playCard(state,'player','character');assert.equal(played.state.cards.find(card=>card.id==='character')?.zone,'character');assert.equal(played.state.cards.find(card=>card.id==='character')?.rested,true,'The card should enter rested under the Leader rule');
 const negated=playCard({...state,cards:state.cards.map(card=>card.id==='leader'?{...card,effectNegated:true}:card)},'player','character');assert.equal(negated.state.cards.find(card=>card.id==='character')?.rested,false,'The rule must stop applying while the Leader effect is negated');
});

test('OP17-087 applies its conditional On Play -3000 power to up to one opposing Character',()=>{
 const effect='If there is a Character with a cost of 12 or more, this Character gains +3000 power. [On Play] If there is a Character with a cost of 12 or more, give up to 1 of your opponent\'s Characters -3000 poser during this turn.';
 const doc=compileEffectDocument({id:'OP17-087',code:'OP17-087',name:'Test Character',color:'Purple',type:'Character',cost:5,power:5000,counter:0,rarity:'R',art:0,effect});
 const action=doc.ast.find(ability=>ability.trigger==='on-play')?.actions.find(item=>item.kind==='power');assert.equal(action?.kind,'power');if(action?.kind!=='power')throw new Error('Expected the typo-tolerant power action');assert.equal(action.amount,-3000);assert.equal(action.target,'opponent-character');assert.deepEqual(action.selection,{min:0,max:1});
 const source={id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,effectSchema:doc},enemy={id:'enemy',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,power:6000},qualifier={id:'large',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,cost:12,power:12000};
 const commands=resolveEffectTiming(doc,'on-play').commands,run=executeEffectCommands({turn:'player',cards:[source,enemy,qualifier],turnEffects:[],restrictions:[],delayed:[]},'player',commands,[{targetId:'enemy'}],'source');assert.equal(run.state.cards.find(card=>card.id==='enemy')?.powerModifier,-3000,'The eligible target must receive -3000');
 const noQualifier=executeEffectCommands({turn:'player',cards:[source,enemy],turnEffects:[],restrictions:[],delayed:[]},'player',commands,[{targetId:'enemy'}],'source');assert.equal(noQualifier.state.cards.find(card=>card.id==='enemy')?.powerModifier,undefined,'The debuff must not resolve without a 12-cost Character');
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

test('Life-top inspection may select either player and slash timings stay independent',()=>{
 const effect="[On Play]/[On K.O.] Look at up to 1 card from the top of your or your opponent's Life cards and place it at the top or bottom of the Life cards.";
 const document=compileEffectDocument({id:'EB02-053',code:'EB02-053',name:'Test Character',color:'Green',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const action=document.ast[0].actions[0];
 assert.equal(action.kind,'reorder-life');
 if(action.kind==='reorder-life')assert.equal(action.scope,'either');
 const cases=scenarios({id:'EB02-053',code:'EB02-053',name:'Test Character',color:'Green',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(item=>item.name.includes('reorder the exact inspected Life cards'));
 assert.equal(cases.length,2);
 for(const scenario of cases)scenario.run(document);
 const merged=structuredClone(document);merged.ast=merged.ast.slice(0,1);merged.ast[0].actions.push({kind:'on-ko'});
 assert.throws(()=>cases[1].run(merged),/timing window is missing/);
});

test('opponent-only Life inspection and ST13-004 preserve their full printed sequence',()=>{
 const opponentText='[Trigger] Draw 1 card, look at up to 1 card from the top of your opponent\'s Life cards, and place it at the top or bottom of the Life cards.';
 const opponentDoc=compileEffectDocument({id:'ST07-016',code:'ST07-016',name:'Test Event',color:'Yellow',type:'Event',cost:2,power:0,counter:0,rarity:'',art:0,effect:opponentText});
 const opponentAction=opponentDoc.ast[0].actions.find(action=>action.kind==='reorder-life');assert.ok(opponentAction);if(opponentAction?.kind==='reorder-life')assert.equal(opponentAction.scope,'opponent');
 const opponentScenario=scenarios({id:'ST07-016',code:'ST07-016',name:'Test Event',color:'Yellow',card_type:'Event',cost:2,power:0,effect_text:opponentText}).find(item=>item.name.includes('reorder the exact inspected Life cards'));
 assert.ok(opponentScenario);opponentScenario.run(opponentDoc);
 const effect='[On Play] Add 1 card from the top of your deck to the top of your Life cards. Then, look at all your Life cards; place 1 card at the top of your deck and place the rest back in your Life area in any order.';
 const document=compileEffectDocument({id:'ST13-004',code:'ST13-004',name:'Test Character',color:'Yellow',type:'Character',cost:5,power:6000,counter:0,rarity:'',art:0,effect});
 const lifeScenario=scenarios({id:'ST13-004',code:'ST13-004',name:'Test Character',color:'Yellow',card_type:'Character',cost:5,power:6000,effect_text:effect}).find(item=>item.name.startsWith('ST13-004 On Play:'));
 assert.ok(lifeScenario);lifeScenario.run(document);
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

test('OP13-059 returns one own Character as an optional cost before its cost-limited target',()=>{
 const effect="[Main] You may return 1 of your Characters to the owner's hand: Return up to 1 Character with a cost of 6 or less to the owner's hand.";
 const document=compileEffectDocument({id:'test',code:'OP13-059',name:'Brilliant Punk',color:'Blue',type:'Event',cost:4,power:0,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'OP13-059',name:'Brilliant Punk',color:'Blue',card_type:'Event',cost:4,power:0,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-return-character-cost'));
 assert.equal(cases.length,1);
 cases[0].run(document);
});

test('OP04-030 separates its On Play K.O. from the paid opponent-attack rest',()=>{
 const effect="[On Play] K.O. up to 1 of your opponent's rested Characters with a cost of 5 or less. [On Your Opponent's Attack] (2) (You may rest the specified number of DON!! cards in your cost area.): Rest up to 1 of your opponent's Characters with a cost of 4 or less.";
 const document=compileEffectDocument({id:'test',code:'OP04-030',name:'Trebol',color:'Purple',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const cases=scenarios({id:'test',code:'OP04-030',name:'Trebol',color:'Purple',card_type:'Character',cost:4,power:5000,effect_text:effect}).filter(scenario=>scenario.name.startsWith('schema-op04-030'));
 assert.equal(cases.length,1);
 cases[0].run(document);
});

test('OP04-038 rest-then-K.O. sequence preserves target scope and order in Main and Counter',()=>{
 const effect="[Main] / [Counter] Rest up to 1 of your opponent's Leader or Character cards. Then, K.O. up to 1 of your opponent's rested Characters with a cost of 6 or less. [Trigger] Set up to 5 of your DON!! cards as active.";
 const document=compileEffectDocument({id:'test',code:'OP04-038',name:'Gravity Blade Raging Tiger',color:'Blue',type:'Event',cost:6,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios({id:'test',code:'OP04-038',name:'Gravity Blade Raging Tiger',color:'Blue',card_type:'Event',cost:6,power:0,effect_text:effect}).filter(item=>item.name.startsWith('schema-op04-038'));
 assert.equal(cases.length,1);cases[0].run(document);
});

test('OP08-019 applies its opposing and allied power choices in order for Main and Counter',()=>{
 const effect="[Main]/[Counter] Give up to 1 of your opponent's Characters 3000 power during this turn. Then, up to 1 of your Characters gains +3000 power during this turn. [Trigger] K.O. up to 1 of your opponent's Characters with 5000 power or less.";
 const document=compileEffectDocument({id:'test',code:'OP08-019',name:'Impact Wave',color:'Green',type:'Event',cost:3,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios({id:'test',code:'OP08-019',name:'Impact Wave',color:'Green',card_type:'Event',cost:3,power:0,effect_text:effect}).filter(item=>item.name.startsWith('schema-op08-019'));
 assert.equal(cases.length,1);cases[0].run(document);
});

test('OP12-019 Counter can target any own Character or only a Silvers Rayleigh Leader',()=>{
 const effect='[Counter] Up to 1 of your Characters or [Silvers Rayleigh] gains +2000 power during this battle.';
 const document=compileEffectDocument({id:'test',code:'OP12-019',name:'Color of Arms Haki',color:'Red',type:'Event',cost:0,power:0,counter:0,rarity:'',art:0,effect});
 const action=document.ast.find(ability=>ability.trigger==='counter')?.actions[0];
 assert(action?.kind==='power'&&action.target==='own-character-or-named-leader'&&action.name==='Silvers Rayleigh'&&action.amount===2000&&action.until==='battle','Counter must retain its Character-or-named-Leader target and battle duration');
 const state={turn:'player' as const,cards:[{id:'leader',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,name:'Silvers Rayleigh'},{id:'other-leader',owner:'player' as const,zone:'leader' as const,type:'Leader' as const,name:'Other Leader'},{id:'character',owner:'player' as const,zone:'character' as const,type:'Character' as const,name:'Any Character'},{id:'enemy',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,name:'Enemy'}],turnEffects:[],restrictions:[],delayed:[]};
 const leader=applyEffectAction(state,'player',action,{targetId:'leader'});assert(!leader.error&&leader.state.cards.find(card=>card.id==='leader')?.powerModifier===2000,'Named Silvers Rayleigh Leader was not eligible');
 const character=applyEffectAction(state,'player',action,{targetId:'character'});assert(!character.error&&character.state.cards.find(card=>card.id==='character')?.powerModifier===2000,'An own Character should remain eligible regardless of name');
 for(const id of ['other-leader','enemy']){const rejected=applyEffectAction(state,'player',action,{targetId:id});assert(Boolean(rejected.error)&&!rejected.state.cards.find(card=>card.id===id)?.powerModifier,`${id} should not be eligible for this Counter`);}
});

test('EB04-009 and OP12-019 attach active DON!! to Silvers Rayleigh before their Main power effects',()=>{
 const cases=[
  {code:'EB04-009',name:"It's My Student's Farewell. I Want It to Be Proper.",text:"[Main] You may give 1 active DON!! card to 1 of your [Silvers Rayleigh]: Give up to 1 of your opponent's Characters −2000 power during this turn."},
  {code:'OP12-019',name:'Color of Arms Haki',text:'[Main] You may give 1 active DON!! card to 1 of your [Silvers Rayleigh]: Up to 1 of your Leader or Character cards gains +1000 power during this turn.'},
 ] as const;
 for(const item of cases){const document=compileEffectDocument({id:'test',code:item.code,name:item.name,color:'Red',type:'Event',cost:0,power:0,counter:0,rarity:'',art:0,effect:item.text});const cardScenarios=scenarios({id:'test',code:item.code,name:item.name,color:'Red',card_type:'Event',cost:0,power:0,effect_text:item.text}).filter(scenario=>scenario.name.startsWith('schema-named-don-payment'));assert.equal(cardScenarios.length,1,`${item.code} should have full attachment-payment coverage`);cardScenarios[0].run(document);}
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
 assert.equal(cases.length,3);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);
 for(const window of broken.normalized)for(const step of window.sequence)if(step.type==='RESOLVE'&&step.action.kind==='return-don'&&step.action.owner==='opponent')step.action.amount=1;
 assert.throws(()=>cases[1].run(broken),/did not return exactly two DON/);
});

test('ST18-005 pays the printed positive DON!! return reminder before playing from hand',()=>{
 const effect='[On Play] DON!! 1 (You may return the specified number of DON!! cards from your field to your DON!! deck.): Play up to 1 purple "Straw Hat Crew" type Character card with a cost of 5 or less from your hand.';
 const document=compileEffectDocument({id:'test',code:'ST18-005',name:'Luffy-Tarou',color:'Purple',type:'Character',cost:5,power:6000,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'test',code:'ST18-005',name:'Luffy-Tarou',color:'Purple',card_type:'Character',cost:5,power:6000,effect_text:effect}).find(item=>item.name.startsWith('schema-return-don-cost'));
 assert.ok(scenario);scenario.run(document);
 const broken=structuredClone(document);broken.ast[0].costs[0].optional=true;assert.throws(()=>scenario.run(broken),/mandatory cost flag/);
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
 assert.equal(cases.length,3);
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
 assert.equal(cases.length,3);
 for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document);const trigger=broken.ast.find(window=>window.trigger==='trigger')?.actions.find(action=>action.kind==='return-to-hand');
 if(trigger?.kind==='return-to-hand')trigger.maxCost=6;
 assert.throws(()=>cases.find(scenario=>scenario.name.startsWith('trigger: return any field card'))!.run(broken),/Trigger accepted a card above 4 cost/);
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

test('OP12-113 Trigger K.O.s only a 1-cost Character, then adds the Trigger card to hand',()=>{
 const effect='[On K.O.] If your Leader has the "Supernovas" type, play up to 1 "Supernovas" type Character card with a cost of 4 or less from your hand rested. [Trigger] K.O. up to 1 of your opponent\'s Characters with a cost of 1 or less and add this card to your hand.';
 const document=compileEffectDocument({id:'test',code:'OP12-113',name:'Roronoa Zoro',color:'Blue',type:'Character',cost:5,power:6000,counter:0,rarity:'C',art:0,effect});
 const cases=scenarios({id:'test',code:'OP12-113',name:'Roronoa Zoro',color:'Blue',card_type:'Character',cost:5,power:6000,effect_text:effect});assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
});

test('P-060 pays its Uta-only rest cost before resting up to two opposing DON!!',()=>{
 const effect="[Main] You may rest 1 of your [Uta] cards: Rest up to 2 of your opponent's DON!! cards.";
 const document=compileEffectDocument({id:'test',code:'P-060',name:'Uta',color:'Green',type:'Event',cost:2,power:0,counter:0,rarity:'P',art:0,effect});
 const cases=scenarios({id:'test',code:'P-060',name:'Uta',color:'Green',card_type:'Event',cost:2,power:0,effect_text:effect});assert.equal(cases.length,1);cases[0].run(document);
});

test('P-013 moves itself to the bottom of the deck before reducing opposing power',()=>{
 const effect="[Activate:Main] You may place this Character at the bottom of the owner's deck: Give up to 1 of your opponent's Characters -3000 power during this turn.";
 const document=compileEffectDocument({id:'test',code:'P-013',name:'Trafalgar Law',color:'Purple',type:'Character',cost:4,power:5000,counter:0,rarity:'P',art:0,effect});
 const cases=scenarios({id:'test',code:'P-013',name:'Trafalgar Law',color:'Purple',card_type:'Character',cost:4,power:5000,effect_text:effect});assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
});

test('OP03-095 applies -2 cost to no more than two selected opposing Characters',()=>{
 const effect="[Main] Give up to 2 of your opponent's Characters −2 cost during this turn.";
 const document=compileEffectDocument({id:'test',code:'OP03-095',name:'Mr. 2.Bon.Kurei',color:'Black',type:'Event',cost:1,power:0,counter:0,rarity:'C',art:0,effect});
 const cases=scenarios({id:'test',code:'OP03-095',name:'Mr. 2.Bon.Kurei',color:'Black',card_type:'Event',cost:1,power:0,effect_text:effect});assert.equal(cases.length,1);cases[0].run(document);
});

test('P-010 adds one active DON!! from the owner’s DON!! deck at end of turn',()=>{
 const effect='[End of Your Turn] Add 1 DON!! card from your DON!! deck and set it as active.';
 const document=compileEffectDocument({id:'test',code:'P-010',name:'Promo',color:'Purple',type:'Character',cost:4,power:5000,counter:0,rarity:'P',art:0,effect});
 const cases=scenarios({id:'test',code:'P-010',name:'Promo',color:'Purple',card_type:'Character',cost:4,power:5000,effect_text:effect});assert.equal(cases.length,1);cases[0].run(document);
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
 assert.equal(cases.length,3);
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
 assert.equal(cases.length,3);
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
 assert.equal(cases.length,3);
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

test('Trigger reuses the complete On K.O. sequence',()=>{
 const effect="[On K.O.] K.O. up to 1 of your opponent's Characters with a cost of 4 or less.\n[Trigger] Activate this card's [On K.O.] effect.",row={id:'test',code:'OP16-114',name:'Test',color:'Black',card_type:'Character' as const,cost:4,power:5000,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios(row).find(item=>item.name.startsWith('schema-reference trigger: resolve the referenced On K.O.'));
 assert.ok(scenario);scenario.run(document);
 const broken=structuredClone(document),trigger=broken.ast.find(ability=>ability.trigger==='trigger');if(trigger)trigger.actions=[];
 assert.throws(()=>scenario.run(broken),/must reference the card's On K\.O\. effect exactly once/);
});

test('OP05-116 uses opponent Life as its K.O. cap in Main and Trigger windows',()=>{
 const effect="[Main] K.O. up to 1 of your opponent's Characters with a cost equal to or less than the number of your opponent's Life cards.\n[Trigger] Activate this card's [Main] effect.",row={id:'OP05-116',code:'OP05-116',name:'Test Event',color:'Blue',card_type:'Event' as const,cost:4,power:0,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:4,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios(row),mainCase=cases.find(item=>item.name.startsWith('schema-ko main: up to 1, live cost cap equals opponent Life')),triggerCase=cases.find(item=>item.name.startsWith('schema-reference trigger:'));
 assert.ok(mainCase);assert.ok(triggerCase);mainCase.run(document);triggerCase.run(document);
 const broken=structuredClone(document),main=broken.ast.find(ability=>ability.trigger==='main'),action=main?.actions.find(item=>item.kind==='ko');if(action?.kind==='ko')delete action.maxCostFromLife;
 assert.throws(()=>mainCase.run(broken),/current opponent Life/);
});

test('OP08-094 verifies its optional Trash-cost K.O. sequence in Main, Counter, and Trigger windows',()=>{
 const effect="[Main]/[Counter] You may place 3 cards from your trash at the bottom of your deck in any order: K.O. up to 1 of your opponent's Characters with a cost of 2 or less. [Trigger] Activate this card's [Main] effect.",row={id:'OP08-094',code:'OP08-094',name:'Imperial Flame',color:'Blue',card_type:'Event' as const,cost:2,power:0,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:2,power:0,counter:0,rarity:'R',art:0,effect});
 const cases=scenarios(row);assert.equal(cases.filter(scenario=>!scenario.name.startsWith('engine-action ')).length,5);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document),main=broken.ast.find(ability=>ability.trigger==='main');if(main)main.costs=[];
 assert.throws(()=>cases[0].run(broken),/complete supported cost and K\.O\. sequence/);
});

test('OP07-092 requires two CP-type Trash cards before its optional cost-1 K.O.',()=>{
 const effect='[On Play] You may place 2 cards with a type including "CP" from your trash at the bottom of your deck in any order: K.O. up to 1 of your opponent\'s Characters with a cost of 1 or less.',row={id:'OP07-092',code:'OP07-092',name:'Joseph',color:'Blue',card_type:'Character' as const,cost:3,power:4000,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const cases=scenarios(row);assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document),cost=broken.ast.find(ability=>ability.trigger==='on-play')?.costs[0];if(cost?.kind==='bottom-deck-trash')delete cost.trait;
 assert.throws(()=>cases[0].run(broken),/type including CP/);
});

test('OP09-115 K.O. requires the opposing Character to have a printed Trigger',()=>{
 const effect="[Main] K.O. up to 1 of your opponent's Characters with a cost of 3 or less and a [Trigger].\n[Trigger] Draw 1 card.",row={id:'OP09-115',code:'OP09-115',name:'Yasopp',color:'Red',card_type:'Character' as const,cost:4,power:5000,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const cases=scenarios(row);assert.equal(cases.length,2);for(const scenario of cases)scenario.run(document);
 const broken=structuredClone(document),action=broken.ast.find(ability=>ability.trigger==='main')?.actions[0];if(action?.kind==='ko')delete action.requiresTrigger;
 assert.throws(()=>cases.find(scenario=>scenario.name.includes('K.O.'))!.run(broken),/cost 3 or less and a Trigger/);
});

test('OP05-094 resolves -3 cost before selecting a zero-cost Character for next Refresh',()=>{
 const effect="[Main] Give up to 1 of your opponent's Characters -3 cost during this turn. Then, up to 1 of your opponent's Characters with a cost of 0 will not become active in the next Refresh Phase. [Trigger] Draw 2 cards and trash 1 card from your hand.",row={id:'OP05-094',code:'OP05-094',name:'Test Event',color:'Blue',card_type:'Event' as const,cost:4,power:0,effect_text:effect},document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Event',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect});
 const cases=scenarios(row);assert.equal(cases.length,1);cases[0].run(document);
 const broken=structuredClone(document),action=broken.ast.find(ability=>ability.trigger==='main')?.actions[1];if(action?.kind==='prevent-ready')delete action.exactCost;
 assert.throws(()=>cases[0].run(broken),/cost exactly 0/);
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

test('OP15-023 opponent-DON sequence resolves its cost before its optional transfer without masking other scenarios',()=>{
 const effect="[Activate: Main] You may give 1 of your opponent's rested DON!! cards to 1 of your opponent's Characters: Give up to 1 DON!! to 1 of your opponent's Leaders or Characters. [On K.O.] Up to 2 of your opponent's rested cards will not become active in your opponent's next Refresh Phase.";
 const document=compileEffectDocument({id:'OP15-023',code:'OP15-023',name:'Arlong',color:'Red',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect});
 const scenario=scenarios({id:'OP15-023',code:'OP15-023',name:'Arlong',color:'Red',card_type:'Character',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('Activate: Main gameplay:'));
 assert.ok(scenario);scenario.run(document);
 const unrelated='[On K.O.] Up to 2 of your opponent\'s rested cards will not become active in your opponent\'s next Refresh Phase.',other=compileEffectDocument({id:'test',code:'OP15-023',name:'Arlong',color:'Red',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect:unrelated});
 assert.ok(scenarios({id:'test',code:'OP15-023',name:'Arlong',color:'Red',card_type:'Character',cost:4,power:5000,effect_text:unrelated}).some(item=>item.name.startsWith('schema-prevent-ready')));assert.equal(other.ast[0].actions[0].kind,'prevent-ready');
});

test('OP14-105 reveals three eligible hand cards before distributing one rested DON!! per recipient',()=>{
 const effect='[Activate: Main] [Once Per Turn] You may reveal 3 {Amazon Lily} or {Kuja Pirates} type cards from your hand: Give your Leader and all of your Characters up to 1 rested DON!! card each.';
 const document=compileEffectDocument({id:'OP14-105',code:'OP14-105',name:'Gorgon Sisters',color:'Green',type:'Character',cost:4,power:5000,counter:1000,rarity:'',art:0,effect});
 const scenario=scenarios({id:'OP14-105',code:'OP14-105',name:'Gorgon Sisters',color:'Green',card_type:'Character',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('Activate: Main gameplay:'));
 assert.ok(scenario);scenario.run(document);
});

test('OP06-086 resolves its two Trash play choices separately and applies rested only to the other Character',()=>{
 const effect='[On Play] Choose up to 1 Character card with a cost of 4 or less and up to 1 Character card with a cost of 2 or less from your trash. Play 1 card and play the other card rested.';
 const document=compileEffectDocument({id:'OP06-086',code:'OP06-086',name:'Gecko Moria',color:'Black',type:'Character',cost:4,power:5000,counter:1000,rarity:'',art:0,effect});
 const scenario=scenarios({id:'OP06-086',code:'OP06-086',name:'Gecko Moria',color:'Black',card_type:'Character',cost:4,power:5000,effect_text:effect}).find(item=>item.name.startsWith('On Play gameplay:'));
 assert.ok(scenario);scenario.run(document);
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

test('conditional and turn-limited attack prohibitions apply only to their printed target',()=>{
 const conditional=compileEffectDocument({id:'conditional',code:'EB04-051',name:'Test',color:'Red',type:'Character',cost:4,power:5000,counter:0,rarity:'',art:0,effect:'This Character cannot attack unless there is a Character with 12000 base power or more.'});
 assert.equal(conditional.resolver.type,'DSL');
 const source={id:'source',owner:'player' as const,zone:'character' as const,type:'Character' as const,power:5000,rested:false,effectSchema:conditional};
 const leader={id:'leader',owner:'opponent' as const,zone:'leader' as const,type:'Leader' as const};
 const base={turn:'player' as const,phase:'main' as const,turnNumber:2,cards:[source,leader],turnEffects:[],restrictions:[],delayed:[]};
 assert.match(declareAttack(base,'player','source','leader').error??'',/prohibited/);
 const threshold={...base,cards:[...base.cards,{id:'power-12k',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,power:12000,rested:true}]};
 assert.equal(declareAttack(threshold,'player','source','leader').error,undefined);

 const restricted=compileEffectDocument({id:'play-turn',code:'OP03-004',name:'Test Rush',color:'Purple',type:'Character',cost:3,power:5000,counter:0,rarity:'',art:0,effect:'This Character cannot attack a Leader on the turn in which it is played. [DON!! x1] This Character gains [Rush].'});
 assert.equal(restricted.resolver.type,'DSL');
 const rushSource={...source,effectSchema:restricted},attached={id:'don',owner:'player' as const,zone:'cost-area' as const,type:'DON!!' as const,attachedTo:'source'},turnState={...base,cards:[rushSource,leader,attached],playedThisTurn:['source']};
 assert.match(declareAttack(turnState,'player','source','leader').error??'',/prohibited/);
 const character={id:'target',owner:'opponent' as const,zone:'character' as const,type:'Character' as const,rested:true};
 assert.equal(declareAttack({...turnState,cards:[rushSource,character,attached]},'player','source','target').error,undefined);
});

test('OP03-051 separates its gated attack-damage mill from its optional On K.O. mill',()=>{
 const row={id:'OP03-051',code:'OP03-051',name:'Arlong',color:'Blue',card_type:'Character' as const,cost:5,power:6000,effect_text:"[DON!! x1] When this Character's attack deals damage to your opponent's Life, you may trash 7 cards from the top of your deck.\n[On K.O.] You may trash 3 cards from the top of your deck."};
 const document=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:'Character',cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 const scenario=scenarios(row).find(item=>item.name.startsWith('OP03-051 real play:'));assert.ok(scenario,'Arlong needs a complete card-specific gameplay scenario');scenario.run(document);
});
