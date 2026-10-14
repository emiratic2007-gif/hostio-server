// Hostio core: receives WhatsApp and Instagram messages, lets the AI talk to the customer,
// and writes bookings into Supabase. No external packages needed.
import crypto from "node:crypto";
import { localNow, toLocal, localToUtc, addDays, fmtDate, freeSlots, findService, systemPrompt, toMin } from "./rules.js";
import { env, Buffer } from "./env.js";
import { db, log } from "./db.js";
import { whatsapp, instagram } from "./channels.js";
import { loadRcContext, rcPrompt, rcTools, runRcTool } from "./rc_ai.js";
export { db, log };

const SUPABASE_URL = env("SUPABASE_URL");
const ANTHROPIC_KEY = env("ANTHROPIC_API_KEY");
const MODEL = env("MODEL", "claude-haiku-5-5");
// Free option: any OpenAI-compatible provider (default: Groq free tier)
const FREE_KEY = env("GROQ_API_KEY");
const FREE_URL = env("FREE_AI_URL", "https://api.groq.com/openai/v1");
const FREE_MODEL = env("FREE_AI_MODEL", "openai/gpt-oss-120b");
const WA_TOKEN = env("WHATSAPP_TOKEN");
const VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN");
const APP_SECRET = env("META_APP_SECRET");
const IG_APP_SECRET = env("INSTAGRAM_APP_SECRET");
const GRAPH = `https://graph.facebook.com/${env("GRAPH_VERSION", "v25.0")}`;
// How long Hostio waits for more messages before answering (people often send several short ones).
const REPLY_DELAY_MS = Number(env("REPLY_DELAY_SECONDS", 6)) * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const q = encodeURIComponent;
const BIZ_FIELDS = "id,slug,name,city,timezone,template,settings";

