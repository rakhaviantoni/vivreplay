import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {compileEffectDocument,type EffectDocument} from '../packages/domain/effect-rules';
const input=JSON.parse(readFileSync('/tmp/vivreplay-schema-refresh.json','utf8')) as {rulesetId:string;changes:Array<{identityId:string;code:string;before:EffectDocument;after:EffectDocument}>};
const canonical=(value:unknown):string=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const cards=input.changes.map(row=>{
 const after=compileEffectDocument({id:row.identityId,code:row.code,name:'',type:'Character',color:'',cost:0,power:0,counter:0,rarity:'',art:0,effect:row.after.rawEffectText});
 const timings=after.ast.map(effect=>({timing:effect.trigger,text:effect.rawText,conditions:effect.conditions,actions:effect.actions,costs:effect.costs,verification:'NOT_GAMEPLAY_VERIFIED'}));
 return {code:row.code,identityId:row.identityId,changed:canonical(row.before.ast)!==canonical(after.ast)||canonical(row.before.normalized)!==canonical(after.normalized),publication:'BLOCKED_PENDING_GAMEPLAY_VERIFICATION',timings};
});
mkdirSync('reports/effects',{recursive:true});
writeFileSync('reports/effects/candidates.json',JSON.stringify({rulesetId:input.rulesetId,databaseWrites:0,cards},null,2));
const lines=['# Candidate effect review','','These are parser candidates, not certified gameplay rules. No published records were changed.','',`Cards compared: ${cards.length}. Semantically changed schemas: ${cards.filter(card=>card.changed).length}.`,'','| Card | Timing | Conditions | Actions | Gameplay verification |','| --- | --- | --- | --- | --- |'];
for(const card of cards)for(const timing of card.timings)lines.push(`| ${card.code} | ${timing.timing} | ${timing.conditions.length} | ${timing.actions.map(action=>action.kind).join(', ')} | Not verified |`);
writeFileSync('reports/effects/candidates.md',lines.join('\n')+'\n');
console.log(JSON.stringify({cards:cards.length,changed:cards.filter(card=>card.changed).length,timings:cards.reduce((n,card)=>n+card.timings.length,0),databaseWrites:0}));
