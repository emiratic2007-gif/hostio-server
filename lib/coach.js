// Personal coaching (template "coach"), e.g. hostio.ba/mofit.
//   POST /api/coach/zahtjev     public: the website sends a training request
//   GET  /api/coach/pregled     coach: business + requests and sessions
//   POST /api/coach/odluka      coach: confirm (with date and time), decline or cancel
//   POST /api/coach/rucno       coach: add a session by hand (client who called or wrote)
//   POST /api/coach/poruka      coach: send the client a message through Hostio (WhatsApp/Instagram, 24 h window)
// Login is the same as the other dashboards (/api/prijava, /api/osvjezi); every coach route is checked
// against businesses.owner_id, so a coach only ever sees their own requests.
import { db, log } from "./db.js";
import { env } from "./env.js";
import { localToUtc } from "./rules.js";
import { whatsapp, instagram } from "./channels.js";

const SUPABASE_URL = env("SUPABASE_URL");
const ANON_KEY = env("SUPABASE_ANON_KEY");
const q = encodeURIComponent;
const UUID = /^[0-9a-f-]{36}$/i;

export const SERVICES = { uzivo: "Trening 1-na-1", online: "Online coaching", prehrana: "Plan prehrane" };
const GOALS = ["Skinuti kilograme", "Mišićna masa", "Snaga", "Kondicija", "Vratiti se u formu"];
const LEVELS = ["Početnik", "Povremeno", "Redovno"];
const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const TIMES = ["Jutro", "Podne", "Večer"];
const FIELDS = "id,ref,service,goals,experience,days,times,name,phone,note,status,session_at,session_min,owner_note,source,chat_key,created_at,decided_at";
const WINDOW_MS = 24 * 3600 * 1000; // WhatsApp and Instagram allow free replies for 24 h after the client's last message

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const fail = (msg, status = 400) => json({ greska: msg }, status);
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const cleanText = (v, max = 1500) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);
const pick = (list, allowed, max) => [...new Set((Array.isArray(list) ? list : []).map((x) => clean(x, 40)).filter((x) => allowed.includes(x)))].slice(0, max);

// Phone as digits with country code, for WhatsApp links (061 123 456 -> 38761123456).
export function waDigits(phone) {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "387" + d.slice(1);
  return d.length >= 8 && d.length <= 15 ? d : "";
}

async function coachBySlug(slug) {
  if (!/^[a-z0-9-]{2,40}$/.test(String(slug || ""))) return null;
  const [biz] = await db(`businesses?slug=eq.${q(slug)}&template=eq.coach&select=id,slug,name,timezone,settings`);
  return biz || null;
}

async function owner(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const user = await res.json();
  const [biz] = await db(`businesses?owner_id=eq.${q(user.id)}&template=eq.coach&select=id,slug,name,timezone,settings,whatsapp_phone_id&limit=1`);
  return { user, biz: biz || null };
}

// "YYYY-MM-DDTHH:MM" in the coach's time zone -> UTC ISO, or null.
function localDT(s, tz) {
  const m = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(String(s || ""));
  if (!m) return null;
  try { return localToUtc(m[1], `${m[2]}:${m[3]}`, tz); } catch { return null; }
}

// Public: a request from the website.
async function newRequest(body) {
  if (clean(body.web, 200)) return json({ ok: true }); // honeypot field, filled only by bots
  const biz = await coachBySlug(body.biz);
  if (!biz) return fail("Nepoznat trener.", 404);
  const service = Object.keys(SERVICES).includes(body.usluga) ? body.usluga : null;
  const name = clean(body.ime, 120), phone = clean(body.tel, 40);
  if (!service) return fail("Izaberi uslugu.");
  if (name.length < 2) return fail("Upiši ime.");
  if (phone.replace(/\D/g, "").length < 8) return fail("Upiši ispravan broj za WhatsApp.");
  const days = pick(body.dani, DAYS, 7);
  if (service === "uzivo" && !days.length) return fail("Izaberi bar jedan dan.");
  // Simple flood guard: at most 3 open requests from one number.
  const open = await db(`coach_requests?business_id=eq.${biz.id}&phone=eq.${q(phone)}&status=eq.novo&select=id`);
  if (open.length >= 3) return fail("Već imamo tvoj zahtjev. Trener će ti se javiti na WhatsApp.", 429);
  const [row] = await db("coach_requests", {
    method: "POST", prefer: "return=representation",
    body: {
      business_id: biz.id, service, name, phone,
      goals: pick(body.ciljevi, GOALS, 8), experience: pick([body.iskustvo], LEVELS, 1)[0] || null,
      days, times: pick(body.doba, TIMES, 3), note: cleanText(body.napomena) || null, source: "web",
    },
  });
  log("coach zahtjev", biz.slug, row.ref);
  return json({ ok: true, ref: row.ref });
}

