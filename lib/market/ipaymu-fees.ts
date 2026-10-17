export type IpaymuFeeEstimateInput={
  method:string;
  channel:string;
  fee:number;
  feeType:'FLAT'|'PERCENT';
  additionalFee:number;
};

/** Published iPaymu customer-side fee estimates for channels with a clear rate. */
export function estimateIpaymuFee(option:IpaymuFeeEstimateInput|undefined,amount:number){
  if(!option||amount<=0)return 0;

  const key=`${option.method}:${option.channel}`;
  if(key==='qris:mpm')return 0; // QRIS is requested with feeDirection=MERCHANT.
  if(key==='paylater:akulaku')return Math.round(amount*0.015)+5_000;
  if(key==='cc:cc')return Math.round(amount*0.025)+2_000;
  if(option.method==='ewallet'&&['dana','shopeepay'].includes(option.channel))return Math.round(amount*0.035);
  if(key==='va:bca')return 4_500; // Published BCA H+2 rate after its 20% discount.
  return Math.max(0,Math.round((option.feeType==='PERCENT'?amount*option.fee/100:option.fee)+option.additionalFee));
}
