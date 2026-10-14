// Hostio for rent-a-car agencies: answers questions on WhatsApp/Instagram, checks real availability,
// and sends the customer a prefilled link to the booking form on the agency website.
import { db } from "./db.js";
import { env } from "./env.js";
import { DAYN, weekday, localNow, toT } from "./rules.js";
import { quote, isFree, addDays, validDate, validTime } from "../public/rent/core.js";
import { effectiveBusy } from "./rentacar.js";

const SITE = env("PUBLIC_SITE_URL", "https://hostio-server.emir-atic2007.workers.dev").replace(/\/$/, "");
const LANGS = ["bs", "en", "de", "ar"];
const BLOCKING = "status=in.(na_cekanju,odobreno,blokirano)";
const nm = (o) => (o && typeof o === "object" ? o.bs || o.en || Object.values(o)[0] : o || "");

export async function loadRcContext(biz) {
  const tz = biz.timezone || "Europe/Sarajevo";
  const s = biz.settings || {};
  const from = new Date(Date.now() - 3 * 864e5).toISOString();
  const [vehicles, busy] = await Promise.all([
    db(`rc_vehicles?business_id=eq.${biz.id}&active=eq.true&select=id,make,model,year,category,transmission,fuel,seats,doors,bags,engine,price_tiers,deposit&order=sort.asc`),
    db(`rc_bookings?business_id=eq.${biz.id}&${BLOCKING}&or=(end_at.gt.${encodeURIComponent(from)},and(picked_up_at.not.is.null,returned_at.is.null))&select=vehicle_id,start_at,end_at,picked_up_at,returned_at&limit=5000`),
  ]);
  return { tz, s, now: localNow(tz), vehicles, busy: effectiveBusy(busy) };
}

const money = (n, s) => `${Number(n)} ${s.currency || "KM"}`;
const vname = (v) => `${v.make} ${v.model}`;
const tiersText = (v, s) => {
  const t = [...(v.price_tiers || [])].sort((a, b) => a.od - b.od);
  return t.map((x, i) => `${t[i + 1] ? `${x.od}–${t[i + 1].od - 1}` : `${x.od}+`} dana ${money(x.cijena, s)}`).join(", ");
};
const TRANS = { manual: "manuelni", automatic: "automatik" };

