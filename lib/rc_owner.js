// Owner dashboard API for rent-a-car agencies: /api/rco/*
// Login is the same as the salon dashboard (/api/prijava, /api/osvjezi). Every request is checked against
// businesses.owner_id, so an owner only ever sees their own agency.
import { db, log } from "./db.js";
import { env } from "./env.js";
import { localToUtc, validDate, validTime } from "../public/rent/core.js";

const SUPABASE_URL = env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const SERVICE_KEY = env("SUPABASE_SERVICE_KEY");
const q = encodeURIComponent;
const UUID = /^[0-9a-f-]{36}$/i;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ greska: msg }, status);
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

const BOOKING_FIELDS = "id,ref,vehicle_id,start_at,end_at,status,pickup_location,dropoff_location,extras,days,price_total,price_breakdown,deposit," +
  "first_name,last_name,email,phone,birth_date,license_number,license_front,license_back,flight_number,note,lang,source,owner_note,created_at,decided_at," +
  "picked_up_at,returned_at,planned_end_at";
const VEHICLE_FIELDS = "id,active,featured,sort,make,model,year,category,body,color,transmission,fuel,seats,doors,bags,ac,consumption,engine,price_tiers,deposit,description,photos";

async function owner(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  const [biz] = await db(`businesses?owner_id=eq.${q(user.id)}&template=eq.rentacar&select=id,slug,name,city,timezone,settings&limit=1`);
  return { user, biz: biz || null };
}

async function booking(biz, id) {
  if (!UUID.test(String(id || ""))) return null;
  const [b] = await db(`rc_bookings?id=eq.${id}&business_id=eq.${biz.id}&select=${BOOKING_FIELDS}`);
  return b || null;
}

