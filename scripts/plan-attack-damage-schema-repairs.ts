import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compileEffectDocument,type EffectDocument} from '../packages/domain/effect-rules';
import {publishedActionScenarios,scenarios,type Identity} from './card-effect-scenarios';
import type {Card} from '../packages/card-data/catalog';

type Report={summary:{ruleset:{id:string}};cards:Array<{code:string;name:string;color:string;cardType:Identity['card_type'];cost:number;power:number;printedText:string;publishedText:string|null;databaseSchema:EffectDocument|null}>};
const report=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as Report;
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const candidateCodes=new Set(['OP03-040','P-117']);
const candidates=[];
for(const row of report.cards.filter(card=>candidateCodes.has(card.code))){
 if(!row.databaseSchema||!row.publishedText||row.printedText!==row.publishedText)throw new Error(`${row.code}: printed text or published baseline is unavailable.`);
 const after=compileEffectDocument({code:row.code,name:row.name,type:row.cardType,color:row.color,cost:row.cost,power:row.power,effect:row.printedText} as unknown as Card);
 const nonDamageText=row.printedText.split(/\n(?=\[DON!!\s*[x×]\s*\d+\]\s*When (?:this (?:Leader|Character)'s attack|you) deals damage to your opponent's Life\b)/i)[0].trim();
 const beforeCombined=row.databaseSchema.ast.find(ability=>ability.rawText===row.printedText&&ability.trigger==='unknown');
 const afterReplacement=after.ast.find(ability=>ability.actions.some(action=>action.kind==='deck-out-replacement'));
 if(!beforeCombined||!afterReplacement||!nonDamageText||afterReplacement.rawText!==nonDamageText||!afterReplacement.actions.some(action=>action.kind==='deck-out-replacement'))throw new Error(`${row.code}: the existing non-damage rule cannot be preserved exactly; refusing a partial publication.`);
 const attackDamage=after.ast.find(ability=>ability.trigger==='attack-damage');
 const attackDamageExecution=after.normalized.find(window=>window.timing==='attack-damage');
 if(!attackDamage||!attackDamage.actions.some(action=>action.kind==='trash')||!attackDamageExecution?.optional)throw new Error(`${row.code}: the optional attack-damage sequence was not parsed as printed.`);
 const identity={code:row.code,name:row.name,color:row.color,card_type:row.cardType,cost:row.cost,power:row.power,effect_text:row.printedText} as Identity;
 const cardScenarios=[...scenarios(identity),...publishedActionScenarios(identity,after)];
 for(const scenario of cardScenarios){try{scenario.run(after);}catch(error){throw new Error(`${row.code}: scenario failed: ${scenario.name}: ${error instanceof Error?error.message:String(error)}`);}}
 candidates.push({code:row.code,printedText:row.printedText,publishedText:row.publishedText,timings:after.ast.map(item=>item.trigger),scenarioNames:cardScenarios.map(item=>item.name),scenarioCount:cardScenarios.length,before:row.databaseSchema,beforeHash:hash(row.databaseSchema),after,afterHash:hash(after)});
}
if(candidates.length!==candidateCodes.size)throw new Error('Not every targeted attack-damage card was audited.');
const output=`reports/effects/publication/attack-damage-${new Date().toISOString().replaceAll(':','-').replaceAll('.','-')}.json`;
writeFileSync(output,JSON.stringify({rulesetId:report.summary.ruleset.id,createdAt:new Date().toISOString(),candidates},null,2));
console.log(JSON.stringify({plan:output,cards:candidates.length,scenarios:candidates.reduce((total,item)=>total+item.scenarioCount,0)}));
