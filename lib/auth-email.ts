export type AuthEmailAction = "verify" | "reset" | "password-changed" | "welcome";

export type AuthEmail = {
  action: AuthEmailAction;
  to: string;
  name?: string | null;
  url?: string;
  /** Preview mode for template review. Delivery follows the recipient's mail-client preference. */
  theme?: "light" | "dark";
  locale?: "en" | "id";
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
  return DEFAULT_APP_URL;
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
  const id=email.locale==='id';
  const greeting = trimmedName ? (id?`Halo ${trimmedName},`:`Hi ${trimmedName},`) : (id?'Halo,':'Hi,');

  switch (email.action) {
    case "verify":
      return id?{
        subject: "Verifikasi email | VivrePlay",
        eyebrow: "Verifikasi akun",
        title: "Verifikasi email Anda",
        copy: `${greeting} konfirmasi alamat email untuk mengaktifkan akun VivrePlay Anda.`,
        action: "Verifikasi email",
        note: "Tautan ini berlaku selama 1 jam. Jika Anda tidak membuat akun ini, abaikan email ini.",
        showLinkFallback: true,
      }: {
        subject: "Verify your email | VivrePlay",
        eyebrow: "Account Verification",
        title: "Verify your email",
        copy: `${greeting} please confirm your email address to activate your VivrePlay account.`,
        action: "Verify email",
        note: "This link expires in 1 hour. If you didn't create an account, you can safely ignore this email.",
        showLinkFallback: true,
      };

    case "reset":
      return id?{
        subject: "Atur ulang kata sandi | VivrePlay",
        eyebrow: "Atur ulang kata sandi",
        title: "Buat kata sandi baru",
        copy: `${greeting} gunakan tombol di bawah untuk membuat kata sandi baru sesuai permintaan Anda.`,
        action: "Atur ulang kata sandi",
        note: "Tautan ini berlaku selama 1 jam. Jika Anda tidak meminta pengaturan ulang kata sandi, abaikan email ini.",
        showLinkFallback: true,
      }: {
        subject: "Reset your password | VivrePlay",
        eyebrow: "Password Reset",
        title: "Reset your password",
        copy: `${greeting} use the button below to choose a new password for your account.`,
        action: "Reset password",
        note: "This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.",
        showLinkFallback: true,
      };

    case "password-changed":
      return id?{
        subject: "Kata sandi diubah | VivrePlay",
        eyebrow: "Keamanan akun",
        title: "Kata sandi berhasil diubah",
        copy: `${greeting} kata sandi akun VivrePlay Anda berhasil diubah.`,
        action: "Masuk",
        note: "Jika Anda tidak mengubah kata sandi ini, segera atur ulang kata sandi atau hubungi support@vivreplay.com.",
        showLinkFallback: false,
      }: {
        subject: "Password changed | VivrePlay",
        eyebrow: "Account Security",
        title: "Password changed",
        copy: `${greeting} your VivrePlay account password was changed successfully.`,
        action: "Sign in",
        note: "If you didn't make this change, please reset your password immediately or email support@vivreplay.com.",
        showLinkFallback: false,
      };

    case "welcome":
      return id?{
        subject: "Selamat datang di VivrePlay",
        eyebrow: "Selamat datang",
        title: "Akun Anda siap digunakan",
        copy: `${greeting} email Anda sudah dikonfirmasi dan akun VivrePlay siap digunakan.`,
        action: "Buka VivrePlay",
        note: "Perlu bantuan? Hubungi kami di support@vivreplay.com.",
        showLinkFallback: false,
      }: {
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
  const id=email.locale==='id';
  const appUrl = getAppUrl();
  const content = messageFor(email);
  const fallback = email.action === "welcome" ? `${appUrl}/cards` : `${appUrl}/sign-in`;
  const target = productionEmailUrl(email.url, fallback);
  const safeTarget = escapeHtml(target);
  const safeTo = escapeHtml(email.to);
  const configuredFrom = process.env.VIVREPLAY_EMAIL_FROM?.trim();
  const configuredDomain = configuredFrom?.match(/@([^\s>]+)/)?.[1]?.toLowerCase();
  const from = configuredDomain === 'vivreplay.com' ? configuredFrom! : DEFAULT_EMAIL_FROM;
  const replyTo = `VivrePlay Support <${DEFAULT_SUPPORT_EMAIL}>`;

  const html = `<!doctype html>
<html lang="${id?'id':'en'}" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="${email.theme ?? 'light dark'}" />
  <meta name="supported-color-schemes" content="${email.theme ?? 'light dark'}" />
  <title>${escapeHtml(content.subject)}</title>
  <style>
    :root{color-scheme:${email.theme ?? 'light dark'};supported-color-schemes:${email.theme ?? 'light dark'}}
    body,.email-bg{background:#f1eee6!important;color:#292b27!important}
    .email-card{background:#fffdf8!important;color:#292b27!important}
    .email-brand,.email-title{color:#272c28!important}
    .email-copy{color:#625f56!important}
    .email-muted{color:#777267!important}
    .email-link{color:#815510!important}
    .email-footer{background:#f7f4ec!important}
    .email-button{background:#b8791d!important;color:#fffdf7!important}
    ${email.theme ? "" : "@media(prefers-color-scheme:dark){"}
      ${email.theme ? "" : `
      body,.email-bg{background:#10171d!important;color:#e8e7e1!important}
      .email-card{background:#182129!important;color:#e8e7e1!important}
      .email-brand,.email-title{color:#f3f0e8!important}
      .email-copy{color:#c5c7c2!important}
      .email-muted{color:#a0aaa9!important}
      .email-link{color:#e6bd70!important}
      .email-footer{background:#141c23!important}
      .email-button{background:#d69b36!important;color:#171b1e!important}
      .email-rule{border-color:#303b43!important}
    }`}
    ${email.theme === 'dark' ? 'body,.email-bg{background:#10171d!important;color:#e8e7e1!important}.email-card{background:#182129!important;color:#e8e7e1!important}.email-brand,.email-title{color:#f3f0e8!important}.email-copy{color:#c5c7c2!important}.email-muted{color:#a0aaa9!important}.email-link{color:#e6bd70!important}.email-footer{background:#141c23!important}.email-button{background:#d69b36!important;color:#171b1e!important}.email-rule{border-color:#303b43!important}' : ''}
    @media(max-width:600px){.email-wrapper{padding:18px 12px!important}.email-content{padding:32px 24px!important}.email-title{font-size:27px!important}.email-footer{padding:18px 24px!important}.email-button{display:block!important;text-align:center!important}}
  </style>
</head>
<body style="margin:0;padding:0;background:#f1eee6;color:#292b27;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(content.copy.slice(0,140))}</div>
  <table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" style="background:#f1eee6;">
    <tr><td class="email-wrapper" align="center" style="padding:40px 16px;">
      <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fffdf8;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 36px 18px;">
          <a class="email-brand" href="${appUrl}" style="display:inline-flex;color:#272c28;text-decoration:none;font-size:20px;font-weight:750;letter-spacing:-.55px;">
            <img src="${appUrl}/brand/vivreplay-compass.png" width="28" height="28" alt="" style="display:block;width:28px;height:28px;margin-right:9px;vertical-align:middle;border:0;" />
            <span style="line-height:28px;">VivrePlay</span>
          </a>
        </td></tr>
        <tr><td class="email-content" style="padding:38px 48px 42px;">
          <p class="email-muted" style="margin:0 0 12px;color:#8b6a34;font-size:11px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(content.eyebrow)}</p>
          <h1 class="email-title" style="margin:0 0 16px;color:#272c28;font-size:32px;line-height:1.15;font-weight:700;letter-spacing:-1px;">${escapeHtml(content.title)}</h1>
          <p class="email-copy" style="margin:0 0 28px;color:#625f56;font-size:16px;line-height:1.65;">${escapeHtml(content.copy)}</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 26px;"><tr><td>
            <a class="email-button" href="${safeTarget}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 21px;border-radius:7px;background:#b8791d;color:#fffdf7;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;">${escapeHtml(content.action)} &rarr;</a>
          </td></tr></table>
          ${content.showLinkFallback ? `<p class="email-muted" style="margin:0 0 6px;color:#777267;font-size:12px;line-height:1.5;">${id?'Jika tombol tidak berfungsi, buka tautan ini:':'If the button doesn’t work, open this link:'}</p><p style="margin:0 0 25px;font-size:12px;line-height:1.6;word-break:break-all;"><a class="email-link" href="${safeTarget}" style="color:#815510;text-decoration:underline;">${safeTarget}</a></p>` : ""}
          <p class="email-rule email-muted" style="margin:0;padding-top:17px;border-top:1px solid #e7e2d7;color:#777267;font-size:12px;line-height:1.6;">${escapeHtml(content.note)}</p>
        </td></tr>
        <tr><td class="email-footer email-rule" style="padding:19px 36px;background:#f7f4ec;border-top:1px solid #e7e2d7;">
          <p style="margin:0 0 9px;font-size:12px;line-height:1.7;">
            <a class="email-link" href="${appUrl}/cards" style="color:#815510;text-decoration:none;">${id?'Kartu':'Cards'}</a><span class="email-muted" style="color:#aaa59a;">&nbsp; | &nbsp;</span><a class="email-link" href="${appUrl}/decks" style="color:#815510;text-decoration:none;">Deck</a><span class="email-muted" style="color:#aaa59a;">&nbsp; | &nbsp;</span><a class="email-link" href="${appUrl}/vault" style="color:#815510;text-decoration:none;">${id?'Koleksi':'Vault'}</a><span class="email-muted" style="color:#aaa59a;">&nbsp; | &nbsp;</span><a class="email-link" href="${appUrl}/market" style="color:#815510;text-decoration:none;">Market</a>
          </p>
          <p class="email-muted" style="margin:0;color:#777267;font-size:11px;line-height:1.6;">${id?'Dikirim ke':'Sent to'} <strong>${safeTo}</strong>. ${id?'Perlu bantuan?':'Need help?'} <a class="email-link" href="mailto:${DEFAULT_SUPPORT_EMAIL}" style="color:#815510;text-decoration:none;">${DEFAULT_SUPPORT_EMAIL}</a></p>
        </td></tr>
      </table>
      <p class="email-muted" style="max-width:560px;margin:14px 0 0;color:#827e74;font-size:11px;line-height:1.5;">${id?'VivrePlay | Pendamping One Piece Card Game':'VivrePlay | A companion for the One Piece Card Game'}</p>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `VivrePlay

${content.title}

${content.copy}

${content.action}:
${target}

${content.note}

${id?'Kartu | Deck | Koleksi | Market':'Cards | Deck | Vault | Market'}
${id?'Dikirim ke':'Sent to'}: ${email.to}
${id?'Bantuan':'Support'}: ${DEFAULT_SUPPORT_EMAIL}
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
