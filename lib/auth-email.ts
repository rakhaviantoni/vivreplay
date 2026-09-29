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
  const configured = process.env.VIVREPLAY_APP_URL || process.env.BETTER_AUTH_URL || DEFAULT_APP_URL;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || /^(localhost|127\.0\.0\.1|::1)$/i.test(url.hostname)) return DEFAULT_APP_URL;
    return url.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

/** Authentication tokens keep their path and query, but email always opens the public app. */
export function productionEmailUrl(value: string | undefined, fallback: string): string {
  const appUrl = getAppUrl();
  try {
    const source = new URL(value || fallback, appUrl);
    const destination = new URL(appUrl);
    destination.pathname = source.pathname;
    destination.search = source.search;
    destination.hash = source.hash;
    return destination.toString();
  } catch {
    return fallback;
  }
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
  const trimmedName = email.name?.trim();
  const greeting = trimmedName ? `Hi ${trimmedName},` : "Hi,";

  switch (email.action) {
    case "verify":
      return {
        subject: "Verify your email · VivrePlay",
        eyebrow: "Account Verification",
        title: "Verify your email",
        copy: `${greeting} please confirm your email address to activate your VivrePlay account.`,
        action: "Verify email",
        note: "This link expires in 1 hour. If you didn't create an account, you can safely ignore this email.",
        showLinkFallback: true,
      };

    case "reset":
      return {
        subject: "Reset your password · VivrePlay",
        eyebrow: "Password Reset",
        title: "Reset your password",
        copy: `${greeting} we received a request to reset your password. Click the button below to choose a new password.`,
        action: "Reset password",
        note: "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.",
        showLinkFallback: true,
      };

    case "password-changed":
      return {
        subject: "Password changed · VivrePlay",
        eyebrow: "Account Security",
        title: "Password changed",
        copy: `${greeting} your VivrePlay account password was changed successfully.`,
        action: "Sign in",
        note: "If you didn't make this change, please reset your password immediately or email support@vivreplay.com.",
        showLinkFallback: false,
      };

    case "welcome":
      return {
        subject: "Welcome to VivrePlay",
        eyebrow: "Welcome",
        title: "Welcome to VivrePlay",
        copy: `${greeting} your email has been confirmed and your account is ready.`,
        action: "Open VivrePlay",
        note: "If you have any questions, you can reach us anytime at support@vivreplay.com.",
        showLinkFallback: false,
      };
  }
}

