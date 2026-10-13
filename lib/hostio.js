// Hostio core: receives WhatsApp messages, lets the AI talk to the customer,
// and writes bookings into Supabase. No external packages needed (Node 20+).
import crypto from "node:crypto";
import { localNow, toLocal, localToUtc, addDays, fmtDate, freeSlots, findService, systemPrompt, toMin } from "./rules.js";

const env = (k, d) => process.env[k] ?? d;
const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_KEY = env("SUPABASE_SERVICE_KEY");
const ANTHROPIC_KEY = env("ANTHROPIC_API_KEY");
const MODEL = env("MODEL", "claude-haiku-5-5");
// Free option: any OpenAI-compatible provider (default: Groq free tier)
const FREE_KEY = env("GROQ_API_KEY");
const FREE_URL = env("FREE_AI_URL", "https://api.groq.com/openai/v1");
const FREE_MODEL = env("FREE_AI_MODEL", "openai/gpt-oss-120b");
const WA_TOKEN = env("WHATSAPP_TOKEN");
const VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = env("META_APP_SECRET");
const GRAPH = `https://graph.facebook.com/${env("GRAPH_VERSION", "v25.0")}`;

const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- Supabase (REST) ----------
async function db(path, { method = "GET", body, prefer } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) { const e = new Error(data?.message || res.statusText); e.code = data?.code; e.status = res.status; throw e; }
  return data;
}
const q = encodeURIComponent;

async function loadContext(biz) {
  const tz = biz.timezone || "Europe/Sarajevo";
  const now = localNow(tz);
  const from = localToUtc(now.date, "00:00", tz), to = localToUtc(addDays(now.date, 60), "00:00", tz);
  const [services, hours, closed, bookings] = await Promise.all([
    db(`services?business_id=eq.${biz.id}&active=eq.true&select=id,name,minutes,price&order=name`),
    db(`working_hours?business_id=eq.${biz.id}&select=weekday,opens,closes`),
    db(`closed_dates?business_id=eq.${biz.id}&day=gte.${now.date}&select=day`),
    db(`bookings?business_id=eq.${biz.id}&status=eq.aktivno&start_at=gte.${q(from)}&start_at=lt.${q(to)}&select=id,start_at,end_at,customer_phone,service_name`),
  ]);
  const hrs = {};
  for (const h of hours) hrs[h.weekday] = [h.opens.slice(0, 5), h.closes.slice(0, 5)];
  return {
    tz, now, services, hours: hrs,
    closed: new Set(closed.map((c) => c.day)),
    bookings: bookings.map((b) => { const s = toLocal(b.start_at, tz), e = toLocal(b.end_at, tz); return { ...b, date: s.date, start: s.min, end: e.date === s.date ? e.min : 24 * 60 }; }),
  };
}

// ---------- AI tools ----------
function tools(ctx) {
  const names = ctx.services.map((s) => s.name);
  return [
    { name: "provjeri_termine", description: "Slobodna početna vremena (HH:MM) za uslugu na datum dalje od 7 dana.",
      input_schema: { type: "object", properties: { datum: { type: "string", description: "YYYY-MM-DD" }, usluga: { type: "string", enum: names } }, required: ["datum", "usluga"] } },
    { name: "rezervisi", description: "Upisuje rezervaciju. Odbija ako termin nije slobodan ili nedostaju podaci. Vraća potvrdu.",
      input_schema: { type: "object", properties: { datum: { type: "string", description: "YYYY-MM-DD" }, vrijeme: { type: "string", description: "HH:MM" }, usluga: { type: "string", enum: names }, ime: { type: "string" }, telefon: { type: "string" } }, required: ["datum", "vrijeme", "usluga", "ime", "telefon"] } },
    { name: "otkazi_termin", description: "Otkazuje budući termin ove mušterije na zadani datum i vrijeme.",
      input_schema: { type: "object", properties: { datum: { type: "string", description: "YYYY-MM-DD" }, vrijeme: { type: "string", description: "HH:MM" } }, required: ["datum", "vrijeme"] } },
  ];
}

