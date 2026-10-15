const MINUTE=60_000;
const HOUR=60*MINUTE;

export function paymentReminderDue(millisecondsUntilExpiry:number){
  return millisecondsUntilExpiry>0&&millisecondsUntilExpiry<=45*MINUTE;
}

export function shippingReminderStage(millisecondsUntilDeadline:number):'day'|'soon'|null{
  if(millisecondsUntilDeadline<=0)return null;
  if(millisecondsUntilDeadline<=3*HOUR+15*MINUTE)return'soon';
  if(millisecondsUntilDeadline<=24*HOUR+15*MINUTE)return'day';
  return null;
}