async function signedUrl(path) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/rc-licenses/${path.split("/").map(q).join("/")}`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: 300 }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.signedURL) throw new Error("Fotografija trenutno nije dostupna.");
  return `${SUPABASE_URL}/storage/v1${d.signedURL}`;
}

// "YYYY-MM-DDTHH:MM" in the agency time zone -> UTC
function localDT(s, tz) {
  const [d, t] = String(s || "").split("T");
  if (!validDate(d) || !validTime(t)) return null;
  return localToUtc(d, t, tz);
}

function validTiers(t) {
  if (!Array.isArray(t) || !t.length || t.length > 8) return null;
  const out = t.map((x) => ({ od: Math.round(Number(x.od)), cijena: Math.round(Number(x.cijena) * 100) / 100 }));
  if (out.some((x) => !(x.od >= 1 && x.od <= 365) || !(x.cijena > 0 && x.cijena < 10000))) return null;
  out.sort((a, b) => a.od - b.od);
  if (out[0].od !== 1 || new Set(out.map((x) => x.od)).size !== out.length) return null;
  return out;
}

export async function handleRcOwner(req) {
  if (!ANON_KEY) return fail("Na serveru nedostaje SUPABASE_ANON_KEY.", 500);
  const url = new URL(req.url);
  const route = url.pathname.replace(/^\/api\/rco\/?/, "");
  const me = await owner(req);
  if (!me) return fail("Prijava je istekla. Prijavite se ponovo.", 401);
  if (!me.biz) return fail("Ovaj račun nije povezan ni s jednom rent-a-car agencijom. Javite se Hostio podršci.", 403);
  const biz = me.biz, tz = biz.timezone || "Europe/Sarajevo";
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (route === "pregled" && req.method === "GET") {
    const [vozila, najmovi] = await Promise.all([
      db(`rc_vehicles?business_id=eq.${biz.id}&select=${VEHICLE_FIELDS}&order=sort.asc`),
      db(`rc_bookings?business_id=eq.${biz.id}&select=${BOOKING_FIELDS}&order=start_at.desc&limit=5000`),
    ]);
    // Licence file paths stay on the server; the page only learns whether a photo exists.
    for (const b of najmovi) { b.ima_prednju = !!b.license_front; b.ima_zadnju = !!b.license_back; delete b.license_front; delete b.license_back; }
    return json({ agencija: { naziv: biz.name, slug: biz.slug, grad: biz.city, tz, postavke: biz.settings || {} }, korisnik: me.user.email, vozila, najmovi, sada: new Date().toISOString() });
  }

  if (route === "dozvola" && req.method === "GET") {
    const b = await booking(biz, url.searchParams.get("id"));
    if (!b) return fail("Zahtjev nije pronađen.", 404);
    const side = url.searchParams.get("strana") === "zadnja" ? b.license_back : b.license_front;
    if (!side) return fail("Za ovaj zahtjev nema fotografije.", 404);
    log("licence viewed", biz.slug, b.ref, url.searchParams.get("strana"));
    return json({ url: await signedUrl(side), pdf: /\.pdf$/i.test(side) });
  }

  if (route === "odluka" && req.method === "POST") {
    const b = await booking(biz, body.id);
    if (!b) return fail("Zahtjev nije pronađen.", 404);
    if (b.status !== "na_cekanju") return fail("O ovom zahtjevu je već odlučeno.", 409);
    const status = body.odluka === "odobri" ? "odobreno" : body.odluka === "odbij" ? "odbijeno" : null;
    if (!status) return fail("Neispravna odluka.");
    const [row] = await db(`rc_bookings?id=eq.${b.id}&business_id=eq.${biz.id}&status=eq.na_cekanju`, { method: "PATCH", prefer: "return=representation",
      body: { status, decided_at: new Date().toISOString(), owner_note: clean(body.napomena, 1000) || b.owner_note } });
    if (!row) return fail("O ovom zahtjevu je već odlučeno.", 409);
    log("rc decision", biz.slug, b.ref, status);
    return json({ ok: true, status });
  }

  if (route === "otkazi" && req.method === "POST") {
    const b = await booking(biz, body.id);
    if (!b) return fail("Najam nije pronađen.", 404);
    if (!["odobreno", "na_cekanju", "blokirano"].includes(b.status)) return fail("Ovaj najam nije aktivan.", 409);
    if (b.picked_up_at) return fail("Vozilo je već preuzeto. Označite ga kao vraćeno.", 409);
    if (b.status !== "blokirano" && new Date(b.end_at) < new Date()) return fail("Završen najam se ne može otkazati.", 409);
    await db(`rc_bookings?id=eq.${b.id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal",
      body: { status: "otkazano", decided_at: new Date().toISOString(), owner_note: clean(body.napomena, 1000) || b.owner_note } });
    log("rc cancel", biz.slug, b.ref);
    return json({ ok: true });
  }

  // Hand-over: the customer took the car / brought it back. Time is "now" unless the owner gives another one.
  if ((route === "preuzeto" || route === "vraceno" || route === "ponisti") && req.method === "POST") {
    const b = await booking(biz, body.id);
    if (!b) return fail("Najam nije pronađen.", 404);
    if (b.status !== "odobreno") return fail("Ovo nije potvrđen najam.", 409);
    const when = body.vrijeme ? localDT(body.vrijeme, tz) : new Date().toISOString();
    if (!when) return fail("Neispravno vrijeme.");
    if (new Date(when) > new Date(Date.now() + 5 * 60e3)) return fail("Vrijeme ne može biti u budućnosti.");
    const patch = (body) => db(`rc_bookings?id=eq.${b.id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal", body });

    if (route === "preuzeto") {
      if (b.picked_up_at) return fail("Vozilo je već označeno kao preuzeto.", 409);
      if (new Date(when) < new Date(new Date(b.start_at).getTime() - 2 * 864e5)) return fail("Preuzimanje je previše prije početka najma.");
      await patch({ picked_up_at: when });
      log("rc picked up", biz.slug, b.ref);
      return json({ ok: true });
    }
    if (route === "vraceno") {
      if (!b.picked_up_at) return fail("Prvo označite da je vozilo preuzeto.", 409);
      if (b.returned_at) return fail("Vozilo je već označeno kao vraćeno.", 409);
      if (new Date(when) < new Date(b.picked_up_at)) return fail("Vraćanje ne može biti prije preuzimanja.");
      const planned = b.planned_end_at || b.end_at;
      const ret = new Date(when).getTime(), start = new Date(b.start_at).getTime();
      const newEnd = new Date(Math.max(ret, start + 60e3)).toISOString();   // the car is free again from this moment
      try { await patch({ returned_at: when, planned_end_at: planned, end_at: newEnd }); }
      catch (e) {
        if (e.code !== "23P01") throw e;
        await patch({ returned_at: when, planned_end_at: planned });          // late and the next rental already starts: keep its slot
      }
      log("rc returned", biz.slug, b.ref);
      return json({ ok: true });
    }
    // undo the last step (a mistake)
    if (b.returned_at) {
      try { await patch({ returned_at: null, end_at: b.planned_end_at || b.end_at, planned_end_at: null }); }
      catch (e) { if (e.code === "23P01") return fail("U međuvremenu je vozilo rezervisano za taj period, pa se vraćanje ne može poništiti.", 409); throw e; }
      return json({ ok: true });
    }
    if (b.picked_up_at) { await patch({ picked_up_at: null }); return json({ ok: true }); }
    return fail("Nema ništa za poništiti.", 409);
  }

  if (route === "napomena" && req.method === "POST") {
    const b = await booking(biz, body.id);
    if (!b) return fail("Najam nije pronađen.", 404);
    await db(`rc_bookings?id=eq.${b.id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal", body: { owner_note: clean(body.napomena, 1000) || null } });
    return json({ ok: true });
  }

  // Owner adds a block (service, repair) or a rental agreed by phone / in person.
  if (route === "rucno" && req.method === "POST") {
    const vid = String(body.vozilo || "");
    if (!UUID.test(vid)) return fail("Odaberite vozilo.");
    const [v] = await db(`rc_vehicles?id=eq.${vid}&business_id=eq.${biz.id}&select=id,deposit`);
    if (!v) return fail("Odaberite vozilo.");
    const start = localDT(body.od, tz), end = localDT(body.do, tz);
    if (!start || !end) return fail("Upišite datum i vrijeme od i do.");
    if (new Date(end) <= new Date(start)) return fail("Kraj mora biti poslije početka.");
    const najam = body.vrsta === "najam";
    const row = {
      business_id: biz.id, vehicle_id: v.id, start_at: start, end_at: end, status: najam ? "odobreno" : "blokirano", source: "vlasnik",
      note: clean(body.napomena, 800) || null, decided_at: new Date().toISOString(),
    };
    if (najam) {
      row.first_name = clean(body.ime, 60); row.last_name = clean(body.prezime, 60);
      if (!row.first_name) return fail("Upišite ime kupca.");
      row.phone = clean(body.telefon, 30) || null; row.email = clean(body.email, 160).toLowerCase() || null;
      const price = Number(body.cijena);
      row.price_total = price > 0 ? Math.round(price * 100) / 100 : null;
      row.days = Math.max(1, Math.ceil((new Date(end) - new Date(start) - 59 * 60000) / 864e5));
      row.deposit = v.deposit;
    }
    try {
      const [r] = await db("rc_bookings", { method: "POST", prefer: "return=representation", body: row });
      log("rc manual", biz.slug, row.status, r.ref);
      return json({ ok: true, ref: r.ref });
    } catch (e) {
      if (e.code === "23P01") return fail("Vozilo je u tom periodu već zauzeto.", 409);
      throw e;
    }
  }

  if (route === "vozilo" && req.method === "POST") {
    const vid = String(body.id || "");
    if (!UUID.test(vid)) return fail("Vozilo nije pronađeno.", 404);
    const patch = {};
    if ("active" in body) patch.active = !!body.active;
    if ("featured" in body) patch.featured = !!body.featured;
    if ("price_tiers" in body) { const t = validTiers(body.price_tiers); if (!t) return fail("Provjerite cijene: prva mora važiti od 1 dana, a svaka cijena mora biti veća od 0."); patch.price_tiers = t; }
    if ("deposit" in body) { const d = Number(body.deposit); if (!(d >= 0 && d < 100000)) return fail("Neispravan depozit."); patch.deposit = Math.round(d); }
    if (!Object.keys(patch).length) return fail("Nema promjena.");
    const rows = await db(`rc_vehicles?id=eq.${vid}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=representation", body: patch });
    if (!rows.length) return fail("Vozilo nije pronađeno.", 404);
    log("rc vehicle", biz.slug, vid, Object.keys(patch).join(","));
    return json({ ok: true, vozilo: rows[0] });
  }

  if (route === "postavke" && req.method === "POST") {
    const s = { ...(biz.settings || {}) };
    const num = (v, min, max) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : null; };
    if (body.hours) {
      const o = String(body.hours.open || ""), c = String(body.hours.close || "");
      if (!validTime(o) || !validTime(c) || o >= c) return fail("Provjerite radno vrijeme.");
      s.hours = { open: o, close: c };
    }
    const fields = { after_hours_fee: [0, 1000], buffer_hours: [0, 48], min_age: [18, 30], license_years: [0, 10], cancellation_hours: [0, 720], min_days: [1, 30] };
    for (const [k, [mn, mx]] of Object.entries(fields)) if (k in body) {
      const n = num(body[k], mn, mx);
      if (n === null) return fail(`Neispravna vrijednost: ${k}.`);
      s[k] = n;
    }
    if (body.contact) {
      const c = body.contact;
      const wa = String(c.whatsapp || "").replace(/\D/g, "");
      if (wa && (wa.length < 8 || wa.length > 15)) return fail("WhatsApp broj upišite s pozivnim brojem, npr. 38761123456.");
      s.contact = { ...(s.contact || {}), phone: clean(c.phone, 30), whatsapp: wa, email: clean(c.email, 160), address: clean(c.address, 160) };
    }
    await db(`businesses?id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal", body: { settings: s } });
    log("rc settings", biz.slug);
    return json({ ok: true, postavke: s });
  }

  return fail("Nepoznata radnja.", 404);
}
