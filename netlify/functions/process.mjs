// Background function: has up to 15 minutes to let the AI answer and save the booking.
// It checks Meta's signature again, so nobody else can call it.
import { processWebhook } from "../../lib/hostio.js";

export default async (req) => {
  const raw = Buffer.from(await req.arrayBuffer());
  await processWebhook(raw, req.headers.get("x-hub-signature-256") || "");
};

export const config = { path: "/hostio-process", background: true };
