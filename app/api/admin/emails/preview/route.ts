import { NextRequest } from "next/server";
import { renderAuthEmail, AuthEmailAction, getAppUrl } from "@/lib/auth-email";
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {marketEmailEvents,type MarketEmailEvent} from '@/lib/market/email-template-types';
import {renderMarketEmail,sampleNotificationDetails} from '@/lib/server/market-notifications';

export async function GET(request: NextRequest) {
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  const searchParams = request.nextUrl.searchParams;
  const actionParam = searchParams.get("action");
  const name = searchParams.get("name") || "Luffy";
  const to = searchParams.get("to") || "pirate@vivreplay.com";
  const locale=searchParams.get('locale')==='id'?'id':'en';
  const theme=searchParams.get('theme')==='dark'?'dark':'light';
  const appUrl = getAppUrl();

  const actions: AuthEmailAction[] = ["verify", "reset", "password-changed", "welcome"];
  const listingTitle=searchParams.get('listing')||'Edward.Newgate (001)';

  const render=(action:string)=>{
    if(action.startsWith('market:')){
      const event=action.slice('market:'.length) as MarketEmailEvent;
      if(!marketEmailEvents.includes(event))return null;
      return{action,...renderMarketEmail(event,listingTitle,'sample-market-thread',locale,to,theme,sampleNotificationDetails(event,locale)),to,name:listingTitle};
    }
    if(!actions.includes(action as AuthEmailAction))return null;
    const authAction=action as AuthEmailAction;
    const url=authAction==='verify'?`${appUrl}/sign-in?verified=1`:authAction==='reset'?`${appUrl}/reset-password?token=sample_secure_token_123`:`${appUrl}/sign-in`;
    return{action:authAction,...renderAuthEmail({action:authAction,to,name,url,theme}),to,name,url};
  };

  if(actionParam){
    const rendered=render(actionParam);
    return rendered?Response.json(rendered):Response.json({error:'Unknown email template.'},{status:400});
  }

  const all=[...actions.map(action=>render(action)),...marketEmailEvents.map(event=>render(`market:${event}`))].filter(Boolean);

  return Response.json({emails:all,appUrl});
}
