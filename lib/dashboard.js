// Dashboard API: owners log in with Supabase Auth; every request is checked
// against businesses.owner_id, so an owner only ever sees their own business.
import { db, log, sendWhatsApp } from "./hostio.js";
import { toLocal, fmtDate, toT } from "./rules.js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const ANON_KEY = process.env.SUPABASE_ANON_KEY;
const q = encodeURIComponent;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ greska: msg }, status);

async function authCall(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}
const session = (d) => ({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: Date.now() + (d.expires_in || 3600) * 1000 });

async function currentOwner(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  const [biz] = await db(`businesses?owner_id=eq.${q(user.id)}&select=id,slug,name,city,timezone,whatsapp_phone_id&limit=1`);
  return biz ? { user, biz } : { user, biz: null };
}

export async function handleApi(req) {
  if (!ANON_KEY) return fail("Na serveru nedostaje SUPABASE_ANON_KEY.", 500);
  const route = new URL(req.url).pathname.replace(/^\/api\/?/, "");
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (route === "prijava" && req.method === "POST") {
    const email = String(body.email || "").trim(), password = String(body.lozinka || "");
    if (!email || !password) return fail("Upišite email i lozinku.");
    const r = await authCall("token?grant_type=password", { email, password });
    if (!r.ok) return fail("Pogrešan email ili lozinka.", 401);
    return json(session(r.data));
  }
  if (route === "osvjezi" && req.method === "POST") {
    const r = await authCall("token?grant_type=refresh_token", { refresh_token: String(body.refresh_token || "") });
    if (!r.ok) return fail("Prijava je istekla.", 401);
    return json(session(r.data));
  }

  const me = await currentOwner(req);
  if (!me) return fail("Prijava je istekla. Prijavite se ponovo.", 401);
  if (!me.biz) return fail("Ovaj račun još nije povezan ni s jednim biznisom. Javite se Hostio podršci.", 403);
  const biz = me.biz, tz = biz.timezone || "Europe/Sarajevo";

  if (route === "podaci" && req.method === "GET") {
    const from = new Date(Date.now() - 120 * 864e5).toISOString();
    const rows = await db(`bookings?business_id=eq.${biz.id}&start_at=gte.${q(from)}&select=id,start_at,end_at,service_name,customer_name,customer_phone,wa_phone,source,status,created_at,cancelled_at&order=start_at.asc&limit=2000`);
    return json({ biznis: { naziv: biz.name, grad: biz.city, tz }, termini: rows });
  }

  if (route === "razgovor" && req.method === "GET") {
    const wa = new URL(req.url).searchParams.get("wa") || "";
    if (!/^\d{6,20}$/.test(wa)) return json({ poruke: [] });
    const rows = await db(`messages?business_id=eq.${biz.id}&customer_phone=eq.${q(wa)}&select=role,content,created_at&order=created_at.desc&limit=60`);
    return json({ poruke: rows.reverse() });
  }

  if (route === "otkazi" && req.method === "POST") {
    const id = String(body.id || "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) return fail("Neispravan termin.");
    const [b] = await db(`bookings?id=eq.${id}&business_id=eq.${biz.id}&select=id,start_at,service_name,customer_name,wa_phone,status`);
    if (!b) return fail("Termin nije pronađen.", 404);
    if (b.status !== "aktivno") return json({ otkazano: true, obavijesten: false, vec: true });
    await db(`bookings?id=eq.${id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal", body: { status: "otkazano", cancelled_at: new Date().toISOString() } });
    log("dashboard cancel", biz.slug, id);
    let obavijesten = false;
    if (b.wa_phone && biz.whatsapp_phone_id && new Date(b.start_at) > new Date()) {
      const l = toLocal(b.start_at, tz);
      const ime = (b.customer_name || "").split(" ")[0];
      const text = `Poštovani${ime ? " " + ime : ""}, Vaš termin (${b.service_name}, ${fmtDate(l.date)} u ${toT(l.min)}) je nažalost otkazan. Za novi termin slobodno nam pišite ovdje.`;
      obavijesten = await sendWhatsApp(biz.whatsapp_phone_id, b.wa_phone, text);
      if (obavijesten) await db("messages", { method: "POST", prefer: "return=minimal", body: { business_id: biz.id, customer_phone: b.wa_phone, role: "assistant", content: text } });
    }
    return json({ otkazano: true, obavijesten });
  }

  return fail("Nepoznata adresa.", 404);
}
