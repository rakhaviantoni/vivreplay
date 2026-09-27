export type AuthEmailAction = "verify" | "reset" | "password-changed" | "welcome";

export type AuthEmail = {
  action: AuthEmailAction;
  to: string;
  name?: string | null;
  url?: string;
};

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  from: string;
  replyTo: string;
};

export const DEFAULT_EMAIL_FROM = "VivrePlay <noreply@vivreplay.com>";
export const DEFAULT_SUPPORT_EMAIL = "support@vivreplay.com";
export const DEFAULT_APP_URL = "https://vivreplay.com";

export function getAppUrl(): string {
  const base = process.env.BETTER_AUTH_URL || DEFAULT_APP_URL;
  return base.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function messageFor(email: AuthEmail) {
  const name = email.name?.trim() || "there";

  switch (email.action) {
    case "verify":
      return {
        subject: "Verify your email address · VivrePlay",
        eyebrow: "ACCOUNT VERIFICATION",
        title: "Confirm your email address",
        copy: `Hi ${name}, thank you for joining VivrePlay! Confirm your email address to activate your account and start tracking your collection, crafting competition-ready decks, and trading on the marketplace.`,
        action: "Verify email address",
        note: "This link will expire in 1 hour. If you didn't create a VivrePlay account, you can safely ignore this email.",
        showLinkFallback: true,
      };

    case "reset":
      return {
        subject: "Reset your password · VivrePlay",
        eyebrow: "ACCOUNT SECURITY",
        title: "Reset your password",
        copy: `Hi ${name}, we received a request to reset the password for your VivrePlay account. Click the button below to choose a new password.`,
        action: "Reset password",
        note: "This link will expire in 1 hour. If you did not request a password reset, no further action is needed and your account remains secure.",
        showLinkFallback: true,
      };

    case "password-changed":
      return {
        subject: "Your password was updated · VivrePlay",
        eyebrow: "SECURITY NOTIFICATION",
        title: "Password updated successfully",
        copy: `Hi ${name}, the password for your VivrePlay account was recently updated. If you made this change, your new password is now active and you're all set.`,
        action: "Go to VivrePlay",
        note: "If you did not make this change, please reset your password immediately or email support@vivreplay.com so we can help secure your account.",
        showLinkFallback: false,
      };

    case "welcome":
      return {
        subject: "Welcome aboard · VivrePlay",
        eyebrow: "WELCOME TO VIVREPLAY",
        title: "Your voyage begins here",
        copy: `Hi ${name}, your email is confirmed and your VivrePlay account is ready! Explore over 5,000+ One Piece Card Game printings, tune your curve in the deck builder, curate your vault, or test decks in the arena.`,
        action: "Explore VivrePlay",
        note: "Have questions or ideas? You can reach our team anytime at support@vivreplay.com.",
        showLinkFallback: false,
      };
  }
}

export function renderAuthEmail(email: AuthEmail): RenderedEmail {
  const appUrl = getAppUrl();
  const content = messageFor(email);
  const target = email.url ?? (email.action === "welcome" ? `${appUrl}/cards` : `${appUrl}/sign-in`);
  const safeTarget = escapeHtml(target);
  const safeTo = escapeHtml(email.to);
  const from = process.env.VIVREPLAY_EMAIL_FROM || DEFAULT_EMAIL_FROM;
  const replyTo = `VivrePlay Support <${DEFAULT_SUPPORT_EMAIL}>`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${escapeHtml(content.subject)}</title>
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
    body, table, td, p, a, li, blockquote {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
    }
    @media only screen and (max-width: 600px) {
      .email-wrapper { padding: 18px 10px !important; }
      .email-card { border-radius: 12px !important; }
      .email-header { padding: 22px 20px 18px !important; }
      .email-body { padding: 26px 20px 28px !important; }
      .email-title { font-size: 23px !important; line-height: 1.25 !important; }
      .email-copy { font-size: 14px !important; line-height: 1.6 !important; }
      .email-btn-cell { display: block !important; width: 100% !important; }
      .email-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .footer-links { font-size: 11px !important; }
      .footer-nav a { display: inline-block !important; padding: 4px 6px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #060d15; color: #eaf0f2; font-family: 'Manrope', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <!-- Preheader text for inbox snippet -->
  <div style="display: none; font-size: 1px; color: #060d15; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(content.copy.slice(0, 140))}…
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #060d15;">
    <tr>
      <td align="center" class="email-wrapper" style="padding: 40px 16px;">
        <!-- Email Container Card -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="max-width: 580px; background-color: #0e1b2a; border: 1px solid #22384e; border-radius: 16px; overflow: hidden; box-shadow: 0 16px 40px rgba(0, 0, 0, 0.45);">
          
          <!-- Top Brass Accent Bar -->
          <tr>
            <td height="3" style="background: linear-gradient(90deg, #d8a63b 0%, #f3ddb0 50%, #d8a63b 100%); line-height: 3px; font-size: 3px;">&nbsp;</td>
          </tr>

          <!-- Brand Header -->
          <tr>
            <td class="email-header" style="padding: 26px 34px 20px; border-bottom: 1px solid #1a2c3f;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="left" style="vertical-align: middle;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="width: 38px; height: 38px; padding-right: 12px; vertical-align: middle;">
                          <a href="${appUrl}" style="text-decoration: none; display: block;">
                            <img src="${appUrl}/brand/vivreplay-compass.png" width="38" height="38" alt="VivrePlay" style="display: block; width: 38px; height: 38px; border: 0;" />
                          </a>
                        </td>
                        <td style="vertical-align: middle;">
                          <a href="${appUrl}" style="color: #f3f6f8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 19px; font-weight: 800; letter-spacing: -0.4px; text-decoration: none;">
                            VivrePlay
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #d8a63b; background: rgba(216, 166, 59, 0.12); border: 1px solid rgba(216, 166, 59, 0.32); border-radius: 9999px; padding: 4px 10px; display: inline-block;">
                      OPTCG COMPANION
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Email Content -->
          <tr>
            <td class="email-body" style="padding: 34px 34px 34px;">
              <!-- Eyebrow Tag -->
              <p style="margin: 0 0 12px; color: #d8a63b; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; text-transform: uppercase;">
                ${escapeHtml(content.eyebrow)}
              </p>

              <!-- Heading -->
              <h1 class="email-title" style="margin: 0 0 16px; color: #f3f6f8; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 26px; line-height: 1.25; font-weight: 800; letter-spacing: -0.6px;">
                ${escapeHtml(content.title)}
              </h1>

              <!-- Body Paragraph -->
              <p class="email-copy" style="margin: 0 0 28px; color: #c2d3df; font-family: 'Manrope', 'Plus Jakarta Sans', sans-serif; font-size: 15px; line-height: 1.65;">
                ${escapeHtml(content.copy)}
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 30px;">
                <tr>
                  <td align="left" class="email-btn-cell" style="border-radius: 8px;">
                    <a href="${safeTarget}" class="email-btn" target="_blank" style="display: inline-block; background-color: #d8a63b; color: #08101a; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 800; letter-spacing: -0.2px; text-decoration: none; padding: 13px 28px; border-radius: 8px; box-shadow: 0 2px 10px rgba(216, 166, 59, 0.28); text-align: center;">
                      ${escapeHtml(content.action)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              ${content.showLinkFallback ? `
              <!-- Fallback Link Sub-Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 26px; background-color: #08121d; border: 1px solid #1c3044; border-radius: 10px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="margin: 0 0 8px; color: #8fa7b7; font-family: 'Manrope', sans-serif; font-size: 12px; line-height: 1.5; font-weight: 500;">
                      Button not working? Copy and paste this URL into your browser:
                    </p>
                    <a href="${safeTarget}" style="color: #d8a63b; font-family: ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, monospace; font-size: 12px; line-height: 1.55; word-break: break-all; text-decoration: underline;">
                      ${safeTarget}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}

              <!-- Security Expiration Note -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #1a2c3f; padding-top: 20px;">
                <tr>
                  <td style="padding-top: 4px;">
                    <p style="margin: 0; color: #8fa7b7; font-family: 'Manrope', sans-serif; font-size: 12px; line-height: 1.6;">
                      ${escapeHtml(content.note)}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Card Sub-Footer: Navigation & Brand -->
          <tr>
            <td style="background-color: #09131e; border-top: 1px solid #1a2c3f; padding: 22px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" class="footer-nav" style="padding-bottom: 14px;">
                    <a href="${appUrl}/cards" style="color: #9cb1c0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; margin: 0 9px;">Cards</a>
                    <span style="color: #274057;">&middot;</span>
                    <a href="${appUrl}/decks" style="color: #9cb1c0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; margin: 0 9px;">Decks</a>
                    <span style="color: #274057;">&middot;</span>
                    <a href="${appUrl}/vault" style="color: #9cb1c0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; margin: 0 9px;">Vault</a>
                    <span style="color: #274057;">&middot;</span>
                    <a href="${appUrl}/market" style="color: #9cb1c0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; margin: 0 9px;">Market</a>
                    <span style="color: #274057;">&middot;</span>
                    <a href="${appUrl}/play" style="color: #9cb1c0; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 12px; font-weight: 600; text-decoration: none; margin: 0 9px;">Arena</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #6d8697; font-family: 'Manrope', sans-serif; font-size: 11px; line-height: 1.55;">
                      Sent to <strong style="color: #a3bac9;">${safeTo}</strong> &middot; Questions? Contact <a href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color: #d8a63b; text-decoration: none;">${DEFAULT_SUPPORT_EMAIL}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <!-- Outer Footer Note -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; margin-top: 18px;">
          <tr>
            <td align="center" style="padding: 0 16px;">
              <p style="margin: 0 0 6px; color: #5a7486; font-family: 'Manrope', sans-serif; font-size: 11px; line-height: 1.5;">
                VivrePlay &middot; A companion for the One Piece Card Game
              </p>
              <p style="margin: 0; color: #435b6c; font-family: 'Manrope', sans-serif; font-size: 11px; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} VivrePlay. All rights reserved.
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `VIVREPLAY · ONE PIECE CARD GAME COMPANION
==================================================

${content.title.toUpperCase()}

${content.copy}

${content.action}:
${target}

--------------------------------------------------
${content.note}

Sent to: ${email.to}
Questions or assistance: ${DEFAULT_SUPPORT_EMAIL}
Explore VivrePlay: ${appUrl}

© ${new Date().getFullYear()} VivrePlay. All rights reserved.`;

  return {
    subject: content.subject,
    html,
    text,
    from,
    replyTo,
  };
}

export async function sendAuthEmail(email: AuthEmail) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email delivery is not configured. RESEND_API_KEY is missing.");

  const rendered = renderAuthEmail(email);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: rendered.from,
      to: [email.to],
      reply_to: rendered.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      tags: [{ name: "category", value: `auth-${email.action}` }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("Resend delivery failed:", response.status, errorBody);
    throw new Error(`Email delivery failed (${response.status}): ${errorBody || "Unknown error"}`);
  }

  return response.json().catch(() => ({}));
}
