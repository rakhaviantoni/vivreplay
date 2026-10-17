function normalizePart(value: string) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}

function containsPart(address: string, part: string) {
  const haystack=normalizePart(address);
  const needle=normalizePart(part);
  if(!haystack||!needle)return false;
  if(` ${haystack} `.includes(` ${needle} `))return true;
  const words=needle.split(' ');
  for(let index=1;index<words.length;index++){
    if(` ${haystack} `.includes(` ${words.slice(index).join(' ')} `))return true;
  }
  return false;
}

/** Format saved address values for display only; form values remain untouched. */
export function formatDeliveryAddress(parts: unknown[]) {
  const result:string[]=[];
  for(const raw of parts){
    if(typeof raw!=='string')continue;
    const value=raw.trim().replace(/(?:\s*,\s*){2,}/g,', ');
    if(!value)continue;
    const normalized=normalizePart(value);
    if(!normalized||result.some(existing=>normalizePart(existing)===normalized||containsPart(existing,value)))continue;
    result.push(value);
  }
  return result.join(', ');
}
