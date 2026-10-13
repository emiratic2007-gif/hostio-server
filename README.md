# Hostio server

Prima WhatsApp poruke, AI razgovara s mušterijom i upisuje termine u Supabase.

## Postavke (environment variables)

| Naziv | Šta je |
|---|---|
| `SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase > Project Settings > API > service_role ključ (tajno) |
| `GROQ_API_KEY` | console.groq.com > API Keys (tajno). Ako postoji, koristi se besplatni model. |
| `ANTHROPIC_API_KEY` | console.anthropic.com > API Keys (tajno). Koristi se ako nema Groq ključa. |
| `WHATSAPP_TOKEN` | Meta > WhatsApp > API Setup > Access token (tajno) |
| `WHATSAPP_VERIFY_TOKEN` | bilo koja riječ koju izmisliš, ista se upiše u Meta webhook |
| `META_APP_SECRET` | Meta > App settings > Basic > App secret (tajno) |
| `FREE_AI_MODEL` | opcionalno, zadano `openai/gpt-oss-120b` |
| `FREE_AI_URL` | opcionalno, zadano Groq; radi i s drugim OpenAI-kompatibilnim servisima |
| `MODEL` | opcionalno Claude model, zadano `claude-haiku-5-5` |
| `REPLY_DELAY_SECONDS` | opcionalno, koliko sekundi Hostio čeka nove poruke prije odgovora, zadano `6` |

## Netlify
- `netlify/functions/webhook.mjs` je adresa `/webhook` koju upisuješ u Meta (Callback URL). Brzo odgovori Meti i preda poruku dalje.
- `netlify/functions/process.mjs` je background funkcija (do 15 minuta) koja pita AI i upisuje termin.
- `lib/` sadrži sav Hostio kod, `public/index.html` je početna stranica ("Hostio radi.").
- `server.js` se na Netlifyju ne koristi; služi samo ako Hostio pokrećeš kao običan server.

## Test
`npm test` provjerava pravila za termine i vremenske zone.
