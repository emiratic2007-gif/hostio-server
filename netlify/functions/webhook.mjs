// Meta calls this address. It answers fast and hands the message to the background function.
import { verifyChallenge, validSignature } from "../../lib/hostio.js";

export default async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const c = verifyChallenge(url);
    return new Response(c ?? "forbidden", { status: c ? 200 : 403 });
  }
  if (req.method === "POST") {
    const raw = Buffer.from(await req.arrayBuffer());
    const sig = req.headers.get("x-hub-signature-256") || "";
    if (!validSignature(raw, sig)) return new Response("", { status: 401 });
    await fetch(new URL("/hostio-process", url), {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": sig },
      body: raw,
    });
    return new Response("ok");
  }
  return new Response("", { status: 405 });
};

export const config = { path: "/webhook" };
