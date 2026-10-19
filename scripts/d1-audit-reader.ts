import {execFileSync} from 'node:child_process';

const PAGE_SIZE=200;
type D1Envelope<T>={results?:T[];success?:boolean;error?:{text?:string}};

export function runD1AuditQuery<T>(sql:string):T[]{
 const output=execFileSync('node_modules/.bin/wrangler',['d1','execute','vivreplay','--remote','--config','dist/server/wrangler.json','--json','--command',sql],{encoding:'utf8',maxBuffer:32*1024*1024});
 const envelope=JSON.parse(output.trimStart()) as D1Envelope<T>[];
 if(!envelope[0]?.success)throw new Error(envelope[0]?.error?.text??'Cloudflare D1 query failed.');
 return envelope[0].results??[];
}

/** Keyset-paginate indexed identifiers, returning at most 200 rows per D1 query. */
export async function readD1AuditPages<T>(options:{select:string;from:string;key:'id'|'identity_id';where?:string}):Promise<T[]>{
 const rows:T[]=[];let cursor='';
 for(;;){
  const where=[options.where,cursor?`${options.key} > '${cursor.replaceAll("'","''")}'`:undefined].filter(Boolean).join(' AND ');
  const page=runD1AuditQuery<T>(`SELECT ${options.select} FROM ${options.from}${where?` WHERE ${where}`:''} ORDER BY ${options.key} LIMIT ${PAGE_SIZE}`);
  rows.push(...page);if(page.length<PAGE_SIZE)return rows;
  const last=page.at(-1) as Record<string,unknown>|undefined;const next=String(last?.[options.key]??'');
  if(!next||next<=cursor)throw new Error(`D1 keyset pagination stalled on ${options.key}.`);
  cursor=next;
 }
}