async function runTool(name, input, { biz, ctx, waPhone }) {
  if (name === "provjeri_termine") return freeSlots(ctx, String(input.datum), String(input.usluga));
  if (name === "rezervisi") {
    const date = String(input.datum), time = String(input.vrijeme);
    const r = freeSlots(ctx, date, String(input.usluga));
    if (!r.slobodno.includes(time)) throw new Error(`Termin ${time} nije slobodan. Slobodno: ${r.slobodno.slice(0, 12).join(", ")}`);
    if (!String(input.ime || "").trim()) throw new Error("Nedostaje ime i prezime");
    if (String(input.telefon || "").replace(/\D/g, "").length < 6) throw new Error("Nedostaje ispravan broj telefona");
    const s = findService(ctx, input.usluga);
    const start = localToUtc(date, time, ctx.tz);
    const end = new Date(new Date(start).getTime() + s.minutes * 60000).toISOString();
    try {
      await db("bookings", { method: "POST", prefer: "return=minimal", body: {
        business_id: biz.id, service_id: s.id, service_name: s.name, start_at: start, end_at: end,
        customer_name: String(input.ime).trim(), customer_phone: String(input.telefon).trim(), source: "hostio",
      } });
    } catch (e) {
      if (e.code === "23P01") throw new Error("Termin je upravo zauzet, ponudi drugi.");
      throw e;
    }
    ctx.bookings.push({ date, start: toMin(time), end: toMin(time) + s.minutes, customer_phone: waPhone });
    log("booking", biz.slug, date, time, s.name);
    return { potvrđeno: true, dan: fmtDate(date), vrijeme: time, usluga: s.name };
  }
  if (name === "otkazi_termin") {
    const start = localToUtc(String(input.datum), String(input.vrijeme), ctx.tz);
    const digits = waPhone.slice(-8);
    const rows = await db(`bookings?business_id=eq.${biz.id}&status=eq.aktivno&start_at=eq.${q(start)}&select=id,customer_phone`);
    const mine = rows.find((b) => b.customer_phone.replace(/\D/g, "").endsWith(digits));
    if (!mine) throw new Error("Nema termina ove mušterije u to vrijeme.");
    await db(`bookings?id=eq.${mine.id}`, { method: "PATCH", body: { status: "otkazano" }, prefer: "return=minimal" });
    return { otkazano: true, dan: fmtDate(String(input.datum)), vrijeme: input.vrijeme };
  }
  throw new Error("Nepoznat alat");
}

// ---------- AI providers: free model if GROQ_API_KEY is set, otherwise Claude ----------
async function askClaude(system, history, toolDefs, exec) {
  const messages = history.map((m) => ({ role: m.role, content: m.content }));
  for (let round = 0; round < 5; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 600, system, messages, tools: toolDefs }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("AI greška: " + (data?.error?.message || res.status));
    const uses = data.content.filter((c) => c.type === "tool_use");
    if (!uses.length || data.stop_reason !== "tool_use") return data.content.filter((c) => c.type === "text").map((c) => c.text).join("\n");
    messages.push({ role: "assistant", content: data.content });
    const results = [];
    for (const u of uses) {
      const r = await exec(u.name, u.input);
      results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r.ok ?? r.error), ...(r.error ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }
  return null;
}

