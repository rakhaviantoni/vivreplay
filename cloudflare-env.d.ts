declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ARENA_SERVICE_ORIGIN?: string;
    ARENA_TICKET_SECRET?: string;
  }
}
