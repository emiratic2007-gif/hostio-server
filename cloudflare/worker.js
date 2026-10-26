// Cloudflare Worker for the Hostio websites.
// Static pages come from public/; /api/* and /status are passed on to the Hostio server on Supabase.
import { forward } from "./server.js";
import { statusPage } from "./status.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (path.startsWith("/api/")) return forward(request, path);
    if (path === "/status") return statusPage(request);
    // One canonical host for Google: www.hostio.ba and the workers.dev address redirect to hostio.ba.
    if (url.hostname === "www.hostio.ba" || url.hostname.endsWith(".workers.dev")) {
      return Response.redirect("https://hostio.ba" + path + url.search, 301);
    }
    return env.ASSETS.fetch(request);
  },
};
