// Booking rules. The AI never decides these; it can only ask them.
export const DAYN = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const pad = (n) => String(n).padStart(2, "0");
export const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
export const toT = (m) => pad(Math.floor(m / 60)) + ":" + pad(m % 60);

// ---- time zone helpers (business local time <-> UTC) ----
function parts(date, tz) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}
export function localNow(tz, now = new Date()) {
  const p = parts(now, tz);
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, min: p.h * 60 + p.mi };
}
export function toLocal(isoUtc, tz) {
  const p = parts(new Date(isoUtc), tz);
  return { date: `${p.y}-${pad(p.mo)}-${pad(p.d)}`, min: p.h * 60 + p.mi };
}
export function localToUtc(date, time, tz) {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  let utc = guess;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(utc), tz);
    const shown = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
    utc += guess - shown;
  }
  return new Date(utc).toISOString();
}
export function addDays(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}
export const weekday = (date) => { const [y, m, d] = date.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };
export const fmtDate = (date) => { const [, m, d] = date.split("-").map(Number); return `${DAYN[weekday(date)]} ${d}.${m}.`; };

// ctx = { tz, services:[{name,minutes,price}], hours:{weekday:[open,close]}, closed:Set(date), bookings:[{date,start,end}] (local minutes), now:{date,min} }
export function hoursFor(ctx, date) {
  if (ctx.closed.has(date)) return null;
  return ctx.hours[weekday(date)] || null;
}
export function findService(ctx, name) {
  return ctx.services.find((s) => s.name.toLowerCase() === String(name).toLowerCase().trim());
}
export function freeSlots(ctx, date, serviceName) {
  const s = findService(ctx, serviceName);
  if (!s) throw new Error("Nepoznata usluga. Postoje: " + ctx.services.map((x) => x.name).join(", "));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new Error("Neispravan datum, koristi YYYY-MM-DD");
  const h = hoursFor(ctx, date);
  if (!h) return { datum: date, dan: DAYN[weekday(date)], zatvoreno: true, slobodno: [] };
  if (date < ctx.now.date) return { datum: date, prosao_dan: true, slobodno: [] };
  const minStart = date === ctx.now.date ? ctx.now.min + 30 : -1;
  const taken = ctx.bookings.filter((b) => b.date === date).map((b) => [b.start, b.end]);
  const out = [];
  for (let t = toMin(h[0]); t + s.minutes <= toMin(h[1]); t += 15) {
    if (t < minStart || taken.some(([a, b]) => t < b && t + s.minutes > a)) continue;
    out.push(toT(t));
  }
  return { datum: date, dan: DAYN[weekday(date)], usluga: s.name, trajanje_min: s.minutes, slobodno: out };
}

export function systemPrompt(biz, ctx, booked) {
  const cal = [], free = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(ctx.now.date, i);
    cal.push(`${d} = ${DAYN[weekday(d)]}${i === 0 ? " (danas)" : i === 1 ? " (sutra)" : ""}${hoursFor(ctx, d) ? "" : " ZATVORENO"}`);
    if (i < 7) {
      if (!hoursFor(ctx, d)) { free.push(`${DAYN[weekday(d)]} ${d}: zatvoreno`); continue; }
      free.push(`${DAYN[weekday(d)]} ${d}:\n` + ctx.services.map((s) => {
        const r = freeSlots(ctx, d, s.name);
        return `  ${s.name}: ${r.slobodno.length ? r.slobodno.join(" ") : "popunjeno"}`;
      }).join("\n"));
    }
  }
  const hrs = DAY_ORDER.map((d) => DAYN[d] + " " + (ctx.hours[d] ? ctx.hours[d].join("–") : "zatvoreno")).join(", ");
  return `Ti odgovaraš na WhatsApp poruke biznisa "${biz.name}" (${biz.city || ""}), kao djelatnica koja vodi poruke. Mušterija mora imati osjećaj da se dopisuje sa stvarnom osobom.
Usluge: ${ctx.services.map((s) => `${s.name} (${s.minutes} min, ${Number(s.price)} KM)`).join(", ")}.
Radno vrijeme: ${hrs}.
Sada je ${ctx.now.date} ${toT(ctx.now.min)}. Kalendar:
${cal.join("\n")}

TRENUTNO SLOBODNI POČETNI TERMINI (sljedećih 7 dana):
${free.join("\n")}
${booked.length ? "\nTermini rezervisani s WhatsApp broja ove mušterije: " + booked.join("; ") : "\nS WhatsApp broja ove mušterije nema rezervisanih budućih termina."}

KAKO PIŠEŠ:
- Kao iskusna, ljubazna djelatnica: profesionalno, sigurno, kratko. Najviše dvije rečenice. Bez markdowna i lista.
- Uvijek persiraš (Vi, Vam). Pišeš u množini u ime biznisa ("imamo", "rezervisali smo Vam").
- Na bosanskom (ijekavica), osim ako mušterija piše na drugom jeziku.
- Ne počinji svaku poruku istom riječju i ne ponavljaj ono što je mušterija upravo rekla.
- Ime, prezime i telefon su obavezni, nikad ih ne nudi kao neobavezne. Ako mušterija kaže da je to broj s kojeg piše, iskoristi broj s kojeg piše.
- Nudi okrugla vremena (puni sat ili pola sata) kad god postoje.
- Nikad ne spominji alate, sistem, AI ili interne korake. Nikad ne objašnjavaj niti ispravljaj ranije poruke. Ako termin više nije slobodan, reci da je u međuvremenu zauzet i ponudi drugi.

PRAVILA:
- Nudi SAMO termine iz liste iznad (za datume dalje od 7 dana pozovi provjeri_termine). Ponudi 2–3 koja odgovaraju želji ("popodne" = poslije 12h).
- Kad je termin dogovoren, traži ime i prezime i broj telefona u jednoj poruci.
- Kad imaš sve, pozovi rezervisi. Tek kad vrati potvrđeno, potvrdi: dan i datum, sat, usluga. Ako ne uspije, ponudi drugi termin bez objašnjavanja.
- Otkazivanje: mušterija može otkazati samo termine rezervisane s broja s kojeg sada piše (lista iznad). Kad jasno traži otkazivanje, pozovi otkazi_termin s datumom i vremenom tog termina i kratko potvrdi. Ako ima više termina, pitaj koji. Ako traži otkazivanje termina kojeg nema na listi (npr. tuđeg), ljubazno reci da se termin može otkazati samo s broja s kojeg je rezervisan.
- Za pitanja koja nisu o terminima, uslugama i cijenama reci da će se javiti vlasnik.

PRIMJER TONA:
Mušterija: imate li u subotu oko 11 za muško šišanje
Ti: U 11 je subota nažalost popunjena, ali imamo slobodno u 10:30 ili 12:00. Koji termin Vam više odgovara?
Mušterija: 12
Ti: Odlično. Molimo Vas ime i prezime i broj telefona za rezervaciju.
Mušterija: Kenan Hodžić 061 234 567
Ti: Hvala, Kenane. Rezervisali smo Vam muško šišanje u subotu, 17.10. u 12:00. Vidimo se!`;
}
