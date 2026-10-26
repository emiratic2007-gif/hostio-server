# Hostio server (Supabase Edge Function "hostio")

Address: https://eauwnwvieyepzrbildqt.supabase.co/functions/v1/hostio

- `/webhook`: WhatsApp (Meta). Verified with META_APP_SECRET.
- `/status?kljuc=<WHATSAPP_VERIFY_TOKEN>`: health check of every part.
  - `&preusmjeri=da` points the WhatsApp number to this server.
  - `&waba=<id>&pretplati=da` subscribes the WhatsApp account.
- `/api/*`: owner dashboard. `/api/rc/*`: rent-a-car agency websites. `/api/coach/*`: personal coaching websites (e.g. /mofit) and the coach dashboard (/dashboard/coach/).

Secrets (Supabase → Edge Functions → Secrets): WHATSAPP_TOKEN, WHATSAPP_VERIFY_TOKEN,
META_APP_SECRET, GROQ_API_KEY or ANTHROPIC_API_KEY. SUPABASE_URL, SUPABASE_ANON_KEY and
SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

Publishing a new version: push to GitHub, then deploy the one-line `index.ts`
(`import "https://raw.githubusercontent.com/emiratic2007-gif/hostio-server/<commit>/edge/hostio.js";`)
with JWT verification off. The code itself checks Meta signatures and owner logins.

Websites (dashboard, /r/{slug}) are static files in `public/` on Cloudflare (Worker "hostio-server", see wrangler.jsonc). `cloudflare/worker.js` forwards
`/api/*` and `/status` to this server, so pages keep using relative `/api/...` addresses.
