// Dashboard API: /api/prijava, /api/osvjezi, /api/podaci, /api/razgovor, /api/otkazi
import { handleApi } from "../../lib/dashboard.js";

export default async (req) => {
  try { return await handleApi(req); }
  catch (e) {
    console.log("GREŠKA u dashboard API:", e.message);
    return new Response(JSON.stringify({ greska: "Greška na serveru. Pokušajte ponovo." }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

// Exact paths, so /api/rc/* (rent-a-car websites) goes to its own function.
export const config = { path: ["prijava", "osvjezi", "podaci", "razgovor", "otkazi", "postavke", "slobodno", "termin"].map((r) => "/api/" + r) };
