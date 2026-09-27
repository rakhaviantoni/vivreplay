import { NextRequest } from "next/server";
import { sendAuthEmail, AuthEmailAction, getAppUrl } from "@/lib/auth-email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      to?: string;
      action?: AuthEmailAction;
      name?: string;
    };

    const to = body.to?.trim();
    if (!to || !to.includes("@")) {
      return Response.json({ error: "A valid recipient email address is required." }, { status: 400 });
    }

    const action = body.action || "verify";
    const name = body.name?.trim() || "Captain";
    const appUrl = getAppUrl();

    const url = action === "verify"
      ? `${appUrl}/sign-in?verified=1`
      : action === "reset"
      ? `${appUrl}/reset-password?token=test_preview_token`
      : `${appUrl}/sign-in`;

    const result = await sendAuthEmail({
      action,
      to,
      name,
      url,
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
