declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    VIVREPLAY_IMAGE_CACHE?: KVNamespace;
    ARENA_SERVICE_ORIGIN?: string;
    ARENA_TICKET_SECRET?: string;
    SUPABASE_SECRET_KEY?: string;
  }
}
