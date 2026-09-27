import type {EffectImplementationStatus,EffectTrigger} from './effect-rules';

export type CustomInstruction=
 | {kind:'choose';count:number;from:'own-character'|'opponent-character'|'own-trash'|'opponent-trash'|'hand'|'cost-area';constraint?:string}
 | {kind:'choose-one';options:string[]}
 | {kind:'play-selected';rested?:boolean}
 | {kind:'delayed';when:'next-main-phase'|'end-turn'|'replacement';instruction:string}
 | {kind:'apply';instruction:string};

export type CustomEffectDefinition={
 handler:string;
 timing:EffectTrigger;
 status:EffectImplementationStatus;
 instructions:CustomInstruction[];
};

const tested=(handler:string,timing:EffectTrigger,instructions:CustomInstruction[]):CustomEffectDefinition=>({handler,timing,status:'TESTED',instructions});
const implemented=(handler:string,timing:EffectTrigger,instruction:string):CustomEffectDefinition=>({handler,timing,status:'IMPLEMENTED',instructions:[{kind:'apply',instruction}]});

/**
 * Cards here need branching, a delayed window, a replacement, or a relationship
 * between selected cards that cannot be represented by one independent DSL action.
 * Every TESTED entry has a pure resolver fixture in tests/custom-effect-resolvers.test.ts.
 */
