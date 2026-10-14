// Connecting a business's Instagram professional account to Hostio (Instagram Login),
// and keeping its access token fresh (tokens last 60 days; we renew them weekly).
import crypto from "node:crypto";
import { env, Buffer } from "./env.js";
import { db, log } from "./db.js";

const APP_ID = env("INSTAGRAM_APP_ID");
const APP_SECRET = env("INSTAGRAM_APP_SECRET");
const VERSION = env("GRAPH_VERSION", "v25.0");
const SITE = env("PUBLIC_SITE_URL", "https://hostio-server.emir-atic2007.workers.dev").replace(/\/$/, "");
const REDIRECT = `${SITE}/api/ig/povratak`;
const SCOPES = "instagram_business_basic,instagram_business_manage_messages";

const b64 = (s) => Buffer.from(s).toString("base64url");
const sign = (s) => crypto.createHmac("sha256", APP_SECRET || "x").update(s).digest("base64url");
const page = (path, params) => new Response(null, { status: 302, headers: { location: `${SITE}${path}?${new URLSearchParams(params)}` } });

// Step 1: /api/ig/povezi?biz=<slug>&kljuc=<WHATSAPP_VERIFY_TOKEN>  → Instagram login page
export async function connectStart(url) {
  if (!APP_ID || !APP_SECRET) return new Response("Na serveru nedostaju INSTAGRAM_APP_ID i INSTAGRAM_APP_SECRET.", { status: 500 });
  if (url.searchParams.get("kljuc") !== env("WHATSAPP_VERIFY_TOKEN")) return new Response("Pogrešan ključ.", { status: 403 });
  const slug = url.searchParams.get("biz") || "";
  const [biz] = await db(`businesses?slug=eq.${encodeURIComponent(slug)}&select=id`);
  if (!biz) return new Response("Nema biznisa " + slug, { status: 404 });
  const payload = b64(JSON.stringify({ b: biz.id, s: slug, e: Date.now() + 15 * 60e3 }));
  const state = `${payload}.${sign(payload)}`;
  const auth = new URL("https://www.instagram.com/oauth/authorize");
  auth.search = new URLSearchParams({ client_id: APP_ID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPES, state, enable_fb_login: "false", force_reauth: "true" });
  return new Response(null, { status: 302, headers: { location: auth.toString() } });
}

// Step 2: Instagram sends the person back here with a one-time code.
export async function connectFinish(url) {
  const fail = (why) => { log("Instagram povezivanje:", why); return page("/povezano.html", { ok: "0", razlog: why }); };
  if (url.searchParams.get("error")) return fail(url.searchParams.get("error_description") || "odbijeno");
  const [payload, sig] = String(url.searchParams.get("state") || "").split(".");
  if (!payload || sig !== sign(payload)) return fail("neispravan zahtjev");
  const st = JSON.parse(Buffer.from(payload, "base64url").toString());
  if (Date.now() > st.e) return fail("link je istekao, pokušaj ponovo");
  const code = String(url.searchParams.get("code") || "").replace(/#_$/, "");
  if (!code) return fail("nema koda");

  const form = new URLSearchParams({ client_id: APP_ID, client_secret: APP_SECRET, grant_type: "authorization_code", redirect_uri: REDIRECT, code });
  const r1 = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const d1 = await r1.json().catch(() => ({}));
  const short = d1.access_token || d1.data?.[0]?.access_token;
  if (!short) return fail("zamjena koda nije uspjela: " + (d1.error_message || d1.error?.message || r1.status));

  const r2 = await fetch(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: "ig_exchange_token", client_secret: APP_SECRET, access_token: short })}`);
  const d2 = await r2.json().catch(() => ({}));
  if (!d2.access_token) return fail("dugi token nije dobijen: " + (d2.error?.message || r2.status));
  const token = d2.access_token;

  const r3 = await fetch(`https://graph.instagram.com/${VERSION}/me?fields=user_id,username,id&access_token=${encodeURIComponent(token)}`);
  const me = await r3.json().catch(() => ({}));
  if (!me.user_id) return fail("profil nije pročitan: " + (me.error?.message || r3.status));

  await db("ig_accounts?on_conflict=ig_user_id", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: {
    business_id: st.b, ig_user_id: String(me.user_id), app_user_id: String(me.id || ""), username: me.username || null, access_token: token,
    token_expires_at: new Date(Date.now() + (Number(d2.expires_in) || 5184000) * 1000).toISOString(), token_refreshed_at: new Date().toISOString(), active: true,
  } });

  // Ask Instagram to send this account's messages to our webhook.
  const r4 = await fetch(`https://graph.instagram.com/${VERSION}/me/subscribed_apps?subscribed_fields=messages&access_token=${encodeURIComponent(token)}`, { method: "POST" });
  const d4 = await r4.json().catch(() => ({}));
  if (!r4.ok || d4.success === false) return fail("pretplata na poruke nije uspjela: " + (d4.error?.message || r4.status));
  log("Instagram povezan:", st.s, "@" + me.username, me.user_id);
  return page("/povezano.html", { ok: "1", ime: me.username || "", biz: st.s });
}

// Renew tokens older than 7 days (each renewal gives 60 more days).
export async function refreshInstagramTokens() {
  const old = new Date(Date.now() - 7 * 864e5).toISOString();
  const rows = await db(`ig_accounts?active=eq.true&token_refreshed_at=lt.${encodeURIComponent(old)}&select=id,username,access_token`);
  let done = 0;
  for (const a of rows) {
    const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(a.access_token)}`);
    const d = await r.json().catch(() => ({}));
    if (!d.access_token) { log("GREŠKA obnova Instagram tokena", a.username, d.error?.message || r.status); continue; }
    await db(`ig_accounts?id=eq.${a.id}`, { method: "PATCH", prefer: "return=minimal", body: {
      access_token: d.access_token, token_refreshed_at: new Date().toISOString(),
      token_expires_at: new Date(Date.now() + (Number(d.expires_in) || 5184000) * 1000).toISOString(),
    } });
    done++;
  }
  return { obnovljeno: done, provjereno: rows.length };
}

export async function instagramStatus() {
  const out = [];
  out.push({ name: "Instagram ključevi (INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET)", ok: !!(APP_ID && APP_SECRET), note: APP_ID && APP_SECRET ? "" : "nedostaju u Secrets (potrebno samo za Instagram)" });
  const rows = await db("ig_accounts?active=eq.true&select=ig_user_id,username,access_token,token_expires_at,businesses(slug)");
  for (const a of rows) {
    const r = await fetch(`https://graph.instagram.com/${VERSION}/me?fields=username&access_token=${encodeURIComponent(a.access_token)}`);
    const d = await r.json().catch(() => ({}));
    const days = a.token_expires_at ? Math.round((new Date(a.token_expires_at) - Date.now()) / 864e5) : "?";
    out.push({ name: `Instagram @${a.username} → ${a.businesses?.slug}`, ok: r.ok, note: r.ok ? `token vrijedi još ${days} dana` : (d.error?.message || r.status) });
  }
  if (!rows.length) out.push({ name: "Povezani Instagram profili", ok: false, note: "nijedan još nije povezan" });
  return out;
}
