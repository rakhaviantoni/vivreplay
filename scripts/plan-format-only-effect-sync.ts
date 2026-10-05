import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scenarios,type Identity} from './card-effect-scenarios';
import type {EffectDocument} from '../packages/domain/effect-rules';

type AuditCard={code:string;printedText:string;publishedText:string|null;textMatches:boolean;localSchema:EffectDocument;databaseSchema:EffectDocument|null;databaseScenarios:Array<{name:string;status:string}>};
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string;code:string}};cards:AuditCard[]};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
// Only normalize typography and whitespace; leave every word, numeral, type, and symbol meaning intact.
const numberSymbols:Record<string,string>={'①':'(1)','➀':'(1)','❶':'(1)','➊':'(1)','②':'(2)','➁':'(2)','❷':'(2)','➋':'(2)','③':'(3)','➂':'(3)','❸':'(3)','➌':'(3)','④':'(4)','➃':'(4)','❹':'(4)','➍':'(4)','⑤':'(5)','➄':'(5)','❺':'(5)','➎':'(5)'};
const formattingOnly=(value:string)=>value.replace(/[−–—]/g,'-').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/Activate:\s*Main/gi,'Activate: Main').replace(/[{}<>]/g,mark=>mark==='{'||mark==='<'?'[':']').replace(/"([^"\n]+)"(?=\s+type)/g,'[$1]').replace(/[①➀❶➊②➁❷➋③➂❸➌④➃❹➍⑤➄❺➎]/g,mark=>numberSymbols[mark]).replace(/\s+/g,' ').replace(/([.!?])(?=\[(?:On Play|On K\.?O\.?|When Attacking|Counter|Main|Trigger|Activate:|Opponent|Your Turn|End of))/gi,'$1 ').trim().replace(/\s*([.,:;])/g,'$1');
const candidates:Array<Record<string,unknown>>=[];
const skipped:Record<string,number>={};
const skip=(reason:string)=>{skipped[reason]=(skipped[reason]??0)+1;};

for(const card of snapshot.cards){
 const before=card.databaseSchema;
 if(!before||card.textMatches||!card.publishedText)continue;
 if(formattingOnly(card.printedText)!==formattingOnly(card.publishedText)){skip('wording-or-semantic-text-difference');continue;}
 if(card.localSchema.resolver.type!=='DSL'||before.resolver.type!=='DSL'||card.localSchema.implementationStatus!=='PARSED'){skip('custom-or-unparsed-resolver');continue;}
 const cardScenarios=scenarios({code:card.code,effect_text:card.printedText} as Identity);
 if(!cardScenarios.length){skip('no-card-scenarios');continue;}
 const after=structuredClone(card.localSchema),scenarioNames:string[]=[];
 try{for(const scenario of cardScenarios){scenario.run(after);scenarioNames.push(scenario.name);}}catch{skip('local-scenario-failed');continue;}
 const d1Passing=card.databaseScenarios.filter(item=>item.status==='PASS').map(item=>item.name);
 if(d1Passing.some(name=>!scenarioNames.includes(name))){skip('would-regress-d1-passing-scenario');continue;}
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,effectTextAfter:card.printedText,timings:[...new Set(after.ast.map(item=>item.trigger))],scenarioNames,scenarioCount:scenarioNames.length,before,after,beforeHash:hash(before),afterHash:hash(after),patchKind:'FORMATTING_ONLY_TEXT_AND_VERIFIED_DSL_SCHEMA'});
}

mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/format-only-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,scenarios:candidates.reduce((sum,item)=>sum+Number(item.scenarioCount),0),skipped}));
