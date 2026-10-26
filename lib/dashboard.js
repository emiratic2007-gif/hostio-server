// Dashboard API: owners log in with Supabase Auth; every request is checked
// against businesses.owner_id, so an owner only ever sees their own business.
import { db, log, sendWhatsApp, loadContext } from "./hostio.js";
import { toLocal, fmtDate, toT, freeSlots, localToUtc, localNow } from "./rules.js";

import { env } from "./env.js";
const SUPABASE_URL = env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY");
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
  const [biz] = await db(`businesses?owner_id=eq.${q(user.id)}&template=eq.salon&select=id,slug,name,city,timezone,whatsapp_phone_id,reminders_enabled&limit=1`);
  if (biz) return { user, biz };
  // Other kinds of business have their own dashboard.
  const [other] = await db(`businesses?owner_id=eq.${q(user.id)}&select=template&limit=1`);
  const redirect = { rentacar: "/dashboard/rentacar/", coach: "/dashboard/coach/" }[other?.template] || null;
  return { user, biz: null, redirect };
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
  if (!me.biz && me.redirect) return json({ greska: "Ovaj račun ima svoj dashboard.", idi: me.redirect }, 409);
  if (!me.biz) return fail("Ovaj račun još nije povezan ni s jednim biznisom. Javite se Hostio podršci.", 403);
  const biz = me.biz, tz = biz.timezone || "Europe/Sarajevo";

  if (route === "podaci" && req.method === "GET") {
    const from = new Date(Date.now() - 120 * 864e5).toISOString();
    const rows = await db(`bookings?business_id=eq.${biz.id}&start_at=gte.${q(from)}&select=id,start_at,end_at,service_name,customer_name,customer_phone,wa_phone,source,status,created_at,cancelled_at,reminder_sent_at,confirmed_at&order=start_at.asc&limit=2000`);
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

  if (route === "postavke" && req.method === "GET") return json(await readSettings(biz));

  if (route === "postavke" && req.method === "POST") {
    const v = validateSettings(body);
    if (v.greska) return fail(v.greska);
    await saveSettings(biz, v);
    log("dashboard settings saved", biz.slug);
    return json(await readSettings({ ...biz, name: v.naziv, city: v.grad, reminders_enabled: v.podsjetnik }));
  }

  if (route === "slobodno" && req.method === "GET") {
    const p = new URL(req.url).searchParams;
    const ctx = await loadContext(biz);
    const s = ctx.services.find((x) => x.id === p.get("usluga"));
    if (!s) return fail("Izaberite uslugu.");
    try { const r = freeSlots(ctx, String(p.get("datum") || ""), s.name); return json({ slobodno: r.slobodno, zatvoreno: !!r.zatvoreno }); }
    catch (e) { return fail(e.message); }
  }

  if (route === "termin" && req.method === "POST") {
    const ctx = await loadContext(biz);
    const s = ctx.services.find((x) => x.id === String(body.usluga || ""));
    if (!s) return fail("Izaberite uslugu.");
    const datum = String(body.datum || ""), vrijeme = String(body.vrijeme || "");
    const ime = String(body.ime || "").trim().slice(0, 80), telefon = String(body.telefon || "").trim().slice(0, 30);
    if (!ime) return fail("Upišite ime i prezime klijenta.");
    if (telefon.replace(/\D/g, "").length < 6) return fail("Upišite ispravan broj telefona.");
    let r; try { r = freeSlots(ctx, datum, s.name); } catch (e) { return fail(e.message); }
    if (!r.slobodno.includes(vrijeme)) return fail("Taj termin više nije slobodan. Izaberite drugo vrijeme.");
    const start = localToUtc(datum, vrijeme, ctx.tz);
    const end = new Date(new Date(start).getTime() + s.minutes * 60000).toISOString();
    try {
      await db("bookings", { method: "POST", prefer: "return=minimal", body: {
        business_id: biz.id, service_id: s.id, service_name: s.name, start_at: start, end_at: end,
        customer_name: ime, customer_phone: telefon, wa_phone: toWaPhone(telefon), source: "rucno",
      } });
    } catch (e) {
      if (e.code === "23P01") return fail("Taj termin je upravo zauzet. Izaberite drugo vrijeme.");
      throw e;
    }
    log("dashboard manual booking", biz.slug, datum, vrijeme);
    return json({ upisano: true });
  }

  return fail("Nepoznata adresa.", 404);
}

// "061 234 567" -> "38761234567", so a client added by hand can later cancel from that WhatsApp number.
function toWaPhone(phone) {
  let d = String(phone).replace(/\D/g, "");
  if (String(phone).trim().startsWith("+")) return d || null;
  if (d.startsWith("00")) return d.slice(2);
  if (d.startsWith("0")) return "387" + d.slice(1);
  return d.length >= 8 ? d : null;
}

const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

