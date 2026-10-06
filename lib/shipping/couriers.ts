const REGULAR=['jnt','jne','sicepat','anteraja','tiki','pos','lion','ninja','wahana'];
const INSTANT=['grab','gojek'];

export function enabledShippingCouriers(methods:unknown[]):string[]{
  return [REGULAR,INSTANT].flatMap((codes,index)=>{
    const explicit=codes.filter(code=>methods.includes(code));
    return explicit.length?explicit:methods.includes(index===0?'regular':'instant')?codes:[];
  });
}
