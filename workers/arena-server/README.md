# VivrePlay Arena Worker

This Worker currently provides the Arena room transport prototype: one Durable Object per room, two authenticated seats, a simple phase/turn marker, and a bounded move event log broadcast over hibernating WebSockets. It does not yet execute or validate moves through the card rules engine, validate deck legality, or run an AI seat. Keep Ranked and Friendly unavailable in the app until that integration is complete.

The repeatable local AI-vs-AI smoke test is `npm run play:simulate:ai -- <seed>`. It uses vanilla cards and the domain combat functions to exercise setup, DON!!, normal plays, attacks, battle, Life, turn rotation, and deck-out; it deliberately excludes card effects and does not exercise Durable Objects.

Set the same `ARENA_TICKET_SECRET` in this Worker and the main VivrePlay Worker. Set `ARENA_SERVICE_ORIGIN` in the main VivrePlay Worker to this Worker's public origin. Deploy with `npx wrangler deploy --config workers/arena-server/wrangler.jsonc`.
