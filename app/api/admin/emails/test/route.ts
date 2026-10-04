import { NextRequest } from "next/server";
import { sendAuthEmail, AuthEmailAction, getAppUrl } from "@/lib/auth-email";
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';
import {marketEmailEvents,type MarketEmailEvent} from '@/lib/market/email-template-types';
import {sendMarketTestEmail} from '@/lib/server/market-notifications';

export async function POST(request: NextRequest) {
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  try {
    const body = await request.json() as {
      to?: string;
      action?: string;
      name?: string;
      locale?:'en'|'id';
      theme?:'light'|'dark';
    };

    const to = body.to?.trim();
    if (!to || !to.includes("@")) {
      return Response.json({ error: "A valid recipient email address is required." }, { status: 400 });
    }

    const action = body.action || "verify";
    const name = body.name?.trim() || "Captain";
    const appUrl = getAppUrl();

    if(action.startsWith('market:')){
      const event=action.slice('market:'.length) as MarketEmailEvent;
      if(!marketEmailEvents.includes(event))return Response.json({error:'Unknown email template.'},{status:400});
      await sendMarketTestEmail(to,event,name,body.locale==='id'?'id':'en',body.theme==='dark'?'dark':'light');
      return Response.json({success:true,message:`Test Market email sent to ${to} via Resend.`});
    }
    if(!['verify','reset','password-changed','welcome'].includes(action))return Response.json({error:'Unknown email template.'},{status:400});

    const authAction=action as AuthEmailAction;
    const url = authAction === "verify"
      ? `${appUrl}/sign-in?verified=1`
      : authAction === "reset"
      ? `${appUrl}/reset-password?token=test_preview_token`
      : `${appUrl}/sign-in`;

    const result = await sendAuthEmail({
      action:authAction,
      to,
      name,
      url,
      theme:body.theme==='dark'?'dark':'light',
    });

    return Response.json({
      success: true,
      message: `Test ${action} email sent successfully to ${to} via Resend.`,
      result,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to deliver test email." },
      { status: 500 }
    );
  }
}
