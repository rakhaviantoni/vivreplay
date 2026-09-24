/** Metadata providers sometimes append a printing marker to the card title. Printing is
 * already represented separately in the UI, so remove only those redundant suffixes. */
export function displayCardName(name:string, code?:string){
  const serial=code?.match(/[-_](\d{3})$/)?.[1];
  let output=name;
  if(serial)output=output.replace(new RegExp(`\\s*\\(${serial.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\)`,'ig'),'');
  return output.replace(/\s*\((?:alternate art|parallel|full art|jolly roger foil|pirate foil)\)/ig,'').replace(/\s{2,}/g,' ').trim();
}
