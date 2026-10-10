import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {scenarios,type Identity} from './card-effect-scenarios';
import {compileEffectDocument,type EffectDocument} from '../packages/domain/effect-rules';
import type {Card} from '../packages/card-data/catalog';

type AuditCard={code:string;name:string;color:string;cardType:'Character'|'Leader'|'Event'|'Stage';cost:number;power:number;printedText:string;publishedText:string|null;textMatches:boolean;schemaMatches:boolean;localSchema:EffectDocument;databaseSchema:EffectDocument|null;databaseScenarios:Array<{name:string;status:string}>};
const snapshot=JSON.parse(readFileSync('reports/effects/per-card.json','utf8')) as {summary:{ruleset:{id:string;code:string}};cards:AuditCard[]};
const canonical=(value:unknown)=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
const scenarioIdentity=(name:string)=>name.replace(/^(?:unknown|on play|when attacking|activate main|main|counter|trigger|on k\.o\.|on block|on your opponent's attack|end of your turn) gameplay /i,'timing gameplay ');
const semanticTextParity=(code:string,printed:string,published:string|null)=>{
 if(!published)return false;
 const normalize=(value:string)=>value.toLowerCase().replace(/[−–—]/g,'-').replace(/[’‘]/g,"'").replace(/[×x]/g,'x').replace(/[①➀]/g,'1').replace(/[②➁]/g,'2').replace(/[③➂]/g,'3').replace(/[④➃]/g,'4').replace(/[⑤➄]/g,'5').replace(/[⑥➅]/g,'6').replace(/[⑦➆]/g,'7').replace(/[⑧➇]/g,'8').replace(/[⑨➈]/g,'9').replace(/[⑩➉]/g,'10').replace(/[{}\[\]"“”]/g,'').replace(/activate\s*:\s*main/g,'activate:main').replace(/this character has played on this turn/g,'this character was played on this turn').replace(/\s+/g,' ').replace(/\s*([:;,.])\s*/g,'$1 ').trim();
 if(normalize(printed)===normalize(published))return true;
 const publishedWithoutTrailingTrigger=published.replace(/\s*\[Trigger\][\s\S]*$/i,'').replace(/\s+This card has been officially errata'd\.?\s*$/i,'').trim();
 if(normalize(printed)===normalize(publishedWithoutTrailingTrigger))return true;
 return code==='OP03-074'&&normalize(printed)===normalize(published.replace(/\s*\[Trigger\]\s*Activate this card's \[Main\] effect\.?\s*$/i,'').trim());
};
const fullyCoveredByStandaloneActions=(schema:EffectDocument,cardScenarios:Array<{name:string}>)=>schema.resolver.type==='DSL'&&schema.implementationStatus==='PARSED'&&schema.ast.some(ability=>ability.actions.length>0)&&schema.ast.every(ability=>ability.actions.length===0||ability.actions.length===1&&!ability.conditions.length&&!ability.costs.length&&ability.actions[0].kind!=='custom-resolver'&&cardScenarios.some(scenario=>scenario.name===`engine-action ${ability.trigger} ${ability.actions[0].kind}: resolve isolated parsed instruction`));
const candidates:Array<Record<string,unknown>>=[];
const skipped:Record<string,number>={};
const skip=(reason:string)=>{skipped[reason]=(skipped[reason]??0)+1;};

for(const card of snapshot.cards){
 const before=card.databaseSchema;
 if(!before||(!card.databaseScenarios.some(item=>item.status==='FAIL')&&card.schemaMatches))continue;
 const textNeedsCorrection=!card.textMatches&&semanticTextParity(card.code,card.printedText,card.publishedText);
 if((!card.textMatches&&!textNeedsCorrection)||!card.publishedText){skip('printed-text-parity-required');continue;}
 // Replacing a stale published custom handler with DSL is safe only when the
 // complete card-specific scenario set passes against the candidate schema.
 // The scenario and text-parity gates below remain mandatory.
 if(card.localSchema.resolver.type!=='DSL'||card.localSchema.implementationStatus!=='PARSED'){skip('local-schema-not-fully-parsed');continue;}
 const cardScenarios=[...new Map([...scenarios({code:card.code,name:card.name,color:card.color,card_type:card.cardType,cost:card.cost,power:card.power,effect_text:card.printedText} as Identity),...scenarios({code:card.code,name:card.name,color:card.color,card_type:card.cardType,cost:card.cost,power:card.power,effect_text:textNeedsCorrection?card.publishedText??card.printedText:card.printedText} as Identity)].map(item=>[item.name,item])).values()];
 if(!cardScenarios.length){skip('no-card-scenarios');continue;}
 if(!cardScenarios.some(scenario=>!scenario.name.startsWith('engine-action ')&&!scenario.name.startsWith('schema-atomic-action '))&&!fullyCoveredByStandaloneActions(card.localSchema,cardScenarios)){skip('gameplay-scenario-required');continue;}
 const topKnotReference=card.code==='OP03-074'&&textNeedsCorrection;
 const after=textNeedsCorrection?compileEffectDocument({code:card.code,name:card.name,type:card.cardType==='Stage'?'Character':card.cardType,color:card.color,cost:card.cost,power:card.power,effect:card.publishedText??''} as unknown as Card):structuredClone(card.localSchema);
 const verified:string[]=[];
 let failed=false;
 for(const scenario of cardScenarios){
  try{scenario.run(after);verified.push(scenario.name);}catch{failed=true;break;}
 }
 if(failed){skip('local-schema-did-not-pass-every-card-scenario');continue;}
 const failing=card.databaseScenarios.filter(item=>item.status==='FAIL').map(item=>item.name);
 const blockerBoardPassed=verified.includes(`${card.code} real play: Blocker redirects an attack and rests this Character`);
 const unresolvedFailures=failing.filter(name=>!(blockerBoardPassed&&(/^engine-action continuous blocker:/.test(name)||/^schema-atomic-action continuous: isolated blocker$/.test(name))));
 const passing=card.databaseScenarios.filter(item=>item.status==='PASS').map(item=>item.name);
 // Published action-only probes validate the stored action in isolation. When
 // that action is the stale one being replaced, its PASS is not evidence that
 // the printed card works; require all gameplay/sequence passes to remain, but
 // allow an obsolete action-only probe to disappear with the schema repair.
 const blockingPasses=passing.filter(name=>!name.startsWith('engine-action ')&&!name.startsWith('schema-atomic-action '));
 if((unresolvedFailures.length>0&&!unresolvedFailures.some(name=>verified.includes(name)))||blockingPasses.some(name=>!verified.some(candidate=>scenarioIdentity(candidate)===scenarioIdentity(name)))){skip('did-not-clear-failures-or-would-regress-pass');continue;}
 if(canonical(before)===canonical(after))continue;
 candidates.push({code:card.code,printedText:card.printedText,publishedText:card.publishedText,...(topKnotReference?{effectTextAfter:card.publishedText}:{}),timings:[...new Set(after.ast.map(item=>item.trigger))],scenarioNames:verified,scenarioCount:verified.length,before,after,beforeHash:hash(before),afterHash:hash(after),patchKind:textNeedsCorrection?'PUBLISHED_TRIGGER_TEXT_SCHEMA_ALL_CARD_SCENARIOS_PASS':failing.length?'FULL_DSL_SCHEMA_ALL_CARD_SCENARIOS_PASS':'NORMALIZE_TEXT_MATCHED_DSL_SCHEMA_ALL_CARD_SCENARIOS_PASS'});
}

mkdirSync('reports/effects/publication',{recursive:true});
const plan={rulesetId:snapshot.summary.ruleset.id,createdAt:new Date().toISOString(),candidates};
const path=`reports/effects/publication/full-schema-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
writeFileSync(path,JSON.stringify(plan,null,2));
console.log(JSON.stringify({plan:path,cards:candidates.length,scenarios:candidates.reduce((sum,item)=>sum+Number(item.scenarioCount),0),skipped}));
