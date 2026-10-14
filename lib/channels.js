// Sending messages on each channel. Every function returns quietly on failure (and logs it).
import { env } from "./env.js";
import { log } from "./db.js";

const VERSION = env("GRAPH_VERSION", "v25.0");
const WA_GRAPH = `https://graph.facebook.com/${VERSION}`;
const IG_GRAPH = `https://graph.instagram.com/${VERSION}`;
const WA_TOKEN = env("WHATSAPP_TOKEN");

// Split long answers into parts that fit the channel (Instagram: 1000 bytes per message).
export function splitText(text, maxBytes) {
  const bytes = (s) => new TextEncoder().encode(s).length;
  if (bytes(text) <= maxBytes) return [text];
  const parts = [];
  let cur = "";
  for (const piece of text.split(/(?<=\n)|(?<=[.!?] )/)) {
    if (bytes(cur + piece) > maxBytes && cur) { parts.push(cur.trim()); cur = ""; }
    if (bytes(piece) > maxBytes) {               // a single very long piece: cut by characters
      let chunk = "";
      for (const ch of piece) { if (bytes(chunk + ch) > maxBytes) { parts.push(chunk); chunk = ""; } chunk += ch; }
      cur = chunk;
    } else cur += piece;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

async function post(url, token, body, what) {
  try {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) log(`GREŠKA ${what}:`, res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (e) { log(`GREŠKA ${what}:`, e.message); return false; }
}

export const whatsapp = {
  name: "WhatsApp",
  async send(acct, to, text) {
    let ok = true;
    for (const part of splitText(text, 4000)) ok = (await post(`${WA_GRAPH}/${acct.phoneId}/messages`, WA_TOKEN, { messaging_product: "whatsapp", to, type: "text", text: { body: part } }, "slanje na WhatsApp")) && ok;
    return ok;
  },
  markRead: (acct, msgId) => post(`${WA_GRAPH}/${acct.phoneId}/messages`, WA_TOKEN, { messaging_product: "whatsapp", status: "read", message_id: msgId }, "WhatsApp pročitano"),
  // "typing..." until the answer is sent (or ~25 s)
  typing: (acct, to, msgId) => post(`${WA_GRAPH}/${acct.phoneId}/messages`, WA_TOKEN, { messaging_product: "whatsapp", status: "read", message_id: msgId, typing_indicator: { type: "text" } }, "WhatsApp tipkanje"),
};

export const instagram = {
  name: "Instagram",
  async send(acct, to, text) {
    let ok = true;
    for (const part of splitText(text, 990)) ok = (await post(`${IG_GRAPH}/${acct.ig_user_id}/messages`, acct.access_token, { recipient: { id: to }, message: { text: part } }, "slanje na Instagram")) && ok;
    return ok;
  },
  markRead: (acct, msgId, to) => post(`${IG_GRAPH}/${acct.ig_user_id}/messages`, acct.access_token, { recipient: { id: to }, sender_action: "mark_seen" }, "Instagram pročitano"),
  typing: (acct, to) => post(`${IG_GRAPH}/${acct.ig_user_id}/messages`, acct.access_token, { recipient: { id: to }, sender_action: "typing_on" }, "Instagram tipkanje"),
};
