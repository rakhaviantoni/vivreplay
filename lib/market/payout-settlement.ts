export type SellerSettlementOrder={amount:number;paidAt:string|null;createdAt:string;details:string|null};

export function payoutReleaseAt(order:SellerSettlementOrder){
  let details:Record<string,unknown>={};
  try{details=JSON.parse(order.details??'{}') as Record<string,unknown>}catch{}
  const method=String(details.ipaymuPaymentMethod??'').toLowerCase();
  const channel=String(details.ipaymuPaymentChannel??'').toLowerCase();
  let businessDays=3;
  if(method==='qris')businessDays=2;
  else if(method==='va')businessDays=channel==='bca'?4:channel==='bsi'?2:channel?0:2;
  else if(['ewallet','cc','cstore','paylater'].includes(method))businessDays=3;
  const raw=order.paidAt||order.createdAt;
  const parsed=new Date(`${raw.replace(' ','T').replace(/Z?$/,'Z')}`);
  if(!Number.isFinite(parsed.getTime()))return null;
  const jakartaClock=new Date(parsed.getTime()+7*60*60*1000);
  const release=new Date(jakartaClock);
  let elapsed=0;
  while(elapsed<businessDays){
    release.setUTCDate(release.getUTCDate()+1);
    const day=release.getUTCDay();
    if(day!==0&&day!==6)elapsed++;
  }
  return new Date(release.getTime()-7*60*60*1000);
}

export function splitSellerEarnings<T extends SellerSettlementOrder>(orders:T[],now=new Date()){
  let earned=0,availableBeforeRequests=0,pendingSettlement=0;
  let nextSettlementAt:Date|null=null;
  for(const order of orders){
    const amount=Math.max(0,Math.round(Number(order.amount)||0));
    earned+=amount;
    const releaseAt=payoutReleaseAt(order);
    if(releaseAt&&releaseAt<=now)availableBeforeRequests+=amount;
    else{
      pendingSettlement+=amount;
      if(releaseAt&&(!nextSettlementAt||releaseAt<nextSettlementAt))nextSettlementAt=releaseAt;
    }
  }
  return {earned,availableBeforeRequests,pendingSettlement,nextSettlementAt:nextSettlementAt?.toISOString()??null};
}
