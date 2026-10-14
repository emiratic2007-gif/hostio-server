// Rent-a-car public API: agency + fleet, availability, and booking requests with driving licence upload.
// Everything here is public (the agency website), so only safe fields are ever returned.
import crypto from "node:crypto";
import { db, log } from "./db.js";
import { env, Buffer } from "./env.js";
import { sendBookingEmail } from "./rc_email.js";
import { quote, isFree, validDate, todayLocal, addDays, localToUtc } from "../public/rent/core.js";

const SUPABASE_URL = env("SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_KEY");
const q = encodeURIComponent;
const BLOCKING = "status=in.(na_cekanju,odobreno,blokirano)";
const LANGS = ["bs", "en", "de", "ar"];
const MAX_FILE = 4 * 1024 * 1024;

const json = (data, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache } });
const fail = (code, status = 400, extra = {}) => json({ greska: code, ...extra }, status);

const VEHICLE_FIELDS = "id,featured,sort,make,model,year,category,body,color,transmission,fuel,seats,doors,bags,ac,consumption,engine,price_tiers,deposit,description,photos";

async function agencyBySlug(slug) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(slug || ""))) return null;
  const [biz] = await db(`businesses?slug=eq.${q(slug)}&template=eq.rentacar&select=id,slug,name,city,timezone,settings`);
  return biz || null;
}

