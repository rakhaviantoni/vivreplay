export function marketShippingDeadline(paidAt:string|null|undefined):string|null{
  if(!paidAt)return null;
  const date=new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(paidAt)?paidAt:`${paidAt.replace(' ','T')}Z`);
  if(Number.isNaN(date.getTime()))return null;
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const part=(type:string)=>Number(parts.find(item=>item.type===type)?.value);
  const deadline=new Date(Date.UTC(part('year'),part('month')-1,part('day')));
  const weekday=deadline.getUTCDay();
  deadline.setUTCDate(deadline.getUTCDate()+(weekday===5?3:weekday===6?2:1));
  deadline.setUTCHours(14,0,0,0);
  return deadline.toISOString();
}
