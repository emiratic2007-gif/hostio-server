// Cloudflare Worker for the Hostio websites.
// Static pages come from public/; /api/* and /status are passed on to the Hostio server on Supabase.
import { forward } from "./server.js";
import { statusPage } from "./status.js";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith("/api/")) return forward(request, path);
    if (path === "/status") return statusPage(request);
    return env.ASSETS.fetch(request);
  },
};
