// Hostio server on Supabase Edge Functions (one function, "hostio").
// Public address: https://<project>.supabase.co/functions/v1/hostio/<route>
//   /webhook          WhatsApp (Meta) — answers at once, the AI works in the background
//   /status?kljuc=…   health check of every part
//   /api/rc/*         rent-a-car agency websites
//   /api/ig/povezi    connect a business's Instagram account (then /api/ig/povratak)
//   /cron             daily maintenance (Instagram token renewal)
//   /api/rco/*        rent-a-car owner dashboard
//   /api/*            salon owner dashboard (and login for both)
import { verifyChallenge, validSignature, processWebhook, statusReport, log } from "../lib/hostio.js";
import { handleApi } from "../lib/dashboard.js";
import { handleRentApi } from "../lib/rentacar.js";
import { handleRcOwner } from "../lib/rc_owner.js";
import { connectStart, connectFinish, refreshInstagramTokens, instagramStatus } from "../lib/instagram.js";
import { db } from "../lib/db.js";
import { env, Buffer } from "../lib/env.js";

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8" } });
// Keeps background work alive after the answer is sent (Supabase), or simply awaits it elsewhere.
const later = (p) => (globalThis.EdgeRuntime?.waitUntil ? globalThis.EdgeRuntime.waitUntil(p) : p);

// Rebuild the request with a clean path ("/api/podaci"), so the shared handlers see the same URLs as before.
async function withPath(req, path) {
  const src = new URL(req.url);
  const url = new URL(path + src.search, src.origin);
  const hasBody = !["GET", "HEAD"].includes(req.method);
  return new Request(url, { method: req.method, headers: req.headers, body: hasBody ? await req.arrayBuffer() : undefined });
}

export async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/(functions\/v1\/)?hostio/, "") || "/";

  if (path === "/webhook") {
    if (req.method === "GET") {
      const c = verifyChallenge(url);
      return new Response(c ?? "forbidden", { status: c ? 200 : 403 });
    }
    if (req.method === "POST") {
      const raw = Buffer.from(await req.arrayBuffer());
      const sig = req.headers.get("x-hub-signature-256") || "";
      if (!validSignature(raw, sig)) return new Response("", { status: 401 });
      later(processWebhook(raw, sig).catch((e) => log("GREŠKA webhook:", e.message)));
      return new Response("ok");
    }
    return new Response("", { status: 405 });
  }

  if (path === "/status") {
    const p = url.searchParams, key = p.get("kljuc");
    if (!key || key !== env("WHATSAPP_VERIFY_TOKEN")) return json({ greska: "Dodaj ?kljuc=<tvoj WHATSAPP_VERIFY_TOKEN> na kraj adrese." }, 403);
    const base = env("PUBLIC_WEBHOOK_BASE") || `${env("SUPABASE_URL")}/functions/v1/hostio`;
    const rows = await statusReport({ waba: p.get("waba"), subscribe: p.get("pretplati") === "da", redirect: p.get("preusmjeri") === "da", baseUrl: base });
    try { rows.push(...await instagramStatus()); } catch (e) { rows.push({ name: "Instagram", ok: false, note: e.message }); }
    return json({ status: rows });
  }

  // Daily maintenance (called by the database scheduler with a private key).
  if (path === "/cron" && req.method === "POST") {
    const [k] = await db("app_secrets?name=eq.cron_key&select=value");
    if (!k || req.headers.get("x-cron-key") !== k.value) return json({ greska: "zabranjeno" }, 403);
    return json({ instagram: await refreshInstagramTokens() });
  }

  if (path === "/api/ig/povezi") return connectStart(url);
  if (path === "/api/ig/povratak") return connectFinish(url);
  if (path.startsWith("/api/rc/")) return handleRentApi(await withPath(req, path));
  if (path.startsWith("/api/rco/")) return handleRcOwner(await withPath(req, path));
  if (path.startsWith("/api/")) return handleApi(await withPath(req, path));
  return json({ greska: "nepoznato" }, 404);
}

if (globalThis.Deno?.serve) {
  Deno.serve(async (req) => {
    try { return await handle(req); }
    catch (e) { log("GREŠKA server:", e.message); return json({ greska: "server" }, 500); }
  });
}
