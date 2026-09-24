import type {Card} from '../card-data/catalog';

export type EffectTrigger='on-play'|'when-attacking'|'activate-main'|'main'|'trigger'|'counter'|'on-ko'|'on-block'|'opponent-attack'|'end-turn'|'continuous'|'unknown';
export type EffectTarget='self'|'own-character'|'own-leader'|'opponent-character'|'opponent-leader'|'opponent-hand'|'deck'|'trash'|'life';
export type EffectAction=
 | {kind:'draw';amount:number}
 | {kind:'rest';scope:'self'|'opponent-character'|'opponent-leader'|'opponent-don'|'opponent-card';maxCost?:number}
 | {kind:'ready';scope:'self'|'own-character';amount?:number}
 | {kind:'ko';maxCost?:number;maxPower?:number;restedOnly?:boolean}
 | {kind:'power';amount:number;until:'turn-end'|'battle';target:EffectTarget}
 | {kind:'cost';amount:number;target:'opponent-character'}
 | {kind:'return-to-hand';scope:'own-character'|'opponent-character';maxCost?:number}
 | {kind:'bottom-deck';scope:'own-character'|'opponent-character'|'any-character'|'opponent-hand'|'trash';maxCost?:number}
 | {kind:'return-trash-to-deck-bottom';amount:number;optional:boolean}
 | {kind:'add-don';amount:number;rested?:boolean}
 | {kind:'return-don';amount:number}
 | {kind:'attach-don-required';amount:number}
 | {kind:'trash';scope:'self'|'hand'|'deck'|'opponent-hand';amount:number;requiresTrigger?:boolean}
 | {kind:'search';amount:number;destination:'hand'|'trash'|'deck-bottom';choose:number;cardType?:Card['type'];trait?:string}
 | {kind:'play';source:'hand'|'trash'|'life';maxCost?:number;rested?:boolean}
 | {kind:'blocker'}
 | {kind:'counter';amount:number}
 | {kind:'rush'}
 | {kind:'double-attack'}
 | {kind:'banish'}
 | {kind:'on-ko'}
 | {kind:'on-block'}
 | {kind:'return-to-deck';scope:'own-character'|'opponent-character';position:'top'|'bottom'}
 | {kind:'reveal';source:'deck'|'life';amount:number}
 | {kind:'life';operation:'add-to-hand'|'add-to-life'|'trash';amount:number}
 | {kind:'grant-keyword';keyword:'rush'|'blocker'|'double-attack'|'banish'|'unblockable';until:'turn-end'|'battle'}
 | {kind:'hand-reset';scope:'self'|'opponent';draw?:number}
 | {kind:'shuffle';scope:'self'|'opponent'}
 | {kind:'recover';source:'trash';destination:'hand';amount:number;maxCost?:number;trait?:string}
 | {kind:'attack-permission';scope:'own-character';activeTargets?:boolean}
 | {kind:'attack-restriction';scope:'opponent-leader'|'opponent-character';until:'turn-end'|'opponent-next-turn'}
 | {kind:'prevent-ready';scope:'opponent-character'|'opponent-don';until:'opponent-next-refresh'}
 | {kind:'prevent-ko';scope:'own-character';by:'battle'|'effect'|'any'}
 | {kind:'activate-main-effect'}
 | {kind:'set-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'don-power';amount:number;during:'your-turn'|'opponent-turn'}
 | {kind:'attach-don';amount:number;source:'cost-area'|'attached'}
 | {kind:'draw-by';source:'returned-hand'}
 | {kind:'reveal-hand';scope:'opponent';amount:number}
 | {kind:'hand-limit';scope:'both';amount:number}
 | {kind:'move-to-life';scope:'own'|'opponent';amount:number;faceUp?:boolean;position:'top'|'bottom'|'choice'}
 | {kind:'trash-life';scope:'own'|'opponent'|'both';amount:number}
 | {kind:'set-cost';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'activate-referenced-effect';trigger:'on-play'|'main'}
 | {kind:'prevent-rest';scope:'opponent-character';until:'opponent-next-turn'}
 | {kind:'swap-power';until:'turn-end'}
 | {kind:'base-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'negate-effect';scope:'opponent-character'|'opponent-card';amount:number;until:'turn-end'}
 | {kind:'cost-reduction';amount:number;cardType?:Card['type'];trait?:string;minimumCost?:number}
 | {kind:'replacement';event:'removed-by-effect'|'ko-by-effect';cost:{kind:'rest-card'|'bottom-deck-own-character'|'return-self-hand'}}
 | {kind:'unimplemented';text:string};

export type EffectCost=
 | {kind:'trash';scope:'hand'|'self';amount:number;requiresTrigger?:boolean;optional:boolean}
 | {kind:'rest';scope:'self'|'don';amount:number;optional:boolean}
 | {kind:'return-don';amount:number;optional:boolean};
export type EffectCondition={kind:'text';text:string};
export type ParsedEffect={trigger:EffectTrigger;actions:EffectAction[];costs:EffectCost[];conditions:EffectCondition[];optional:boolean;source:string};
const numberAfter=(text:string,pattern:RegExp)=>Number(text.match(pattern)?.[1]??0);
const costLimit=(text:string)=>numberAfter(text,/cost of\s+(\d+)\s+or less/i)||undefined;
const powerLimit=(text:string)=>numberAfter(text,/(\d+)\s+power or less/i)||undefined;

/** Converts printed English effect clauses into board actions. UI owns timing and choices. */
function parseEffectText(source:string):ParsedEffect[]{
 const text=source.replace(/^NULL$/i,'').trim();
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const trigger:EffectTrigger=/\[On Play\]/i.test(text)?'on-play':/\[When Attacking\]/i.test(text)?'when-attacking':/\[Activate\s*:\s*Main\]/i.test(text)?'activate-main':/\[Main\]/i.test(text)?'main':/\[Counter\]/i.test(text)?'counter':/\[Trigger\]/i.test(text)?'trigger':/\[On K\.O\.\]/i.test(text)?'on-ko':/\[On Block\]/i.test(text)?'on-block':/\[On Your Opponent's Attack\]/i.test(text)?'opponent-attack':/\[End of Your Turn\]/i.test(text)?'end-turn':/\[(?:Your Turn|Opponent's Turn|Once Per Turn)\]/i.test(text)?'continuous':'unknown';
 const actions:EffectAction[]=[]; const costs:EffectCost[]=[]; const conditions:EffectCondition[]=[]; const optional=/\bYou may\b/i.test(text);
 for(const match of text.matchAll(/\bIf\s+([^.:]+)(?:[:,])/gi)) conditions.push({kind:'text',text:match[1].trim()});
 const draw=numberAfter(text,/draw\s+(\d+)\s+card/i); if(draw)actions.push({kind:'draw',amount:draw});
 if(/^(?:\[Your Turn\]\s*)?Your Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'your-turn'});
 if(/^(?:\[Opponent's Turn\]\s*)?Opponent's Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'opponent-turn'});
 if(/draw cards? equal to the number you returned to your deck/i.test(text))actions.push({kind:'draw-by',source:'returned-hand'});
 const resetMatch=text.match(/(you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck.*?draws? (\d+) cards?/i); if(resetMatch)actions.push({kind:'hand-reset',scope:/opponent/i.test(resetMatch[1])?'opponent':'self',draw:Number(resetMatch[2])});
 if(/(?:you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck/i.test(text)&&!resetMatch)actions.push({kind:'hand-reset',scope:/your opponent/i.test(text)?'opponent':'self'});
 if(/(?:you|your opponent) (?:shuffles?|shuffle) (?:their|your) deck/i.test(text))actions.push({kind:'shuffle',scope:/your opponent/i.test(text)?'opponent':'self'});
 const trashRecovery=text.match(/add up to (\d+) .*?(?:Character )?cards?.*?from your trash to your hand/i); if(trashRecovery)actions.push({kind:'recover',source:'trash',destination:'hand',amount:Number(trashRecovery[1]),maxCost:costLimit(text),trait:text.match(/\[([^\]]+)\] (?:or \[[^\]]+\] )?type (?:Character )?cards?/i)?.[1]});
 const broadRecovery=text.match(/(?:add|select) up to (\d+) .*?from your trash (?:to your hand|and play)/i); if(broadRecovery)actions.push({kind:'recover',source:'trash',destination:'hand',amount:Number(broadRecovery[1]),maxCost:costLimit(text),trait:text.match(/(?:\{|\[)([^}\]]+)(?:\}|\]) type/i)?.[1]});
 const fixedPower=text.match(/set the power of up to \d+ of your opponent's Characters? to (\d+)/i); if(fixedPower)actions.push({kind:'set-power',amount:Number(fixedPower[1]),target:'opponent-character',until:'turn-end'});
 const directPower=text.match(/give up to \d+ of your opponent's Characters? (\d+) power during this turn/i); if(directPower)actions.push({kind:'power',amount:Number(directPower[1]),until:'turn-end',target:'opponent-character'});
 const fixedCost=text.match(/set the cost of up to \d+ of your opponent's Characters?.*?to (\d+) during this turn/i); if(fixedCost)actions.push({kind:'set-cost',amount:Number(fixedCost[1]),target:'opponent-character',until:'turn-end'});
 const power=Number(text.match(/([+\-]\d+)\s*power/i)?.[1]??0); if(power)actions.push({kind:'power',amount:power,until:/during this battle/i.test(text)?'battle':'turn-end',target:/opponent/i.test(text)?'opponent-character':/Leader/i.test(text)?'own-leader':'own-character'});
 const cost=Number(text.match(/([+\-]\d+)\s*cost/i)?.[1]??0); if(cost)actions.push({kind:'cost',amount:cost,target:'opponent-character'});
 if(/K\.O\.\s+(?:all|(?:up to\s+)?\d*\s*(?:of your opponent's )?(?:rested )?characters?)/i.test(text))actions.push({kind:'ko',maxCost:costLimit(text),maxPower:powerLimit(text),restedOnly:/rested Characters?/i.test(text)});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?(?:to the owner's )?hand/i.test(text))actions.push({kind:'return-to-hand',scope:'opponent-character',maxCost:costLimit(text)});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your )?[^.]*?Characters?.*?(?:to the owner's )?hand/i.test(text)&&/of your /i.test(text))actions.push({kind:'return-to-hand',scope:'own-character',maxCost:costLimit(text)});
 if(/place\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?bottom of (?:the )?owner's deck/i.test(text))actions.push({kind:'bottom-deck',scope:'opponent-character',maxCost:costLimit(text)});
 if(/at the end of a battle.*?place the opponent's Character you battled with at the bottom of the owner's deck/i.test(text))actions.push({kind:'bottom-deck',scope:'opponent-character',maxCost:costLimit(text)});
 if(/place all Characters? with a cost of \d+ or less at the bottom of the owner's deck/i.test(text))actions.push({kind:'bottom-deck',scope:'any-character',maxCost:costLimit(text)});
 if(/your opponent places? \d+ cards? from their trash at the bottom of their deck/i.test(text))actions.push({kind:'bottom-deck',scope:'trash'});
 if(/places? \d+ cards? from their hand at the bottom of their deck/i.test(text))actions.push({kind:'bottom-deck',scope:'opponent-hand'});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your )?characters?.*?(?:to the top|on top) of (?:your )?deck/i.test(text))actions.push({kind:'return-to-deck',scope:'own-character',position:'top'});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?(?:to the top|on top) of (?:the owner's )?deck/i.test(text))actions.push({kind:'return-to-deck',scope:'opponent-character',position:'top'});
 if(/reveal\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i.test(text))actions.push({kind:'reveal',source:'deck',amount:numberAfter(text,/reveal\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i)});
 if(/add\s+(?:up to\s+)?(\d+)\s+cards? from (?:the top|your) Life/i.test(text))actions.push({kind:'life',operation:'add-to-hand',amount:numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards? from (?:the top|your) Life/i)});
 if(/add\s+(?:up to\s+)?(\d+)\s+cards?.*?to (?:the top of )?your Life/i.test(text))actions.push({kind:'life',operation:'add-to-life',amount:numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards?.*?to (?:the top of )?your Life/i)});
 if(/rest\s+this (?:character|stage)/i.test(text)){actions.push({kind:'rest',scope:'self'});if(/(?:You may )?rest this (?:character|stage)\s*:/i.test(text))costs.push({kind:'rest',scope:'self',amount:1,optional,});}
 const opponentRest=text.match(/rest (?:all(?: of)?\s+|(?:up to\s+)?\d*\s*(?:of )?)your opponent's (Leader or Character|Characters?|DON!! cards?|Leader or Character cards?)/i); if(opponentRest){const subject=opponentRest[1]??'';actions.push({kind:'rest',scope:/DON!!/i.test(subject)?'opponent-don':/Leader or Character/i.test(subject)?'opponent-card':/Leader/i.test(subject)?'opponent-leader':'opponent-character',maxCost:costLimit(text)});}
 if(/set this Character as active/i.test(text))actions.push({kind:'ready',scope:'self',amount:1});
 const readyTarget=text.match(/set\s+(?:up to\s+)?\d*\s*(?:of )?your .*?(DON!! cards|characters?)\b.*?as active/i); if(readyTarget)actions.push({kind:'ready',scope:/DON!!/i.test(readyTarget[1])?'self':'own-character',amount:numberAfter(text,/set\s+(?:up to\s+)?(\d+)/i)||undefined});
 const addDon=numberAfter(text,/add (?:up to\s+)?(\d+)\s+DON!!/i); if(addDon)actions.push({kind:'add-don',amount:addDon,rested:/and rest it|set it as active/i.test(text)});
 const returnDon=numberAfter(text,/DON!!\s*[-−]\s*(\d+)/i); if(returnDon){actions.push({kind:'return-don',amount:returnDon});if(/DON!!\s*[-−]\s*\d+\s*:/i.test(text))costs.push({kind:'return-don',amount:returnDon,optional});}
 const restedDonCost=numberAfter(text,/(?:You may )?rest\s+(\d+)\s+of your DON!! cards?(?:\s+and this (?:Character|Stage))?\s*:/i); if(restedDonCost)costs.push({kind:'rest',scope:'don',amount:restedDonCost,optional});
 const required=numberAfter(text,/DON!!\s*(?:×|x)\s*(\d+)/i); if(required)actions.push({kind:'attach-don-required',amount:required});
 const returnTrash=numberAfter(text,/(?:You may )?return\s+(\d+)\s+cards? from your trash to the bottom of your deck/i); if(returnTrash)actions.push({kind:'return-trash-to-deck-bottom',amount:returnTrash,optional:/You may return/i.test(text)});
 const handTrashMatch=text.match(/trash\s+(\d+)\s+(?:[^.:]*?\s+)?cards?(?:\s+with\s+(?:a|an)\s+\[Trigger\])?\s+from your hand/i)||text.match(/trash\s+(\d+)\s+cards?\s+with\s+(?:a|an)\s+\[Trigger\]\s+from your hand/i); if(handTrashMatch){const requiresTrigger=/with\s+(?:a|an)\s+\[Trigger\]/i.test(handTrashMatch[0]),amount=Number(handTrashMatch[1]);actions.push({kind:'trash',scope:'hand',amount,requiresTrigger});if(/trash\s+\d+\s+cards?(?:\s+with\s+(?:a|an)\s+\[Trigger\])?\s+from your hand\s*:/i.test(text))costs.push({kind:'trash',scope:'hand',amount,requiresTrigger,optional});}
 const deckTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from the top of your deck/i); if(deckTrash)actions.push({kind:'trash',scope:'deck',amount:deckTrash});
 const opponentHandTrash=numberAfter(text,/opponent trashes?\s+(\d+)\s+cards? from their hand/i); if(opponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:opponentHandTrash});
 const directOpponentHandTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from your opponent's hand/i); if(directOpponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:directOpponentHandTrash});
 if(/trash this (?:character|stage)/i.test(text))actions.push({kind:'trash',scope:'self',amount:1});
 const look=numberAfter(text,/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i);
 if(look){
  const cardType=text.match(/(?:up to\s+)?\d+\s+(?:\{[^}]+\}\s+type\s+)?(Character|Event|Stage|Leader)\s+card/i)?.[1] as Card['type']|undefined;
  const trait=text.match(/(?:up to\s+)?\d+\s+\{([^}]+)\}\s+type(?:\s+(?:Character|Event|Stage|Leader))?\s+card/i)?.[1];
  const choose=numberAfter(text,/(?:reveal|add|choose)\s+(?:up to\s+)?(\d+)\s+(?:card|Character|Event|Stage|red Character)/i)||1;
  actions.push({kind:'search',amount:look,choose,destination:/trash the rest/i.test(text)?'trash':/bottom of your deck/i.test(text)?'deck-bottom':'hand',cardType,trait});
 }
 const namedDeckSearch=text.match(/reveal up to\s+(\d+)\s+\[([^\]]+)\]\s+from your deck and add it to your hand/i); if(namedDeckSearch)actions.push({kind:'search',amount:0,choose:Number(namedDeckSearch[1]),destination:'hand',trait:namedDeckSearch[2]});
 const lifeToHand=numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards? from the (?:top|top or bottom) of your Life cards? to your hand/i); if(lifeToHand)actions.push({kind:'life',operation:'add-to-hand',amount:lifeToHand});
 const lifePlacement=text.match(/(?:add|place) up to (\d+) .*?(?:Character|card).*?to the (top|bottom)( or bottom)? of (?:your opponent's|the owner's|your) Life cards?(?: (face-up|face-down))?/i); if(lifePlacement)actions.push({kind:'move-to-life',scope:/your opponent/i.test(lifePlacement[0])?'opponent':'own',amount:Number(lifePlacement[1]),position:lifePlacement[3]?'choice':lifePlacement[2].toLowerCase() as 'top'|'bottom',faceUp:lifePlacement[4]==='face-up'});
 const handReveal=numberAfter(text,/choose (\d+) cards? from your opponent's hand; your opponent reveals?/i); if(handReveal)actions.push({kind:'reveal-hand',scope:'opponent',amount:handReveal});
 if(/trash cards? from your hands until you each have (\d+) cards? in your hands/i.test(text))actions.push({kind:'hand-limit',scope:'both',amount:numberAfter(text,/until you each have (\d+)/i)});
 if(/trash (\d+) cards? from the top of each of your and your opponent's Life cards?/i.test(text))actions.push({kind:'trash-life',scope:'both',amount:numberAfter(text,/trash (\d+) cards? from the top of each/i)});
 if(/play this card/i.test(text))actions.push({kind:'play',source:'life'});
 const attachMatch=text.match(/give up to (\d+) (?:total of your currently given )?(?:rested )?DON!! cards? to (?:your Leader or )?(?:1 of your )?Characters?/i); if(attachMatch)actions.push({kind:'attach-don',amount:Number(attachMatch[1]),source:/currently given/i.test(attachMatch[0])?'attached':'cost-area'});
 const anyAttach=text.match(/give up to (\d+) rested DON!! cards? to .*?(?:Leader|Character)/i); if(anyAttach)actions.push({kind:'attach-don',amount:Number(anyAttach[1]),source:'cost-area'});
 if(/play up to\s+\d+.*?from your hand/i.test(text))actions.push({kind:'play',source:'hand',maxCost:costLimit(text),rested:/from your hand rested/i.test(text)});
 if(/(?:activate|select) up to\s+\d+.*?Event.*?from your hand/i.test(text))actions.push({kind:'play',source:'hand',maxCost:costLimit(text)});
 if(/play up to\s+\d+.*?from your trash/i.test(text))actions.push({kind:'play',source:'trash',maxCost:costLimit(text),rested:/from your trash rested/i.test(text)});
 if(/\[Blocker\]/i.test(text))actions.push({kind:'blocker'});
 const counter=numberAfter(text,/\[Counter\]\s*\+?(\d+)/i); if(counter)actions.push({kind:'counter',amount:counter});
 if(/\[Rush\]/i.test(text))actions.push({kind:'rush'});
 if(/\[Double Attack\]/i.test(text))actions.push({kind:'double-attack'});
 if(/\[Banish\]/i.test(text))actions.push({kind:'banish'});
 if(/\[On K\.O\.\]/i.test(text))actions.push({kind:'on-ko'});
 if(/\[On Block\]/i.test(text))actions.push({kind:'on-block'});
 if(/activate this card's \[Main\] effect/i.test(text))actions.push({kind:'activate-main-effect'});
 if(/activate this card's \[On Play\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'on-play'});
 if(/activate this card's \[Main\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'main'});
 if(/(?:can also )?attack active Characters? (?:during this turn|on the turn in which they are played)/i.test(text)||/can attack Characters? on the turn in which (?:it|they are) played/i.test(text)||/this Character can attack Characters? on the turn in which it is played/i.test(text))actions.push({kind:'attack-permission',scope:'own-character',activeTargets:/active Characters?/i.test(text)});
 if(/(?:Leader|Character|card)s? cannot attack until (?:the (?:start|end) of )?your opponent's next (?:turn|End Phase)/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'opponent-next-turn'});
 if(/(?:Leader|Character|card)s? cannot attack during this turn/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'turn-end'});
 if(/will not become active in your opponent's next Refresh Phase/i.test(text))actions.push({kind:'prevent-ready',scope:/DON!!/i.test(text)?'opponent-don':'opponent-character',until:'opponent-next-refresh'});
 if(/cannot be rested until the end of your opponent's next/i.test(text))actions.push({kind:'prevent-rest',scope:'opponent-character',until:'opponent-next-turn'});
 if(/swap the base power of the selected Characters? with each other during this turn/i.test(text))actions.push({kind:'swap-power',until:'turn-end'});
 const basePower=text.match(/base power (?:becomes?|become) (\d+)/i); if(basePower)actions.push({kind:'base-power',amount:Number(basePower[1]),target:/Leader/i.test(text)?'own-leader':'own-character',until:'turn-end'});
 if(/cannot be K\.O\.'d in battle/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'battle'});
 if(/cannot be K\.O\.'d by (?:your opponent's )?effects/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 const negate=text.match(/negate the effects? of up to (\d+) of your opponent's (Characters?|Leader or Character cards?)/i); if(negate)actions.push({kind:'negate-effect',scope:/Leader or Character/i.test(negate[2])?'opponent-card':'opponent-character',amount:Number(negate[1]),until:'turn-end'});
 const reduction=text.match(/cost of playing (?:\[([^\]]+)\] type )?(Character|Event|Stage) cards? with a cost of (\d+) or more from your hand will be reduced by (\d+)/i); if(reduction)actions.push({kind:'cost-reduction',trait:reduction[1],cardType:reduction[2] as Card['type'],minimumCost:Number(reduction[3]),amount:Number(reduction[4])});
 if(/would be removed from the field by your opponent's effect.*?rest \d+ of your (?:active )?cards? instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'rest-card'}});
 if(/would be removed from the field by your opponent's effect.*?place \d+ of your Characters?.*?bottom of the owner's deck instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'bottom-deck-own-character'}});
 if(/would be removed from the field by your opponent's effect.*?return this Character to the owner's hand instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'return-self-hand'}});
 for(const [pattern,keyword] of [[/gains? \[Rush\]/i,'rush'],[/gains? \[Blocker\]/i,'blocker'],[/gains? \[Double Attack\]/i,'double-attack'],[/gains? \[Banish\]/i,'banish'],[/gains? \[Unblockable\]/i,'unblockable'],[/cannot be blocked/i,'unblockable']] as const){if(pattern.test(text))actions.push({kind:'grant-keyword',keyword,until:/during this battle/i.test(text)?'battle':'turn-end'});}
 if(!actions.length&&text.replace(/\[[^\]]+\]|\([^)]*\)|[\s.,:;]+/g,'').length)actions.push({kind:'unimplemented',text});
 return [{trigger,actions,costs,conditions,optional,source:text}];
}

/** Splits independently-triggered printed abilities before deriving their action schema. */
export function parseEffects(card:Card):ParsedEffect[]{
 const text=(card.effect??'').replace(/^NULL$/i,'').trim();
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const boundaries=[...text.matchAll(/(?:^|\r?\n)\s*\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|Your Turn|Opponent's Turn|End of Your Turn)\]/gim)];
 if(!boundaries.length)return parseEffectText(text);
 return boundaries.map((boundary,index)=>parseEffectText(text.slice(boundary.index,boundaries[index+1]?.index).trim())[0]);
}

export function requiredAttackDon(card:Card){return parseEffects(card).flatMap(effect=>effect.actions).find((action):action is Extract<EffectAction,{kind:'attach-don-required'}>=>action.kind==='attach-don-required')?.amount??0;}
