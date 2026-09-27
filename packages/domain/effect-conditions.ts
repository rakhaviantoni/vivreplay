import type {MatchEffectState, PlayerId} from './match-effect-state';

export function evaluateEffectCondition(text:string,state:MatchEffectState,actor:PlayerId):boolean|undefined {
 const own=state.cards.filter(card=>card.owner===actor),enemy=state.cards.filter(card=>card.owner!==actor);
 const leader=own.find(card=>card.zone==='leader');
 const parts=text.split(/\s+and\s+/i);
 if(parts.length>1){const results=parts.map(part=>evaluateEffectCondition(part,state,actor));return results.includes(false)?false:results.includes(undefined)?undefined:true;}
 const name=text.match(/^your Leader is \[([^\]]+)\]$/i);
 if(name)return leader?.name?.toLowerCase()===name[1].toLowerCase();
 const trait=text.match(/^your Leader (?:has the [\[{"]([^\]}" ]+(?: [^\]}" ]+)*)[\]}" ] type|type includes "([^"]+)")$/i);
 if(trait)return Boolean(leader?.traits?.some(value=>value.toLowerCase()===(trait[1]??trait[2]).toLowerCase()));
 if(/^your Leader is multicolored$/i.test(text))return (leader?.color?.split(/[\s/]+/).filter(Boolean).length??0)>1;
 if(/^the number of DON!! cards on your field is equal to or less than the number on your opponent's field$/i.test(text)){
  const field=(cards:typeof own)=>cards.filter(card=>card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;
  return field(own)<=field(enemy);
 }
 const threshold=text.match(/^(you have|your opponent has) (\d+) or (less|more) (Life cards|cards in your hand|cards in their hand|cards in your trash|DON!! cards on your field|rested Characters)$/i);
 if(threshold){const pool=threshold[1].toLowerCase()==='you have'?own:enemy;const subject=threshold[4].toLowerCase();const count=pool.filter(card=>subject==='life cards'?card.zone==='life':subject.includes('hand')?card.zone==='hand':subject.includes('trash')?card.zone==='trash':subject==='rested characters'?card.zone==='character'&&card.rested:card.type==='DON!!'&&(card.zone==='cost-area'||Boolean(card.attachedTo))).length;return threshold[3].toLowerCase()==='less'?count<=Number(threshold[2]):count>=Number(threshold[2]);}
 return undefined;
}
