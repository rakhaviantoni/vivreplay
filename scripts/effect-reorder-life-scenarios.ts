import {compileEffectDocument,type EffectAction,type EffectDocument} from '../packages/domain/effect-rules';
import {applyEffectAction,type MatchEffectState} from '../packages/domain/match-effect-state';
import {advanceEffectExecution,beginEffectExecution} from '../packages/domain/effect-controller';
import {resolveEffectTiming} from '../packages/domain/effect-runtime';

type Row={id:string;code:string;name:string;color:string;effect_text:string;card_type:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number};
type Scenario={name:string;run:(document:EffectDocument)=>void};
const assert=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};

/** Exercise the shared Life-ordering mechanic with exact owner and ordering checks. */
export function reorderLifeScenarios(row:Row):Scenario[]{
 const actions:Array<{timing:string;timingIndex:number;action:Extract<EffectAction,{kind:'reorder-life'}>}>=[];
 const text=row.effect_text;
 if(!/\b(?:Life cards|Life area)\b/i.test(text))return [];
 const local=compileEffectDocument({id:row.id,code:row.code,name:row.name,color:row.color,type:row.card_type==='Stage'?'Character':row.card_type,cost:row.cost,power:row.power,counter:0,rarity:'',art:0,effect:row.effect_text});
 for(const ability of local.ast){let timingIndex=0;for(const action of ability.actions)if(action.kind==='reorder-life')actions.push({timing:ability.trigger,timingIndex:timingIndex++,action});}
 const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 const generated:Scenario[]=actions.map(({timing,timingIndex,action})=>({name:`${row.code} ${timing}: reorder the exact inspected Life cards without touching the rest`,run(document:EffectDocument){
  const ability=document.ast.filter(item=>item.trigger===timing)[timingIndex];
  assert(Boolean(ability),'Published Life-reorder timing window is missing');
  const actual=ability!.actions.find(item=>item.kind==='reorder-life');
  assert(Boolean(actual)&&canonical(actual)===canonical(action),'Published Life-reorder scope or amount differs from the parsed card text');
  const makeState=(owner:'player'|'opponent'):MatchEffectState=>({turn:'player',cards:[
   ...Array.from({length:6},(_,i)=>({id:`${owner}-life-${i}`,owner,zone:'life' as const,type:'Character' as const})),
   ...Array.from({length:2},(_,i)=>({id:`${owner}-deck-${i}`,owner,zone:'deck' as const,type:'Character' as const})),
   {id:'untouched-life',owner:owner==='player'?'opponent':'player',zone:'life',type:'Character'},
  ],turnEffects:[],restrictions:[],delayed:[]});
  const owners=action.scope==='own'?['player'] as const:action.scope==='opponent'?['opponent'] as const:['player','opponent'] as const;
  for(const owner of owners){
   const state=makeState(owner),life=state.cards.filter(card=>card.owner===owner&&card.zone==='life'),inspected=action.amount==='all'?life:life.slice(0,action.amount);
   if(!inspected.length)continue;
   const order=inspected.map(card=>card.id).reverse();
   const missing=applyEffectAction(state,'player',action,{owner});
   assert(Boolean(missing.requiresSelection),'Life ordering did not request an explicit ordering choice');
   const invalidOrder=inspected.length===1?[]:Array(inspected.length).fill(order[0]);
   const duplicate=applyEffectAction(state,'player',action,{owner,cardIds:invalidOrder});
   assert(Boolean(duplicate.error),'Life ordering accepted duplicate or incomplete selections');
   const ordered=applyEffectAction(state,'player',action,{owner,cardIds:order});
   assert(!ordered.error&&!ordered.requiresSelection,'A complete valid Life order was rejected');
   if(action.moveFirstToDeckTop){
    assert(ordered.state.cards.find(card=>card.id===order[0])?.zone==='deck','The selected first Life card was not moved to the deck top');
    assert(ordered.state.cards.filter(card=>card.owner===owner&&card.zone==='life').map(card=>card.id).join(',')===order.slice(1).join(','),'Remaining Life cards do not match the chosen order');
   }else {
    const expected=[...order,...life.filter(card=>!inspected.some(item=>item.id===card.id)).map(card=>card.id)];
    assert(ordered.state.cards.filter(card=>card.owner===owner&&card.zone==='life').map(card=>card.id).join(',')===expected.join(','),'Life cards do not match the chosen order or preserve uninspected cards');
   }
   assert(ordered.state.cards.find(card=>card.id==='untouched-life')?.zone==='life','Life reordering changed the other player’s Life area');
  }
 }}));
 if(row.code==='ST13-004')generated.push({name:'ST13-004 On Play: add the top deck card to Life, then return the chosen Life card to deck top',run(document:EffectDocument){
  const ability=document.ast.filter(item=>item.trigger==='on-play');
  assert(ability.length===1&&ability[0].actions.length===2,'On Play must contain the deck-to-Life move followed by Life reordering');
  const [add,order]=ability[0].actions;
  assert(add.kind==='move-to-life'&&add.source==='deck-top'&&add.amount===1&&add.position==='top','First instruction must move exactly the top deck card onto Life');
  assert(order.kind==='reorder-life'&&order.scope==='own'&&order.amount==='all'&&order.moveFirstToDeckTop,'Second instruction must reorder all Life and put the chosen first card on deck top');
  const state:MatchEffectState={turn:'player',cards:[...Array.from({length:3},(_,i)=>({id:`life-${i}`,owner:'player' as const,zone:'life' as const,type:'Character' as const})),{id:'deck-top',owner:'player',zone:'deck',type:'Character'},{id:'deck-next',owner:'player',zone:'deck',type:'Character'}],turnEffects:[],restrictions:[],delayed:[]};
  const started=beginEffectExecution(state,'player','st13-004','on-play',resolveEffectTiming(document,'on-play').commands);assert(started.requiresSelection,'The top deck card must be selected for the Life move');
  const moved=advanceEffectExecution(started.execution,{cardIds:['deck-top']});assert(moved.requiresSelection&&!moved.error,'Life ordering must follow the deck-to-Life move');
  const ordered=advanceEffectExecution(moved.execution,{cardIds:['life-1','deck-top','life-0','life-2']});assert(ordered.complete&&!ordered.error,'Complete Life order did not resolve');
  assert(ordered.execution.state.cards.find(card=>card.id==='life-1')?.zone==='deck','The chosen first Life card did not move to deck top');
  assert(ordered.execution.state.cards.filter(card=>card.owner==='player'&&card.zone==='life').map(card=>card.id).join(',')==='deck-top,life-0,life-2','Remaining Life cards did not retain the chosen order');
  assert(ordered.execution.state.cards.filter(card=>card.owner==='player'&&card.zone==='deck').map(card=>card.id).join(',')==='life-1,deck-next','The returned card was not placed above the remaining deck');
 }});
 return generated;
}
