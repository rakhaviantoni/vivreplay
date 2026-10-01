import type {Card} from '../card-data/catalog';
import {customResolverStatus} from './custom-effect-resolvers';

export type EffectTrigger='on-play'|'when-attacking'|'activate-main'|'main'|'trigger'|'counter'|'on-ko'|'on-block'|'opponent-attack'|'end-turn'|'character-played-from-trash'|'continuous'|'unknown';
export type EffectTarget='own-card'|'self'|'own-character'|'own-leader'|'opponent-character'|'opponent-leader'|'opponent-hand'|'deck'|'trash'|'life';
export type EffectAction=(
 | {kind:'draw';amount:number}
 | {kind:'reorder-deck';amount:number;position:'top'|'bottom'|'choice'}
 | {kind:'rest';scope:'self'|'own-leader'|'opponent-character'|'opponent-leader'|'opponent-don'|'opponent-card';maxCost?:number;minAttachedDon?:number}
 | {kind:'ready';scope:'self'|'own-character'|'own-don';amount?:number;trait?:string;traits?:string[];attribute?:string;restedOnly?:boolean;minCost?:number;maxCost?:number;name?:string;color?:string;selection?:{min:number;max:number|'all'}}
 | {kind:'ko';maxCost?:number;maxCostFromLife?:'own'|'opponent';conditionalMaxCost?:{condition:string;amount:number};maxPower?:number;maxBasePower?:number;restedOnly?:boolean}
 | {kind:'power';amount:number;until:'turn-end'|'battle';target:EffectTarget;trait?:string;name?:string;bonus?:{condition:string;amount:number}}
 | {kind:'cost';amount:number;target:'opponent-character'}
 | {kind:'return-to-hand';scope:'own-character'|'opponent-character'|'any-character'|'any-card';maxCost?:number;maxPower?:number;maxBasePower?:number;activeOnly?:boolean;selection?:{min:number;max:number|'all'}}
 | {kind:'bottom-deck';scope:'own-character'|'opponent-character'|'any-character'|'opponent-hand'|'trash';maxCost?:number;selection?:{min:number;max:number|'all'}}
 | {kind:'return-trash-to-deck-bottom';amount:number;optional:boolean}
 | {kind:'add-don';amount:number;rested?:boolean}
 | {kind:'return-don';amount:number;owner?:'self'|'opponent'}
 | {kind:'attach-don-required';amount:number}
 | {kind:'trash';scope:'self'|'hand'|'deck'|'opponent-hand';amount:number;requiresTrigger?:boolean;chooser?:'opponent';color?:string;trait?:string;cardType?:Card['type'];maxCost?:number}
 | {kind:'search';amount:number;destination:'hand'|'trash'|'deck-bottom';choose:number;cardType?:Card['type'];name?:string;trait?:string;color?:string;minCost?:number;maxCost?:number;exactCost?:number;minPower?:number;maxPower?:number;exactPower?:number;triggerOnly?:boolean;alternatives?:Array<{cardType?:Card['type'];name?:string;trait?:string;color?:string;minCost?:number;maxCost?:number;exactCost?:number;minPower?:number;maxPower?:number;exactPower?:number;choose?:number}>;excludeName?:string}
 | {kind:'play';source:'hand'|'trash'|'life'|'deck';amount?:number;maxCost?:number;minCost?:number;exactCost?:number;minPower?:number;maxPower?:number;exactPower?:number;costAtMostDonField?:boolean;topOnly?:boolean;rested?:boolean;trait?:string;color?:string;attribute?:string;name?:string;noBaseEffect?:boolean;cardType?:Card['type'];alternatives?:Array<{cardType?:Card['type'];name?:string;trait?:string;color?:string;attribute?:string}>;excludeName?:string}
 | {kind:'blocker'}
 | {kind:'counter';amount:number}
 | {kind:'rush'}
 | {kind:'double-attack'}
 | {kind:'banish'}
 | {kind:'on-ko'}
 | {kind:'on-block'}
 | {kind:'return-to-deck';scope:'own-character'|'opponent-character';position:'top'|'bottom'}
 | {kind:'reveal';source:'deck'|'life';amount:number}
 | {kind:'life';operation:'add-to-hand'|'add-to-life'|'trash'|'opponent-top-to-owner-hand';amount:number}
 | {kind:'grant-keyword';keyword:'rush'|'blocker'|'double-attack'|'banish'|'unblockable';until:'turn-end'|'battle'|'opponent-next-turn';scope?:'self'|'previous-played'|'previous-target'|'own-character'|'own-leader'|'own-card';trait?:string;name?:string;color?:string;maxCost?:number;withoutOnPlay?:boolean;continuous?:boolean}
 | {kind:'hand-reset';scope:'self'|'opponent';draw?:number;shuffle?:boolean}
 | {kind:'shuffle';scope:'self'|'opponent'}
 | {kind:'recover';source:'trash';destination:'hand';amount:number;maxCost?:number;minCost?:number;exactCost?:number;trait?:string;color?:string;cardType?:Card['type'];name?:string;excludeName?:string}
 | {kind:'attack-permission';scope:'own-character';activeTargets?:boolean;until?:'turn-end'}
 | {kind:'skip-next-refresh';scope:'self'}
 | {kind:'attack-prohibition';scope:'own-leader'|'own-character'}
 | {kind:'attack-restriction';scope:'opponent-leader'|'opponent-character';until:'turn-end'|'opponent-next-turn'|'next-own-turn'}
 | {kind:'prevent-ready';scope:'opponent-character'|'opponent-don'|'opponent-card';until:'opponent-next-refresh';maxCost?:number;minAttachedDon?:number;restedOnly?:boolean;selection?:{min:number;max:number|'all'}}
 | {kind:'prevent-ko';scope:'own-character';by:'battle'|'effect'|'any';attribute?:string;byCardType?:'Leader'|'Character'|'Leader or Character';excludeAttribute?:string;sourceMaxPower?:number;requiresAttachedDon?:number;protects?:'own-characters'|'characters';protectedMaxCost?:number;protectedExactCost?:number;protectedTrait?:string;protectedExcludeName?:string;protectedExcludeOwnerOnly?:boolean;protectedMustBeActive?:boolean}
 | {kind:'activate-main-effect'}
 | {kind:'set-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'don-power';amount:number;during:'your-turn'|'opponent-turn'}
 | {kind:'attach-don';amount:number;source:'cost-area'|'attached';rested?:boolean;recipient?:'target'|'self'}
 | {kind:'draw-by';source:'returned-hand'}
 | {kind:'reveal-hand';scope:'opponent';amount:number}
 | {kind:'hand-limit';scope:'both';amount:number}
 | {kind:'move-to-life';scope:'own'|'opponent';amount:number;faceUp?:boolean;position:'top'|'bottom'|'choice';source?:'hand'|'character'|'trash'|'deck-top'}
 | {kind:'trash-life';scope:'own'|'opponent'|'both';amount:number}
 | {kind:'set-cost';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'activate-referenced-effect';trigger:'on-play'|'main'|'counter'}
 | {kind:'prevent-rest';scope:'opponent-character';until:'opponent-next-turn'}
 | {kind:'swap-power';until:'turn-end'}
 | {kind:'base-power';amount:number;target:EffectTarget;until:'turn-end'}
 | {kind:'negate-effect';scope:'opponent-character'|'opponent-card';amount:number;until:'turn-end'}
 | {kind:'prevent-keyword-activation';keyword:'blocker';scope:'opponent-character';maxPower:number;until:'battle'}
 | {kind:'cost-reduction';amount:number;cardType?:Card['type'];trait?:string;minimumCost?:number}
 | {kind:'replacement';event:'removed-by-effect'|'ko-by-effect'|'ko';cost:{kind:'rest-card'|'rest-leader-or-stage'|'bottom-deck-own-character'|'return-self-hand'|'bottom-deck-trash';amount?:number;stageName?:string};eligibility?:{color?:string;cardType?:Card['type'];maxBaseCost?:number};oncePerTurn?:boolean}
 | {kind:'copy-base-power';target:'own-character';from:'opponent-character';until:'turn-end'}
 | {kind:'reorder-life';scope:'own'|'either';amount:number;addSelfToHand?:boolean}
 | {kind:'play-or-life';source:'hand';maxCost?:number;faceUp?:boolean}
 | {kind:'bottom-deck-hand';scope:'self';amount:'all'}
 | {kind:'custom-resolver';handler:string}) & {selection?:{min:number;max:number|'all'}};

export type EffectCost=
 | {kind:'trash';scope:'hand'|'self';amount:number;requiresTrigger?:boolean;color?:string;trait?:string;cardType?:Card['type'];maxCost?:number;optional:boolean}
 | {kind:'bottom-deck-trash';amount:number;optional:boolean}
 | {kind:'rest';scope:'self'|'leader'|'don'|'own-card';amount:number;optional:boolean}
 | {kind:'turn-life';scope:'own';amount:number;position:'top';faceUp:boolean;optional:boolean}
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
const powerLimit=(text:string)=>{const match=text.match(/(\d+)\s+(?!base\s)power or less/i);return match?Number(match[1]):undefined;};
const basePowerLimit=(text:string)=>{const match=text.match(/(\d+)\s+base power or less/i);return match?Number(match[1]):undefined;};

/** Converts printed English effect clauses into board actions. UI owns timing and choices. */
function parseEffectText(source:string):ParsedEffect[]{
 const text=source.replace(/^NULL$/i,'').replace(/−/g,'-').trim();
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const timingText=text.replace(/activate this card's \[(?:Main|Counter|On Play)\] effect/gi,'');
 const timingPrefix=timingText.replace(/^\s*\[DON!!\s*[x×]\s*\d+\]\s*/i,'');
 const trigger:EffectTrigger=/^\s*\[On Play\]/i.test(timingPrefix)?'on-play':/^\s*\[When Attacking\]/i.test(timingPrefix)?'when-attacking':/^\s*\[Activate\s*:\s*Main\]/i.test(timingPrefix)?'activate-main':/^\s*\[Main\]/i.test(timingPrefix)?'main':/^\s*\[Counter\]/i.test(timingPrefix)?'counter':/^\s*\[Trigger\]/i.test(timingPrefix)?'trigger':/^\s*\[On K\.O\.\]/i.test(timingPrefix)||/\bWhen this Character is K\.O\.'d\b/i.test(timingPrefix)?'on-ko':/^\s*\[On Block\]/i.test(timingPrefix)?'on-block':/^\s*\[On Your Opponent's Attack\]/i.test(timingPrefix)?'opponent-attack':/^\s*\[End of Your Turn\]/i.test(timingPrefix)?'end-turn':/^\s*When a .*?Character card is played from your trash,/i.test(timingPrefix)?'character-played-from-trash':/^\s*\[(?:Your Turn|Opponent's Turn|Once Per Turn)\]/i.test(timingPrefix)?'continuous':'unknown';
 const conditionalBoost=text.match(/^\[Counter\] Up to 1 of your Leader or Character cards gains \+(\d+) power during this battle\. Then, if (you have \d+ or (?:less|more) (?:Life cards|cards in your trash|cards in your hand)), that card gains an additional \+(\d+) power during this battle\.$/i);
 if(conditionalBoost)return [{trigger:'counter',actions:[{kind:'power',amount:Number(conditionalBoost[1]),until:'battle',target:'own-card',selection:{min:0,max:1},bonus:{condition:conditionalBoost[2],amount:Number(conditionalBoost[3])}}],costs:[],conditions:[],optional:false,source:text}];
 const actions:EffectAction[]=[]; const costs:EffectCost[]=[]; const conditions:EffectCondition[]=[]; const optional=/\bYou may\b/i.test(text);
 const revealedOptionalPlay=/you may play that card/i.test(text)&&/If that card is/i.test(text)&&/If you do/i.test(text);
 for(const match of text.matchAll(/\bIf\s+([^,:]+)(?:[:,])/gi))if(!(/you have \d+ or more cards in your trash/i.test(match[1])&&/instead of a Character/i.test(text))&&!(revealedOptionalPlay&&/^(?:that card is |you do$)/i.test(match[1].trim())))conditions.push({kind:'text',text:match[1].trim()});
 if(/^\[Opponent's Turn\]/i.test(timingPrefix))conditions.push({kind:'text',text:"it is your opponent's turn"});
 if(/^\[Your Turn\]/i.test(timingPrefix))conditions.push({kind:'text',text:'it is your turn'});
 const drawMatch=text.match(/\bdraw\s+(a|one|\d+)\s+cards?\b/i);const draw=drawMatch?(/^(?:a|one)$/i.test(drawMatch[1])?1:Number(drawMatch[1])):0;if(draw)actions.push({kind:'draw',amount:draw});
 if(/your opponent chooses 1 card from your hand; trash that card/i.test(text))actions.push({kind:'trash',scope:'hand',amount:1,chooser:'opponent'});
 if(/^(?:\[Your Turn\]\s*)?Your Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'your-turn'});
 if(/^(?:\[Opponent's Turn\]\s*)?Opponent's Turn\s*\+1000$/i.test(text))actions.push({kind:'don-power',amount:1000,during:'opponent-turn'});
 if(/draw cards? equal to the number you returned to your deck/i.test(text))actions.push({kind:'draw-by',source:'returned-hand'});
 const resetMatch=text.match(/(you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck.*?draws? (\d+) cards?/i); if(resetMatch){const drawIndex=actions.findIndex(action=>action.kind==='draw');if(drawIndex>=0)actions.splice(drawIndex,1);actions.push({kind:'hand-reset',scope:/opponent/i.test(resetMatch[1])?'opponent':'self',draw:Number(resetMatch[2]),shuffle:/shuffl/i.test(resetMatch[0])});}
 if(/(?:you|your opponent) returns? all cards? in (?:their|your) hand to (?:their|your) deck/i.test(text)&&!resetMatch)actions.push({kind:'hand-reset',scope:/your opponent/i.test(text)?'opponent':'self'});
 if(/place all cards in your hand at the bottom of your deck/i.test(text))actions.push({kind:'bottom-deck-hand',scope:'self',amount:'all'});
 if(/^This Leader cannot attack\.$/i.test(text.trim()))actions.push({kind:'attack-prohibition',scope:'own-leader'});
 if(!resetMatch&&/(?:you|your opponent) (?:shuffles?|shuffle) (?:their|your) deck/i.test(text))actions.push({kind:'shuffle',scope:/your opponent/i.test(text)?'opponent':'self'});
 if(!resetMatch&&/\bshuffle your deck\b/i.test(text)&&!actions.some(action=>action.kind==='shuffle'))actions.push({kind:'shuffle',scope:'self'});
 const recovery=text.match(/(?:Add|Select) up to (\d+) (.+?) from your trash to your hand/i);
 if(recovery){let descriptor=recovery[2].replace(/^of your /i,'').trim();const action:Extract<EffectAction,{kind:'recover'}>={kind:'recover',source:'trash',destination:'hand',amount:Number(recovery[1])};
  const cost=descriptor.match(/\s+(?:with|and) a cost of (\d+)(?: or less)?/i);if(cost){const n=Number(cost[1]);if(/or less/i.test(cost[0]))action.maxCost=n;else action.exactCost=n;descriptor=descriptor.replace(cost[0],'').trim();}
  const color=descriptor.match(/^(black|blue|red|green|purple|yellow)\s+/i);if(color){action.color=color[1].toLowerCase();descriptor=descriptor.slice(color[0].length);}
  const includedType=descriptor.match(/^(Character|Event|Stage|Leader) card with a type including \"([^\"]+)\"/i);
  if(includedType){action.cardType=includedType[1] as Card['type'];action.trait=includedType[2];descriptor=descriptor.slice(includedType[0].length);}
  const trait=descriptor.match(/^(?:\{([^}]+)\}|\[([^\]]+)\]|\"([^\"]+)\") type(?:\s+(Character|Event|Stage|Leader))?\s*/i);
  if(trait){const values=trait.slice(1);action.trait=values.slice(0,3).find(Boolean);const type=values[3];if(type)action.cardType=type as Card['type'];descriptor=descriptor.slice(trait[0].length);}
  const named=descriptor.match(/^\[([^\]]+)\]$/);if(named){action.name=named[1];descriptor='';}
  const type=descriptor.match(/^(Character|Event|Stage|Leader)(?: cards?)?$/i);if(type)action.cardType=type[1] as Card['type'];else if(descriptor&&!/^cards?$/i.test(descriptor)){
   const rest=descriptor.replace(/\b(?:Character|Event|Stage|Leader)\s+cards?\b/i,'').trim();if(rest&&!/^cards?$/i.test(rest)){const namedRest=rest.match(/^\[([^\]]+)\]$/);if(namedRest)action.name=namedRest[1];else action.trait=rest;}
  }
  if(/other than \[([^\]]+)\]/i.test(recovery[2]))action.excludeName=recovery[2].match(/other than \[([^\]]+)\]/i)![1];
  actions.push(action);
 }
 const fixedPower=text.match(/set the power of up to \d+ of your opponent's Characters? to (\d+)/i); if(fixedPower)actions.push({kind:'set-power',amount:Number(fixedPower[1]),target:'opponent-character',until:'turn-end'});
 const directPower=text.match(/give up to \d+ of your opponent's Characters? (\d+) power during this turn/i); if(directPower)actions.push({kind:'power',amount:Number(directPower[1]),until:'turn-end',target:'opponent-character'});
 const selfPower=text.match(/give this Character ([+\-]?\d+) power/i); if(selfPower)actions.push({kind:'power',amount:Number(selfPower[1]),until:/during this battle/i.test(text)?'battle':'turn-end',target:'own-character'});
 const opponentCardPower=text.match(/give up to \d+ of your opponent's Leader or Character cards? ([+\-]?\d+) power/i); if(opponentCardPower)actions.push({kind:'power',amount:Number(opponentCardPower[1]),until:'turn-end',target:'opponent-character'});
 const fixedCost=text.match(/set the cost of up to \d+ of your opponent's Characters?.*?to (\d+) during this turn/i); if(fixedCost)actions.push({kind:'set-cost',amount:Number(fixedCost[1]),target:'opponent-character',until:'turn-end'});
 const power=Number(text.match(/([+\-]\d+)\s*power/i)?.[1]??0),powerSubject=text.match(/(?:up to\s+\d+\s+of your|your)\s+((?:\[[^\]]+\]|\{[^}]+\}|[\w' .-]+)(?:\s+(?:or\s+)?(?:\[[^\]]+\]|\{[^}]+\}|type|cards?|Characters?|Leader))*?)\s+gains\s+[+\-−]\s*\d+\s+power/i)?.[1]?.trim()??'',powerTrait=powerSubject.match(/(?:\[([^\]]+)\]|\{([^}]+)\})\s+type\s+(?:Characters?|Leader or Character)\b/i),powerName=powerSubject.match(/\[([^\]]+)\](?:\s+cards?)?$/i),genericPowerTarget=/up to 1 of your Leader or Character cards gains/i.test(powerSubject||text)||/\bcards?$/i.test(powerSubject)||/^\[[^\]]+\]$/i.test(powerSubject)||/^Leader or Characters?$/i.test(powerSubject)?'own-card':/give up to \d+ of your opponent's/i.test(powerSubject||text)?'opponent-character':/give this Character/i.test(powerSubject||text)?'own-character':/opponent/i.test(powerSubject)?'opponent-character':/Leader/i.test(powerSubject||text)?'own-leader':'own-character',genericPowerUntil=/during this battle/i.test(text)?'battle':'turn-end'; if(power&&!actions.some(action=>action.kind==='power'&&action.amount===power&&action.target===genericPowerTarget&&action.until===genericPowerUntil))actions.push({kind:'power',amount:power,until:genericPowerUntil,...(genericPowerTarget==='own-card'||/up to\s+\d+\s+of your/i.test(text)?{selection:{min:0,max:numberAfter(text,/up to\s+(\d+)/i)||1}}:{}),...(powerTrait?{trait:powerTrait[1]??powerTrait[2]}:{}),...(powerName?{name:powerName[1]}:{}),target:genericPowerTarget});
 const cost=Number(text.match(/([+\-]\d+)\s*cost/i)?.[1]??0); if(cost)actions.push({kind:'cost',amount:cost,target:'opponent-character'});
 const conditionalKo=text.match(/if you have (\d+) or more cards in your trash, choose up to 1 of your opponent's Characters? with a cost of (\d+) or less instead of a Character with a cost of (\d+) or less/i);
 const koLifeLimit=/cost equal to or less than the number of your opponent's Life cards/i.test(text)?'opponent':/cost equal to or less than the number of your Life cards/i.test(text)?'own':undefined,koUpTo=numberAfter(text,/K\.O\.\s+up to\s+(\d+)/i);
 if(conditionalKo)actions.push({kind:'ko',maxCost:Number(conditionalKo[3]),conditionalMaxCost:{condition:`you have ${conditionalKo[1]} or more cards in your trash`,amount:Number(conditionalKo[2])},selection:{min:0,max:1}});
 else if(/K\.O\.\s+(?:all|(?:up to\s+)?\d*\s*(?:of your opponent's )?(?:rested )?characters?)/i.test(text))actions.push({kind:'ko',maxCost:costLimit(text),...(koLifeLimit?{maxCostFromLife:koLifeLimit}:{}),maxPower:powerLimit(text),...(basePowerLimit(text)!==undefined?{maxBasePower:basePowerLimit(text)}:{}),restedOnly:/rested Characters?/i.test(text),...(koUpTo?{selection:{min:0,max:koUpTo}}:{})});
 if(!actions.some(action=>action.kind==='ko')&&/K\.O\.\s+(?:up to\s+)?\d+\s+of your opponent's .*?Characters?/i.test(text))actions.push({kind:'ko',maxCost:costLimit(text),...(koLifeLimit?{maxCostFromLife:koLifeLimit}:{}),maxPower:powerLimit(text),...(basePowerLimit(text)!==undefined?{maxBasePower:basePowerLimit(text)}:{}),restedOnly:/rested Characters?/i.test(text),...(koUpTo?{selection:{min:0,max:koUpTo}}:{})});
 const activeCharacterReturn=/return up to 1 active Character with a cost of \d+ or less to the owner's hand/i.test(text);
 const anyCardReturn=/return up to 1 card with a cost of \d+ or less to the owner's hand/i.test(text);
 if(activeCharacterReturn)actions.push({kind:'return-to-hand',scope:'any-character',maxCost:costLimit(text),activeOnly:true,selection:{min:0,max:1}});
 else if(anyCardReturn)actions.push({kind:'return-to-hand',scope:'any-card',maxCost:costLimit(text),selection:{min:0,max:1}});
 else {const returnUpTo=text.match(/return up to (\d+) (of your opponent's |of your )?Characters?(?: with a cost of (\d+) or less| with (\d+) (base )?power or less)? to the owner's hand/i);if(returnUpTo){const scope=returnUpTo[2]?.toLowerCase().includes('opponent')?'opponent-character':returnUpTo[2]?'own-character':'any-character',power=returnUpTo[4]?Number(returnUpTo[4]):undefined,base=Boolean(returnUpTo[5]);actions.push({kind:'return-to-hand',scope,maxCost:returnUpTo[3]?Number(returnUpTo[3]):undefined,...(power!==undefined&&!base?{maxPower:power}:{}),...(power!==undefined&&base?{maxBasePower:power}:{}),selection:{min:0,max:Number(returnUpTo[1])}});}else if(/return\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?(?:to the owner's )?hand/i.test(text))actions.push({kind:'return-to-hand',scope:'opponent-character',maxCost:costLimit(text)});else if(/return\s+(?:up to\s+)?\d*\s*(?:of your )?[^.]*?Characters?.*?(?:to the owner's )?hand/i.test(text)&&/of your (?!opponent)/i.test(text))actions.push({kind:'return-to-hand',scope:'own-character',maxCost:costLimit(text)});}
 if(/return this Character to the owner's hand/i.test(text))actions.push({kind:'return-to-hand',scope:'own-character'});
 const bottomCharacter=text.match(/place\s+(up to\s+(\d+)|all|\d+)?\s*(of your opponent's |of your )?characters?\b([\s\S]*?)at the bottom of (?:the )?owner's deck/i);
 if(bottomCharacter){const quantity=bottomCharacter[1]?.toLowerCase(),scope=bottomCharacter[3]?.toLowerCase().includes('opponent')?'opponent-character':bottomCharacter[3]?'own-character':'any-character';actions.push({kind:'bottom-deck',scope,maxCost:costLimit(bottomCharacter[0]),...(quantity?.startsWith('up to')?{selection:{min:0,max:Number(bottomCharacter[2])}}:quantity==='all'?{selection:{min:0,max:'all' as const}}:{})});}
 if(/at the end of a battle.*?place the opponent's Character you battled with at the bottom of the owner's deck/i.test(text))actions.push({kind:'bottom-deck',scope:'opponent-character',maxCost:costLimit(text)});
 if(/place all Characters? with a cost of \d+ or less at the bottom of the owner's deck/i.test(text))actions.push({kind:'bottom-deck',scope:'any-character',maxCost:costLimit(text)});
 if(/your opponent places? \d+ cards? from their trash at the bottom of their deck/i.test(text))actions.push({kind:'bottom-deck',scope:'trash'});
 if(/places? \d+ cards? from their hand at the bottom of their deck/i.test(text))actions.push({kind:'bottom-deck',scope:'opponent-hand'});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your )?characters?.*?(?:to the top|on top) of (?:your )?deck/i.test(text))actions.push({kind:'return-to-deck',scope:'own-character',position:'top'});
 if(/return\s+(?:up to\s+)?\d*\s*(?:of your opponent's )?characters?.*?(?:to the top|on top) of (?:the owner's )?deck/i.test(text))actions.push({kind:'return-to-deck',scope:'opponent-character',position:'top'});
 if(/reveal\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i.test(text))actions.push({kind:'reveal',source:'deck',amount:numberAfter(text,/reveal\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i)});
 if(/add\s+(?:up to\s+)?(\d+)\s+cards? from (?:the top|your) Life/i.test(text))actions.push({kind:'life',operation:'add-to-hand',amount:numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards? from (?:the top|your) Life/i)});
 if(/add\s+(?:up to\s+)?(\d+)\s+cards?.*?to (?:the top of )?your Life/i.test(text)&&!/from the top of your deck to/i.test(text))actions.push({kind:'life',operation:'add-to-life',amount:numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards?.*?to (?:the top of )?your Life/i)});
 if(/rest\s+this (?:character|stage)/i.test(text)){if(/(?:You may )?rest this (?:character|stage)\s*:/i.test(text)||/You may rest this (?:character|stage)\s+and\s+trash\s+\d+\s+[^.:]*\bfrom your hand\s*:/i.test(text))costs.push({kind:'rest',scope:'self',amount:1,optional,});else actions.push({kind:'rest',scope:'self'});}
 if(/You may rest your Leader\s*:/i.test(text))costs.push({kind:'rest',scope:'leader',amount:1,optional:true});
 const ownCardRest=text.match(/You may rest\s+(\d+)\s+of your cards?\s*:/i);if(ownCardRest)costs.push({kind:'rest',scope:'own-card',amount:Number(ownCardRest[1]),optional:true});
 const opponentRest=text.match(/rest (?:all(?: of)?\s+|(?:up to\s+)?\d*\s*(?:of )?)your opponent's (Leader or Character|Characters?|DON!! cards?|Leader or Character cards?)/i); if(opponentRest){const subject=opponentRest[1]??'',attachedDon=text.match(/(?:with|that has)\s+(?:(\d+)\s+or more\s+)?(?:a\s+)?DON!! cards? given/i);actions.push({kind:'rest',scope:/DON!!/i.test(subject)?'opponent-don':/Leader or Character/i.test(subject)?'opponent-card':/Leader/i.test(subject)?'opponent-leader':'opponent-character',maxCost:costLimit(text),...(attachedDon?{minAttachedDon:Number(attachedDon[1]??1)}:{}),...(/^rest all/i.test(text)?{selection:{min:0,max:'all'}}:{})});}
 if(/set this Character as active/i.test(text))actions.push({kind:'ready',scope:'self',amount:1});
 const readyTarget=text.match(/set\s+(?:up to\s+)?\d*\s*(?:of )?your .*?(DON!! cards|characters?)\b.*?as active/i); if(readyTarget){const amount=numberAfter(text,/set\s+(?:up to\s+)?(\d+)/i)||undefined,traitText=readyTarget[0].match(/((?:(?:\[[^\]]+\]|\{[^}]+\}|\"[^\"]+\")\s*(?:or\s*)?)+)\s+type/i)?.[1],includedType=readyTarget[0].match(/\btype including\s+[\"{\[]?([^\"}\]]+)[\"}\]]?/i)?.[1]?.trim(),traits=traitText?[...traitText.matchAll(/\[([^\]]+)\]|\{([^}]+)\}|\"([^\"]+)\"/g)].map(match=>(match[1]??match[2]??match[3]).trim()):includedType?[includedType]:[],attribute=readyTarget[0].match(/\"([^\"]+)\"\s+attribute/i)?.[1]??readyTarget[0].match(/\(([^)]+)\)\s+attribute/i)?.[1],costRange=readyTarget[0].match(/costs?\s+of\s+(\d+)\s+to\s+(\d+)/i),maxCost=costRange?Number(costRange[2]):costLimit(readyTarget[0]),minCost=costRange?Number(costRange[1]):undefined;actions.push({kind:'ready',scope:/DON!!/i.test(readyTarget[1])?'own-don':'own-character',amount,...(traits.length===1?{trait:traits[0]}:traits.length>1?{traits}:{}),...(attribute?{attribute}:{}),...(/\brested\s+Characters?\b/i.test(readyTarget[0])?{restedOnly:true}:{}),...(minCost!==undefined?{minCost}:{}),...(maxCost!==undefined?{maxCost}:{}),...(/set\s+up to/i.test(text)&&amount?{selection:{min:0,max:amount}}:{})});}
 if(opponentRest&&readyTarget&&(opponentRest.index??Infinity)>(readyTarget.index??Infinity)){const restIndex=actions.findLastIndex(action=>action.kind==='rest'&&action.scope==='opponent-character'),readyIndex=actions.findLastIndex(action=>action.kind==='ready'&&action.scope==='own-don');if(restIndex>=0&&readyIndex>=0)[actions[restIndex],actions[readyIndex]]=[actions[readyIndex],actions[restIndex]];}
 const addDonMatch=text.match(/add (up to\s+)?(\d+)\s+DON!!/i),addDon=Number(addDonMatch?.[2]??0); if(addDon)actions.push({kind:'add-don',amount:addDon,rested:/and rest (?:it|them)|add[^.]*?rested/i.test(text),...(addDonMatch?.[1]?{selection:{min:0,max:addDon}}:{})});
 const opponentReturnDon=text.match(/your opponent returns? (\d+) DON!! cards? from their field to their DON!! deck/i);if(opponentReturnDon)actions.push({kind:'return-don',amount:Number(opponentReturnDon[1]),owner:'opponent'});
 const returnDon=numberAfter(text,/DON!!\s*[-−]\s*(\d+)/i); if(returnDon){if(/DON!!\s*[-−]\s*\d+\s*(?:\([^)]*\))?\s*:/i.test(text))costs.push({kind:'return-don',amount:returnDon,optional:false});else if(!opponentReturnDon)actions.push({kind:'return-don',amount:returnDon,owner:'self'});}
 const restedDonCost=numberAfter(text,/(?:You may )?rest\s+(\d+)\s+of your DON!! cards?[^:]*:/i); if(restedDonCost)costs.push({kind:'rest',scope:'don',amount:restedDonCost,optional});
 const turnLifeCost=text.match(/turn\s+(\d+) cards? from the top of your Life(?: cards?)? face-up/i);if(turnLifeCost)costs.push({kind:'turn-life',scope:'own',amount:Number(turnLifeCost[1]),position:'top',faceUp:true,optional});
 const symbolDonCost=text.match(/[①②③④⑤⑥⑦⑧⑨⑩]/);if(symbolDonCost){const amount='①②③④⑤⑥⑦⑧⑨⑩'.indexOf(symbolDonCost[0])+1;costs.push({kind:'rest',scope:'don',amount,optional:false});}
 const required=numberAfter(text,/DON!!\s*(?:×|x)\s*(\d+)/i); if(required)actions.push({kind:'attach-don-required',amount:required});
 const returnTrashCost=text.match(/You may (?:return|place)\s+(\d+)\s+cards? from your trash (?:to|at) the bottom of your deck in any order\s*:/i);if(returnTrashCost)costs.push({kind:'bottom-deck-trash',amount:Number(returnTrashCost[1]),optional:true});else {const returnTrash=numberAfter(text,/(?:You may )?return\s+(\d+)\s+cards? from your trash to the bottom of your deck/i); if(returnTrash)actions.push({kind:'return-trash-to-deck-bottom',amount:returnTrash,optional:/You may return/i.test(text)});}
 const handTrashMatch=text.match(/trash\s+(\d+)\s+[^.:]*?\bfrom your hand/i); if(handTrashMatch){const source=handTrashMatch[0],requiresTrigger=/with\s+(?:a|an)\s+\[Trigger\]/i.test(source),amount=Number(handTrashMatch[1]),color=source.match(/\b(black|blue|red|green|purple|yellow)\b/i)?.[1],trait=source.match(/(?:\[|\{|\")([^\]}.\"]+)(?:\]|\}|\")\s+type/i)?.[1],cardType=source.match(/\b(Character|Event|Stage)\s+cards?/i)?.[1] as Card['type']|undefined,maxCost=costLimit(source),restriction={...(color?{color}:{}),...(trait?{trait}:{}),...(cardType?{cardType}:{}),...(maxCost?{maxCost}:{})},isHandTrashCost=text.slice((handTrashMatch.index??0)+source.length).trimStart().startsWith(':');if(isHandTrashCost)costs.push({kind:'trash',scope:'hand',amount,requiresTrigger,optional,...restriction});else actions.push({kind:'trash',scope:'hand',amount,requiresTrigger,...restriction});}
 const deckTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from the top of your deck/i); if(deckTrash)actions.push({kind:'trash',scope:'deck',amount:deckTrash});
 const opponentHandTrash=numberAfter(text,/opponent trashes?\s+(\d+)\s+cards? from their hand/i); if(opponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:opponentHandTrash});
 const directOpponentHandTrash=numberAfter(text,/trash\s+(\d+)\s+cards? from your opponent's hand/i); if(directOpponentHandTrash)actions.push({kind:'trash',scope:'opponent-hand',amount:directOpponentHandTrash});
 if(/trash this (?:character|stage)/i.test(text)){if(/trash this (?:character|stage)\s*:/i.test(text))costs.push({kind:'trash',scope:'self',amount:1,optional});else actions.push({kind:'trash',scope:'self',amount:1});}
 const look=numberAfter(text,/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your deck/i);
 const reorderOnly=look&&/place them at the (?:top|top or bottom) of (?:your|the) deck in any order/i.test(text)&&!/add .*?to your hand/i.test(text);
 if(reorderOnly)actions.push({kind:'reorder-deck',amount:look,position:/top or bottom/i.test(text)?'choice':'top'});
 if(look&&!reorderOnly){
  const descriptor=text.match(/(?:reveal|add)\s+(?:up to\s+)?\d+\s+(.+?)\s+(?:and\s+add\s+(?:it|them)\s+to your hand|to your hand)/i)?.[1]??'';
  const excludeName=descriptor.match(/other than\s+\[([^\]]+)\]/i)?.[1]??text.match(/other than\s+\[([^\]]+)\]/i)?.[1];
  const subject=descriptor.replace(/other than\s+\[[^\]]+\]/i,'').trim();
  const triggerOnly=/\[Trigger\]/i.test(subject);
  const searchSubject=subject.replace(/\[Trigger\]/ig,'').replace(/with\s+a\s*$/i,'').trim();
  const cardType=searchSubject.match(/\b(Character|Event|Stage|Leader)\s+cards?\b/i)?.[1] as Card['type']|undefined;
  const unwrappedSubject=searchSubject.replace(/\{[^}]*\}|\[[^\]]*\]|"[^"]*"|'[^']*'/g,' ');
  const color=unwrappedSubject.match(/\b(red|blue|green|purple|black|yellow)\b/i)?.[1];
  const powerRestriction=searchSubject.match(/(\d+)\s+power(?:\s+or\s+(less|more))?/i),powerValue=powerRestriction?Number(powerRestriction[1]):undefined;
  const powerRule=powerRestriction?(powerRestriction[2]?.toLowerCase()==='more'?{minPower:powerValue}:powerRestriction[2]?.toLowerCase()==='less'?{maxPower:powerValue}:{exactPower:powerValue}):{};
  const includingType=searchSubject.match(/type including\s+["']([^"']+)["']/i)?.[1];
  const includingTraits=[...searchSubject.matchAll(/type including\s+["']([^"']+)["']/ig)].map(match=>match[1]);
  const traitSegment=searchSubject.match(/^(.+?)\s+type\b/i)?.[1]?.trim();
  const meaningfulTraitSegment=/^card with an?$/i.test(traitSegment??'')?undefined:traitSegment;
  const wrappedTraits=meaningfulTraitSegment?[...meaningfulTraitSegment.matchAll(/(?:\{([^}]+)\}|\[([^\]]+)\]|\"([^\"]+)\"|'([^']+)')/g)].map(match=>match[1]??match[2]??match[3]??match[4]):[];
  const traitValues=[...(meaningfulTraitSegment?(wrappedTraits.length?wrappedTraits:meaningfulTraitSegment.split(/\s+or\s+/i).map(value=>value.replace(/[\"'{}\[\]]/g,'').trim()).filter(Boolean)):[]),...includingTraits];
  const traitAlternatives=traitValues.length>1?traitValues.map(trait=>({trait})):undefined;
  const trait=traitValues[0];
  const namedSubject=searchSubject.match(/^\[([^\]]+)\]$/)?.[1]??searchSubject.match(/^\"([^\"]+)\"$/)?.[1];
  const firstSearchChoose=numberAfter(text,/reveal\s+(?:up to\s+)?(\d+)\s+/i)||1,extraChooseMatches=[...descriptor.matchAll(/\bor\s+up to\s+(\d+)\s+/ig)],chooseMatches=[{1:String(firstSearchChoose)},...extraChooseMatches.map(match=>({1:match[1]}))],choose=firstSearchChoose+extraChooseMatches.reduce((sum,match)=>sum+Number(match[1]),0);
  const namedOrColour=text.match(/reveal\s+(?:up to\s+)?(\d+)\s+\[([^\]]+)\]\s+or\s+(?:\d+\s+)?(red|green|blue|purple|black|yellow)\s+(Event|Character|Stage)\b/i);
  const namedIncluding=searchSubject.match(/^\[([^\]]+)\]\s+or\s+(?:up to\s+\d+\s+)?card with a type including\s+["']([^"']+)["']/i);
  const allTraitValues=[...new Set(traitValues)];
  const typedAlternatives=allTraitValues.length>1?allTraitValues.map(value=>({trait:value,...(cardType?{cardType}:{}),...(chooseMatches.length>1?{choose:Number(chooseMatches[0][1])}:{})})):traitAlternatives?.map(alternative=>({...alternative,...(cardType?{cardType}:{})}));
  const namedType=text.match(/reveal\s+(?:up to\s+)?\d+\s+\[([^\]]+)\]\s+or\s+(Character|Event|Stage|Leader)\s+card/i);
  const alternatives=namedOrColour?[{name:namedOrColour[2]},{color:namedOrColour[3],cardType:namedOrColour[4] as Card['type']}]:namedType?[{name:namedType[1]},{cardType:namedType[2] as Card['type']}]:namedIncluding?[{name:namedIncluding[1],...(chooseMatches.length>1?{choose:Number(chooseMatches[0][1])}:{})},{trait:namedIncluding[2],...(chooseMatches.length>1?{choose:Number(chooseMatches[1][1])}:{})}]:typedAlternatives;
  const searchCost=searchSubject.match(/(?:card|Character|Event|Stage)\s+with a cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),costValue=searchCost?Number(searchCost[1]):undefined;
  const costRestriction=searchCost?(searchCost[2]?.toLowerCase()==='more'?{minCost:costValue}:searchCost[2]?.toLowerCase()==='less'?{maxCost:costValue}:{exactCost:costValue}):{};
  const globalCardType=namedOrColour||namedType?undefined:cardType,globalColor=namedOrColour?undefined:color;
  const searchAction:Extract<EffectAction,{kind:'search'}>={kind:'search',amount:look,choose,destination:/trash the rest/i.test(text)?'trash':/bottom of your deck/i.test(text)?'deck-bottom':'hand',...(alternatives?(namedOrColour?{cardType:undefined,trait:undefined}:{...(globalCardType?{cardType:globalCardType}:{}),...(globalColor?{color:globalColor}:{})}):{...(globalCardType?{cardType:globalCardType}:{}),...(namedSubject?{name:namedSubject}:{}),...(trait?{trait}:{}),...(globalColor?{color:globalColor}:{})}),...costRestriction,...powerRule,...(triggerOnly?{triggerOnly}:{}),...(alternatives?{alternatives}:{}),...(excludeName?{excludeName}:{})};
  actions.push(searchAction);
 }
 const namedDeckSearch=text.match(/reveal up to\s+(\d+)\s+\[([^\]]+)\]\s+from your deck and add it to your hand/i); if(namedDeckSearch)actions.push({kind:'search',amount:0,choose:Number(namedDeckSearch[1]),destination:'hand',trait:namedDeckSearch[2]});
 const lifeToHand=numberAfter(text,/add\s+(?:up to\s+)?(\d+)\s+cards? from the (?:top|top or bottom) of your Life cards? to your hand/i); if(lifeToHand)actions.push({kind:'life',operation:'add-to-hand',amount:lifeToHand});
 const takeOpponentLife=numberAfter(text,/add up to\s+(\d+)\s+cards? from the top of your opponent's Life cards? to the owner's hand/i);if(takeOpponentLife)actions.push({kind:'life',operation:'opponent-top-to-owner-hand',amount:takeOpponentLife,selection:{min:0,max:takeOpponentLife}});
 const lifeReorder=numberAfter(text,/look at\s+(?:up to\s+)?(\d+)\s+cards? from the top of your or your opponent's Life cards?/i); if(lifeReorder)actions.push({kind:'reorder-life',scope:'either',amount:lifeReorder,addSelfToHand:/add this card to your hand/i.test(text)});
 const lifePlacement=text.match(/(?:add|place) up to (\d+) .*?(?:Character|card).*?to the (top|bottom)( or bottom)? of (?:your opponent's|the owner's|your) Life cards?(?: (face-up|face-down))?/i); if(lifePlacement&&!/from the top of your deck to/i.test(lifePlacement[0]))actions.push({kind:'move-to-life',scope:/your opponent/i.test(lifePlacement[0])?'opponent':'own',amount:Number(lifePlacement[1]),position:lifePlacement[3]?'choice':lifePlacement[2].toLowerCase() as 'top'|'bottom',faceUp:lifePlacement[4]==='face-up'});
 const deckToLife=text.match(/add up to\s+(\d+)\s+cards? from the top of your deck to the top of your Life cards?/i);if(deckToLife)actions.push({kind:'move-to-life',scope:'own',amount:Number(deckToLife[1]),position:'top',source:'deck-top',selection:{min:0,max:Number(deckToLife[1])}});
 const handReveal=numberAfter(text,/choose (\d+) cards? from your opponent's hand; your opponent reveals?/i); if(handReveal)actions.push({kind:'reveal-hand',scope:'opponent',amount:handReveal});
 if(/trash cards? from your hands until you each have (\d+) cards? in your hands/i.test(text))actions.push({kind:'hand-limit',scope:'both',amount:numberAfter(text,/until you each have (\d+)/i)});
 if(/trash (\d+) cards? from the top of each of your and your opponent's Life cards?/i.test(text))actions.push({kind:'trash-life',scope:'both',amount:numberAfter(text,/trash (\d+) cards? from the top of each/i)});
 const opponentLifeTrashMatch=text.match(/trash (up to )?(\d+) cards? from the top of your opponent's Life cards?/i);const opponentLifeTrash=Number(opponentLifeTrashMatch?.[2]??0);if(opponentLifeTrash)actions.push({kind:'trash-life',scope:'opponent',amount:opponentLifeTrash,...(opponentLifeTrashMatch?.[1]?{selection:{min:0,max:opponentLifeTrash}}:{})});
 if(/play this card/i.test(text))actions.push({kind:'play',source:'life'});
 const selfAttach=text.match(/give this Character up to (\d+) rested DON!! cards?/i);if(selfAttach)actions.push({kind:'attach-don',amount:Number(selfAttach[1]),source:'cost-area',rested:true,recipient:'self',selection:{min:0,max:Number(selfAttach[1])}});
 const selfLeaderAttach=text.match(/give up to (\d+) rested DON!! cards? to this Leader/i);if(selfLeaderAttach)actions.push({kind:'attach-don',amount:Number(selfLeaderAttach[1]),source:'cost-area',rested:true,recipient:'self',selection:{min:0,max:Number(selfLeaderAttach[1])}});
 const attachMatch=!selfAttach&&text.match(/give up to (\d+) (?:total of your currently given )?(?:rested )?DON!! cards? to (?:your Leader or )?(?:1 of your )?Characters?/i); if(attachMatch)actions.push({kind:'attach-don',amount:Number(attachMatch[1]),source:/currently given/i.test(attachMatch[0])?'attached':'cost-area',rested:/rested DON!!/i.test(attachMatch[0])});
 const anyAttach=!attachMatch&&!selfLeaderAttach&&text.match(/give up to (\d+) rested DON!! cards? to .*?(?:Leader|Character)/i); if(anyAttach)actions.push({kind:'attach-don',amount:Number(anyAttach[1]),source:'cost-area',rested:true});
 const playAtDon=text.match(/play up to\s+(\d+)\s+(.+?)\s+with a cost equal to or less than the number of DON!! cards on your field from your hand/i);if(playAtDon){const descriptor=playAtDon[2],alternatives=descriptor.split(/\s+or\s+/i).map(part=>{const token=part.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)")/),value=token?.[1]??token?.[2]??token?.[3];if(!value)return {};return /\btype\b/i.test(part)?{trait:value}:{name:value};});actions.push({kind:'play',source:'hand',amount:Number(playAtDon[1]),costAtMostDonField:true,cardType:/Character card/i.test(descriptor)?'Character':undefined,...(alternatives.length>1?{alternatives}:{})});}
 const handPlay=!actions.some(action=>action.kind==='play'&&action.source==='hand')?text.match(/play up to\s+(\d+)\s+(.+?)\s+from your hand(?:\s+rested)?/i):null;
 if(handPlay){const originalDescriptor=handPlay[2],descriptor=originalDescriptor.replace(/other than\s+\[[^\]]+\]/i,'').trim(),unwrapped=descriptor.replace(/\{[^}]*\}|\[[^\]]*\]|"[^"]*"|'[^']*'/g,' '),colour=unwrapped.match(/\b(red|blue|green|purple|black|yellow)\b/i)?.[1]?.toLowerCase(),type=descriptor.match(/\b(Character|Stage)\s+cards?\b/i)?.[1] as Card['type']|undefined,wrapper=descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)"|'([^']+)')/),wrapped=wrapper?.[1]??wrapper?.[2]??wrapper?.[3]??wrapper?.[4],trait=wrapped&&(/\btype including\b/i.test(descriptor)||new RegExp(`(?:\\}\\s*|\\]\\s*|[\"']\\s*)type\\b`,'i').test(descriptor))?wrapped:undefined,name=wrapped&&!trait?wrapped:undefined,attribute=descriptor.match(/\b( Slash|Ranged|Strike|Wisdom|Special) attribute\b/i)?.[1]?.trim(),excluded=originalDescriptor.match(/other than\s+\[([^\]]+)\]/i)?.[1],costMatch=descriptor.match(/cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),powerMatch=descriptor.match(/(\d+)\s+power(?:\s+or\s+(less|more))?/i),costValue=costMatch?Number(costMatch[1]):undefined,powerValue=powerMatch?Number(powerMatch[1]):undefined;
  actions.push({kind:'play',source:'hand',amount:Number(handPlay[1]),...(type?{cardType:type}:{}),...(trait?{trait}:{}),...(name?{name}:{}),...(colour?{color:colour}:{}),...(attribute?{attribute}:{}),...(costMatch?(costMatch[2]?.toLowerCase()==='less'?{maxCost:costValue}:costMatch[2]?.toLowerCase()==='more'?{minCost:costValue}:{exactCost:costValue}):{}),...(powerMatch?(powerMatch[2]?.toLowerCase()==='less'?{maxPower:powerValue}:powerMatch[2]?.toLowerCase()==='more'?{minPower:powerValue}:{exactPower:powerValue}):{}),...(/no base effect/i.test(descriptor)?{noBaseEffect:true}:{}),...(excluded?{excludeName:excluded}:{}),rested:/from your hand rested/i.test(handPlay[0])});
 }
 const revealedOptionalPlayMatch=text.match(/If that card is a ([\s\S]*?), you may play that card/i);if(revealedOptionalPlayMatch){const descriptor=revealedOptionalPlayMatch[1],type=descriptor.match(/^(Character|Stage) card\b/i)?.[1] as Card['type']|undefined,trait=descriptor.match(/type including\s+["']([^"']+)["']/i)?.[1]??descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\])\s+type/i)?.slice(1).find(Boolean),cost=descriptor.match(/cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),costValue=cost?Number(cost[1]):undefined;actions.push({kind:'play',source:'deck',amount:1,topOnly:true,selection:{min:0,max:1},...(type?{cardType:type}:{}),...(trait?{trait}:{}),...(cost?(cost[2]?.toLowerCase()==='less'?{maxCost:costValue}:cost[2]?.toLowerCase()==='more'?{minCost:costValue}:{exactCost:costValue}):{})});}
 if(/select up to\s+\d+.*?from your hand and play it or add it to the top of your Life cards?/i.test(text))actions.push({kind:'play-or-life',source:'hand',maxCost:costLimit(text),faceUp:/face-up/i.test(text)});
 if(/(?:activate|select) up to\s+\d+.*?Event.*?from your hand/i.test(text))actions.push({kind:'play',source:'hand',maxCost:costLimit(text)});
 const trashPlay=text.match(/play up to\s+(\d+)\s+(.+?)\s+from your trash(?:\s+rested)?/i); if(trashPlay){const original=trashPlay[2],excludeName=original.match(/other than \[([^\]]+)\]/i)?.[1],descriptor=original.replace(/other than \[[^\]]+\]/i,'').trim(),wrapper=descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|\"([^\"]+)\")/),wrapped=wrapper?.[1]??wrapper?.[2]??wrapper?.[3],hasType=/type\b/i.test(descriptor),trait=wrapped&&hasType?wrapped:undefined,name=wrapped&&!hasType?wrapped:undefined,color=descriptor.replace(/(?:\{[^}]*\}|\[[^\]]*\]|\"[^\"]*\")/g,' ').match(/\b(black|blue|red|green|purple|yellow)\b/i)?.[1],cardType=descriptor.match(/\b(Character|Event|Stage|Leader)\s+cards?\b/i)?.[1] as Card['type']|undefined,costMatch=descriptor.match(/cost of\s+(\d+)(?:\s+or\s+(less|more))?/i),powerMatch=descriptor.match(/(\d+)\s+power(?:\s+or\s+(less|more))?/i),attribute=descriptor.match(/\b(Slash|Ranged|Strike|Wisdom|Special) attribute\b/i)?.[1],costValue=costMatch?Number(costMatch[1]):undefined,powerValue=powerMatch?Number(powerMatch[1]):undefined;actions.push({kind:'play',source:'trash',amount:Number(trashPlay[1]),...(costMatch?(costMatch[2]?.toLowerCase()==='less'?{maxCost:costValue}:costMatch[2]?.toLowerCase()==='more'?{minCost:costValue}:{exactCost:costValue}):{}),...(powerMatch?(powerMatch[2]?.toLowerCase()==='less'?{maxPower:powerValue}:powerMatch[2]?.toLowerCase()==='more'?{minPower:powerValue}:{exactPower:powerValue}):{}),rested:/from your trash rested/i.test(trashPlay[0]),...(trait?{trait}:{}),...(name?{name}:{}),...(color?{color:color.toLowerCase()}:{}),...(attribute?{attribute}:{}),...(cardType?{cardType}:{}),...(excludeName?{excludeName}:{})});}
 const deckPlay=text.match(/play up to\s+(\d+)\s+(.+?)\s+from your deck/i); if(deckPlay){const descriptor=deckPlay[2],trait=descriptor.match(/(?:\{|\[|\")([^}\]\"]+)(?:\}|\]|\")(?: type)?/i)?.[1],color=descriptor.match(/\b(black|blue|red|green|purple|yellow)\b/i)?.[1],cardType=descriptor.match(/\b(Character|Event|Stage|Leader)\s+cards?/i)?.[1] as Card['type']|undefined,cost=descriptor.match(/cost of\s+(\d+)(?:\s+(or less))?/i);actions.push({kind:'play',source:'deck',amount:Number(deckPlay[1]),...(cost?(cost[2]?{maxCost:Number(cost[1])}:{exactCost:Number(cost[1])}):{}),...(trait?{trait}:{}),...(color?{color}:{}),...(cardType?{cardType}:{})});}
 if(/(?:^|\n|\]|\.)\s*\[Blocker\]/i.test(text)&&!/(?:gains?|gives?|giving|without|with(?: a)?|activate(?:s)?|have|has)\s+\[Blocker\]/i.test(text))actions.push({kind:'blocker'});
 const counter=numberAfter(text,/\[Counter\]\s*\+?(\d+)/i); if(counter)actions.push({kind:'counter',amount:counter});
 if(/(?:^|\n|\]|\.)\s*\[Rush\]/i.test(text)&&!/(?:gains?|gives?|giving|without|with(?: a)?|activate(?:s)?|have|has)\s+\[Rush\]/i.test(text))actions.push({kind:'rush'});
 if(/(?:^|\n|\]|\.)\s*\[Double Attack\]/i.test(text)&&!/(?:gains?|gives?|giving|without|with(?: a)?|activate(?:s)?|have|has)\s+\[Double Attack\]/i.test(text))actions.push({kind:'double-attack'});
 if(/(?:^|\n|\]|\.)\s*\[Banish\]/i.test(text)&&!/(?:gains?|gives?|giving|without|with(?: a)?|activate(?:s)?|have|has)\s+\[Banish\]/i.test(text))actions.push({kind:'banish'});
 if(/activate this card's \[Main\] effect/i.test(text))actions.push({kind:'activate-main-effect'});
 if(/activate this card's \[On Play\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'on-play'});
 if(/activate this card's \[Main\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'main'});
 if(/activate this card's \[Counter\] effect/i.test(text))actions.push({kind:'activate-referenced-effect',trigger:'counter'});
 if(/(?:can also )?attack (?:your opponent's )?active Characters?(?: during this turn| on the turn in which they are played)?/i.test(text)||/can attack Characters? on the turn in which (?:it|they are) played/i.test(text)||/this Character can attack Characters? on the turn in which it is played/i.test(text))actions.push({kind:'attack-permission',scope:'own-character',activeTargets:/active Characters?/i.test(text),...(/during this turn/i.test(text)?{until:'turn-end' as const}:{})});
 if(/(?:Leader|Character|card)s?(?:\s+with[^.]*?)? cannot attack until (?:the (?:start|end) of )?your opponent's next (?:turn|End Phase)/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'opponent-next-turn'});
 if(/(?:Leader|Character|card)s?(?:\s+with[^.]*?)? cannot attack until the start of your next turn/i.test(text))actions.push({kind:'attack-restriction',scope:'opponent-character',until:'next-own-turn'});
 if(/(?:Leader|Character|card)s? cannot attack during this turn/i.test(text))actions.push({kind:'attack-restriction',scope:/Leader/i.test(text)?'opponent-leader':'opponent-character',until:'turn-end'});
 if(/(?:this Character )?will not become active in your next Refresh Phase/i.test(text))actions.push({kind:'skip-next-refresh',scope:'self'});
 else {const selectedPreventReady=text.match(/up to (\d+) of your opponent's (rested )?(Leader or Character cards?|Characters?|DON!! cards?|cards?)(?: with a cost of (\d+) or less)?(?: that has (\d+) or more DON!! cards? given)? will not become active in your opponent's next Refresh Phase/i);if(selectedPreventReady)actions.push({kind:'prevent-ready',scope:/DON!!/i.test(selectedPreventReady[3])?'opponent-don':/cards?$/i.test(selectedPreventReady[3])&&!/Character/i.test(selectedPreventReady[3])?'opponent-card':/Leader or Character/i.test(selectedPreventReady[3])?'opponent-card':'opponent-character',until:'opponent-next-refresh',...(selectedPreventReady[4]?{maxCost:Number(selectedPreventReady[4])}:{}),...(selectedPreventReady[5]?{minAttachedDon:Number(selectedPreventReady[5])}:{}),...(selectedPreventReady[2]?{restedOnly:true}:{}),selection:{min:0,max:Number(selectedPreventReady[1])}});else {const preventReady=text.match(/all of your opponent's (rested )?(Characters?|DON!! cards?)(?: with a cost of (\d+) or less)? will not become active in your opponent's next Refresh Phase/i);if(preventReady)actions.push({kind:'prevent-ready',scope:/DON!!/i.test(preventReady[2])?'opponent-don':'opponent-character',until:'opponent-next-refresh',...(preventReady[3]?{maxCost:Number(preventReady[3])}:{}),...(preventReady[1]?{restedOnly:true}:{}),selection:{min:0,max:'all'}});else if(/will not become active in your opponent's next Refresh Phase/i.test(text))actions.push({kind:'prevent-ready',scope:/DON!!/i.test(text)?'opponent-don':'opponent-character',until:'opponent-next-refresh'});}}
 if(/cannot be rested until the end of your opponent's next/i.test(text))actions.push({kind:'prevent-rest',scope:'opponent-character',until:'opponent-next-turn'});
 if(/swap the base power of the selected Characters? with each other during this turn/i.test(text))actions.push({kind:'swap-power',until:'turn-end'});
 if(/this Character's base power becomes the same as the selected Character's power during this turn/i.test(text))actions.push({kind:'copy-base-power',target:'own-character',from:'opponent-character',until:'turn-end'});
 const basePower=text.match(/base power (?:becomes?|become) (\d+)/i); if(basePower)actions.push({kind:'base-power',amount:Number(basePower[1]),target:/Leader/i.test(text)?'own-leader':'own-character',until:'turn-end'});
 const excludedBattleAttribute=text.match(/cannot be K\.O\.'d in battle by Characters? without the ["“<(]([^"”>)]+)["”>)] attribute/i);
 const strikeProtection=text.match(/cannot be K\.O\.'d in battle by ["“<]([^"”>]+)["”>] attribute (Leaders?\s+or\s+Characters?|Characters?\s+or\s+Leaders?|Characters?|Leaders?|cards?)/i);
 const genericAttributeProtection=/cannot be K\.O\.'d in battle by attribute cards?/i.test(text);
 const cardTypeProtection=text.match(/cannot be K\.O\.'d in battle by (Leaders?|Characters?)(?:\s|[.,;]|$)/i);
 const clanProtection=text.match(/([\w .'-]+) type Characters? other than (?:your )?\[([^\]]+)\] cannot be K\.O\.'d in battle/i);
 if(excludedBattleAttribute)actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',byCardType:'Character',excludeAttribute:excludedBattleAttribute[1],requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(strikeProtection)actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',attribute:strikeProtection[1],byCardType:/^Leaders?\s+or\s+Characters?|^Characters?\s+or\s+Leaders?/i.test(strikeProtection[2])?'Leader or Character':/^Leader/i.test(strikeProtection[2])?'Leader':/^Character/i.test(strikeProtection[2])?'Character':undefined,requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(genericAttributeProtection)actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',attribute:'*',requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(cardTypeProtection)actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',byCardType:/^Leader/i.test(cardTypeProtection[1])?'Leader':'Character',requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(clanProtection){actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',protects:'characters',protectedTrait:clanProtection[1].trim(),protectedExcludeName:clanProtection[2],protectedExcludeOwnerOnly:/other than your \[/i.test(clanProtection[0])});}
 else if(/cannot be K\.O\.'d in battle/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'battle',requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 const globalProtection=text.match(/your ([\s\S]*?\bCharacters?[\s\S]*?) cannot be K\.O\.'d by (?:your opponent's )?effects?/i);
 const effectProtection=text.match(/cannot be K\.O\.'d by (?:your opponent's )?effects? of Characters? without the \(([^)]+)\) attribute/i);
 const effectSourcePower=text.match(/cannot be K\.O\.'d by (?:your opponent's )?effects? of (?:your opponent's )?(Characters?|Leaders?) with ([\d,]+) (?:base )?power or less/i);
 if(effectProtection)actions.push({kind:'prevent-ko',scope:'own-character',by:'effect',excludeAttribute:effectProtection[1],byCardType:'Character',requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(effectSourcePower)actions.push({kind:'prevent-ko',scope:'own-character',by:'effect',byCardType:/^Leader/i.test(effectSourcePower[1])?'Leader':'Character',sourceMaxPower:Number(effectSourcePower[2].replaceAll(',','')),requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 else if(!globalProtection&&/cannot be K\.O\.'d by (?:your opponent's )?effects/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect',requiresAttachedDon:numberAfter(text,/\[DON!!\s*[x×]\s*(\d+)\]/i)||undefined});
 if(globalProtection&&!/\bthis Character\b/i.test(globalProtection[0])){const descriptor=globalProtection[1],trait=descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)")\s+type/i),excluded=descriptor.match(/other than \[([^\]]+)\]/i),maxCost=descriptor.match(/cost of (\d+) or less/i),exactCost=descriptor.match(/(?:base )?cost of (\d+)(?!\s+or less)/i);actions.push({kind:'prevent-ko',scope:'own-character',by:'effect',protects:'own-characters',...(trait?{protectedTrait:trait[1]??trait[2]??trait[3]}:{}),...(excluded?{protectedExcludeName:excluded[1]}:{}),...(maxCost?{protectedMaxCost:Number(maxCost[1])}:{}),...(exactCost?{protectedExactCost:Number(exactCost[1])}:{}),...( /\bactive Characters?/i.test(descriptor)?{protectedMustBeActive:true}:{})});}
 if(!globalProtection&&/cannot be removed from the field by your opponent's effects?/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 if(/can be K\.O\.'d by effects until the end of your opponent's next turn/i.test(text))actions.push({kind:'prevent-ko',scope:'own-character',by:'effect'});
 const negate=text.match(/negate the effects? of up to (\d+) of your opponent's (Characters?|Leader or Character cards?)/i); if(negate)actions.push({kind:'negate-effect',scope:/Leader or Character/i.test(negate[2])?'opponent-card':'opponent-character',amount:Number(negate[1]),until:'turn-end'});
 if(/negate the effects? of your opponent's Leader and all of their Characters during this turn/i.test(text))actions.push({kind:'negate-effect',scope:'opponent-card',amount:0,until:'turn-end'});
 if(/negate the effect of up to \d+ of each of your opponent's Leader and Character cards during this turn/i.test(text))actions.push({kind:'negate-effect',scope:'opponent-card',amount:2,until:'turn-end'});
 const blockerLock=text.match(/your opponent cannot activate a \[Blocker\] Character that has ([\d,]+) or less power during this battle/i);if(blockerLock)actions.push({kind:'prevent-keyword-activation',keyword:'blocker',scope:'opponent-character',maxPower:Number(blockerLock[1].replaceAll(',','')),until:'battle'});
 const reduction=text.match(/cost of playing (?:\[([^\]]+)\] type )?(Character|Event|Stage) cards? with a cost of (\d+) or more from your hand will be reduced by (\d+)/i); if(reduction)actions.push({kind:'cost-reduction',trait:reduction[1],cardType:reduction[2] as Card['type'],minimumCost:Number(reduction[3]),amount:Number(reduction[4])});
 const nextReduction=text.match(/next time you play \[([^\]]+)\](?: type)?(?: Character)? with a cost of (\d+) or more from your hand during this turn, the cost will be reduced by (\d+)/i); if(nextReduction)actions.push({kind:'cost-reduction',trait:nextReduction[1],cardType:'Character',minimumCost:Number(nextReduction[2]),amount:Number(nextReduction[3])});
 if(/would be removed from the field by your opponent's effect.*?rest \d+ of your (?:active )?cards? instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'rest-card'}});
 if(/would be removed from the field by your opponent's effect.*?place \d+ of your Characters?.*?bottom of the owner's deck instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'bottom-deck-own-character'}});
 if(/would be removed from the field by your opponent's effect.*?return this Character to the owner's hand instead/i.test(text))actions.push({kind:'replacement',event:'removed-by-effect',cost:{kind:'return-self-hand'}});
 if(/if this Character would be K\.O\.'d, you may rest your Leader or 1 \[([^\]]+)\] instead/i.test(text)){const stageName=text.match(/if this Character would be K\.O\.'d, you may rest your Leader or 1 \[([^\]]+)\] instead/i)![1];actions.push({kind:'replacement',event:'ko',cost:{kind:'rest-leader-or-stage',amount:1,stageName}});}
 const koReplacement=text.match(/If your (black|blue|red|green|purple|yellow) Character with a base cost of (\d+) or less would be K\.O\.(?:'|’)?d by your opponent(?:'|’)s effect, you may place (\d+) cards? from your trash at the bottom of your deck in any order instead/i);
 if(koReplacement)actions.push({kind:'replacement',event:'ko-by-effect',cost:{kind:'bottom-deck-trash',amount:Number(koReplacement[3])},eligibility:{color:koReplacement[1],cardType:'Character',maxBaseCost:Number(koReplacement[2])},oncePerTurn:/\[Once Per Turn\]/i.test(text)});
 for(const [pattern,keyword] of [[/gains? \[Rush\]/i,'rush'],[/gains? \[Blocker\]/i,'blocker'],[/gains? \[Double Attack\]/i,'double-attack'],[/gains? \[Banish\]/i,'banish'],[/gains? \[Unblockable\]/i,'unblockable'],[/cannot be blocked/i,'unblockable']] as const){
  const match=text.match(pattern);if(!match)continue;
  const before=text.slice(0,match.index),recipient=before.match(/(?:This Character|This Leader|your Leader|up to \d+ of your [^.;:]*?(?:Characters?|cards?)[^.;:]*)\s*$/i);
  const action:Extract<EffectAction,{kind:'grant-keyword'}>={kind:'grant-keyword',keyword,until:/during this battle/i.test(text)?'battle':/until the end of your opponent's next turn/i.test(text)?'opponent-next-turn':'turn-end'};
  const exact=/This Character\s*$/i.test(before)?'self':/This Leader\s*$/i.test(before)?'self':/your Leader\s*$/i.test(before)?'own-leader':undefined;
  if(exact)action.scope=exact;
  else if(/that Character\s*$/i.test(before))action.scope=actions.some(candidate=>candidate.kind==='ready')?'previous-target':'previous-played';
  else if(recipient){const descriptor=recipient[0];const namedCard=/up to \d+ of your \[[^\]]+\] cards?/i.test(descriptor);action.scope=/Leader or Character/i.test(descriptor)||namedCard?'own-card':/Leader/i.test(descriptor)&&!/Characters?/i.test(descriptor)?'own-leader':'own-character';const max=descriptor.match(/up to (\d+)/i);if(max)action.selection={min:0,max:Number(max[1])};
   const trait=descriptor.match(/(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)")\s+type Characters?/i);if(trait)action.trait=trait[1]??trait[2]??trait[3];
   const name=descriptor.match(/up to \d+ of your \[([^\]]+)\](?!\s+type)/i);if(name)action.name=name[1];
   const cost=descriptor.match(/cost of (\d+) or less/i);if(cost)action.maxCost=Number(cost[1]);
   if(/without an \[On Play\] effect/i.test(descriptor))action.withoutOnPlay=true;
   const color=descriptor.match(/\b(black|blue|red|green|purple|yellow)\b/i);if(color)action.color=color[1].toLowerCase();
  }
  if(trigger==='character-played-from-trash'){const eventTrait=text.match(/When a\s+(?:\{([^}]+)\}|\[([^\]]+)\]|"([^"]+)")\s+type Character card is played from your trash/i);if(eventTrait)action.trait=eventTrait[1]??eventTrait[2]??eventTrait[3];}
  if(conditions.length>0&&!/(?:during this battle|during this turn|until the end of)/i.test(text)&&(trigger==='continuous'||trigger==='unknown'))action.continuous=true;
  actions.push(action);
 }
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
 // In this printed pattern the initial “You may” applies to the complete
 // rest-DON + hand-trash package. Once the first payment is chosen, the
 // second payment is mandatory. Keep separate DON!! and hand choices intact.
 if(/\bYou may\s+rest\s+(?:\d+\s+of your DON!! cards?|this (?:Character|Stage))\s+and\s+trash\s+\d+\s+[^.:]*\bfrom your hand\s*:/i.test(text)){
  const handCost=costs.findIndex(cost=>cost.kind==='trash'&&cost.scope==='hand');
  if(handCost>0&&'optional'in costs[handCost])costs[handCost]={...costs[handCost],optional:false} as EffectCost;
 }
 if(/\bYou may\s+rest\s+\d+\s+of your DON!! cards?\s+and\s+trash this (?:Character|Stage)\s*:/i.test(text)){
  const selfCost=costs.findIndex(cost=>cost.kind==='trash'&&cost.scope==='self');
  if(selfCost>0&&'optional'in costs[selfCost])costs[selfCost]={...costs[selfCost],optional:false} as EffectCost;
 }
 return [{trigger,actions,costs,conditions,optional,source:text}];
}

/** Splits independently-triggered printed abilities before deriving their action schema. */
export function parseEffects(card:Card):ParsedEffect[]{
 // DON!! ×N is a qualifier for the timing window that follows it (most often
 // [When Attacking]); leaving it on the preceding clause incorrectly makes
 // the earlier On Play effect require attached DON!! instead.
 const text=(card.effect??'').replace(/^NULL$/i,'').trim().replace(/\[DON!!\s*([x×]\s*\d+)\]\s*(\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|Your Turn|Opponent's Turn|End of Your Turn|Once Per Turn)\])/gi,'$2 [DON!!$1]');
 if(!text)return [{trigger:'unknown',actions:[],costs:[],conditions:[],optional:false,source:''}];
 const separateDonClause=text.match(/^(.*?\.\s+)\[DON!!\s*[x×]\s*\d+\]\s*(?=If\b|This Character\b|Your Turn\b|Opponent's Turn\b)([\s\S]+)$/i);
 if(separateDonClause)return [...parseEffects({...card,effect:separateDonClause[1].trim()}),...parseEffects({...card,effect:text.slice(separateDonClause[1].length).trim()})];
 // A leading printed Blocker is a keyword ability in its own right, even when
 // the same card has a continuous clause or another timing immediately after it.
 const leadingBlocker=text.match(/^\[Blocker\](?:\s*\([^)]*\))?/i);
 if(leadingBlocker){const remainder=text.slice(leadingBlocker[0].length).trim();if(remainder)return [...parseEffectText(leadingBlocker[0]),...parseEffects({...card,effect:remainder})];}
 const boundaries=[...text.matchAll(/\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|Your Turn|Opponent's Turn|End of Your Turn|Once Per Turn)\]/gim)].filter(marker=>{
  const prefix=text.slice(0,marker.index),suffix=text.slice(marker.index!+marker[0].length);
  if(/Once Per Turn/i.test(marker[0]))return /\.\s*\n\s*$/.test(prefix)&&/^\s*When\b/i.test(suffix);
  const clausePrefix=prefix.replace(/\s*\([^)]*\)\s*$/,'');
  if(!/(?:^|[.\n])\s*$/.test(clausePrefix)&&!/^\[(?:Blocker|Rush|Double Attack|Banish)\]$/i.test(prefix.trim())&&!/^\[(?:Blocker|Rush|Double Attack|Banish)\]\s*\([^]*\)$/i.test(prefix.trim())&&!/^(?:\[(?:On Play|When Attacking|Activate\s*:\s*Main|Main|Counter|Trigger|On K\.O\.|On Block|On Your Opponent's Attack|Your Turn|Opponent's Turn|End of Your Turn|Once Per Turn|Blocker|Rush|Double Attack|Banish)\]\s*\/?\s*)+$/i.test(prefix.trim()))return false;
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
 const normalized=ast.map(effect=>{const actions=effect.actions.filter(action=>action.kind!=='attach-don-required'&&!effect.costs.some(cost=>(cost.kind==='trash'&&action.kind==='trash'&&cost.scope===action.scope&&cost.amount===action.amount&&Boolean(cost.requiresTrigger)===Boolean(action.requiresTrigger))||(cost.kind==='rest'&&cost.scope==='self'&&action.kind==='rest'&&action.scope==='self')||(cost.kind==='return-don'&&action.kind==='return-don'&&(action.owner??'self')==='self'&&cost.amount===action.amount)));return {timing:effect.trigger,optional:/\bYou may\b/i.test(effect.rawText),conditions:effect.conditions,sequence:[...effect.costs.map(cost=>({type:'PAY_COST' as const,cost})),...actions.map(action=>({type:'RESOLVE' as const,action}))]};});
 const implementationStatus:EffectImplementationStatus=resolver.type==='CUSTOM'?customResolverStatus(resolver.handler):'PARSED';
 return {rawEffectText,parserVersion:EFFECT_PARSER_VERSION,parseConfidence:custom?.65:rawEffectText?0.94:1,implementationStatus,ast,normalized,resolver};
}

export function requiredAttackDon(card:Card){return parseEffects(card).flatMap(effect=>effect.actions).find((action):action is Extract<EffectAction,{kind:'attach-don-required'}>=>action.kind==='attach-don-required')?.amount??0;}
