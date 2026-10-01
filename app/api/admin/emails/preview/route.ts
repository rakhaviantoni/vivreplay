import { NextRequest } from "next/server";
import { renderAuthEmail, AuthEmailAction, getAppUrl } from "@/lib/auth-email";
import {isCurrentUserAdmin} from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  if(!await isCurrentUserAdmin())return Response.json({error:'Admin access is required.'},{status:403});
  const searchParams = request.nextUrl.searchParams;
  const actionParam = searchParams.get("action") as AuthEmailAction | null;
  const name = searchParams.get("name") || "Luffy";
  const to = searchParams.get("to") || "pirate@vivreplay.com";
  const appUrl = getAppUrl();

  const actions: AuthEmailAction[] = ["verify", "reset", "password-changed", "welcome"];

  if (actionParam && actions.includes(actionParam)) {
    const url = actionParam === "verify" 
      ? `${appUrl}/sign-in?verified=1` 
      : actionParam === "reset" 
      ? `${appUrl}/reset-password?token=sample_secure_token_123` 
      : `${appUrl}/sign-in`;

    const rendered = renderAuthEmail({
      action: actionParam,
      to,
      name,
      url,
    });

    return Response.json({
      action: actionParam,
      ...rendered,
      to,
      name,
      url,
    });
  }

  // Return all rendered emails
  const all = actions.map((action) => {
    const url = action === "verify" 
      ? `${appUrl}/sign-in?verified=1` 
      : action === "reset" 
      ? `${appUrl}/reset-password?token=sample_secure_token_123` 
      : `${appUrl}/sign-in`;

    return {
      action,
      ...renderAuthEmail({ action, to, name, url }),
      to,
      name,
      url,
    };
  });

  return Response.json({ emails: all, appUrl });
}
