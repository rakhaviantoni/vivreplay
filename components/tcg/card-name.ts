/** Metadata providers sometimes append a printing marker to the card title. Printing is
 * already represented separately in the UI, so remove only those redundant suffixes. */
export function displayCardName(name:string, code?:string){
  const serial=code?.match(/[-_](\d{3})$/)?.[1];
  let output=name.trim();
  if((output.match(/"/g)?.length??0)%2===1&&output.endsWith('"'))output=output.slice(0,-1).trimEnd();
  output=removeRepeatedName(output);
  if(serial)output=output.replace(new RegExp(`\\s*\\(${serial.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\)`,'ig'),'');
  output=output.replace(/\s*\((?:alternate art|parallel|full art|jolly roger foil|pirate foil)\)/ig,'').replace(/\s{2,}/g,' ').trim();
  return output;
}

function removeRepeatedName(name:string){
  let value=name.trim();
  for(let length=Math.floor(value.length/2);length>1;length--){
    const part=value.slice(0,length).trimEnd();
    if(!part)continue;
    let rest=value.slice(length);
    let repeats=1;
    while(rest.trim()){
      if(!rest.startsWith(part))rest=rest.replace(/^[\s'|·•/,:;]+/,'');
      if(!rest.startsWith(part))break;
      rest=rest.slice(part.length);
      repeats++;
    }
    if(repeats>1&&!rest.trim()){value=part;break;}
  }
  return value;
}
