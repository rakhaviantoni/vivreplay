import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { sendAuthEmail } from "@/lib/auth-email";
import { z } from "zod";

const authEnv = env as Cloudflare.Env;
const baseURL = authEnv.BETTER_AUTH_URL || "https://vivreplay.com";
const trustedOrigins = [new URL(baseURL).origin];
const authHostname = new URL(baseURL).hostname;
if (authHostname === 'vivreplay.com') trustedOrigins.push('https://www.vivreplay.com');
if (authHostname === 'www.vivreplay.com') trustedOrigins.push('https://vivreplay.com');
async function preferredEmailLocale(authSubject:string):Promise<'en'|'id'>{
  try{
    if(!authEnv.DB)return'en';
    const profile=await authEnv.DB.prepare('SELECT locale FROM profiles WHERE auth_subject=?').bind(authSubject).first<{locale:string}>();
    return profile?.locale?.toLowerCase().startsWith('id')?'id':'en';
  }catch{return'en'}
}

export const auth = betterAuth({
  database: authEnv.DB,
  secret: authEnv.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins,
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: true,
        validator: { input: z.string().regex(/^[a-z0-9_-]{3,30}$/) },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({ action: "reset", to: user.email, name: user.name, url, locale:await preferredEmailLocale(user.id) });
    },
    onPasswordReset: async ({ user }) => {
      await sendAuthEmail({ action: "password-changed", to: user.email, name: user.name, locale:await preferredEmailLocale(user.id) });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({ action: "verify", to: user.email, name: user.name, url, locale:await preferredEmailLocale(user.id) });
    },
  },
  socialProviders: {
    google: {
      clientId: authEnv.GOOGLE_CLIENT_ID as string,
      clientSecret: authEnv.GOOGLE_CLIENT_SECRET as string,
      requireEmailVerification: true,
      prompt: "select_account",
    },
  },
  plugins: [nextCookies()],
});
