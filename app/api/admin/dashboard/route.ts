import {db,errorResponse} from '@/lib/server/store';
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

type DailyRow={day:string;accounts:number;orders:number;volume:number};
type CustomerRow={id:string;username:string|null;display_name:string;tier:string;pro_expires_at:string|null;created_at:string;email:string|null};
const marketPaidStatuses="'PAID','SHIPPED','RECEIVED','COMPLETED','FULFILLED'";
let overviewCache:{expiresAt:number;data:{generatedAt:string;accounts:number;proAccounts:number;daily:DailyRow[]}}|null=null;

export async function GET(request:Request){
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try{
    const d=db();
    const view=new URL(request.url).searchParams.get('view')??'overview';
    if(view==='customers'){
      const params=new URL(request.url).searchParams;
      const rawQuery=(params.get('q')??'').trim().toLowerCase().slice(0,80);
      const tier=params.get('tier');
      const cursor=params.get('cursor');
      let cursorParts:string[]=[];
      if(cursor){
        try{cursorParts=cursor.split('|',2);if(cursorParts.length!==2||!/^\d{4}-\d\d-\d\d/.test(cursorParts[0]))cursorParts=[];}catch{cursorParts=[];}
      }
      const cursorClause=cursorParts.length?' AND (u.createdAt < ? OR (u.createdAt = ? AND u.id < ?))':'';
      const tierClause=tier==='pro'||tier==='free'?' AND COALESCE(p.tier,\'free\') = ?':'';
      const common=[...(cursorParts.length?[cursorParts[0],cursorParts[0],cursorParts[1]]:[]),...(tierClause?[tier!]:[])];
      const select=`SELECT u.id,p.username,COALESCE(p.display_name,u.name) AS display_name,
        COALESCE(p.tier,'free') AS tier,p.pro_expires_at,u.createdAt AS created_at,u.email
        FROM user u LEFT JOIN profiles p ON p.auth_subject=u.id`;
      let statement;
      let bindings:string[];
      if(rawQuery){
        const upper=`${rawQuery}\uffff`;
        statement=d.prepare(`${select} WHERE (p.username >= ? AND p.username < ?${cursorClause}${tierClause})
          UNION
          ${select} WHERE (u.email >= ? AND u.email < ?${cursorClause}${tierClause})
          ORDER BY created_at DESC,id DESC LIMIT 51`);
        bindings=[rawQuery,upper,...common,rawQuery,upper,...common];
      }else{
        statement=d.prepare(`${select} WHERE 1=1${cursorClause}${tierClause} ORDER BY u.createdAt DESC,u.id DESC LIMIT 51`);
        bindings=common;
      }
      const rows=(await statement.bind(...bindings).all<CustomerRow>()).results;
      const hasMore=rows.length>50;
      const customers=rows.slice(0,50);
      const last=customers.at(-1);
      return Response.json({customers,nextCursor:hasMore&&last?`${last.created_at}|${last.id}`:null},{headers:{'Cache-Control':'private, no-store'}});
    }

    if(overviewCache&&overviewCache.expiresAt>Date.now())return Response.json(overviewCache.data,{headers:{'Cache-Control':'private, no-store'}});
    const now=new Date();
    const start=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-29)).toISOString();
    const [accounts,proAccounts,accountRows,orderRows]=await Promise.all([
      d.prepare('SELECT COUNT(*) AS total FROM user').first<{total:number}>(),
      d.prepare("SELECT COUNT(*) AS total FROM profiles WHERE tier='pro' AND (pro_expires_at IS NULL OR pro_expires_at>CURRENT_TIMESTAMP)").first<{total:number}>(),
      d.prepare(`SELECT substr(createdAt,1,10) AS day,COUNT(*) AS accounts
        FROM user WHERE createdAt>=? GROUP BY substr(createdAt,1,10)`).bind(start).all<{day:string;accounts:number}>(),
      d.prepare(`SELECT substr(created_at,1,10) AS day,COUNT(*) AS orders,SUM(subtotal) AS volume
        FROM checkout_orders WHERE kind='MARKET' AND status IN (${marketPaidStatuses}) AND created_at>=?
        GROUP BY substr(created_at,1,10)`).bind(start).all<{day:string;orders:number;volume:number|null}>(),
    ]);
    const daily=new Map<string,DailyRow>();
    for(let offset=0;offset<30;offset++){
      const date=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-29+offset)).toISOString().slice(0,10);
      daily.set(date,{day:date,accounts:0,orders:0,volume:0});
    }
    for(const row of accountRows.results){const day=daily.get(row.day);if(day)day.accounts=row.accounts;}
    for(const row of orderRows.results){const day=daily.get(row.day);if(day){day.orders=row.orders;day.volume=row.volume??0;}}
    const data={generatedAt:now.toISOString(),accounts:accounts?.total??0,proAccounts:proAccounts?.total??0,daily:[...daily.values()]};
    overviewCache={data,expiresAt:Date.now()+60_000};
    return Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    console.error('admin_dashboard_load_failed',error instanceof Error?error.message:'unknown error');
    const response=errorResponse(error);
    if(response.status===500)return Response.json({error:'Dashboard data could not be loaded. Refresh and try again.'},{status:500,headers:{'Cache-Control':'no-store'}});
    return response;
  }
}
