import { env } from "cloudflare:workers";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { sendAuthEmail } from "@/lib/auth-email";

const authEnv = env as Cloudflare.Env;
const baseURL = authEnv.BETTER_AUTH_URL || "https://vivreplay.com";

export const auth = betterAuth({
  database: authEnv.DB,
  secret: authEnv.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({ action: "reset", to: user.email, name: user.name, url });
    },
    onPasswordReset: async ({ user }) => {
      await sendAuthEmail({ action: "password-changed", to: user.email, name: user.name });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({ action: "verify", to: user.email, name: user.name, url });
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
