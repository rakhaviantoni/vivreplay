import {optionalUser,db,errorResponse} from '@/lib/server/store';
import {fetchMarketPolicies} from '@/lib/market/policy';

export async function GET(){
  try{
    const [profile,policies]=await Promise.all([optionalUser().catch(()=>null),fetchMarketPolicies(db())]);
    const period=profile?.pro_billing_period==='yearly'?'yearly':'monthly';
    const current=profile?.tier==='pro'?(period==='yearly'?policies.proAnnual:policies.pro):policies.free;
    return Response.json({free:policies.free,proMonthly:policies.pro,proAnnual:policies.proAnnual,current},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
  }catch(error){return errorResponse(error)}
}
