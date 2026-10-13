// Hostio rent-a-car: price and time rules shared by the website (browser) and the server.
// The server always recomputes the price; the browser only shows the same numbers.

const pad = (n) => String(n).padStart(2, "0");
export const DAY_MS = 24 * 3600 * 1000;
export const GRACE_MIN = 59; // up to 59 minutes late on return is not charged as an extra day

// Local date "YYYY-MM-DD" + time "HH:MM" in the agency time zone -> UTC ISO string.
export function localToUtc(date, time, tz) {
  const [y, mo, d] = String(date).split("-").map(Number);
  const [h, mi] = String(time).split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess;
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(f.formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
    utc += guess - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  }
  return new Date(utc).toISOString();
}

export function todayLocal(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(now);
}

export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

export const validDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !isNaN(Date.parse(s + "T00:00:00Z"));
export const validTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));

// Number of charged days: every started 24 h counts, after a short grace period.
export function rentalDays(startIso, endIso) {
  const ms = new Date(endIso) - new Date(startIso) - GRACE_MIN * 60000;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

// Price per day for a rental length: the highest tier whose "od" (from days) is reached.
export function dayPrice(tiers, days) {
  const sorted = [...(tiers || [])].sort((a, b) => a.od - b.od);
  let p = sorted.length ? Number(sorted[0].cijena) : 0;
  for (const t of sorted) if (days >= t.od) p = Number(t.cijena);
  return p;
}
export const fromPrice = (tiers) => Math.min(...(tiers || []).map((t) => Number(t.cijena)));

const outside = (hm, hours) => !!hours && (hm < hours.open || hm > hours.close);
const r2 = (n) => Math.round(n * 100) / 100;

/**
 * Full quote. Input uses local date/time strings in the agency time zone.
 * Returns null fields + "greska" when something is not valid, so both sides show the same message key.
 */
export function quote({ vehicle, settings, tz, pickupDate, pickupTime, returnDate, returnTime, pickup, dropoff, extras = [] }) {
  if (!vehicle) return { greska: "vozilo" };
  if (!validDate(pickupDate) || !validDate(returnDate) || !validTime(pickupTime) || !validTime(returnTime)) return { greska: "datum" };
  const start = localToUtc(pickupDate, pickupTime, tz), end = localToUtc(returnDate, returnTime, tz);
  if (new Date(end) <= new Date(start)) return { greska: "redoslijed" };
  // Count days on the local clock, so a summer/winter time change never adds an extra day.
  const days = rentalDays(pickupDate + "T" + pickupTime + ":00Z", returnDate + "T" + returnTime + ":00Z");
  if (days < (settings.min_days || 1)) return { greska: "min_dana", min: settings.min_days };
  if (days > 90) return { greska: "max_dana" };
  const locs = settings.locations || [];
  const pu = locs.find((l) => l.id === pickup), dr = locs.find((l) => l.id === (dropoff || pickup));
  if (!pu || !dr) return { greska: "lokacija" };

  const perDay = dayPrice(vehicle.price_tiers, days);
  const lines = [{ key: "najam", days, perDay, total: r2(perDay * days) }];
  for (const id of extras) {
    const x = (settings.extras || []).find((e) => e.id === id);
    if (!x) return { greska: "dodatak" };
    let t = x.per === "dan" ? x.price * days : x.price;
    if (x.max) t = Math.min(t, x.max);
    lines.push({ key: "dodatak", id, total: r2(t) });
  }
  if (pu.fee) lines.push({ key: "preuzimanje", id: pu.id, total: r2(pu.fee) });
  if (dr.fee) lines.push({ key: "vracanje", id: dr.id, total: r2(dr.fee) });
  const ah = settings.after_hours_fee || 0;
  if (ah && outside(pickupTime, settings.hours)) lines.push({ key: "van_radnog_preuzimanje", total: ah });
  if (ah && outside(returnTime, settings.hours)) lines.push({ key: "van_radnog_vracanje", total: ah });

  const total = r2(lines.reduce((s, l) => s + l.total, 0));
  return { start, end, days, perDay, lines, total, deposit: Number(vehicle.deposit) || 0 };
}

// Is [start, end) free for this vehicle, given busy ranges and a buffer for cleaning between rentals?
export function isFree(busy, start, end, bufferHours = 0) {
  const s = new Date(start).getTime(), e = new Date(end).getTime(), b = bufferHours * 3600e3;
  return !busy.some((x) => s < new Date(x.end_at).getTime() + b && e + b > new Date(x.start_at).getTime());
}
