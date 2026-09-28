import type {Card} from '../card-data/catalog';
import {customResolverStatus} from './custom-effect-resolvers';

export type EffectTrigger='on-play'|'when-attacking'|'activate-main'|'main'|'trigger'|'counter'|'on-ko'|'on-block'|'opponent-attack'|'end-turn'|'continuous'|'unknown';
export type EffectTarget='own-card'|'self'|'own-character'|'own-leader'|'opponent-character'|'opponent-leader'|'opponent-hand'|'deck'|'trash'|'life';
export type EffectAction=(
 | {kind:'draw';amount:number}
 | {kind:'reorder-deck';amount:number;position:'top'|'bottom'}
 | {kind:'rest';scope:'self'|'opponent-character'|'opponent-leader'|'opponent-don'|'opponent-card';maxCost?:number}
 | {kind:'ready';scope:'self'|'own-character'|'own-don';amount?:number}
 | {kind:'ko';maxCost?:number;maxPower?:number;restedOnly?:boolean}
 | {kind:'power';amount:number;until:'turn-end'|'battle';target:EffectTarget}
 | {kind:'cost';amount:number;target:'opponent-character'}
 | {kind:'return-to-hand';scope:'own-character'|'opponent-character';maxCost?:number}
 | {kind:'bottom-deck';scope:'own-character'|'opponent-character'|'any-character'|'opponent-hand'|'trash';maxCost?:number}
 | {kind:'return-trash-to-deck-bottom';amount:number;optional:boolean}
 | {kind:'add-don';amount:number;rested?:boolean}
 | {kind:'return-don';amount:number}
 | {kind:'attach-don-required';amount:number}
 | {kind:'trash';scope:'self'|'hand'|'deck'|'opponent-hand';amount:number;requiresTrigger?:boolean;color?:string;trait?:string;cardType?:Card['type'];maxCost?:number}
 | {kind:'search';amount:number;destination:'hand'|'trash'|'deck-bottom';choose:number;cardType?:Card['type'];trait?:string;color?:string;alternatives?:Array<{cardType?:Card['type'];name?:string;trait?:string;color?:string}>;excludeName?:string}
 | {kind:'play';source:'hand'|'trash'|'life';amount?:number;maxCost?:number;rested?:boolean;trait?:string;color?:string;excludeName?:string}
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
 | {kind:'hand-reset';scope:'self'|'opponent';draw?:number;shuffle?:boolean}
 | {kind:'shuffle';scope:'self'|'opponent'}
 | {kind:'recover';source:'trash';destination:'hand';amount:number;maxCost?:number;trait?:string;color?:string;excludeName?:string}
 | {kind:'attack-permission';scope:'own-character';activeTargets?:boolean}
 | {kind:'attack-restriction';scope:'opponent-leader'|'opponent-character';until:'turn-end'|'opponent-next-turn'|'next-own-turn'}
 | {kind:'prevent-ready';scope:'opponent-character'|'opponent-don';until:'opponent-next-refresh'}
 | {kind:'prevent-ko';scope:'own-character';by:'battle'|'effect'|'any'}
 | {kind:'activate-main-effect'}
 | {kind:'set-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'don-power';amount:number;during:'your-turn'|'opponent-turn'}
 | {kind:'attach-don';amount:number;source:'cost-area'|'attached';rested?:boolean}
 | {kind:'draw-by';source:'returned-hand'}
 | {kind:'reveal-hand';scope:'opponent';amount:number}
 | {kind:'hand-limit';scope:'both';amount:number}
 | {kind:'move-to-life';scope:'own'|'opponent';amount:number;faceUp?:boolean;position:'top'|'bottom'|'choice'}
 | {kind:'trash-life';scope:'own'|'opponent'|'both';amount:number}
 | {kind:'set-cost';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'activate-referenced-effect';trigger:'on-play'|'main'|'counter'}
 | {kind:'prevent-rest';scope:'opponent-character';until:'opponent-next-turn'}
 | {kind:'swap-power';until:'turn-end'}
 | {kind:'base-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'negate-effect';scope:'opponent-character'|'opponent-card';amount:number;until:'turn-end'}
 | {kind:'cost-reduction';amount:number;cardType?:Card['type'];trait?:string;minimumCost?:number}
 | {kind:'replacement';event:'removed-by-effect'|'ko-by-effect';cost:{kind:'rest-card'|'bottom-deck-own-character'|'return-self-hand'}}
 | {kind:'copy-base-power';target:'own-character';from:'opponent-character';until:'turn-end'}
 | {kind:'reorder-life';scope:'own'|'either';amount:number;addSelfToHand?:boolean}
 | {kind:'play-or-life';source:'hand';maxCost?:number;faceUp?:boolean}
 | {kind:'bottom-deck-hand';scope:'self';amount:'all'}
 | {kind:'custom-resolver';handler:string}) & {selection?:{min:number;max:number|'all'}};

export type EffectCost=
 | {kind:'trash';scope:'hand'|'self';amount:number;requiresTrigger?:boolean;color?:string;trait?:string;cardType?:Card['type'];maxCost?:number;optional:boolean}
 | {kind:'rest';scope:'self'|'don';amount:number;optional:boolean}
 | {kind:'return-don';amount:number;optional:boolean};
export type EffectCondition={kind:'text';text:string};
export type ParsedEffect={trigger:EffectTrigger;actions:EffectAction[];costs:EffectCost[];conditions:EffectCondition[];optional:boolean;source:string};
export type EffectImplementationStatus='RAW'|'PARSED'|'REVIEWED'|'IMPLEMENTED'|'TESTED';
export type ParsedEffectAst={rawText:string;trigger:EffectTrigger;conditions:EffectCondition[];costs:EffectCost[];actions:EffectAction[]};
export type NormalizedEffect={timing:EffectTrigger;optional:boolean;conditions:EffectCondition[];sequence:Array<{type:'PAY_COST';cost:EffectCost}|{type:'RESOLVE';action:EffectAction}>};
export type EffectResolver={type:'DSL'}|{type:'CUSTOM';handler:string};
export type EffectDocument={rawEffectText:string;parserVersion:string;parseConfidence:number;implementationStatus:EffectImplementationStatus;ast:ParsedEffectAst[];normalized:NormalizedEffect[];resolver:EffectResolver};
export const EFFECT_PARSER_VERSION='0.4.0';
const numberAfter=(text:string,pattern:RegExp)=>Number(text.match(pattern)?.[1]??0);
const costLimit=(text:string)=>{const match=text.match(/cost of\s+(\d+)\s+or less/i);return match?Number(match[1]):undefined;};
const powerLimit=(text:string)=>{const match=text.match(/(\d+)\s+power or less/i);return match?Number(match[1]):undefined;};

/** Converts printed English effect clauses into board actions. UI owns timing and choices. */
function parseEffectText(source:string):ParsedEffect[]{
 const text=source.replace(/^NULL$/i,'').replace(/−/g,'-').trim();
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const timingText=text.replace(/activate this card's \[(?:Main|Counter|On Play)\] effect/gi,'');
 const trigger:EffectTrigger=/\[On Play\]/i.test(timingText)?'on-play':/\[When Attacking\]/i.test(timingText)?'when-attacking':/\[Activate\s*:\s*Main\]/i.test(timingText)?'activate-main':/\[Main\]/i.test(timingText)?'main':/\[Counter\]/i.test(timingText)?'counter':/\[Trigger\]/i.test(timingText)?'trigger':/\[On K\.O\.\]/i.test(timingText)?'on-ko':/\[On Block\]/i.test(timingText)?'on-block':/\[On Your Opponent's Attack\]/i.test(timingText)?'opponent-attack':/\[End of Your Turn\]/i.test(timingText)?'end-turn':/\[(?:Your Turn|Opponent's Turn|Once Per Turn)\]/i.test(timingText)?'continuous':'unknown';
 const actions:EffectAction[]=[]; const costs:EffectCost[]=[]; const conditions:EffectCondition[]=[]; const optional=/\bYou may\b/i.test(text);
 for(const match of text.matchAll(/\bIf\s+([^,:]+)(?:[:,])/gi)) conditions.push({kind:'text',text:match[1].trim()});
 const draw=numberAfter(text,/draw\s+(\d+)\s+card/i); if(draw)actions.push({kind:'draw',amount:draw});
 if(/^(?:\[Your Turn\]\s*)?Your Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'your-turn'});
 if(/^(?:\[Opponent's Turn\]\s*)?Opponent's Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'opponent-turn'});
 if(/draw cards? equal to the number you returned to your deck/i.test(text))actions.push({kind:'draw-by',source:'returned-hand'});
 const resetMatch=text.match(/(you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck.*?draws? (\d+) cards?/i); if(resetMatch){const drawIndex=actions.findIndex(action=>action.kind==='draw');if(drawIndex>=0)actions.splice(drawIndex,1);actions.push({kind:'hand-reset',scope:/opponent/i.test(resetMatch[1])?'opponent':'self',draw:Number(resetMatch[2]),shuffle:/shuffl/i.test(resetMatch[0])});}
 if(/(?:you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck/i.test(text)&&!resetMatch)actions.push({kind:'hand-reset',scope:/your opponent/i.test(text)?'opponent':'self'});
 if(/place all cards in your hand at the bottom of your deck/i.test(text))actions.push({kind:'bottom-deck-hand',scope:'self',amount:'all'});
 if(!resetMatch&&/(?:you|your opponent) (?:shuffles?|shuffle) (?:their|your) deck/i.test(text))actions.push({kind:'shuffle',scope:/your opponent/i.test(text)?'opponent':'self'});
 const trashRecovery=text.match(/add up to (\d+) .*?(?:Character )?cards?.*?from your trash to your hand/i); if(trashRecovery)actions.push({kind:'recover',source:'trash',destination:'hand',amount:Number(trashRecovery[1]),maxCost:costLimit(text),trait:text.match(/\[([^\]]+)\] (?:or \[[^\]]+\] )?type (?:Character )?cards?/i)?.[1]});
 const broadRecovery=text.match(/(?:add|select) up to (\d+) .*?from your trash (?:to your hand|and play)/i); if(broadRecovery){const source=broadRecovery[0];const trait=source.match(/(?:\{|\[|\")([^}\]\"]+)(?:\}|\]|\") type/i)?.[1];const color=source.match(/\b(black|blue|red|green|purple|yellow) (?:Character|card)/i)?.[1];const excludeName=source.match(/other than \[([^\]]+)\]/i)?.[1];actions.push({kind:'recover',source:'trash',destination:'hand',amount:Number(broadRecovery[1]),maxCost:costLimit(source),...(trait?{trait}:{}),...(color?{color}:{}),...(excludeName?{excludeName}:{})});}
 const fixedPower=text.match(/set the power of up to \d+ of your opponent's Characters? to (\d+)/i); if(fixedPower)actions.push({kind:'set-power',amount:Number(fixedPower[1]),target:'opponent-character',until:'turn-end'});
 const directPower=text.match(/give up to \d+ of your opponent's Characters? (\d+) power during this turn/i); if(directPower)actions.push({kind:'power',amount:Number(directPower[1]),until:'turn-end',target:'opponent-character'});
 const selfPower=text.match(/give this Character ([+\-]?\d+) power/i); if(selfPower)actions.push({kind:'power',amount:Number(selfPower[1]),until:/during this battle/i.test(text)?'battle':'turn-end',target:'own-character'});
 const opponentCardPower=text.match(/give up to \d+ of your opponent's Leader or Character cards? ([+\-]?\d+) power/i); if(opponentCardPower)actions.push({kind:'power',amount:Number(opponentCardPower[1]),until:'turn-end',target:'opponent-character'});
 const fixedCost=text.match(/set the cost of up to \d+ of your opponent's Characters?.*?to (\d+) during this turn/i); if(fixedCost)actions.push({kind:'set-cost',amount:Number(fixedCost[1]),target:'opponent-character',until:'turn-end'});
 const power=Number(text.match(/([+\-]\d+)\s*power/i)?.[1]??0); if(power)actions.push({kind:'power',amount:power,until:/during this battle/i.test(text)?'battle':'turn-end',...(/Up to 1 of your Leader or Character cards gains/i.test(text)?{selection:{min:0,max:1}}:{}),target:/Up to 1 of your Leader or Character cards gains/i.test(text)?'own-card':/opponent/i.test(text)?'opponent-character':/Leader/i.test(text)?'own-leader':'own-character'});
 const cost=Number(text.match(/([+\-]\d+)\s*cost/i)?.[1]??0); if(cost)actions.push({kind:'cost',amount:cost,target:'opponent-character'});
 if(/K\.O\.\s+(?:all|(?:up to\s+)?\d*\s*(?:of your opponent's )?(?:rested )?characters?)/i.test(text))actions.push({kind:'ko',maxCost:costLimit(text),maxPower:powerLimit(text),restedOnly:/rested Characters?/i.test(text)});
 if(!actions.some(action=>action.kind==='ko')&&/K\.O\.\s+(?:up to\s+)?\d+\s+of your opponent's .*?Characters?/i.test(text))actions.push({kind:'ko',maxCost:costLimit(text),maxPower:powerLimit(text),restedOnly:/rested Characters?/i.test(text)});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?(?:to the owner's )?hand/i.test(text))actions.push({kind:'return-to-hand',scope:'opponent-character',maxCost:costLimit(text)});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your )?[^.]*?Characters?.*?(?:to the owner's )?hand/i.test(text)&&/of your /i.test(text))actions.push({kind:'return-to-hand',scope:'own-character',maxCost:costLimit(text)});
 if(/return this Character to the owner's hand/i.test(text))actions.push({kind:'return-to-hand',scope:'own-character'});
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
 const readyTarget=text.match(/set\s+(?:up to\s+)?\d*\s*(?:of )?your .*?(DON!! cards|characters?)\b.*?as active/i); if(readyTarget)actions.push({kind:'ready',scope:/DON!!/i.test(readyTarget[1])?'own-don':'own-character',amount:numberAfter(text,/set\s+(?:up to\s+)?(\d+)/i)||undefined});
 const addDon=numberAfter(text,/add (?:up to\s+)?(\d+)\s+DON!!/i); if(addDon)actions.push({kind:'add-don',amount:addDon,rested:/and rest (?:it|them)|add[^.]*?rested/i.test(text)});
 const returnDon=numberAfter(text,/DON!!\s*[-−]\s*(\d+)/i); if(returnDon){actions.push({kind:'return-don',amount:returnDon});if(/DON!!\s*[-−]\s*\d+\s*:/i.test(text))costs.push({kind:'return-don',amount:returnDon,optional});}
 const restedDonCost=numberAfter(text,/(?:You may )?rest\s+(\d+)\s+of your DON!! cards?(?:\s+and this (?:Character|Stage))?\s*:/i); if(restedDonCost)costs.push({kind:'rest',scope:'don',amount:restedDonCost,optional});
 const required=numberAfter(text,/DON!!\s*(?:×|x)\s*(\d+)/i); if(required)actions.push({kind:'attach-don-required',amount:required});
 const returnTrash=numberAfter(text,/(?:You may )?return\s+(\d+)\s+cards? from your trash to the bottom of your deck/i); if(returnTrash)actions.push({kind:'return-trash-to-deck-bottom',amount:returnTrash,optional:/You may return/i.test(text)});
 const handTrashMatch=text.match(/trash\s+(\d+)\s+[^.:]*?\bfrom your hand/i); if(handTrashMatch){const source=handTrashMatch[0],requiresTrigger=/with\s+(?:a|an)\s+\[Trigger\]/i.test(source),amount=Number(handTrashMatch[1]),color=source.match(/\b(black|blue|red|green|purple|yellow)\b/i)?.[1],trait=source.match(/(?:\[|\{|\")([^\]}.\"]+)(?:\]|\}|\")\s+type/i)?.[1],cardType=source.match(/\b(Character|Event|Stage)\s+cards?/i)?.[1] as Card['type']|undefined,maxCost=costLimit(source),restriction={...(color?{color}:{}),...(trait?{trait}:{}),...(cardType?{cardType}:{}),...(maxCost?{maxCost}:{})};actions.push({kind:'trash',scope:'hand',amount,requiresTrigger,...restriction});if(text.slice((handTrashMatch.index??0)+source.length).trimStart().startsWith(':'))costs.push({kind:'trash',scope:'hand',amount,requiresTrigger,optional,...restriction});}
 const deckTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from the top of your deck/i); if(deckTrash)actions.push({kind:'trash',scope:'deck',amount:deckTrash});
 const opponentHandTrash=numberAfter(text,/opponent trashes?\s+(\d+)\s+cards? from their hand/i); if(opponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:opponentHandTrash});
 const directOpponentHandTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from your opponent's hand/i); if(directOpponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:directOpponentHandTrash});
 if(/trash this (?:character|stage)/i.test(text)){actions.push({kind:'trash',scope:'self',amount:1});if(/trash this (?:character|stage)\s*:/i.test(text))costs.push({kind:'trash',scope:'self',amount:1,optional});}
 const look=numberAfter(text,/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i);
 const reorderOnly=look&&/place them at the top of your deck in any order/i.test(text)&&!/add .*?to your hand/i.test(text);
 if(reorderOnly)actions.push({kind:'reorder-deck',amount:look,position:'top'});
 if(look&&!reorderOnly){
  const cardType=text.match(/(?:up to\s+)?\d+\s+(?:\{[^}]+\}\s+type\s+)?(Character|Event|Stage|Leader)\s+card/i)?.[1] as Card['type']|undefined;
  const trait=text.match(/(?:up to\s+)?\d+\s+\{([^}]+)\}\s+type(?:\s+(?:Character|Event|Stage|Leader))?\s+card/i)?.[1]??text.match(/(?:reveal|add)\s+(?:up to\s+)?\d+\s+\[([^\]]+)\]\s+type(?:\s+(?:Character|Event|Stage|Leader))?\s+card/i)?.[1]??text.match(/(?:reveal|add)\s+(?:up to\s+)?\d+\s+\"([^\"]+)\"\s+type\s+card/i)?.[1]??text.match(/(?:reveal|add)\s+(?:up to\s+)?\d+\s+card with a type including\s+\"([^\"]+)\"/i)?.[1];
  const excludeName=text.match(/other than\s+\[([^\]]+)\]/i)?.[1];
  const choose=numberAfter(text,/(?:reveal|add|choose)\s+(?:up to\s+)?(\d+)\s+(?:card|Character|Event|Stage|red Character)/i)||1;
  const namedOrColour=text.match(/reveal\s+(?:up to\s+)?(\d+)\s+\[([^\]]+)\]\s+or\s+(red|green|blue|purple|black|yellow)\s+(Event|Character|Stage)\b/i);
  const alternatives=namedOrColour?[{name:namedOrColour[2]},{color:namedOrColour[3],cardType:namedOrColour[4] as Card['type']}]:undefined;
  actions.push({kind:'search',amount:look,choose,destination:/trash the rest/i.test(text)?'trash':/bottom of your deck/i.test(text)?'deck-bottom':'hand',cardType:alternatives?undefined:cardType,trait:alternatives?undefined:trait,...(alternatives?{alternatives}:{}),...(excludeName?{excludeName}:{})});
 }
 const namedDeckSearch=text.match(/reveal up to\s+(\d+)\s+\[([^\]]+)\]\s+from your deck and add it to your hand/i); if(namedDeckSearch)actions.push({kind:'search',amount:0,choose:Number(namedDeckSearch[1]),destination:'hand',trait:namedDeckSearch[2]});
 const lifeToHand=numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards? from the (?:top|top or bottom) of your Life cards? to your hand/i); if(lifeToHand)actions.push({kind:'life',operation:'add-to-hand',amount:lifeToHand});
 const lifeReorder=numberAfter(text,/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your or your opponent's Life cards?/i); if(lifeReorder)actions.push({kind:'reorder-life',scope:'either',amount:lifeReorder,addSelfToHand:/add this card to your hand/i.test(text)});
 const lifePlacement=text.match(/(?:add|place) up to (\d+) .*?(?:Character|card).*?to the (top|bottom)( or bottom)? of (?:your opponent's|the owner's|your) Life cards?(?: (face-up|face-down))?/i); if(lifePlacement)actions.push({kind:'move-to-life',scope:/your opponent/i.test(lifePlacement[0])?'opponent':'own',amount:Number(lifePlacement[1]),position:lifePlacement[3]?'choice':lifePlacement[2].toLowerCase() as 'top'|'bottom',faceUp:lifePlacement[4]==='face-up'});
 const handReveal=numberAfter(text,/choose (\d+) cards? from your opponent's hand; your opponent reveals?/i); if(handReveal)actions.push({kind:'reveal-hand',scope:'opponent',amount:handReveal});
 if(/trash cards? from your hands until you each have (\d+) cards? in your hands/i.test(text))actions.push({kind:'hand-limit',scope:'both',amount:numberAfter(text,/until you each have (\d+)/i)});
 if(/trash (\d+) cards? from the top of each of your and your opponent's Life cards?/i.test(text))actions.push({kind:'trash-life',scope:'both',amount:numberAfter(text,/trash (\d+) cards? from the top of each/i)});
 const opponentLifeTrash=numberAfter(text,/trash (?:up to )?(\d+) cards? from the top of your opponent's Life cards?/i); if(opponentLifeTrash)actions.push({kind:'trash-life',scope:'opponent',amount:opponentLifeTrash});
 if(/play this card/i.test(text))actions.push({kind:'play',source:'life'});
 const attachMatch=text.match(/give up to (\d+) (?:total of your currently given )?(?:rested )?DON!! cards? to (?:your Leader or )?(?:1 of your )?Characters?/i); if(attachMatch)actions.push({kind:'attach-don',amount:Number(attachMatch[1]),source:/currently given/i.test(attachMatch[0])?'attached':'cost-area',rested:/rested DON!!/i.test(attachMatch[0])});
 const anyAttach=!attachMatch&&text.match(/give up to (\d+) rested DON!! cards? to .*?(?:Leader|Character)/i); if(anyAttach)actions.push({kind:'attach-don',amount:Number(anyAttach[1]),source:'cost-area',rested:true});
 if(/play up to\s+\d+.*?from your hand/i.test(text))actions.push({kind:'play',source:'hand',maxCost:costLimit(text),rested:/from your hand rested/i.test(text)});
 if(/select up to\s+\d+.*?from your hand and play it or add it to the top of your Life cards?/i.test(text))actions.push({kind:'play-or-life',source:'hand',maxCost:costLimit(text),faceUp:/face-up/i.test(text)});
 if(/(?:activate|select) up to\s+\d+.*?Event.*?from your hand/i.test(text))actions.push({kind:'play',source:'hand',maxCost:costLimit(text)});
 const trashPlay=text.match(/play up to\s+(\d+)\s+(.+?)\s+from your trash(?:\s+rested)?/i); if(trashPlay){const descriptor=trashPlay[2],trait=descriptor.match(/(?:\{|\[|\")([^}\]\"]+)(?:\}|\]|\")(?: type)?/i)?.[1],color=descriptor.match(/\b(black|blue|red|green|purple|yellow)\b/i)?.[1],excludeName=descriptor.match(/other than \[([^\]]+)\]/i)?.[1];actions.push({kind:'play',source:'trash',amount:Number(trashPlay[1]),maxCost:costLimit(descriptor),rested:/from your trash rested/i.test(trashPlay[0]),...(trait?{trait}:{}),...(color?{color}:{}),...(excludeName?{excludeName}:{})});}
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
 if(/activate this card's \[Counter\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'counter'});
 if(/(?:can also )?attack active Characters? (?:during this turn|on the turn in which they are played)/i.test(text)||/can attack Characters? on the turn in which (?:it|they are) played/i.test(text)||/this Character can attack Characters? on the turn in which it is played/i.test(text))actions.push({kind:'attack-permission',scope:'own-character',activeTargets:/active Characters?/i.test(text)});
 if(/(?:Leader|Character|card)s?(?:\s+with[^.]*?)? cannot attack until (?:the (?:start|end) of )?your opponent's next (?:turn|End Phase)/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'opponent-next-turn'});
 if(/(?:Leader|Character|card)s?(?:\s+with[^.]*?)? cannot attack until the start of your next turn/i.test(text))actions.push({kind:'attack-restriction',scope:'opponent-character',until:'next-own-turn'});
 if(/(?:Leader|Character|card)s? cannot attack during this turn/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'turn-end'});
 if(/will not become active in your opponent's next Refresh Phase/i.test(text))actions.push({kind:'prevent-ready',scope:/DON!!/i.test(text)?'opponent-don':'opponent-character',until:'opponent-next-refresh'});
 if(/cannot be rested until the end of your opponent's next/i.test(text))actions.push({kind:'prevent-rest',scope:'opponent-character',until:'opponent-next-turn'});
 if(/swap the base power of the selected Characters? with each other during this turn/i.test(text))actions.push({kind:'swap-power',until:'turn-end'});
 if(/this Character's base power becomes the same as the selected Character's power during this turn/i.test(text))actions.push({kind:'copy-base-power',target:'own-character',from:'opponent-character',until:'turn-end'});
 const basePower=text.match(/base power (?:becomes?|become) (\d+)/i); if(basePower)actions.push({kind:'base-power',amount:Number(basePower[1]),target:/Leader/i.test(text)?'own-leader':'own-character',until:'turn-end'});
 if(/cannot be K\.O\.'d in battle/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'battle'});
 if(/cannot be K\.O\.'d by (?:your opponent's )?effects/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 if(/cannot be removed from the field by your opponent's effects?/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 if(/can be K\.O\.'d by effects until the end of your opponent's next turn/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 const negate=text.match(/negate the effects? of up to (\d+) of your opponent's (Characters?|Leader or Character cards?)/i); if(negate)actions.push({kind:'negate-effect',scope:/Leader or Character/i.test(negate[2])?'opponent-card':'opponent-character',amount:Number(negate[1]),until:'turn-end'});
 if(/negate the effects? of your opponent's Leader and all of their Characters during this turn/i.test(text))actions.push({kind:'negate-effect',scope:'opponent-card',amount:0,until:'turn-end'});
 if(/negate the effect of up to \d+ of each of your opponent's Leader and Character cards during this turn/i.test(text))actions.push({kind:'negate-effect',scope:'opponent-card',amount:2,until:'turn-end'});
 const reduction=text.match(/cost of playing (?:\[([^\]]+)\] type )?(Character|Event|Stage) cards? with a cost of (\d+) or more from your hand will be reduced by (\d+)/i); if(reduction)actions.push({kind:'cost-reduction',trait:reduction[1],cardType:reduction[2] as Card['type'],minimumCost:Number(reduction[3]),amount:Number(reduction[4])});
 const nextReduction=text.match(/next time you play \[([^\]]+)\](?: type)?(?: Character)? with a cost of (\d+) or more from your hand during this turn, the cost will be reduced by (\d+)/i); if(nextReduction)actions.push({kind:'cost-reduction',trait:nextReduction[1],cardType:'Character',minimumCost:Number(nextReduction[2]),amount:Number(nextReduction[3])});
 if(/would be removed from the field by your opponent's effect.*?rest \d+ of your (?:active )?cards? instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'rest-card'}});
 if(/would be removed from the field by your opponent's effect.*?place \d+ of your Characters?.*?bottom of the owner's deck instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'bottom-deck-own-character'}});
 if(/would be removed from the field by your opponent's effect.*?return this Character to the owner's hand instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'return-self-hand'}});
 for(const [pattern,keyword] of [[/gains? \[Rush\]/i,'rush'],[/gains? \[Blocker\]/i,'blocker'],[/gains? \[Double Attack\]/i,'double-attack'],[/gains? \[Banish\]/i,'banish'],[/gains? \[Unblockable\]/i,'unblockable'],[/cannot be blocked/i,'unblockable']] as const){if(pattern.test(text))actions.push({kind:'grant-keyword',keyword,until:/during this battle/i.test(text)?'battle':'turn-end'});}
 if(!actions.length&&text.replace(/\[[^\]]+\]|\([^)]*\)|[\s.,:;]+/g,'').length)actions.push({kind:'custom-resolver',handler:'pending'});
 const searchIndex=actions.findIndex(action=>action.kind==='search');
 const handDiscardIndex=actions.findIndex(action=>action.kind==='trash'&&action.scope==='hand');
 if(searchIndex>=0&&handDiscardIndex>=0&&!costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand')){
  const searchPosition=text.search(/look at/i),discardPosition=text.search(/trash\s+\d+\s+[^:]*?from your hand/i);
  if(discardPosition>searchPosition&&handDiscardIndex<searchIndex){const [discard]=actions.splice(handDiscardIndex,1);actions.splice(actions.findIndex(action=>action.kind==='search')+1,0,discard);}
 }
 const drawIndex=actions.findIndex(action=>action.kind==='draw');
 const discardIndex=actions.findIndex(action=>action.kind==='trash'&&action.scope==='hand');
 if(drawIndex>=0&&discardIndex>=0&&!costs.some(cost=>cost.kind==='trash'&&cost.scope==='hand')){
  const discardPosition=text.search(/trash\s+\d+\s+[^:]*?from your hand/i),drawPosition=text.search(/draw\s+\d+\s+card/i);
  if(discardPosition>=0&&discardPosition<drawPosition&&discardIndex>drawIndex){const [discard]=actions.splice(discardIndex,1);actions.splice(drawIndex,0,discard);}
 }
 for(const action of actions){
  const quantity=action.kind==='ko'?text.match(/K\.O\.\s+(?:(up to)\s+)?(\d+|all)\b/i):action.kind==='rest'&&action.scope!=='self'?text.match(/rest\s+(?:(up to)\s+)?(\d+|all)\s+(?:of\s+)?your opponent/i):action.kind==='cost'?text.match(/give\s+(?:(up to)\s+)?(\d+|all)\s+of your opponent's Characters?\s+[+\-]\d+\s+cost/i):null;
  if(quantity)action.selection={min:quantity[1]?0:quantity[2].toLowerCase()==='all'?0:Number(quantity[2]),max:quantity[2].toLowerCase()==='all'?'all':Number(quantity[2])};
 }
 return [{trigger,actions,costs,conditions,optional,source:text}];
}

/** Splits independently-triggered printed abilities before deriving their action schema. */
export function parseEffects(card:Card):ParsedEffect[]{
 const text=(card.effect??'').replace(/^NULL$/i,'').trim();
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const boundaries=[...text.matchAll(/\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|Your Turn|Opponent's Turn|End of Your Turn|Once Per Turn)\]/gim)].filter(marker=>{
  const prefix=text.slice(0,marker.index),suffix=text.slice(marker.index!+marker[0].length);
  if(/Once Per Turn/i.test(marker[0]))return /\.\s*\n\s*$/.test(prefix)&&/^\s*When\b/i.test(suffix);
  return !/with\s+(?:(?:a|an)\s+)?$/i.test(prefix)&&!/^\s+effects?\b/i.test(suffix);
 });
 if(!boundaries.length)return parseEffectText(text);
 const parsed:ParsedEffect[]=[];
 const prefix=text.slice(0,boundaries[0].index).trim();
 if(prefix)parsed.push(...parseEffectText(prefix));
 for(let index=0;index<boundaries.length;index++){
  const first=index;
  while(index+1<boundaries.length&&/^[\s/]*$/.test(text.slice(boundaries[index].index!+boundaries[index][0].length,boundaries[index+1].index)))index++;
  const body=text.slice(boundaries[index].index!+boundaries[index][0].length,boundaries[index+1]?.index).trim();
  for(let marker=first;marker<=index;marker++)parsed.push(...parseEffectText(`${boundaries[marker][0]} ${body}`));
 }
 return parsed;
}

/** Builds the persistent four-layer contract: raw text → AST → normalized sequence → resolver. */
export function compileEffectDocument(card:Card):EffectDocument{
 const rawEffectText=(card.effect??'').replace(/^NULL$/i,'').trim();
 const parsed=parseEffects(card);
 const custom=parsed.flatMap(effect=>effect.actions).some(action=>action.kind==='custom-resolver');
 const handlerPart=(value:string)=>value.replace(/[^A-Za-z0-9]+/g,'_').replace(/^_|_$/g,'').toUpperCase();
 const ast=parsed.map(effect=>({rawText:effect.source,trigger:effect.trigger,conditions:effect.conditions,costs:effect.costs,actions:effect.actions.map(action=>action.kind==='custom-resolver'?{...action,handler:`${handlerPart(card.code)}_${handlerPart(effect.trigger)}`}:action)}));
 const resolver:EffectResolver=custom?{type:'CUSTOM',handler:ast.flatMap(effect=>effect.actions).find((action):action is Extract<EffectAction,{kind:'custom-resolver'}>=>action.kind==='custom-resolver')?.handler??`${handlerPart(card.code)}_CUSTOM`}:{type:'DSL'};
 const normalized=ast.map(effect=>{const actions=effect.actions.filter(action=>!effect.costs.some(cost=>(cost.kind==='trash'&&action.kind==='trash'&&cost.scope===action.scope&&cost.amount===action.amount&&Boolean(cost.requiresTrigger)===Boolean(action.requiresTrigger))||(cost.kind==='rest'&&cost.scope==='self'&&action.kind==='rest'&&action.scope==='self')||(cost.kind==='return-don'&&action.kind==='return-don'&&cost.amount===action.amount)));return {timing:effect.trigger,optional:/\bYou may\b/i.test(effect.rawText),conditions:effect.conditions,sequence:[...effect.costs.map(cost=>({type:'PAY_COST' as const,cost})),...actions.map(action=>({type:'RESOLVE' as const,action}))]};});
 const implementationStatus:EffectImplementationStatus=resolver.type==='CUSTOM'&&customResolverStatus(resolver.handler)==='RAW'?'RAW':'PARSED';
 return {rawEffectText,parserVersion:EFFECT_PARSER_VERSION,parseConfidence:custom?.65:rawEffectText?0.94:1,implementationStatus,ast,normalized,resolver};
}

export function requiredAttackDon(card:Card){return parseEffects(card).flatMap(effect=>effect.actions).find((action):action is Extract<EffectAction,{kind:'attach-don-required'}>=>action.kind==='attach-don-required')?.amount??0;}
