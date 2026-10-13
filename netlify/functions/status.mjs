// Open https://<tvoja-adresa>/status?kljuc=<WHATSAPP_VERIFY_TOKEN> to check every part of Hostio.
import { statusReport } from "../../lib/hostio.js";

export default async (req) => {
  const params = new URL(req.url).searchParams;
  const key = params.get("kljuc");
  if (!key || key !== process.env.WHATSAPP_VERIFY_TOKEN) return new Response("Dodaj ?kljuc=<tvoj WHATSAPP_VERIFY_TOKEN> na kraj adrese.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  const rows = await statusReport({ waba: params.get("waba"), subscribe: params.get("pretplati") === "da", redirect: params.get("preusmjeri") === "da", baseUrl: new URL(req.url).origin });
  const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hostio status</title>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:30px auto;padding:0 16px">
<h1>Hostio status</h1><table style="border-collapse:collapse;width:100%">
${rows.map((r) => `<tr style="border-bottom:1px solid #ddd"><td style="padding:8px;font-size:20px">${r.ok ? "✅" : "❌"}</td><td style="padding:8px"><b>${esc(r.name)}</b><br><small>${esc(r.note)}</small></td></tr>`).join("")}
</table></body>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
};

export const config = { path: "/status" };