export function rcPrompt(biz, ctx, channelName) {
  const s = ctx.s, c = s.contact || {};
  const cal = Array.from({ length: 14 }, (_, i) => { const d = addDays(ctx.now.date, i); return `${d} = ${DAYN[weekday(d)]}${i === 0 ? " (danas)" : i === 1 ? " (sutra)" : ""}`; });
  const fleet = ctx.vehicles.map((v) => `- ${v.id}: ${vname(v)} ${v.year || ""}, ${v.category}, ${TRANS[v.transmission] || v.transmission}, ${v.fuel}, ${v.seats} sjedišta, ${v.bags} kofera${v.engine ? ", " + v.engine : ""}; cijena po danu: ${tiersText(v, s)}; depozit ${money(v.deposit || 0, s)}`).join("\n");
  const locs = (s.locations || []).map((l) => `- ${l.id}: ${nm(l.name)}${l.address ? " (" + l.address + ")" : ""}, ${l.fee ? "doplata " + money(l.fee, s) : "bez doplate"}`).join("\n");
  const extras = (s.extras || []).map((x) => `${nm(x.name)} ${money(x.price, s)}/${x.per === "dan" ? "dan" : "najam"}${x.max ? ` (najviše ${money(x.max, s)})` : ""}`).join("; ");
  const terms = [
    s.hours && `radno vrijeme svaki dan ${s.hours.open}–${s.hours.close}${s.after_hours_fee ? `, preuzimanje ili vraćanje van radnog vremena doplata ${money(s.after_hours_fee, s)}` : ""}`,
    s.min_age && `vozač najmanje ${s.min_age} godina`,
    s.license_years && `vozačka dozvola najmanje ${s.license_years} godine`,
    s.mileage === "unlimited" && "neograničena kilometraža",
    s.fuel_policy === "full_to_full" && "gorivo: auto se preuzima pun i vraća pun",
    s.cancellation_hours && `besplatno otkazivanje do ${s.cancellation_hours} sati prije preuzimanja`,
    "kašnjenje s vraćanjem do 59 minuta se ne naplaćuje, nakon toga dodatni dan",
    "plaćanje isključivo na licu mjesta pri preuzimanju vozila; depozit se uzima pri preuzimanju i vraća po povratku vozila",
    s.min_days > 1 && `najkraći najam ${s.min_days} dana`,
  ].filter(Boolean).join("; ");

  return `Ti odgovaraš na ${channelName} poruke rent-a-car agencije "${biz.name}" (${biz.city || ""}), kao djelatnica koja vodi poruke. Mušterija mora imati osjećaj da se dopisuje sa stvarnom osobom.
Sada je ${ctx.now.date} ${toT(ctx.now.min)}. Kalendar:
${cal.join("\n")}

VOZNI PARK (id: opis):
${fleet}

LOKACIJE PREUZIMANJA I VRAĆANJA (id: naziv, doplata):
${locs}

DODATNA OPREMA: ${extras || "nema"}.
USLOVI: ${terms}.
KONTAKT: ${[c.phone, c.address, c.email].filter(Boolean).join(", ")}.

KAKO PIŠEŠ:
- Kao iskusna, ljubazna djelatnica: profesionalno, sigurno, kratko. Najviše tri kratke rečenice. Bez markdowna, zvjezdica i lista.
- Uvijek persiraš (Vi, Vam). Pišeš u množini u ime agencije ("imamo", "šaljemo Vam").
- Odgovaraš na jeziku na kojem mušterija piše (bosanski ijekavica, engleski, njemački, arapski ili drugi).
- Ne ponavljaj ono što je mušterija upravo rekla i ne počinji svaku poruku istom riječju.
- Nikad ne spominji alate, sistem, AI ili interne korake. Nikad ne objašnjavaj niti ispravljaj ranije poruke.

PRAVILA:
- Cijene po danu, uslove i opremu odgovaraš iz podataka iznad. Ukupnu cijenu i dostupnost za konkretne datume NIKAD ne pogađaj: čim znaš datum preuzimanja i vraćanja, pozovi provjeri_dostupnost. Ako mušterija nije rekla sat, pretpostavi 10:00 i to kratko spomeni.
- Nudi samo vozila koja provjeri_dostupnost vrati kao slobodna: 2–3 koja odgovaraju želji (mjenjač, broj osoba, prtljag), s ukupnom cijenom. Ako ništa nije slobodno, ponudi druge datume.
- Rezervacija se završava na našoj stranici. Kad se mušterija odluči za vozilo, pozovi posalji_link (s jezikom na kojem mušterija piše) i pošalji link uz kratku poruku da tamo upiše podatke i doda fotografiju vozačke dozvole, a da mi zahtjev potvrđujemo u najkraćem roku. Link prepiši tačno kako ga dobiješ.
- Nikad sam ne potvrđuj rezervaciju i ne govori da je vozilo rezervisano. Vozilo je rezervisano tek kad mušterija pošalje zahtjev preko linka i agencija ga potvrdi.
- U poruci ne traži i ne primaj broj vozačke dozvole, fotografije dokumenata ni podatke kartice. Ako ih mušterija pošalje, reci da se to unosi na stranici preko linka.
- Za ono što ne znaš (status poslanog zahtjeva, posebni popusti, dogovori, oštećenja) reci da će se javiti kolega i daj broj telefona agencije.

PRIMJER TONA:
Mušterija: treba mi auto od petka do nedjelje, automatik
Ti: Rado. U koliko sati biste preuzeli i vratili vozilo, i da li Vam odgovara naša poslovnica u centru ili aerodrom?
Mušterija: petak 10h aerodrom, vraćam u nedjelju u 18h
Ti: Za taj termin imamo slobodan VW Golf 8 automatik za ukupno 215 KM ili Toyotu Corollu Hybrid za 236 KM, s preuzimanjem na aerodromu. Koji Vam više odgovara?
Mušterija: golf
Ti: Odlično. Ovdje možete poslati zahtjev, samo upišite podatke i dodajte fotografiju vozačke dozvole: <link>. Zahtjev potvrđujemo u najkraćem roku, a plaćanje je na licu mjesta.`;
}

export function rcTools(ctx) {
  const locIds = (ctx.s.locations || []).map((l) => l.id);
  const dates = {
    od_datum: { type: "string", description: "datum preuzimanja YYYY-MM-DD" }, od_vrijeme: { type: "string", description: "vrijeme preuzimanja HH:MM (24h)" },
    do_datum: { type: "string", description: "datum vraćanja YYYY-MM-DD" }, do_vrijeme: { type: "string", description: "vrijeme vraćanja HH:MM (24h)" },
    preuzimanje: { type: "string", enum: locIds, description: "id lokacije preuzimanja" }, vracanje: { type: "string", enum: locIds, description: "id lokacije vraćanja (ako je ista, isto kao preuzimanje)" },
  };
  return [
    { name: "provjeri_dostupnost", description: "Koja vozila su slobodna za tačan termin i koliko košta ukupno (bez dodatne opreme).",
      input_schema: { type: "object", properties: dates, required: ["od_datum", "do_datum"] } },
    { name: "posalji_link", description: "Pravi link na stranicu agencije s već popunjenim vozilom, datumima i lokacijom, za slanje zahtjeva za rezervaciju.",
      input_schema: { type: "object", properties: { vozilo: { type: "string", enum: ctx.vehicles.map((v) => v.id), description: "id vozila" }, ...dates, jezik: { type: "string", enum: LANGS } }, required: ["vozilo", "od_datum", "do_datum"] } },
  ];
}

