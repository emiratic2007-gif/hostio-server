// Dashboard API: /api/prijava, /api/osvjezi, /api/podaci, /api/razgovor, /api/otkazi
import { handleApi } from "../../lib/dashboard.js";

export default async (req) => {
  try { return await handleApi(req); }
  catch (e) {
    console.log("GREŠKA u dashboard API:", e.message);
    return new Response(JSON.stringify({ greska: "Greška na serveru. Pokušajte ponovo." }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config = { path: "/api/*" };
