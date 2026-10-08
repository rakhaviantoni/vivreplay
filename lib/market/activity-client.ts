export type MarketActivityCounts = {listings:number;offers:number;orders:number};

const CACHE_MS=10_000;
const cachedByProfile=new Map<string,{counts:MarketActivityCounts;at:number}>();
const requestsByProfile=new Map<string,Promise<MarketActivityCounts|null>>();

export async function loadMarketActivityCounts(profileId:string) {
  const cached=cachedByProfile.get(profileId);
  if(cached&&Date.now()-cached.at<CACHE_MS)return cached.counts;
  const inFlight=requestsByProfile.get(profileId);
  if(inFlight)return inFlight;
  const request=(async()=>{
    try{
      const response=await fetch('/api/market/activity',{cache:'no-store'});
      if(!response.ok)return null;
      const result=await response.json() as {counts?:Partial<MarketActivityCounts>};
      const counts={listings:result.counts?.listings??0,offers:result.counts?.offers??0,orders:result.counts?.orders??0};
      cachedByProfile.set(profileId,{counts,at:Date.now()});
      return counts;
    }catch{return null}
    finally{requestsByProfile.delete(profileId)}
  })();
  requestsByProfile.set(profileId,request);
  return request;
}