async function readSettings(biz) {
  const tz = biz.timezone || "Europe/Sarajevo", today = localNow(tz).date;
  const [services, hours, closed] = await Promise.all([
    db(`services?business_id=eq.${biz.id}&active=eq.true&select=id,name,minutes,price&order=name`),
    db(`working_hours?business_id=eq.${biz.id}&select=weekday,opens,closes`),
    db(`closed_dates?business_id=eq.${biz.id}&day=gte.${today}&select=day&order=day`),
  ]);
  const radno = {}; for (let d = 0; d < 7; d++) radno[d] = null;
  for (const h of hours) radno[h.weekday] = [h.opens.slice(0, 5), h.closes.slice(0, 5)];
  return {
    biznis: { naziv: biz.name, grad: biz.city || "" }, podsjetnik: biz.reminders_enabled !== false,
    usluge: services.map((s) => ({ id: s.id, naziv: s.name, min: s.minutes, cijena: Number(s.price) })),
    radno, neradni: closed.map((c) => c.day),
  };
}

function validateSettings(b) {
  const naziv = String(b?.biznis?.naziv || "").trim().slice(0, 80), grad = String(b?.biznis?.grad || "").trim().slice(0, 60);
  if (!naziv) return { greska: "Upišite naziv biznisa." };
  const usluge = Array.isArray(b.usluge) ? b.usluge : [];
  if (!usluge.length) return { greska: "Dodajte barem jednu uslugu." };
  if (usluge.length > 40) return { greska: "Najviše 40 usluga." };
  const names = new Set(), out = [];
  for (const u of usluge) {
    const n = String(u.naziv || "").trim().slice(0, 60), m = Math.round(Number(u.min)), c = Number(u.cijena);
    if (!n) return { greska: "Svaka usluga mora imati naziv." };
    if (names.has(n.toLowerCase())) return { greska: `Usluga "${n}" je upisana dvaput.` };
    names.add(n.toLowerCase());
    if (!(m >= 5 && m <= 600)) return { greska: `Trajanje za "${n}" mora biti između 5 i 600 minuta.` };
    if (!(c >= 0 && c <= 100000)) return { greska: `Cijena za "${n}" nije ispravna.` };
    out.push({ id: typeof u.id === "string" && /^[0-9a-f-]{36}$/i.test(u.id) ? u.id : null, naziv: n, min: m, cijena: Math.round(c * 100) / 100 });
  }
  const radno = {};
  for (let d = 0; d < 7; d++) {
    const h = b?.radno?.[d];
    if (!h) { radno[d] = null; continue; }
    if (!HM.test(h[0]) || !HM.test(h[1])) return { greska: "Radno vrijeme nije ispravno upisano." };
    if (h[1] <= h[0]) return { greska: "Kraj radnog vremena mora biti poslije početka." };
    radno[d] = [h[0], h[1]];
  }
  if (!Object.values(radno).some(Boolean)) return { greska: "Barem jedan dan mora biti radni." };
  const neradni = [...new Set((Array.isArray(b.neradni) ? b.neradni : []).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)))].slice(0, 200);
  return { naziv, grad, usluge: out, radno, neradni, podsjetnik: b.podsjetnik !== false };
}

async function saveSettings(biz, v) {
  const P = { prefer: "return=minimal" };
  await db(`businesses?id=eq.${biz.id}`, { method: "PATCH", ...P, body: { name: v.naziv, city: v.grad, reminders_enabled: v.podsjetnik } });
  const existing = await db(`services?business_id=eq.${biz.id}&active=eq.true&select=id`);
  const keep = new Set();
  for (const u of v.usluge) {
    const row = { name: u.naziv, minutes: u.min, price: u.cijena, active: true };
    if (u.id && existing.some((e) => e.id === u.id)) { keep.add(u.id); await db(`services?id=eq.${u.id}&business_id=eq.${biz.id}`, { method: "PATCH", ...P, body: row }); }
    else await db("services", { method: "POST", ...P, body: { ...row, business_id: biz.id } });
  }
  for (const e of existing) if (!keep.has(e.id)) await db(`services?id=eq.${e.id}&business_id=eq.${biz.id}`, { method: "PATCH", ...P, body: { active: false } });
  await db(`working_hours?business_id=eq.${biz.id}`, { method: "DELETE", ...P });
  const hours = Object.entries(v.radno).filter(([, h]) => h).map(([d, h]) => ({ business_id: biz.id, weekday: Number(d), opens: h[0], closes: h[1] }));
  if (hours.length) await db("working_hours", { method: "POST", ...P, body: hours });
  const today = localNow(biz.timezone || "Europe/Sarajevo").date;
  await db(`closed_dates?business_id=eq.${biz.id}&day=gte.${today}`, { method: "DELETE", ...P });
  const days = v.neradni.filter((d) => d >= today).map((d) => ({ business_id: biz.id, day: d }));
  if (days.length) await db("closed_dates", { method: "POST", ...P, body: days });
}
