// /status?kljuc=… : readable health page for every part of Hostio.
import { forward } from "../cloudflare/server.js";

const esc = (t) => String(t ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export async function onRequest({ request }) {
  const res = await forward(request, "/status");
  const data = await res.json().catch(() => ({}));
  const rows = data.status || [];
  const body = rows.length
    ? `<table style="border-collapse:collapse;width:100%">${rows.map((r) => `<tr style="border-bottom:1px solid #ddd"><td style="padding:8px;font-size:20px">${r.ok ? "✅" : "❌"}</td><td style="padding:8px"><b>${esc(r.name)}</b><br><small>${esc(r.note)}</small></td></tr>`).join("")}</table>`
    : `<p>${esc(data.greska || "Server ne odgovara.")}</p>`;
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hostio status</title>
<body style="font-family:system-ui,sans-serif;max-width:720px;margin:30px auto;padding:0 16px"><h1>Hostio status</h1>${body}</body>`,
    { status: res.status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
