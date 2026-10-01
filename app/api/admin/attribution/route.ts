import {db} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type Visit={id:string;visitor_id:string;landing_path:string;referrer_origin:string|null;country_code:string|null;utm_source:string|null;utm_medium:string|null;utm_campaign:string|null;utm_term:string|null;utm_content:string|null;parameters:string;converted_at:string|null;created_at:string};

export async function GET(){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const [summary,sources,countries,pages,recent]=await Promise.all([
      db().prepare(`SELECT COUNT(*) AS visits,COUNT(DISTINCT visitor_id) AS visitors,COUNT(converted_at) AS new_users FROM attribution_visits WHERE created_at>=datetime('now','-90 days')`).first<{visits:number;visitors:number;new_users:number}>(),
      db().prepare(`SELECT COALESCE(utm_source,'(not set)') AS source,COALESCE(utm_medium,'(not set)') AS medium,COALESCE(utm_campaign,'(not set)') AS campaign,COUNT(*) AS visits,COUNT(DISTINCT visitor_id) AS visitors,COUNT(converted_at) AS new_users FROM attribution_visits WHERE created_at>=datetime('now','-90 days') GROUP BY source,medium,campaign ORDER BY visits DESC LIMIT 100`).all(),
      db().prepare(`SELECT COALESCE(country_code,'Unknown') AS country,COUNT(*) AS visits,COUNT(DISTINCT visitor_id) AS visitors,COUNT(converted_at) AS new_users FROM attribution_visits WHERE created_at>=datetime('now','-90 days') GROUP BY country ORDER BY visits DESC LIMIT 50`).all(),
      db().prepare(`SELECT landing_path AS path,COUNT(*) AS visits FROM attribution_visits WHERE created_at>=datetime('now','-90 days') GROUP BY landing_path ORDER BY visits DESC LIMIT 50`).all(),
      db().prepare('SELECT * FROM attribution_visits ORDER BY created_at DESC LIMIT 200').all<Visit>(),
    ]);
    return Response.json({summary:summary??{visits:0,visitors:0,new_users:0},sources:sources.results,countries:countries.results,pages:pages.results,recent:recent.results},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Attribution data is unavailable. Apply the latest D1 migration.'},{status:503});}
}
