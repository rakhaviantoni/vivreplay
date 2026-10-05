import type {MatchEffectState, PlayerId} from './match-effect-state';

export function evaluateEffectCondition(text:string,state:MatchEffectState,actor:PlayerId,sourceCardId?:string):boolean|undefined {
 const own=state.cards.filter(card=>card.owner===actor),enemy=state.cards.filter(card=>card.owner!==actor);
 const leader=own.find(card=>card.zone==='leader');
 if(/^the revealed card is an Event$/i.test(text)){const id=state.revealedCardIds?.at(-1);return id?state.cards.find(card=>card.id===id)?.type==='Event':false;}
 if(/^it is your opponent's turn$/i.test(text))return state.turn!==actor;
 if(/^it is your turn$/i.test(text))return state.turn===actor;
 if(/^this Character is rested$/i.test(text))return Boolean(state.cards.find(card=>card.id===sourceCardId)?.rested);
 if(/^this Character is active$/i.test(text))return Boolean(sourceCardId&&state.cards.find(card=>card.id===sourceCardId)&&!state.cards.find(card=>card.id===sourceCardId)?.rested);
 if(/^this Character was played on this turn$/i.test(text))return Boolean(sourceCardId&&(state.playedThisTurn??[]).includes(sourceCardId));
 const namedTrashCards=text.match(/^you have \[([^\]]+)\] and \[([^\]]+)\] in your trash$/i);
 if(namedTrashCards)return [namedTrashCards[1],namedTrashCards[2]].every(name=>own.some(card=>card.zone==='trash'&&card.name?.toLowerCase()===name.toLowerCase()));
 const parts=text.split(/\s+and\s+/i);
 if(parts.length>1){const results=parts.map(part=>evaluateEffectCondition(part,state,actor,sourceCardId));return results.includes(false)?false:results.includes(undefined)?undefined:true;}
 const name=text.match(/^your Leader is \[([^\]]+)\]$/i);
 if(name)return leader?.name?.toLowerCase()===name[1].toLowerCase();
 const namedCharacter=text.match(/^you have (?:a )?\[([^\]]+)\](?: or \[([^\]]+)\])? Character$/i);
 if(namedCharacter){const names=namedCharacter.slice(1).filter(Boolean).map(value=>value!.toLowerCase());return own.some(card=>card.zone==='character'&&names.includes(card.name?.toLowerCase()??''));}
 const namedCard=text.match(/^you have \[([^\]]+)\]$/i);
 if(namedCard)return own.some(card=>(card.zone==='character'||card.zone==='leader')&&card.name?.toLowerCase()===namedCard[1].toLowerCase());
 const ownedCharacterCost=text.match(/^you have a Character with a cost of (\d+)(?: or (less|more))?$/i);
 if(ownedCharacterCost){const limit=Number(ownedCharacterCost[1]),comparison=ownedCharacterCost[2]?.toLowerCase();return own.some(card=>card.zone==='character'&&(comparison==='less'?Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=limit:comparison==='more'?Math.max(0,(card.cost??-Infinity)+(card.costModifier??0))>=limit:Math.max(0,(card.cost??Infinity)+(card.costModifier??0))===limit));}
 const noOtherNamedCharacter=text.match(/^you have no other \[([^\]]+)\] Characters?$/i);
 if(noOtherNamedCharacter)return !own.some(card=>card.zone==='character'&&card.id!==sourceCardId&&card.name?.toLowerCase()===noOtherNamedCharacter[1].toLowerCase());
 const fieldCharacterCost=text.match(/^there is a Character with a cost of (\d+)(?: or (less|more))?$/i);
 if(fieldCharacterCost){const limit=Number(fieldCharacterCost[1]),comparison=fieldCharacterCost[2]?.toLowerCase();return state.cards.some(card=>card.zone==='character'&&(comparison==='less'?Math.max(0,(card.cost??Infinity)+(card.costModifier??0))<=limit:comparison==='more'?Math.max(0,(card.cost??-Infinity)+(card.costModifier??0))>=limit:Math.max(0,(card.cost??Infinity)+(card.costModifier??0))===limit));}
 const opponentCharacterCost=text.match(/^your opponent has a Character with a cost of (\d+)(?: or (less|more))?$/i);
 if(opponentCharacterCost){const limit=Number(opponentCharacterCost[1]),comparison=opponentCharacterCost[2]?.toLowerCase();return enemy.some(card=>card.zone==='character'&&(comparison==='less'?(card.cost??Infinity)<=limit:comparison==='more'?(card.cost??-Infinity)>=limit:(card.cost??Infinity)===limit));}
 const trait=text.match(/^your Leader (?:has the [\[{"]([^\]}" ]+(?: [^\]}" ]+)*)[\]}" ] type|type includes "([^"]+)")$/i);
 if(trait)return Boolean(leader?.traits?.some(value=>value.toLowerCase()===(trait[1]??trait[2]).toLowerCase()));
 const onlyTrait=text.match(/^you only have Characters? with a type including "([^"]+)"$/i);
 if(onlyTrait){const characters=own.filter(card=>card.zone==='character');return characters.length>0&&characters.every(card=>card.traits?.some(value=>value.toLowerCase()===onlyTrait[1].toLowerCase()));}
 const leaderAttribute=text.match(/^your Leader has the \(?(Slash|Ranged|Wisdom|Strike|Special)\)? attribute$/i);
 if(leaderAttribute)return Boolean(leader?.attributes?.some(value=>value.toLowerCase()===leaderAttribute[1].toLowerCase()));
 const apostropheTrait=text.match(/^your Leader's type includes ["']([^"']+)["']$/i);
 if(apostropheTrait)return Boolean(leader?.traits?.some(value=>value.toLowerCase()===apostropheTrait[1].toLowerCase()));
 if(/^your Leader is multicolored$/i.test(text))return (leader?.color?.split(/[\s/]+/).filter(Boolean).length??0)>1;
 const eitherDon=text.match(/^either you or your opponent has (\d+) DON!! cards on the field$/i);
 if(eitherDon){const count=(cards:typeof own)=>cards.filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;return count(own)>=Number(eitherDon[1])||count(enemy)>=Number(eitherDon[1]);}
 if(/^either you or your opponent has 0 Life cards$/i.test(text))return own.every(card=>card.zone!=='life')||enemy.every(card=>card.zone!=='life');
 const exactDon=text.match(/^you have (\d+) DON!! cards on your field$/i);
 if(exactDon)return own.filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length===Number(exactDon[1]);
 if(/^you have any DON!! cards on your field$/i.test(text))return own.some(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo)));
 const characterThreshold=text.match(/^(you have|your opponent has) (\d+) or (less|more) Characters?$/i);
 if(characterThreshold){const pool=characterThreshold[1].toLowerCase()==='you have'?own:enemy,count=pool.filter(card=>card.zone==='character').length;return characterThreshold[3].toLowerCase()==='less'?count<=Number(characterThreshold[2]):count>=Number(characterThreshold[2]);}
 const poweredCharacterThreshold=text.match(/^(you have|your opponent has) (\d+) or more Characters? with a base power of (\d+) or more$/i);
 if(poweredCharacterThreshold){const pool=poweredCharacterThreshold[1].toLowerCase()==='you have'?own:enemy;return pool.filter(card=>card.zone==='character'&&(card.power??0)>=Number(poweredCharacterThreshold[3])).length>=Number(poweredCharacterThreshold[2]);}
 const characterCountLimit=text.match(/^you have (\d+) or (less|more) Characters?$/i);
 if(characterCountLimit){const count=own.filter(card=>card.zone==='character').length,limit=Number(characterCountLimit[1]);return characterCountLimit[2].toLowerCase()==='less'?count<=limit:count>=limit;}
 const boardPower=text.match(/^your opponent has a Leader or Character with a base power of (\d+) or more$/i);
 if(boardPower)return enemy.some(card=>(card.zone==='leader'||card.zone==='character')&&(card.power??0)>=Number(boardPower[1]));
 const anyCharacterPower=text.match(/^there is a Character with (\d+) base power or more$/i);
 if(anyCharacterPower)return state.cards.some(card=>card.zone==='character'&&(card.power??0)>=Number(anyCharacterPower[1]));
 if(/^all (?:of )?your DON!! cards are rested$/i.test(text)){const dons=own.filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo)));return dons.length>0&&dons.every(card=>card.rested);}
 if(/^the number of DON!! cards on your field is equal to or less than the number on your opponent's field$/i.test(text)){
  const field=(cards:typeof own)=>cards.filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;
  return field(own)<=field(enemy);
 }
 const threshold=text.match(/^(you have|your opponent has) (\d+) or (less|more) (Life cards|cards in your hand|cards in their hand|cards in your trash|DON!! cards on your field|rested Characters)$/i);
 if(threshold){const pool=threshold[1].toLowerCase()==='you have'?own:enemy;const subject=threshold[4].toLowerCase();const count=pool.filter(card=>subject==='life cards'?card.zone==='life':subject.includes('hand')?card.zone==='hand':subject.includes('trash')?card.zone==='trash':subject==='rested characters'?card.zone==='character'&&card.rested:card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;return threshold[3].toLowerCase()==='less'?count<=Number(threshold[2]):count>=Number(threshold[2]);}
 return undefined;
}