export async function handleCoachApi(req) {
  const route = new URL(req.url).pathname.replace(/^\/api\/coach\/?/, "");
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (route === "zahtjev" && req.method === "POST") return newRequest(body);

  if (!ANON_KEY) return fail("Na serveru nedostaje SUPABASE_ANON_KEY.", 500);
  const me = await owner(req);
  if (!me) return fail("Prijava je istekla. Prijavite se ponovo.", 401);
  if (!me.biz) return fail("Ovaj račun nije povezan s trenerom. Javite se Hostio podršci.", 403);
  const biz = me.biz, tz = biz.timezone || "Europe/Sarajevo";

  if (route === "pregled" && req.method === "GET") {
    const from = new Date(Date.now() - 180 * 864e5).toISOString();
    const rows = await db(`coach_requests?business_id=eq.${biz.id}&or=(created_at.gte.${q(from)},session_at.gte.${q(from)})&select=${FIELDS}&order=created_at.desc&limit=2000`);
    const [ig] = await db(`ig_accounts?business_id=eq.${biz.id}&active=eq.true&select=username&limit=1`);
    return json({ trener: { naziv: biz.name, slug: biz.slug, tz, kontakt: biz.settings?.contact || {}, kanali: { whatsapp: !!biz.whatsapp_phone_id, instagram: !!ig } },
      korisnik: me.user.email, usluge: SERVICES, zahtjevi: rows });
  }

  if (route === "odluka" && req.method === "POST") {
    const id = String(body.id || "");
    if (!UUID.test(id)) return fail("Neispravan zahtjev.");
    const [r] = await db(`coach_requests?id=eq.${id}&business_id=eq.${biz.id}&select=${FIELDS}`);
    if (!r) return fail("Zahtjev nije pronađen.", 404);
    const status = body.status;
    const patch = { status, decided_at: new Date().toISOString(), owner_note: cleanText(body.biljeska) || r.owner_note };
    if (status === "potvrdjeno") {
      const at = localDT(body.termin, tz);
      if (!at) return fail("Izaberi dan i vrijeme termina.");
      patch.session_at = at;
      const min = Number(body.trajanje);
      if (min >= 15 && min <= 240) patch.session_min = Math.round(min);
    } else if (status === "odbijeno") {
      if (r.status !== "novo") return fail("Ovaj zahtjev je već riješen.");
    } else if (status === "otkazano") {
      if (r.status !== "potvrdjeno") return fail("Otkazati se može samo potvrđen termin.");
    } else return fail("Nepoznata odluka.");
    const [row] = await db(`coach_requests?id=eq.${id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=representation", body: patch });
    return json({ zahtjev: pickFields(row), wa: waDigits(row.phone) });
  }

  if (route === "rucno" && req.method === "POST") {
    const service = Object.keys(SERVICES).includes(body.usluga) ? body.usluga : "uzivo";
    const name = clean(body.ime, 120), phone = clean(body.tel, 40), at = localDT(body.termin, tz);
    if (name.length < 2) return fail("Upiši ime klijenta.");
    if (phone.replace(/\D/g, "").length < 6) return fail("Upiši broj klijenta.");
    if (!at) return fail("Izaberi dan i vrijeme termina.");
    const min = Number(body.trajanje);
    const [row] = await db("coach_requests", {
      method: "POST", prefer: "return=representation",
      body: { business_id: biz.id, service, name, phone, status: "potvrdjeno", session_at: at, session_min: min >= 15 && min <= 240 ? Math.round(min) : 60,
        note: cleanText(body.napomena) || null, source: "rucno", decided_at: new Date().toISOString() },
    });
    return json({ zahtjev: pickFields(row) });
  }

  if (route === "poruka" && req.method === "POST") {
    const id = String(body.id || ""), text = cleanText(body.tekst, 2000);
    if (!UUID.test(id)) return fail("Neispravan zahtjev.");
    if (!text) return fail("Poruka je prazna.");
    const [r] = await db(`coach_requests?id=eq.${id}&business_id=eq.${biz.id}&select=id,phone,chat_key`);
    if (!r) return fail("Zahtjev nije pronađen.", 404);
    return sendToClient(biz, r, text);
  }

  return fail("nepoznato", 404);
}

// Sends through the chat the client used (Instagram), else WhatsApp, but only inside the 24 h window
// after the client's last message (outside it Meta allows only approved templates).
async function sendToClient(biz, r, text) {
  const ig = String(r.chat_key || "").startsWith("ig:") ? r.chat_key.slice(3) : null;
  const chan = ig ? "instagram" : "whatsapp", customer = ig || (String(r.chat_key || "").startsWith("wa:") ? r.chat_key.slice(3) : waDigits(r.phone));
  const closed = (why) => json({ poslano: false, greska: why }, 409);
  let acct;
  if (ig) {
    [acct] = await db(`ig_accounts?business_id=eq.${biz.id}&active=eq.true&select=ig_user_id,access_token&limit=1`);
    if (!acct) return closed("Instagram nije povezan s Hostiom. Pošalji poruku sam.");
  } else {
    if (!biz.whatsapp_phone_id) return closed("WhatsApp broj još nije povezan s Hostiom. Pošalji poruku preko WhatsApp linka.");
    if (!customer) return closed("Broj klijenta nije ispravan.");
    acct = { phoneId: biz.whatsapp_phone_id };
  }
  const [last] = await db(`messages?business_id=eq.${biz.id}&channel=eq.${chan}&customer_phone=eq.${q(customer)}&role=eq.user&select=created_at&order=created_at.desc&limit=1`);
  if (!last || Date.now() - new Date(last.created_at) > WINDOW_MS)
    return closed("Klijent nam nije pisao u zadnja 24 sata, pa mu Hostio ne smije prvi poslati poruku. Pošalji je preko WhatsApp linka.");
  const ok = await (ig ? instagram : whatsapp).send(acct, customer, text);
  if (!ok) return fail("Poruka nije poslana. Pokušaj ponovo ili je pošalji preko WhatsApp linka.", 502);
  await db("messages", { method: "POST", prefer: "return=minimal", body: { business_id: biz.id, channel: chan, customer_phone: customer, role: "assistant", content: text } });
  log("coach poruka klijentu", biz.slug, chan);
  return json({ poslano: true, kanal: ig ? "Instagram" : "WhatsApp" });
}

const pickFields = (row) => Object.fromEntries(FIELDS.split(",").map((k) => [k, row[k]]));
