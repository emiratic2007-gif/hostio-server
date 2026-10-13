// Reminders: once an hour, send a WhatsApp template the day before each appointment,
// with "Dolazim" / "Otkaži" buttons that point at that exact booking.
import { db, log } from "./hostio.js";
import { toLocal, fmtDate, toT, localNow } from "./rules.js";

const env = (k, d) => process.env[k] ?? d;
const GRAPH = `https://graph.facebook.com/${env("GRAPH_VERSION", "v25.0")}`;
const TEMPLATE = env("REMINDER_TEMPLATE", "podsjetnik_termin");
const LANG = env("REMINDER_LANG", "hr");
const MIN_NOTICE_H = Number(env("REMINDER_MIN_NOTICE_HOURS", 20)); // bookings made later than this get no reminder
const FROM_H = 8, TO_H = 21;                                        // no messages at night (business local time)
const q = encodeURIComponent;

// Exactly the template body registered on Meta, used to keep the chat history in the database.
export function reminderText(name, biz, service, date, time) {
  return `Poštovani ${name}, podsjećamo Vas na termin u ${biz}: ${service}, ${date} u ${time}. Ako ne možete doći, kliknite Otkaži i mjesto ćemo ponuditi drugima.`;
}

async function sendTemplate(phoneId, to, params, bookingId) {
  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "template",
      template: {
        name: TEMPLATE, language: { code: LANG },
        components: [
          { type: "body", parameters: params.map((text) => ({ type: "text", text })) },
          { type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: "potvrdi:" + bookingId }] },
          { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "otkazi:" + bookingId }] },
        ],
      },
    }),
  });
  if (!res.ok) { log("GREŠKA podsjetnik:", res.status, await res.text()); return false; }
  return true;
}

export async function sendDueReminders(now = new Date()) {
  // Off until the WhatsApp template is approved: set REMINDERS_ON=1 in Netlify to turn on.
  if (env("REMINDERS_ON") !== "1") return { sent: 0, skipped: 0, total: 0, off: true };
  const from = new Date(now.getTime() + 2 * 3600e3).toISOString();
  const to = new Date(now.getTime() + 26 * 3600e3).toISOString();
  const rows = await db(`bookings?status=eq.aktivno&reminder_sent_at=is.null&wa_phone=not.is.null&start_at=gt.${q(from)}&start_at=lte.${q(to)}` +
    `&select=id,start_at,created_at,service_name,customer_name,wa_phone,business_id,businesses(name,timezone,whatsapp_phone_id,reminders_enabled)&order=start_at.asc&limit=200`);
  let sent = 0, skipped = 0;
  for (const b of rows) {
    const biz = b.businesses || {};
    const tz = biz.timezone || "Europe/Sarajevo";
    const hour = Math.floor(localNow(tz, now).min / 60);
    if (!biz.reminders_enabled || !biz.whatsapp_phone_id || hour < FROM_H || hour >= TO_H) { skipped++; continue; }
    // Fresh bookings don't need a reminder yet: wait until the booking is at least 12 h old.
    if (new Date(b.start_at) - new Date(b.created_at) < MIN_NOTICE_H * 3600e3 || now - new Date(b.created_at) < 12 * 3600e3) { skipped++; continue; }
    // Claim the booking first so two runs can never send the same reminder twice.
    const claimed = await db(`bookings?id=eq.${b.id}&reminder_sent_at=is.null`, { method: "PATCH", prefer: "return=representation", body: { reminder_sent_at: now.toISOString() } });
    if (!claimed.length) continue;
    const l = toLocal(b.start_at, tz);
    const name = (b.customer_name || "").trim().split(/\s+/)[0] || "Poštovani";
    const params = [name, biz.name, b.service_name, fmtDate(l.date), toT(l.min)];
    if (await sendTemplate(biz.whatsapp_phone_id, b.wa_phone, params, b.id)) {
      sent++;
      await db("messages", { method: "POST", prefer: "return=minimal", body: { business_id: b.business_id, customer_phone: b.wa_phone, role: "assistant", content: reminderText(...params) } });
    } else {
      await db(`bookings?id=eq.${b.id}`, { method: "PATCH", prefer: "return=minimal", body: { reminder_sent_at: null } }); // try again next hour
    }
  }
  log(`podsjetnici: poslano ${sent}, preskočeno ${skipped}, kandidata ${rows.length}`);
  return { sent, skipped, total: rows.length };
}
