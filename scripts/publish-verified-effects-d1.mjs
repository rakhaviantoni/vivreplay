import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';

const planPath=process.argv.find(value=>value.startsWith('--plan='))?.slice('--plan='.length);
if(!planPath)throw new Error('Pass --plan=reports/effects/publication/<verified-plan>.json');
const plan=JSON.parse(readFileSync(planPath,'utf8'));
const quote=value=>`'${String(value).replaceAll("'","''")}'`;
const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
const hash=value=>createHash('sha256').update(canonical(value)).digest('hex');
const run=sql=>{
 const output=execFileSync('node_modules/.bin/wrangler',['d1','execute','vivreplay','--remote','--config','dist/server/wrangler.json','--json','--command',sql],{encoding:'utf8',maxBuffer:32*1024*1024});
 const result=JSON.parse(output)[0];if(!result?.success)throw new Error(result?.error?.text??'D1 operation failed.');return result.results??[];
};
const rulesetId=plan.rulesetId;
const results=[];
for(const candidate of plan.candidates){
 const rows=run(`SELECT i.id,i.effect_text,r.effect_text AS published_text,r.effect_schema FROM tcg_card_identities i LEFT JOIN tcg_card_rule_revisions r ON r.identity_id=i.id AND r.ruleset_id=${quote(rulesetId)} WHERE i.code=${quote(candidate.code)} LIMIT 1`);
 const current=rows[0];if(!current)throw new Error(`${candidate.code}: active D1 ruleset row is missing.`);
 const schema=typeof current.effect_schema==='string'?JSON.parse(current.effect_schema):current.effect_schema??null;
 if(current.effect_text!==candidate.printedText||current.published_text!==candidate.publishedText||hash(schema)!==candidate.beforeHash)throw new Error(`${candidate.code}: D1 changed since this verified plan was made.`);
 const write=candidate.before===null
  ?`INSERT INTO tcg_card_rule_revisions (ruleset_id,identity_id,effect_text,effect_schema,errata_reference,source_url) VALUES (${quote(rulesetId)},${quote(current.id)},${quote(candidate.effectTextAfter??candidate.printedText)},${quote(JSON.stringify(candidate.after))},NULL,'https://en.onepiece-cardgame.com/cardlist/')`
  :`UPDATE tcg_card_rule_revisions SET effect_text=${quote(candidate.effectTextAfter??candidate.printedText)},effect_schema=${quote(JSON.stringify(candidate.after))} WHERE ruleset_id=${quote(rulesetId)} AND identity_id=${quote(current.id)} AND effect_text=${quote(current.published_text)}`;
 if(process.argv.includes('--apply'))run(write);
 const readback=run(`SELECT effect_text,effect_schema FROM tcg_card_rule_revisions WHERE ruleset_id=${quote(rulesetId)} AND identity_id=${quote(current.id)} LIMIT 1`)[0];
 const readSchema=typeof readback?.effect_schema==='string'?JSON.parse(readback.effect_schema):readback?.effect_schema;
 if(!readback||readback.effect_text!==(candidate.effectTextAfter??candidate.printedText)||hash(readSchema)!==candidate.afterHash)throw new Error(`${candidate.code}: D1 readback does not match the verified schema.`);
 results.push({code:candidate.code,status:process.argv.includes('--apply')?'PUBLISHED_AND_READBACK_TESTED':'DRY_RUN_READBACK_MATCHED'});
}
const outputPath=planPath.replace(/\.json$/,'')+'.d1-results.json';writeFileSync(outputPath,JSON.stringify(results,null,2));
console.log(JSON.stringify({results:results.length,cards:results.map(item=>item.code),outputPath,apply:process.argv.includes('--apply')}));
