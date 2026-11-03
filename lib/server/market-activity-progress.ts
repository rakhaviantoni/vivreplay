import type {D1Database} from '@cloudflare/workers-types';
import {MARKET_ACTIVITY_REWARDS,type MarketActivityAction} from '@/lib/market-activity';

export async function recordMarketActivity(database:D1Database,profileId:string,action:MarketActivityAction,referenceId:string){
  const reward=MARKET_ACTIVITY_REWARDS[action];
  const result=await database.prepare(`INSERT OR IGNORE INTO market_activity_events (id,profile_id,action,reference_id,points)
    SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM market_activity_events WHERE profile_id=? AND action=? AND created_at>=datetime('now','-30 days'))<?`)
    .bind(crypto.randomUUID(),profileId,action,referenceId,reward.points,profileId,action,reward.monthlyLimit).run();
  return Boolean(result.meta.changes);
}

export async function getMarketActivityProgress(database:D1Database,profileId:string){
  const [total,activity]=await Promise.all([
    database.prepare(`SELECT COALESCE(SUM(points),0) AS points FROM market_activity_events
      WHERE profile_id=? AND created_at>=datetime('now','-90 days')`).bind(profileId).first<{points:number}>(),
    database.prepare(`SELECT action,COUNT(*) AS count FROM market_activity_events
      WHERE profile_id=? AND created_at>=datetime('now','-30 days') GROUP BY action`).bind(profileId).all<{action:MarketActivityAction;count:number}>(),
  ]);
  const points=Math.max(0,Number(total?.points)||0);
  const taskCounts:Record<MarketActivityAction,number>={vault_added:0,listing_published:0,offer_replied:0,order_completed:0};
  for(const row of activity.results??[])if(row.action in taskCounts)taskCounts[row.action]=Math.max(0,Number(row.count)||0);
  const level=points>=40?2:points>=15?1:0;
  const currentThreshold=level===2?40:level===1?15:0;
  const nextThreshold=level===2?null:level===1?40:15;
  return{points,level:level===2?'Established':level===1?'Active':'Getting started',currentThreshold,nextThreshold,pointsToNext:nextThreshold===null?0:Math.max(0,nextThreshold-points),progressPercent:nextThreshold===null?100:Math.min(100,Math.round((points-currentThreshold)/(nextThreshold-currentThreshold)*100)),windowDays:90,taskCounts};
}
