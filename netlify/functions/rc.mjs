// Public API for rent-a-car agency websites: /api/rc/agencija, /dostupnost, /kalendar, /zahtjev
import { handleRentApi } from "../../lib/rentacar.js";

export default async (req) => {
  try { return await handleRentApi(req); }
  catch (e) {
    console.log("GREŠKA rc API:", e.message);
    return new Response(JSON.stringify({ greska: "server" }), { status: 500, headers: { "content-type": "application/json" } });
  }
};

export const config = { path: "/api/rc/*" };