function readInput(ctx, input) {
  const locs = ctx.s.locations || [];
  const pu = locs.some((l) => l.id === input.preuzimanje) ? input.preuzimanje : locs[0]?.id;
  const dr = locs.some((l) => l.id === input.vracanje) ? input.vracanje : pu;
  const r = { pd: String(input.od_datum || ""), pt: validTime(input.od_vrijeme) ? input.od_vrijeme : "10:00", rd: String(input.do_datum || ""), rt: validTime(input.do_vrijeme) ? input.do_vrijeme : "10:00", pu, dr };
  if (!validDate(r.pd) || !validDate(r.rd)) throw new Error("Neispravan datum, koristi YYYY-MM-DD");
  if (r.pd < ctx.now.date) throw new Error("Datum preuzimanja je u prošlosti");
  if (r.pd > addDays(ctx.now.date, 365)) throw new Error("Rezervacije se primaju najviše godinu dana unaprijed");
  return r;
}
const q4 = (ctx, v, r) => quote({ vehicle: v, settings: ctx.s, tz: ctx.tz, pickupDate: r.pd, pickupTime: r.pt, returnDate: r.rd, returnTime: r.rt, pickup: r.pu, dropoff: r.dr, extras: [] });
const ERR = { redoslijed: "Vraćanje mora biti nakon preuzimanja", min_dana: "Prekratak najam", max_dana: "Najduži najam preko stranice je 90 dana", lokacija: "Nepoznata lokacija", datum: "Neispravan datum ili vrijeme" };
const free = (ctx, v, qt) => isFree(ctx.busy.filter((b) => b.vehicle_id === v.id), qt.start, qt.end, Number(ctx.s.buffer_hours) || 0);

export async function runRcTool(name, input, { biz, ctx }) {
  const r = readInput(ctx, input);
  if (name === "provjeri_dostupnost") {
    const out = { preuzimanje: `${r.pd} ${r.pt} (${r.pu})`, vracanje: `${r.rd} ${r.rt} (${r.dr})`, slobodna: [], zauzeta: [] };
    for (const v of ctx.vehicles) {
      const qt = q4(ctx, v, r);
      if (qt.greska) throw new Error(ERR[qt.greska] || qt.greska);
      if (new Date(qt.start) < new Date(Date.now() + 2 * 3600e3)) throw new Error("Preuzimanje mora biti barem 2 sata od sada");
      out.dana = qt.days;
      if (free(ctx, v, qt)) out.slobodna.push({ vozilo: v.id, naziv: vname(v), mjenjac: TRANS[v.transmission], sjedista: v.seats, kofera: v.bags, cijena_po_danu: qt.perDay, ukupno: qt.total, valuta: ctx.s.currency || "KM", depozit: v.deposit });
      else out.zauzeta.push(vname(v));
    }
    out.slobodna.sort((a, b) => a.ukupno - b.ukupno);
    return out;
  }
  if (name === "posalji_link") {
    const v = ctx.vehicles.find((x) => x.id === input.vozilo || vname(x).toLowerCase() === String(input.vozilo || "").toLowerCase());
    if (!v) throw new Error("Nepoznato vozilo");
    const qt = q4(ctx, v, r);
    if (qt.greska) throw new Error(ERR[qt.greska] || qt.greska);
    if (!free(ctx, v, qt)) throw new Error(`${vname(v)} je u tom terminu zauzet, ponudi drugo vozilo`);
    const lang = LANGS.includes(input.jezik) ? input.jezik : "bs";
    const p = new URLSearchParams({ vozilo: v.id, od: `${r.pd}T${r.pt}`, do: `${r.rd}T${r.rt}`, lok: r.pu, jezik: lang });
    if (r.dr !== r.pu) p.set("vrati", r.dr);
    return { link: `${SITE}/r/${biz.slug}?${p}`, vozilo: vname(v), dana: qt.days, ukupno_bez_dodataka: qt.total, valuta: ctx.s.currency || "KM" };
  }
  throw new Error("Nepoznat alat");
}
