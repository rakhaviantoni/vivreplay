declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    CARD_IMAGES?: R2Bucket;
    BETTER_AUTH_URL?: string;
    BETTER_AUTH_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    ARENA_SERVICE_ORIGIN?: string;
    ARENA_TICKET_SECRET?: string;
    SUPABASE_SECRET_KEY?: string;
  }
}