export async function loadContext(biz) {
  const tz = biz.timezone || "Europe/Sarajevo";
  const now = localNow(tz);
  const from = localToUtc(now.date, "00:00", tz), to = localToUtc(addDays(now.date, 60), "00:00", tz);
  const [services, hours, closed, bookings] = await Promise.all([
    db(`services?business_id=eq.${biz.id}&active=eq.true&select=id,name,minutes,price&order=name`),
    db(`working_hours?business_id=eq.${biz.id}&select=weekday,opens,closes`),
    db(`closed_dates?business_id=eq.${biz.id}&day=gte.${now.date}&select=day`),
    db(`bookings?business_id=eq.${biz.id}&status=eq.aktivno&start_at=gte.${q(from)}&start_at=lt.${q(to)}&select=id,start_at,end_at,customer_phone,wa_phone,service_name`),
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
    { name: "otkazi_termin", description: "Otkazuje (briše) budući termin koji je rezervisan s WhatsApp broja s kojeg mušterija sada piše. Termine drugih ljudi nije moguće otkazati.",
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
        customer_name: String(input.ime).trim(), customer_phone: String(input.telefon).trim(), wa_phone: waPhone, source: "hostio",
      } });
    } catch (e) {
      if (e.code === "23P01") throw new Error("Termin je upravo zauzet, ponudi drugi.");
      throw e;
    }
    ctx.bookings.push({ date, start: toMin(time), end: toMin(time) + s.minutes, wa_phone: waPhone, service_name: s.name });
    log("booking", biz.slug, date, time, s.name);
    return { potvrđeno: true, dan: fmtDate(date), vrijeme: time, usluga: s.name };
  }
  if (name === "otkazi_termin") {
    const date = String(input.datum), time = String(input.vrijeme);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Neispravan datum ili vrijeme");
    const start = localToUtc(date, time, ctx.tz);
    if (new Date(start) < new Date()) throw new Error("Taj termin je već prošao.");
    // Only bookings made from this exact WhatsApp number can be cancelled.
    const rows = await db(`bookings?business_id=eq.${biz.id}&status=eq.aktivno&start_at=eq.${q(start)}&wa_phone=eq.${q(waPhone)}&select=id`);
    if (!rows.length) throw new Error("S ovog WhatsApp broja nije rezervisan termin u to vrijeme. Otkazati se može samo termin rezervisan s ovog broja.");
    await db(`bookings?id=eq.${rows[0].id}&wa_phone=eq.${q(waPhone)}`, { method: "PATCH", body: { status: "otkazano", cancelled_at: new Date().toISOString() }, prefer: "return=minimal" });
    ctx.bookings = ctx.bookings.filter((b) => !(b.id === rows[0].id));
    log("cancel", biz.slug, date, time);
    return { otkazano: true, dan: fmtDate(date), vrijeme: time };
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

// customerKey: the WhatsApp number, or "ig:<id>" for Instagram (used to tie salon bookings to the person).
async function reply(biz, channel, customerKey, history) {
  const ask = FREE_KEY ? askFree : askClaude;
  let system, toolDefs, exec;
  if (biz.template === "rentacar") {
    const ctx = await loadRcContext(biz);
    system = rcPrompt(biz, ctx, channel.name);
    toolDefs = rcTools(ctx);
    exec = async (name, input) => {
      try { return { ok: await runRcTool(name, input, { biz, ctx }) }; }
      catch (e) { return { error: "Greška: " + e.message }; }
    };
  } else {
    const ctx = await loadContext(biz);
    const booked = ctx.bookings.filter((b) => b.wa_phone === customerKey)
      .map((b) => `${b.service_name}, ${fmtDate(b.date)} u ${String(Math.floor(b.start / 60)).padStart(2, "0")}:${String(b.start % 60).padStart(2, "0")}`);
    system = systemPrompt(biz, ctx, booked);
    if (channel === instagram) system = system.replaceAll("WhatsApp poruke", "Instagram poruke").replaceAll("WhatsApp broja", "Instagram profila").replaceAll("broja s kojeg", "profila s kojeg").replaceAll("Ako mušterija kaže da je to broj s kojeg piše, iskoristi broj s kojeg piše.", "");
    else system += `\n\nMušterija piše s broja +${customerKey}.`;
    toolDefs = tools(ctx);
    exec = async (name, input) => {
      try { return { ok: await runTool(name, input, { biz, ctx, waPhone: customerKey }) }; }
      catch (e) { return { error: "Greška: " + e.message }; }
    };
  }
  const text = await ask(system, history, toolDefs, exec);
  return (text || fallbackText(biz)).replace(/\*\*/g, "").trim();
}
const fallbackText = () => "Hvala na poruci, javit ćemo Vam se uskoro.";

// ---------- messages from any channel ----------
export const sendWhatsApp = (phoneId, to, text) => whatsapp.send({ phoneId }, to, text);

// Joins back-to-back messages from the same side into one turn ("zdravo" + "imate li sutra" + "oko 10").
function mergeTurns(list) {
  const out = [];
  for (const m of list) {
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n" + m.content;
    else out.push({ role: m.role, content: m.content });
  }
  return out;
}

/**
 * One incoming customer message.
 * channel: whatsapp | instagram (senders), acct: what the channel needs to answer,
 * customer: WhatsApp number or Instagram user id, msgId: the channel's message id (deduplication).
 */
async function handleIncoming({ channel, acct, biz, customer, msgId, text, kind, button }) {
  const chan = channel === instagram ? "instagram" : "whatsapp";
  const customerKey = chan === "instagram" ? "ig:" + customer : customer;
  // Save first: if this message was already handled, stop (Meta sometimes delivers twice).
  const saved = await db("messages?on_conflict=wa_message_id", {
    method: "POST", prefer: "resolution=ignore-duplicates,return=representation",
    body: { business_id: biz.id, channel: chan, customer_phone: customer, role: "user", content: text ?? `[${kind}]`, wa_message_id: (chan === "instagram" ? "ig:" : "") + msgId },
  });
  if (!saved.length) { log("poruka već obrađena, preskačem"); return; }
  log("2/4 spremljeno u bazu za", biz.slug, chan);
  channel.markRead(acct, msgId, customer);
  const remember = (content) => db("messages", { method: "POST", prefer: "return=minimal", body: { business_id: biz.id, channel: chan, customer_phone: customer, role: "assistant", content } });

  // "Dolazim" / "Otkaži" buttons from the salon reminder are handled directly (no AI), for the exact booking.
  const action = String(button?.payload || "").match(/^(potvrdi|otkazi):([0-9a-f-]{36})$/i);
  if (action && chan === "whatsapp") {
    const answer = await reminderAnswer(biz, customer, action[1].toLowerCase(), action[2]);
    await channel.send(acct, customer, answer);
    await remember(answer);
    log("4/4 odgovor na dugme podsjetnika:", action[1]);
    return;
  }

  // Wait a few seconds. If the customer sends another message meanwhile, that newer one answers everything.
  await sleep(REPLY_DELAY_MS);
  const newer = await db(`messages?business_id=eq.${biz.id}&channel=eq.${chan}&customer_phone=eq.${q(customer)}&role=eq.user&id=gt.${saved[0].id}&select=id&limit=1`);
  if (newer.length) { log("stigla je novija poruka, ona će odgovoriti na sve"); return; }
  channel.typing(acct, customer, msgId);

  let answer;
  if (!text) {
    answer = biz.template === "rentacar"
      ? "Hvala na poruci. Molimo Vas da nam napišete poruku tekstom, a dokumente ćete moći dodati na našoj stranici kod rezervacije."
      : "Hvala na poruci. Molimo Vas da nam napišete poruku tekstom kako bismo Vam mogli pomoći oko termina.";
  } else {
    const since = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    const rows = await db(`messages?business_id=eq.${biz.id}&channel=eq.${chan}&customer_phone=eq.${q(customer)}&created_at=gte.${q(since)}&select=role,content&order=created_at.desc&limit=20`);
    const history = mergeTurns(rows.reverse().filter((m) => !m.content.startsWith("[")));
    while (history.length && history[0].role !== "user") history.shift();
    try { answer = await reply(biz, channel, customerKey, history); }
    catch (e) { log("GREŠKA kod AI-ja:", e.message); answer = fallbackText(biz); }
  }
  if (!answer) return;
  log("3/4 AI odgovorio, šaljem na", channel.name);
  await channel.send(acct, customer, answer);
  log("4/4 gotovo");
  await remember(answer);
}

async function handleWhatsApp(phoneId, msg) {
  log("1/4 WhatsApp poruka primljena", "phone_id=" + phoneId, "tip=" + msg.type);
  const [biz] = await db(`businesses?whatsapp_phone_id=eq.${q(phoneId)}&select=${BIZ_FIELDS}`);
  if (!biz) { log("no business for phone id", phoneId); return; }
  const button = msg.type === "button" ? { text: msg.button?.text, payload: msg.button?.payload }
    : msg.type === "interactive" ? { text: msg.interactive?.button_reply?.title, payload: msg.interactive?.button_reply?.id } : null;
  const text = msg.type === "text" ? msg.text.body.trim() : button?.text ? String(button.text).trim() : null;
  await handleIncoming({ channel: whatsapp, acct: { phoneId }, biz, customer: msg.from, msgId: msg.id, text, kind: msg.type, button });
}

async function handleInstagram(igId, ev) {
  const m = ev.message;
  if (!m || m.is_echo || m.is_deleted || m.is_unsupported) return;   // our own replies, deletions, reactions etc.
  log("1/4 Instagram poruka primljena", "ig=" + igId);
  const [acct] = await db(`ig_accounts?ig_user_id=eq.${q(igId)}&active=eq.true&select=ig_user_id,access_token,businesses(${BIZ_FIELDS})`);
  if (!acct?.businesses) { log("no business for instagram account", igId); return; }
  const text = typeof m.text === "string" && m.text.trim() ? m.text.trim() : null;
  await handleIncoming({ channel: instagram, acct, biz: acct.businesses, customer: ev.sender.id, msgId: m.mid, text, kind: m.attachments?.[0]?.type || "poruka" });
}

async function reminderAnswer(biz, waPhone, kind, id) {
  const tz = biz.timezone || "Europe/Sarajevo";
  const [b] = await db(`bookings?id=eq.${id}&business_id=eq.${biz.id}&wa_phone=eq.${q(waPhone)}&select=id,start_at,service_name,status`);
  if (!b || b.status !== "aktivno") return "Ovaj termin više nije aktivan. Ako želite novi termin, slobodno nam pišite.";
  const l = toLocal(b.start_at, tz), when = `${fmtDate(l.date)} u ${String(Math.floor(l.min / 60)).padStart(2, "0")}:${String(l.min % 60).padStart(2, "0")}`;
  if (new Date(b.start_at) < new Date()) return "Ovaj termin je već prošao. Za novi termin slobodno nam pišite.";
  if (kind === "potvrdi") {
    await db(`bookings?id=eq.${id}&wa_phone=eq.${q(waPhone)}`, { method: "PATCH", prefer: "return=minimal", body: { confirmed_at: new Date().toISOString() } });
    return `Hvala na potvrdi, vidimo se! Vaš termin: ${when}.`;
  }
  await db(`bookings?id=eq.${id}&wa_phone=eq.${q(waPhone)}&status=eq.aktivno`, { method: "PATCH", prefer: "return=minimal", body: { status: "otkazano", cancelled_at: new Date().toISOString() } });
  log("cancel from reminder", biz.slug, id);
  return `Termin (${b.service_name}, ${when}) je otkazan. Hvala što ste nam javili. Ako želite novi termin, slobodno nam pišite.`;
}

// Meta signs every webhook with the app secret (WhatsApp: Meta app secret; Instagram login: Instagram app secret).
export function validSignature(raw, header) {
  const secrets = [APP_SECRET, IG_APP_SECRET].filter(Boolean);
  if (!secrets.length) return false;
  if (!header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7));
  return secrets.some((sec) => {
    const expected = Buffer.from(crypto.createHmac("sha256", sec).update(raw).digest("hex"));
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
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
    if (body.object === "instagram") {
      for (const entry of body.entry || []) for (const ev of entry.messaging || []) {
        if (String(ev.sender?.id) === String(entry.id)) continue;                 // sent by the business itself
        await handleInstagram(String(ev.recipient?.id || entry.id), ev);
      }
    } else {
      for (const entry of body.entry || []) for (const ch of entry.changes || []) {
        const v = ch.value || {};
        for (const msg of v.messages || []) await handleWhatsApp(v.metadata.phone_number_id, msg);
      }
    }
  } catch (e) { log("GREŠKA:", e.message, env("HOSTIO_DEBUG") ? e.stack : ""); }
  return true;
}

// Health check page: tests every part of Hostio and reports OK / problem, without showing any secret.
export async function statusReport({ waba, subscribe, redirect, baseUrl } = {}) {
  const out = [];
  const add = (name, ok, note = "") => out.push({ name, ok, note });
  const need = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "WHATSAPP_TOKEN", "WHATSAPP_VERIFY_TOKEN", "META_APP_SECRET"];
  for (const k of need) add("Varijabla " + k, !!env(k), env(k) ? "" : "nedostaje u postavkama servera (Secrets)");
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
