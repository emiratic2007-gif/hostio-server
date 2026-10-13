// Settings (secrets) for Node (Netlify, tests) and Deno (Supabase Edge Functions) alike.
import process from "node:process";
export { Buffer } from "node:buffer";

// Supabase gives its own key names to Edge Functions; names starting with SUPABASE_ cannot be set by hand there.
const ALIAS = { SUPABASE_SERVICE_KEY: "SUPABASE_SERVICE_ROLE_KEY" };
export const env = (k, d) => process.env[k] || (ALIAS[k] && process.env[ALIAS[k]]) || d;
