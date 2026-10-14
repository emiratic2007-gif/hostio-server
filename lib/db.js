// Database access (Supabase REST with the server key) and logging, shared by every part of Hostio.
import { env } from "./env.js";

const SUPABASE_URL = env("SUPABASE_URL");
const SUPABASE_KEY = env("SUPABASE_SERVICE_KEY");

export const log = (...a) => console.log(new Date().toISOString(), ...a);

export async function db(path, { method = "GET", body, prefer } = {}) {
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