// Settings that may be shown publicly (everything the website needs, nothing internal).
function publicSettings(s) {
  const pick = ["demo", "currency", "brand", "contact", "hours", "after_hours_fee", "min_days", "min_age", "license_years",
    "buffer_hours", "cancellation_hours", "mileage", "fuel_policy", "locations", "extras", "reviews"];
  return Object.fromEntries(pick.filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
}

// Real occupation of a car: a car that was picked up and is not back yet stays busy (late return),
// and a car brought back is free from the moment it came back.
export function effectiveBusy(rows, now = Date.now()) {
  return rows.map((b) => {
    let end = new Date(b.end_at).getTime();
    if (b.returned_at) end = new Date(b.returned_at).getTime();
    else if (b.picked_up_at && end < now + 3600e3) end = now + 3600e3;
    return { vehicle_id: b.vehicle_id, start_at: b.start_at, end_at: new Date(end).toISOString() };
  });
}

async function busyFor(bizId, fromIso, toIso, vehicleId) {
  const overdue = `or=(end_at.gt.${q(fromIso)},and(picked_up_at.not.is.null,returned_at.is.null))`;
  const rows = await db(`rc_bookings?business_id=eq.${bizId}&${BLOCKING}&${overdue}&start_at=lt.${q(toIso)}` +
    (vehicleId ? `&vehicle_id=eq.${vehicleId}` : "") + "&select=vehicle_id,start_at,end_at,picked_up_at,returned_at&limit=2000");
  return effectiveBusy(rows).filter((b) => b.end_at > fromIso);
}

// ---------- storage (private bucket for licences) ----------
function sniff(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { type: "image/png", ext: "png" };
  if (buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") return { type: "image/webp", ext: "webp" };
  if (buf.slice(0, 4).toString() === "%PDF") return { type: "application/pdf", ext: "pdf" };
  return null;
}
async function upload(path, buf, type) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/rc-licenses/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "content-type": type, "x-upsert": "false" }, body: buf,
  });
  if (!res.ok) throw new Error("upload " + res.status + " " + (await res.text()).slice(0, 200));
}
async function removeFiles(paths) {
  if (!paths.length) return;
  await fetch(`${SUPABASE_URL}/storage/v1/object/rc-licenses`, {
    method: "DELETE", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => {});
}

// ---------- validation helpers ----------
const clean = (v, max = 120) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
const emailOk = (e) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test(e);
function ageOn(birth, onDate) {
  const [by, bm, bd] = birth.split("-").map(Number), [y, m, d] = onDate.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export async function handleRentApi(req) {
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/rc\/?/, "");
  const p = url.searchParams;

  if (route === "agencija" && req.method === "GET") {
    const biz = await agencyBySlug(p.get("slug"));
    if (!biz) return fail("nema_agencije", 404);
    const vehicles = await db(`rc_vehicles?business_id=eq.${biz.id}&active=eq.true&select=${VEHICLE_FIELDS}&order=sort.asc`);
    return json({ agencija: { slug: biz.slug, naziv: biz.name, grad: biz.city, tz: biz.timezone, postavke: publicSettings(biz.settings || {}) }, vozila: vehicles });
  }

  if (route === "dostupnost" && req.method === "GET") {
    const biz = await agencyBySlug(p.get("slug"));
    if (!biz) return fail("nema_agencije", 404);
    const tz = biz.timezone || "Europe/Sarajevo";
    const od = p.get("od") || "", dd = p.get("do") || "";
    const [d1, t1] = od.split("T"), [d2, t2] = dd.split("T");
    if (!validDate(d1) || !validDate(d2)) return fail("datum");
    const start = localToUtc(d1, t1 || "10:00", tz), end = localToUtc(d2, t2 || "10:00", tz);
    if (new Date(end) <= new Date(start)) return fail("redoslijed");
    const buffer = Number(biz.settings?.buffer_hours) || 0;
    const busy = await busyFor(biz.id, new Date(new Date(start) - 2 * 864e5).toISOString(), new Date(new Date(end).getTime() + 2 * 864e5).toISOString());
    const vehicles = await db(`rc_vehicles?business_id=eq.${biz.id}&active=eq.true&select=id`);
    const out = {};
    for (const v of vehicles) out[v.id] = isFree(busy.filter((b) => b.vehicle_id === v.id), start, end, buffer);
    return json({ slobodno: out });
  }

  if (route === "kalendar" && req.method === "GET") {
    const biz = await agencyBySlug(p.get("slug"));
    if (!biz) return fail("nema_agencije", 404);
    const vid = p.get("vozilo") || "";
    if (!/^[0-9a-f-]{36}$/i.test(vid)) return fail("vozilo");
    const from = new Date().toISOString(), to = new Date(Date.now() + 200 * 864e5).toISOString();
    const busy = await busyFor(biz.id, from, to, vid);
    return json({ zauzeto: busy.map((b) => ({ od: b.start_at, do: b.end_at })), buffer: Number(biz.settings?.buffer_hours) || 0 });
  }

  if (route === "zahtjev" && req.method === "POST") return submitRequest(req);

  return fail("nepoznato", 404);
}

async function submitRequest(req) {
  let form;
  try { form = await req.formData(); } catch { return fail("format"); }
  if (clean(form.get("website"))) return json({ ok: true, ref: "OK" }); // honeypot: bots fill hidden fields
  const biz = await agencyBySlug(clean(form.get("slug"), 40));
  if (!biz) return fail("nema_agencije", 404);
  const s = biz.settings || {}, tz = biz.timezone || "Europe/Sarajevo";
  const vid = clean(form.get("vozilo"), 40);
  if (!/^[0-9a-f-]{36}$/i.test(vid)) return fail("vozilo");
  const [vehicle] = await db(`rc_vehicles?id=eq.${vid}&business_id=eq.${biz.id}&active=eq.true&select=${VEHICLE_FIELDS}`);
  if (!vehicle) return fail("vozilo");

  let extras = [];
  try { extras = JSON.parse(String(form.get("dodaci") || "[]")); } catch { return fail("dodatak"); }
  if (!Array.isArray(extras) || extras.length > 10) return fail("dodatak");
  extras = [...new Set(extras.map((x) => clean(x, 40)))];

  const input = {
    vehicle, settings: s, tz,
    pickupDate: clean(form.get("datum_od"), 10), pickupTime: clean(form.get("vrijeme_od"), 5),
    returnDate: clean(form.get("datum_do"), 10), returnTime: clean(form.get("vrijeme_do"), 5),
    pickup: clean(form.get("preuzimanje"), 40), dropoff: clean(form.get("vracanje"), 40) || clean(form.get("preuzimanje"), 40), extras,
  };
  const qt = quote(input);
  if (qt.greska) return fail(qt.greska, 400, qt.min ? { min: qt.min } : {});
  if (new Date(qt.start) < new Date(Date.now() + 2 * 3600e3)) return fail("prerano");
  if (input.pickupDate > addDays(todayLocal(tz), 365)) return fail("predaleko");

  const d = {
    first_name: clean(form.get("ime"), 60), last_name: clean(form.get("prezime"), 60), email: clean(form.get("email"), 160).toLowerCase(),
    phone: clean(form.get("telefon"), 30), birth_date: clean(form.get("datum_rodjenja"), 10), license_number: clean(form.get("broj_dozvole"), 40),
    flight_number: clean(form.get("let"), 20), note: clean(form.get("napomena"), 800), lang: LANGS.includes(form.get("jezik")) ? form.get("jezik") : "bs",
    wa_phone: /^\d{8,15}$/.test(String(form.get("wa") || "")) ? String(form.get("wa")) : null,
  };
  if (!d.first_name || !d.last_name) return fail("ime");
  if (!emailOk(d.email)) return fail("email");
  if (d.phone.replace(/\D/g, "").length < 8) return fail("telefon");
  if (!validDate(d.birth_date)) return fail("datum_rodjenja");
  const age = ageOn(d.birth_date, input.pickupDate);
  if (age < (s.min_age || 18) || age > 100) return fail("godine", 400, { min: s.min_age || 18 });
  if (d.license_number.length < 4) return fail("dozvola");
  if (form.get("uslovi") !== "da") return fail("uslovi");

  // Recent requests from the same phone: stop obvious spam.
  const since = new Date(Date.now() - 864e5).toISOString();
  const recent = await db(`rc_bookings?business_id=eq.${biz.id}&phone=eq.${q(d.phone)}&created_at=gte.${q(since)}&select=id&limit=6`);
  if (recent.length >= 5) return fail("previse", 429);

  // Licence photos (both sides), checked by their real content, not by the file name.
  const files = [];
  for (const side of ["dozvola_prednja", "dozvola_zadnja"]) {
    const f = form.get(side);
    if (!f || typeof f === "string" || !f.size) return fail("slika_dozvole", 400, { strana: side });
    if (f.size > MAX_FILE) return fail("slika_velika", 400, { strana: side });
    const buf = Buffer.from(await f.arrayBuffer());
    const kind = sniff(buf);
    if (!kind) return fail("slika_format", 400, { strana: side });
    files.push({ side, buf, kind });
  }

  // Free? (fast check incl. cleaning buffer; the database constraint is the final guard)
  const buffer = Number(s.buffer_hours) || 0;
  const busy = await busyFor(biz.id, new Date(new Date(qt.start) - 2 * 864e5).toISOString(), new Date(new Date(qt.end).getTime() + 2 * 864e5).toISOString(), vehicle.id);
  if (!isFree(busy, qt.start, qt.end, buffer)) return fail("zauzeto", 409);

  const id = crypto.randomUUID();
  const paths = [];
  try {
    for (const f of files) {
      const path = `${biz.id}/${id}/${f.side === "dozvola_prednja" ? "prednja" : "zadnja"}-${crypto.randomBytes(6).toString("hex")}.${f.kind.ext}`;
      await upload(path, f.buf, f.kind.type);
      paths.push(path);
    }
    const [row] = await db("rc_bookings", { method: "POST", prefer: "return=representation", body: {
      id, business_id: biz.id, vehicle_id: vehicle.id, start_at: qt.start, end_at: qt.end, status: "na_cekanju",
      pickup_location: input.pickup, dropoff_location: input.dropoff, extras, days: qt.days, price_total: qt.total,
      price_breakdown: qt.lines, deposit: qt.deposit, ...d, license_front: paths[0], license_back: paths[1],
      source: d.wa_phone ? "whatsapp" : "web",
    } });
    log("rc request", biz.slug, row.ref, vehicle.make, vehicle.model, qt.days + "d", qt.total);
    await sendBookingEmail("primljen", { booking: row, vehicle, biz });   // "we received your request" (never blocks the booking)
    return json({ ok: true, ref: row.ref, ukupno: qt.total, dana: qt.days, depozit: qt.deposit });
  } catch (e) {
    await removeFiles(paths);
    if (e.code === "23P01") return fail("zauzeto", 409);
    log("GREŠKA rc zahtjev:", e.message);
    return fail("server", 500);
  }
}