const definitions:CustomEffectDefinition[]=[
 tested('OP06_086_ON_PLAY','on-play',[
  {kind:'choose',count:1,from:'own-trash',constraint:'Character with cost 4 or less'},
  {kind:'choose',count:1,from:'own-trash',constraint:'Character with cost 2 or less'},
  {kind:'choose-one',options:['Play the first selected card','Play the second selected card']},
  {kind:'play-selected'},
  {kind:'play-selected',rested:true},
 ]),
 tested('OP06_092_ON_PLAY','on-play',[{kind:'choose-one',options:['Trash up to 1 opponent Character with cost 4 or less','Put 3 Event cards from opponent trash on deck bottom']}]),
 tested('PRB02_005_ON_PLAY','on-play',[{kind:'delayed',when:'next-main-phase',instruction:'Rest 1 active opponent DON!! if the printed condition held on play'}]),
 tested('OP10_074_CONTINUOUS','continuous',[{kind:'delayed',when:'replacement',instruction:'Instead of this Character being K.O.d by an opponent effect, optionally rest 2 active own DON!!'}]),
 tested('OP14_092_CONTINUOUS','continuous',[{kind:'delayed',when:'replacement',instruction:'Instead of this Character being K.O.d, optionally put 3 own trash cards on deck bottom'}]),
 tested('OP15_069_UNKNOWN','unknown',[{kind:'delayed',when:'replacement',instruction:'Instead of an eligible own Character being removed by an opponent effect, optionally return 1 own DON!!'}]),
 tested('OP16_018_CONTINUOUS','continuous',[{kind:'delayed',when:'replacement',instruction:'Instead of an eligible Red-Haired Pirates Character being K.O.d, optionally trash a 6000-power Character from hand'}]),
 tested('P_111_CONTINUOUS','continuous',[{kind:'delayed',when:'replacement',instruction:'Instead of an eligible Straw Hat Crew Character being removed by an opponent effect, optionally rest 1 own DON!!'}]),
 tested('OP12_040_UNKNOWN','unknown',[{kind:'delayed',when:'replacement',instruction:'When a Navy card effect trashes cards from own hand, draw the exact number trashed'}]),
 tested('OP13_035_END_TURN','end-turn',[{kind:'choose-one',options:['Set this Character active','Set up to 1 own DON!! active']}]),
 tested('OP13_105_ON_PLAY','on-play',[{kind:'apply',instruction:'Reveal all own Life cards and reorder them'}]),
 tested('OP13_003_UNKNOWN','unknown',[{kind:'apply',instruction:'During DON!! phase, attach one placed DON!! to Leader if any DON!! are on field; otherwise apply the printed leader power condition'}]),
 tested('OP15_031_ON_PLAY','on-play',[{kind:'choose',count:1,from:'opponent-character',constraint:'rested'}, {kind:'apply',instruction:'K.O. the selected Character only if its cost equals DON!! attached to it'}]),
 tested('OP17_119_ON_PLAY','on-play',[{kind:'choose',count:0,from:'opponent-character',constraint:'Characters with a combined total cost of 4 or less'}, {kind:'apply',instruction:'K.O. every selected Character'}]),
 tested('OP15_023_ACTIVATE_MAIN','activate-main',[{kind:'choose',count:1,from:'cost-area',constraint:'opponent rested DON!!'}, {kind:'apply',instruction:'Attach it to an opponent Character'}, {kind:'apply',instruction:'Attach up to 1 DON!! from its owner cost area to that owner Leader or Character'}]),
 tested('ST13_002_END_TURN','end-turn',[{kind:'apply',instruction:'Trash all own face-up Life cards'}]),
 tested('ST13_005_ON_PLAY','on-play',[{kind:'choose',count:1,from:'hand',constraint:'Character with cost 5'}, {kind:'apply',instruction:'After optional top-or-bottom Life trash cost, put selected card on Life face-down'}]),
 tested('P_098_ON_PLAY','on-play',[{kind:'apply',instruction:'If own field has fewer than five Characters with cost 5 or greater, place this Character on deck bottom'}]),
 tested('P_067_UNKNOWN','unknown',[{kind:'apply',instruction:'While this Character is rested, opponent attacks must target this Character'}]),

 implemented('OP02_025_ACTIVATE_MAIN','activate-main','If own Character count is 1 or less, reduce the next eligible Land of Wano Character played from hand this turn by 1.'),
 implemented('OP08_001_ACTIVATE_MAIN','activate-main','Give up to three eligible Animal or Drum Kingdom Characters one rested DON!! each.'),
 implemented('OP09_064_ON_PLAY','on-play','After optional DON!!-1 return cost, set one Kid Pirates Leader active.'),
 implemented('OP09_009_ON_PLAY','on-play','Trash up to one opponent Character with power 6000 or less.'),
 implemented('OP06_083_ACTIVATE_MAIN','activate-main','Pay by K.O.ing one Thriller Bark Pirates Character, then negate this Character effect for the turn.'),
 implemented('OP11_031_ACTIVATE_MAIN','activate-main','Once per turn, allow one Fish-Man or Merfolk Character to attack Characters on the turn it was played.'),
 implemented('OP12_037_MAIN','main','After optional three DON!! rest cost, rest up to two total opponent Characters and/or DON!! cards.'),
 implemented('OP12_039_MAIN','main','Set own Roronoa Zoro Leader active.'),
 implemented('OP12_014_ACTIVATE_MAIN','activate-main','Trash Boa Hancock, then give up to two rested DON!! cards to own Leader or one own Character.'),
 implemented('OP11_091_ON_PLAY','on-play','Put three Event cards from opponent trash on bottom of opponent deck in any order.'),
 implemented('OP05_117_ON_PLAY','on-play','Search the top five for one Sky Island card, add it to hand, and bottom-deck the remainder in any order.'),
 implemented('OP13_098_MAIN','main','After optional one DON!! rest cost and Imu Leader check, K.O. one opponent Stage with cost exactly 7.'),
 implemented('OP13_006_ON_PLAY','on-play','Give up to two rested DON!! cards to one Monkey.D.Luffy card.'),
 implemented('EB04_017_CONTINUOUS','continuous','Apply the Minks threshold cost increase and the conditional On Play Minks Character play as separate timing windows.'),
 implemented('EB04_011_ON_PLAY','on-play','Draw one per Neptunian Character, then trash the same number of cards from hand.'),
 implemented('OP14_105_ACTIVATE_MAIN','activate-main','Reveal three Amazon Lily or Kuja Pirates cards from hand, then give Leader and each Character up to one rested DON!!.'),
 implemented('OP14_027_CONTINUOUS','continuous','On becoming rested, rest an eligible opponent Character; while rested on opponent turn, grant all opponent Characters +1000.'),
 implemented('OP14_053_CONTINUOUS','continuous','While hand has seven or fewer cards on opponent turn, set base power to Leader base power.'),
 implemented('OP13_028_ON_PLAY','on-play','Set all own DON!! active, then prevent playing cards from hand for the rest of turn.'),
 implemented('EB03_059_TRIGGER','trigger','Prevent one eligible opponent Character other than Monkey.D.Luffy from attacking this turn.'),
 implemented('EB03_031_ON_PLAY','on-play','After DON!!-1 and Sanji Leader check, activate the Main effect of one eligible Event in own trash.'),
 implemented('EB03_026_ACTIVATE_MAIN','activate-main','Bottom-deck one own Character as cost; then give one rested DON!! to own Leader and one Character.'),
 implemented('OP14_056_UNKNOWN','unknown','When a card is trashed from own hand by an effect, negate this Character effect for the turn.'),
 implemented('OP15_032_ON_PLAY','on-play','Rest up to one opponent card; separately permit the printed activated self-trash ready effect.'),
 implemented('EB04_012_ACTIVATE_MAIN','activate-main','Once per turn, if played this turn, set own Land of Wano Leader active.'),
 implemented('EB04_005_UNKNOWN','unknown','This Character may attack only while opponent controls at least two Characters with base power 5000 or more.'),
 implemented('OP15_028_ON_PLAY','on-play','With East Blue Leader, attach up to one opponent cost-area DON!! to one opponent Character.'),
 implemented('OP16_042_UNKNOWN','unknown','Override deck construction limit: any number of this named card may be included.'),
 implemented('OP16_030_END_TURN','end-turn','Set all own green Characters costing five or less active.'),
 implemented('OP16_036_WHEN_ATTACKING','when-attacking','Set this Character base power to opponent Leader base power for the turn.'),
 implemented('ST15_001_WHEN_ATTACKING','when-attacking','With Edward.Newgate Leader, prevent own effects from adding Life cards to hand this turn.'),
 implemented('ST19_003_ON_PLAY','on-play','With Smoker Leader, give up to one opponent Character +4 cost for the turn.'),
 implemented('ST19_005_ACTIVATE_MAIN','activate-main','After bottom-decking one own trash card, give up to one opponent Character +1 cost for the turn.'),
 implemented('P_058_P1_MAIN','main','With Uta Leader, schedule all own FILM Characters to become active at end of turn.'),
 implemented('ST29_012_ACTIVATE_MAIN','activate-main','Give up to one rested DON!! to one Monkey.D.Luffy card.'),
 implemented('P_058_MAIN','main','With Uta Leader, schedule all own FILM Characters to become active at end of turn.'),
 implemented('P_700_UNKNOWN','unknown','Designated-event Leader identity override: treat as all card names, types, and attributes.'),
 implemented('P_900_UNKNOWN','unknown','Designated-event Leader identity override: treat as all card names, types, and attributes.'),
 implemented('P_800_UNKNOWN','unknown','Designated-event Leader identity override: treat as all card names, types, and attributes.'),
 implemented('P_009_ON_PLAY','on-play','If opponent has six or more hand cards, opponent adds one Life card to hand.'),
 implemented('P_091_ON_PLAY','on-play','Play up to one Neptunian or Fish-Man Island Character costing five or less from hand; separately allow its printed activated attack permission.'),
 implemented('OP15_091_ON_PLAY','on-play','Put up to one card from opponent trash on the bottom of its owner deck.'),
 implemented('OP16_100_MAIN','main','After optional two DON!! rest cost and a qualifying opponent K.O. this turn, set Yamato Leader active.'),
 implemented('OP16_039_TRIGGER','trigger','Rest opponent Leader.'),
 implemented('OP16_074_ON_PLAY','on-play','With Impel Down Leader, opponent returns one DON!!; separately resolve the printed On K.O. four-DON return.'),
 implemented('OP17_116_MAIN','main','After optional two DON!! rest cost, K.O. up to one opponent Stage.'),
 implemented('OP17_097_MAIN','main','Give every opponent Character +1 cost for the turn.'),
 implemented('ST01_001_ACTIVATE_MAIN','activate-main','Give this Leader or one own Character up to one rested DON!!.'),
 implemented('ST09_010_CONTINUOUS','continuous','Instead of this Character being K.O.d, optionally trash one own top-or-bottom Life card.'),

];

const byHandler=new Map(definitions.map(definition=>[definition.handler,definition]));
export function customEffectDefinition(handler:string){return byHandler.get(handler);}
export function customResolverStatus(handler:string):EffectImplementationStatus{return byHandler.get(handler)?.status??'RAW';}
export function resolveCustomEffect(handler:string){const definition=byHandler.get(handler);return (definition?.status==='TESTED'||definition?.status==='IMPLEMENTED')?{status:'ready' as const,instructions:definition.instructions}:{status:'custom' as const,instructions:[] as CustomInstruction[]};}
export function customEffectDefinitions(){return [...definitions];}