export function renderAuthEmail(email: AuthEmail): RenderedEmail {
  const appUrl = getAppUrl();
  const content = messageFor(email);
  const fallback = email.action === "welcome" ? `${appUrl}/cards` : `${appUrl}/sign-in`;
  const target = productionEmailUrl(email.url, fallback);
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
      .email-wrapper { padding: 20px 12px !important; }
      .email-header { padding: 22px 22px 19px !important; }
      .email-body { padding: 28px 22px 30px !important; }
      .email-title { font-size: 25px !important; line-height: 1.18 !important; }
      .email-copy { font-size: 15px !important; line-height: 1.65 !important; }
      .email-btn-cell { display: block !important; width: 100% !important; }
      .email-btn { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .footer-nav a { display: inline-block !important; margin: 4px 7px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f3eadb; color: #2e302d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="display: none; font-size: 1px; color: #f3eadb; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${escapeHtml(content.copy.slice(0, 140))}…
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f3eadb;">
    <tr>
      <td align="center" class="email-wrapper" style="padding: 40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-card" style="max-width: 580px; background-color: #fffaf1; border: 1px solid #d8c8ac; border-radius: 14px; overflow: hidden; box-shadow: 0 14px 34px rgba(62, 45, 21, 0.13);">
          <tr>
            <td height="4" style="background-color: #bf8526; line-height: 4px; font-size: 4px;">&nbsp;</td>
          </tr>
          <tr>
            <td class="email-header" style="padding: 26px 34px 20px; border-bottom: 1px solid #e4d7c0; background-color: #fbf4e7;">
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
                          <a href="${appUrl}" style="color: #24352e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 23px; font-weight: 700; letter-spacing: -0.7px; text-decoration: none;">
                            VivrePlay
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align: middle;">
                    <span style="font-family: Arial, sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1.1px; text-transform: uppercase; color: #8b5b14; background-color: #f5e5bf; border: 1px solid #d9bb7b; border-radius: 999px; padding: 5px 9px; display: inline-block;">
                      ACCOUNT
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="email-body" style="padding: 34px 34px 34px;">
              <p style="margin: 0 0 12px; color: #a06a18; font-family: Arial, sans-serif; font-size: 10px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
                ${escapeHtml(content.eyebrow)}
              </p>
              <h1 class="email-title" style="margin: 0 0 16px; color: #26352e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 30px; line-height: 1.16; font-weight: 700; letter-spacing: -0.7px;">
                ${escapeHtml(content.title)}
              </h1>
              <p class="email-copy" style="margin: 0 0 28px; color: #5f5a50; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65;">
                ${escapeHtml(content.copy)}
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 30px;">
                <tr>
                  <td align="left" class="email-btn-cell" style="border-radius: 7px; background-color: #be8427;">
                    <a href="${safeTarget}" class="email-btn" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #be8427; color: #fffaf0; font-family: Arial, sans-serif; font-size: 14px; font-weight: 800; letter-spacing: -0.1px; text-decoration: none; padding: 14px 25px; border-radius: 7px; text-align: center;">
                      ${escapeHtml(content.action)} &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              ${content.showLinkFallback ? `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 26px; background-color: #f7efdf; border: 1px solid #e4d3b4; border-radius: 8px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <p style="margin: 0 0 8px; color: #766b5c; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; font-weight: 500;">
                      Button not working? Copy and paste this URL into your browser:
                    </p>
                    <a href="${safeTarget}" style="color: #8a5b12; font-family: 'Courier New', monospace; font-size: 11px; line-height: 1.55; word-break: break-all; text-decoration: underline;">
                      ${safeTarget}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ""}

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top: 1px solid #e4d7c0;">
                <tr>
                  <td style="padding-top: 19px;">
                    <p style="margin: 0; color: #766b5c; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.6;">
                      ${escapeHtml(content.note)}
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="background-color: #f7efdf; border-top: 1px solid #e4d7c0; padding: 21px 34px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" class="footer-nav" style="padding-bottom: 14px;">
                    <a href="${appUrl}/cards" style="color: #5d635a; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; margin: 0 9px;">Cards</a>
                    <span style="color: #c6b58f;">&middot;</span>
                    <a href="${appUrl}/decks" style="color: #5d635a; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; margin: 0 9px;">Decks</a>
                    <span style="color: #c6b58f;">&middot;</span>
                    <a href="${appUrl}/vault" style="color: #5d635a; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; margin: 0 9px;">Vault</a>
                    <span style="color: #c6b58f;">&middot;</span>
                    <a href="${appUrl}/market" style="color: #5d635a; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; margin: 0 9px;">Market</a>
                    <span style="color: #c6b58f;">&middot;</span>
                    <a href="${appUrl}/play" style="color: #5d635a; font-family: Arial, sans-serif; font-size: 12px; font-weight: 700; text-decoration: none; margin: 0 9px;">Arena</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin: 0; color: #766b5c; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.55;">
                      Sent to <strong style="color: #4c534b;">${safeTo}</strong> &middot; Questions? Contact <a href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color: #8a5b12; text-decoration: none;">${DEFAULT_SUPPORT_EMAIL}</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 580px; margin-top: 18px;">
          <tr>
            <td align="center" style="padding: 0 16px;">
              <p style="margin: 0 0 6px; color: #7a705f; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5;">
                VivrePlay &middot; A companion for the One Piece Card Game
              </p>
              <p style="margin: 0; color: #8a806f; font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5;">
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

  const text = `VivrePlay

${content.title}

${content.copy}

${content.action}:
${target}

${content.note}

Sent to: ${email.to}
Support: ${DEFAULT_SUPPORT_EMAIL}
`;

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
