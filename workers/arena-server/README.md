# VivrePlay Arena Worker

This Worker owns one Durable Object per online Arena room. It keeps the room's seats, phase, turn, and event stream authoritative, then broadcasts snapshots over hibernating WebSockets.

Set the same `ARENA_TICKET_SECRET` in this Worker and the main VivrePlay Worker. Set `ARENA_SERVICE_ORIGIN` in the main VivrePlay Worker to this Worker's public origin. Deploy with `npx wrangler deploy --config workers/arena-server/wrangler.jsonc`.