async function askFree(system, history, toolDefs, exec) {
  const messages = [{ role: "system", content: system }, ...history.map((m) => ({ role: m.role, content: m.content }))];
  const tools = toolDefs.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.input_schema } }));
  for (let round = 0; round < 5; round++) {
    const res = await fetch(`${FREE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${FREE_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: FREE_MODEL, messages, tools, max_tokens: 800, temperature: 0.4 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error("AI greška: " + (data?.error?.message || res.status));
    const msg = data.choices?.[0]?.message || {};
    const calls = msg.tool_calls || [];
    if (!calls.length) return msg.content || "";
    messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
    for (const c of calls) {
      let args = {};
      try { args = JSON.parse(c.function.arguments || "{}"); } catch {}
      const r = await exec(c.function.name, args);
      messages.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(r.ok ?? r.error) });
    }
  }
  return null;
}

async function reply(biz, waPhone, history) {
  const ctx = await loadContext(biz);
  const digits = waPhone.slice(-8);
  const booked = ctx.bookings.filter((b) => b.customer_phone?.replace(/\D/g, "").endsWith(digits))
    .map((b) => `${b.service_name}, ${fmtDate(b.date)} u ${String(Math.floor(b.start / 60)).padStart(2, "0")}:${String(b.start % 60).padStart(2, "0")}`);
  const system = systemPrompt(biz, ctx, booked) + `\n\nMušterija piše s broja +${waPhone}.`;
  const exec = async (name, input) => {
    try { return { ok: await runTool(name, input, { biz, ctx, waPhone }) }; }
    catch (e) { return { error: "Greška: " + e.message }; }
  };
  const ask = FREE_KEY ? askFree : askClaude;
  const text = await ask(system, history, tools(ctx), exec);
  return (text || "Hvala na poruci, javit ćemo Vam se uskoro.").replace(/\*\*/g, "").trim();
}

// ---------- WhatsApp ----------
async function sendWhatsApp(phoneId, to, text) {
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  });
  if (!res.ok) log("GREŠKA kod slanja na WhatsApp:", res.status, await res.text());
}
async function markRead(phoneId, messageId) {
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  }).catch(() => {});
}

async function handleMessage(phoneId, msg) {
  log("1/4 poruka primljena", "phone_id=" + phoneId, "tip=" + msg.type);
  const [biz] = await db(`businesses?whatsapp_phone_id=eq.${q(phoneId)}&select=id,slug,name,city,timezone`);
  if (!biz) { log("no business for phone id", phoneId); return; }
  const waPhone = msg.from;
  const text = msg.type === "text" ? msg.text.body.trim() : null;
  // Save first: if this WhatsApp message was already handled, stop (Meta sometimes sends twice).
  const saved = await db("messages?on_conflict=wa_message_id", {
    method: "POST", prefer: "resolution=ignore-duplicates,return=representation",
    body: { business_id: biz.id, customer_phone: waPhone, role: "user", content: text ?? `[${msg.type}]`, wa_message_id: msg.id },
  });
  if (!saved.length) { log("poruka već obrađena, preskačem"); return; }
  log("2/4 spremljeno u bazu za", biz.slug);
  markRead(phoneId, msg.id);

  let answer;
  if (!text) {
    answer = "Hvala na poruci. Molimo Vas da nam napišete poruku tekstom kako bismo Vam mogli pomoći oko termina.";
  } else {
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const rows = await db(`messages?business_id=eq.${biz.id}&customer_phone=eq.${q(waPhone)}&created_at=gte.${q(since)}&select=role,content&order=created_at.desc&limit=20`);
    const history = rows.reverse().filter((m) => !m.content.startsWith("["));
    while (history.length && history[0].role !== "user") history.shift();
    try { answer = await reply(biz, waPhone, history); }
    catch (e) { log("GREŠKA kod AI-ja:", e.message); answer = "Hvala na poruci, javit ćemo Vam se uskoro."; }
  }
  if (!answer) return;
  log("3/4 AI odgovorio, šaljem na WhatsApp");
  await sendWhatsApp(phoneId, waPhone, answer);
  log("4/4 gotovo");
  await db("messages", { method: "POST", prefer: "return=minimal", body: { business_id: biz.id, customer_phone: waPhone, role: "assistant", content: answer } });
}

export function validSignature(raw, header) {
  if (!APP_SECRET) return true;
  if (!header?.startsWith("sha256=")) return false;
  const expected = crypto.createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  const got = header.slice(7);
  return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}


// Meta webhook check: returns the challenge text if the verify token matches, otherwise null.
export function verifyChallenge(url) {
  const ok = url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === VERIFY_TOKEN;
  return ok ? url.searchParams.get("hub.challenge") : null;
}

// Handle one webhook delivery (raw body bytes + Meta signature header).
export async function processWebhook(raw, signature) {
  if (!validSignature(raw, signature)) { log("bad signature"); return false; }
  try {
    const body = JSON.parse(raw.toString("utf8"));
    for (const entry of body.entry || []) for (const ch of entry.changes || []) {
      const v = ch.value || {};
      for (const msg of v.messages || []) await handleMessage(v.metadata.phone_number_id, msg);
    }
  } catch (e) { log("GREŠKA:", e.message); }
  return true;
}

// Health check page: tests every part of Hostio and reports OK / problem, without showing any secret.
export async function statusReport({ waba, subscribe, redirect, baseUrl } = {}) {
  const out = [];
  const add = (name, ok, note = "") => out.push({ name, ok, note });
  const need = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "WHATSAPP_TOKEN", "WHATSAPP_VERIFY_TOKEN", "META_APP_SECRET"];
  for (const k of need) add("Varijabla " + k, !!process.env[k], process.env[k] ? "" : "nedostaje u Netlifyju");
  add("AI ključ (GROQ_API_KEY ili ANTHROPIC_API_KEY)", !!(FREE_KEY || ANTHROPIC_KEY), FREE_KEY ? "koristi se Groq" : ANTHROPIC_KEY ? "koristi se Claude" : "nema nijednog");
  if (SUPABASE_URL && /\/rest\/v1/.test(SUPABASE_URL)) add("SUPABASE_URL format", false, "obriši /rest/v1/ s kraja");
  let phoneIds = [];
  try {
    const rows = await db("businesses?select=slug,whatsapp_phone_id");
    phoneIds = rows.filter((r) => r.whatsapp_phone_id).map((r) => r.whatsapp_phone_id);
    add("Supabase baza", true, rows.length + " biznis(a)");
    add("Biznis povezan s WhatsApp brojem", phoneIds.length > 0, phoneIds.length ? rows.filter((r) => r.whatsapp_phone_id).map((r) => r.slug + " = " + r.whatsapp_phone_id).join(", ") : "pokreni SQL: update businesses set whatsapp_phone_id = '...' where slug = 'salon-lana';");
  } catch (e) { add("Supabase baza", false, e.message); }
  try {
    if (FREE_KEY) {
      const r = await fetch(`${FREE_URL}/models`, { headers: { Authorization: `Bearer ${FREE_KEY}` } });
      add("Groq ključ", r.ok, r.ok ? "" : "status " + r.status + ": " + (await r.text()).slice(0, 200));
    } else if (ANTHROPIC_KEY) {
      const r = await fetch("https://api.anthropic.com/v1/models", { headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" } });
      add("Claude ključ", r.ok, r.ok ? "" : "status " + r.status + ": " + (await r.text()).slice(0, 200));
    }
  } catch (e) { add("AI servis", false, e.message); }
  for (const id of phoneIds) {
    try {
      const r = await fetch(`${GRAPH}/${id}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      const d = await r.json();
      add("WhatsApp token za broj " + id, r.ok, r.ok ? (d.display_phone_number || "") + " " + (d.verified_name || "") : (d?.error?.message || r.status));
    } catch (e) { add("WhatsApp token", false, e.message); }
    const ours = baseUrl ? baseUrl + "/webhook" : null;
    try {
      if (redirect && ours) {
        const r = await fetch(`${GRAPH}/${id}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({ webhook_configuration: { override_callback_uri: ours, verify_token: VERIFY_TOKEN } }),
        });
        const d = await r.json();
        add("Preusmjeravanje broja " + id + " na Hostio", r.ok && d.success !== false, r.ok ? "upravo postavljeno na " + ours : (d?.error?.message || r.status));
      }
      const r = await fetch(`${GRAPH}/${id}?fields=webhook_configuration`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      const d = await r.json();
      if (!r.ok) { add("Kamo Meta šalje poruke za broj " + id, false, d?.error?.message || r.status); }
      else {
        const w = d.webhook_configuration || {};
        const active = w.phone_number || w.whatsapp_business_account || w.application || "";
        const level = w.phone_number ? "adresa postavljena na broju" : w.whatsapp_business_account ? "adresa postavljena na WhatsApp računu" : "adresa iz Meta dashboarda";
        const ok = !!ours && active.replace(/\/$/, "") === ours;
        add("Kamo Meta šalje poruke za broj " + id, ok,
          (active || "nigdje") + " (" + level + ")" + (ok ? "" : ". Da preusmjeriš na Hostio, otvori ovu adresu s &preusmjeri=da na kraju"));
      }
    } catch (e) { add("Kamo Meta šalje poruke", false, e.message); }
  }
  if (waba && /^\d+$/.test(waba)) {
    try {
      if (subscribe) {
        const r = await fetch(`${GRAPH}/${waba}/subscribed_apps`, { method: "POST", headers: { Authorization: `Bearer ${WA_TOKEN}` } });
        const d = await r.json();
        add("Pretplata WhatsApp računa na aplikaciju", r.ok && d.success !== false, r.ok ? "upravo uključeno" : (d?.error?.message || r.status));
      }
      const r = await fetch(`${GRAPH}/${waba}/subscribed_apps`, { headers: { Authorization: `Bearer ${WA_TOKEN}` } });
      const d = await r.json();
      const apps = (d.data || []).map((a) => a.whatsapp_business_api_data?.name || a.name || a.id).filter(Boolean);
      add("WhatsApp račun " + waba + " šalje poruke aplikaciji", r.ok && apps.length > 0,
        !r.ok ? (d?.error?.message || r.status) : apps.length ? "pretplaćene aplikacije: " + apps.join(", ") : "nije pretplaćen, otvori ovu adresu s &pretplati=da na kraju");
    } catch (e) { add("WhatsApp račun", false, e.message); }
  }
  return out;
}
