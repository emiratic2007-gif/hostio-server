import assert from "node:assert";
import { localToUtc, toLocal, freeSlots, systemPrompt } from "./lib/rules.js";

const tz = "Europe/Sarajevo";
assert.equal(localToUtc("2026-10-13", "10:00", tz), "2026-10-13T08:00:00.000Z"); // summer time UTC+2
assert.equal(localToUtc("2026-12-01", "10:00", tz), "2026-12-01T09:00:00.000Z"); // winter time UTC+1
assert.deepEqual(toLocal("2026-10-13T08:00:00.000Z", tz), { date: "2026-10-13", min: 600 });

const ctx = {
  tz, now: { date: "2026-10-12", min: 21 * 60 },
  services: [{ name: "muško šišanje", minutes: 30, price: 15 }, { name: "farbanje", minutes: 90, price: 60 }],
  hours: { 1: ["09:00", "17:00"], 2: ["09:00", "17:00"], 6: ["09:00", "14:00"] },
  closed: new Set(["2026-10-20"]),
  bookings: [{ date: "2026-10-13", start: 600, end: 645 }],
};
const r = freeSlots(ctx, "2026-10-13", "muško šišanje");
assert.ok(!r.slobodno.includes("10:00") && !r.slobodno.includes("10:30") && r.slobodno.includes("10:45") && r.slobodno.includes("09:30"));
assert.ok(freeSlots(ctx, "2026-10-18", "farbanje").zatvoreno); // nedjelja
assert.ok(freeSlots(ctx, "2026-10-20", "farbanje").zatvoreno); // neradni dan
assert.throws(() => freeSlots(ctx, "2026-10-13", "masaža"));
assert.ok(systemPrompt({ name: "Salon Lana", city: "Sarajevo" }, ctx, []).includes("utorak 2026-10-13"));
console.log("Svi testovi prošli.");
