// Optional: run Hostio as a normal server (local testing, Cloud Run, Render...).
// On Netlify this file is not used; netlify/functions/ is used instead.
import http from "node:http";
import { verifyChallenge, processWebhook, validSignature } from "./lib/hostio.js";

const PORT = process.env.PORT ?? 8080;
http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.pathname === "/") { res.end("Hostio radi."); return; }
  if (req.method === "GET" && url.pathname === "/webhook") {
    const c = verifyChallenge(url);
    res.writeHead(c ? 200 : 403).end(c ?? "forbidden");
    return;
  }
  if (req.method === "POST" && url.pathname === "/webhook") {
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks), sig = req.headers["x-hub-signature-256"];
    if (!validSignature(raw, sig)) { res.writeHead(401).end(); return; }
    res.writeHead(200).end("ok");
    processWebhook(raw, sig);
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, () => console.log("Hostio sluša na portu", PORT));
