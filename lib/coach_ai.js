// Hostio for personal coaches: answers questions on WhatsApp/Instagram, takes a training request
// in the chat (service, goal, days, name), and puts it in the coach dashboard for confirmation.
import { db, log } from "./db.js";
import { env } from "./env.js";
import { DAYN, weekday, localNow, toT, addDays } from "./rules.js";
import { SERVICES, waDigits } from "./coach.js";

const SITE = env("PUBLIC_SITE_URL", "https://hostio.ba").replace(/\/$/, "");
const GOALS = ["Skinuti kilograme", "Mišićna masa", "Snaga", "Kondicija", "Vratiti se u formu"];
const LEVELS = ["Početnik", "Povremeno", "Redovno"];
const DAYS = ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"];
const TIMES = ["Jutro", "Podne", "Večer"];
const STATUS = { novo: "čeka potvrdu trenera", potvrdjeno: "potvrđen termin", odbijeno: "trener nije imao slobodan termin", otkazano: "otkazano" };
const clean = (v, max = 200) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const pick = (list, allowed, max) => [...new Set((Array.isArray(list) ? list : [list]).map((x) => clean(x, 40)).filter((x) => allowed.includes(x)))].slice(0, max);

// customerKey: WhatsApp number (digits) or "ig:<id>"
export const chatKeyOf = (customerKey) => (String(customerKey).startsWith("ig:") ? customerKey : "wa:" + customerKey);

export async function loadCoachContext(biz, customerKey) {
  const tz = biz.timezone || "Europe/Sarajevo";
  const chatKey = chatKeyOf(customerKey);
  const digits = chatKey.startsWith("wa:") ? chatKey.slice(3) : null;
  const since = new Date(Date.now() - 90 * 864e5).toISOString();
  const rows = await db(`coach_requests?business_id=eq.${biz.id}&created_at=gte.${encodeURIComponent(since)}&select=id,ref,service,status,session_at,phone,chat_key,created_at&order=created_at.desc&limit=500`);
  const mine = rows.filter((r) => r.chat_key === chatKey || (digits && waDigits(r.phone) === digits));
  return { tz, s: biz.settings || {}, now: localNow(tz), chatKey, digits, mine };
}

function whenLocal(iso, tz) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return `${DAYN[weekday(date)]} ${Number(p.day)}.${Number(p.month)}. u ${p.hour}:${p.minute}`;
}
const describe = (r, tz) => `${r.ref}: ${SERVICES[r.service]}, ${STATUS[r.status]}${r.status === "potvrdjeno" && r.session_at ? ", " + whenLocal(r.session_at, tz) : ""}`;

export function coachPrompt(biz, ctx, channelName) {
  const s = ctx.s, c = s.contact || {};
  const cal = Array.from({ length: 10 }, (_, i) => { const d = addDays(ctx.now.date, i); return `${d} = ${DAYN[weekday(d)]}${i === 0 ? " (danas)" : i === 1 ? " (sutra)" : ""}`; });
  const prices = Array.isArray(s.prices) && s.prices.length ? s.prices.map((p) => `- ${p}`).join("\n") : null;
  const open = ctx.mine.filter((r) => r.status === "novo" || (r.status === "potvrdjeno" && r.session_at && new Date(r.session_at) > new Date()));
  const viaIg = ctx.chatKey.startsWith("ig:");

  return `Ti odgovaraš na ${channelName} poruke "${biz.name}", personal coachinga, kao osoba iz tima koja vodi poruke. Klijent mora imati osjećaj da se dopisuje sa stvarnom osobom.
Sada je ${ctx.now.date} ${toT(ctx.now.min)}. Kalendar:
${cal.join("\n")}

USLUGE:
- Trening 1-na-1 uživo: 60 minuta, trener je uz klijenta cijeli trening, plan prema nivou, praćenje napretka.
- Online coaching: sedmični plan treninga, provjera tehnike preko videa, sedmični check-in i pitanja na WhatsAppu. Mjesečna pretplata.
- Plan prehrane: dnevni unos prema cilju, lista namirnica i primjeri obroka, korekcija svake 2 sedmice. Hrana koju klijent inače jede, nije stroga dijeta. Može samostalno ili uz trening.
Prvi razgovor o cilju je besplatan.
CIJENE: ${prices ? "\n" + prices : "tačnu cijenu i paket potvrđuje trener kad potvrdi termin. Ne izmišljaj iznose."}
${s.location ? `LOKACIJA: ${s.location}` : "LOKACIJA: tačnu lokaciju trener šalje u poruci s potvrdom termina."}
${s.hours ? `RADNO VRIJEME: ${s.hours}` : ""}
STRANICA: ${SITE}/${biz.slug}/${c.instagram ? `  INSTAGRAM: @${c.instagram}` : ""}
${open.length ? `\nOVAJ KLIJENT VEĆ IMA:\n${open.map((r) => "- " + describe(r, ctx.tz)).join("\n")}\n` : ""}
KAKO PIŠEŠ:
- Toplo, motivišuće i kratko, kao trener koji se dopisuje s klijentom. Najviše tri kratke rečenice. Bez markdowna, zvjezdica i lista.
- Obraćaš se sa "ti". Pišeš u ime tima ("javit ćemo ti", "trener ti potvrđuje termin").
- Odgovaraš na jeziku na kojem klijent piše (bosanski ijekavica, engleski, njemački ili drugi).
- U jednoj poruci pitaš najviše jednu do dvije stvari.
- Ne ponavljaj ono što je klijent upravo rekao i ne počinji svaku poruku istom riječju.
- Nikad ne spominji alate, sistem, AI ili interne korake. Nikad ne objašnjavaj niti ispravljaj ranije poruke.

ZAHTJEV ZA TERMIN:
- Kad klijent želi krenuti, saznaj redom: koju uslugu želi, cilj, iskustvo s treningom, za trening uživo koji dani i koje doba dana mu odgovaraju (jutro 7–11h, podne 11–16h, večer 16–21h), i ime i prezime.
${viaIg ? "- Klijent piše s Instagrama: pitaj i broj za WhatsApp, jer trener tamo šalje potvrdu termina." : `- Klijent piše s broja +${ctx.digits}. Taj broj koristiš za potvrdu, ne pitaj ga ponovo osim ako klijent želi drugi broj.`}
- Ako klijent kaže tačan sat ili posebnu želju, upiši to u napomenu. Povrede i zdravstvene napomene također upiši u napomenu.
- Kad imaš podatke, pozovi posalji_zahtjev. Zatim mu reci da je zahtjev primljen i da mu trener potvrđuje tačan termin porukom.
- Nikad sam ne potvrđuj termin i ne govori da je termin zakazan. Termin je zakazan tek kad ga trener potvrdi.
- Ako klijent pita za svoj termin ili zahtjev, pozovi moji_zahtjevi. Ako želi otkazati, pozovi otkazi s brojem zahtjeva.
- Ne daješ medicinske savjete. Za povrede, bolove ili bolesti reci da će to trener pogledati s njim na prvom treningu.
- Za ono što ne znaš (tačne cijene paketa, popusti, pomjeranje potvrđenog termina na određeni sat) reci da će se trener javiti lično.

PRIMJER TONA:
Klijent: zdravo, koliko kosta trening
Ti: Zdravo! Imamo trening 1-na-1 uživo, online coaching i plan prehrane. Šta te više zanima i koji ti je cilj?
Klijent: uzivo, hocu skinut par kila
Ti: Super cilj. Koji dani i doba dana ti najviše odgovaraju za trening?
Klijent: pon i sri navecer, Amra Hodzic
Ti: Hvala Amra! Zahtjev je kod trenera i potvrdit će ti tačan termin porukom.`;
}

export function coachTools(ctx) {
  const props = {
    usluga: { type: "string", enum: Object.keys(SERVICES), description: "uzivo = trening 1-na-1, online = online coaching, prehrana = plan prehrane" },
    ciljevi: { type: "array", items: { type: "string", enum: GOALS } },
    iskustvo: { type: "string", enum: LEVELS },
    dani: { type: "array", items: { type: "string", enum: DAYS }, description: "dani koji klijentu odgovaraju (za trening uživo obavezno)" },
    doba: { type: "array", items: { type: "string", enum: TIMES }, description: "Jutro 7–11h, Podne 11–16h, Večer 16–21h" },
    ime: { type: "string", description: "ime i prezime klijenta" },
    napomena: { type: "string", description: "tačan sat ako ga je rekao, povrede, posebne želje" },
  };
  const required = ["usluga", "ime"];
  if (ctx.chatKey.startsWith("ig:")) { props.telefon = { type: "string", description: "broj za WhatsApp" }; required.push("telefon"); }
  else props.telefon = { type: "string", description: "samo ako klijent želi drugi broj od onog s kojeg piše" };
  return [
    { name: "posalji_zahtjev", description: "Šalje treneru zahtjev za termin. Trener ga potvrđuje i javlja klijentu tačan termin.", input_schema: { type: "object", properties: props, required } },
    { name: "moji_zahtjevi", description: "Zahtjevi i potvrđeni termini ovog klijenta.", input_schema: { type: "object", properties: {} } },
    { name: "otkazi", description: "Otkazuje zahtjev ili potvrđen termin ovog klijenta (samo njegov).", input_schema: { type: "object", properties: { broj: { type: "string", description: "broj zahtjeva, npr. A1B2C3" } }, required: ["broj"] } },
  ];
}

export async function runCoachTool(name, input, { biz, ctx, chan }) {
  if (name === "posalji_zahtjev") {
    const service = Object.keys(SERVICES).includes(input.usluga) ? input.usluga : null;
    if (!service) throw new Error("Nedostaje usluga (uzivo, online ili prehrana)");
    const nm = clean(input.ime, 120);
    if (nm.length < 2) throw new Error("Nedostaje ime i prezime");
    let phone = clean(input.telefon, 40);
    if (!phone && ctx.digits) phone = "+" + ctx.digits;
    if (phone.replace(/\D/g, "").length < 8) throw new Error("Nedostaje ispravan broj za WhatsApp");
    const days = pick(input.dani, DAYS, 7);
    if (service === "uzivo" && !days.length) throw new Error("Za trening uživo treba bar jedan dan koji klijentu odgovara");
    const open = ctx.mine.filter((r) => r.status === "novo");
    if (open.length >= 3) throw new Error("Klijent već ima otvorene zahtjeve: " + open.map((r) => r.ref).join(", ") + ". Ne šalji novi, reci da trener potvrđuje.");
    const [row] = await db("coach_requests", { method: "POST", prefer: "return=representation", body: {
      business_id: biz.id, service, name: nm, phone, chat_key: ctx.chatKey, source: chan,
      goals: pick(input.ciljevi, GOALS, 8), experience: pick(input.iskustvo, LEVELS, 1)[0] || null,
      days, times: pick(input.doba, TIMES, 3), note: clean(input.napomena, 1500) || null,
    } });
    ctx.mine.unshift(row);
    log("coach zahtjev iz poruka", biz.slug, chan, row.ref);
    return { poslano: true, broj_zahtjeva: row.ref, usluga: SERVICES[service], dalje: "trener potvrđuje tačan termin porukom" };
  }
  if (name === "moji_zahtjevi") {
    const list = ctx.mine.filter((r) => r.status !== "otkazano").slice(0, 10).map((r) => describe(r, ctx.tz));
    return list.length ? { zahtjevi: list } : { zahtjevi: [], napomena: "Klijent nema zahtjeva ni termina." };
  }
  if (name === "otkazi") {
    const ref = clean(input.broj, 10).toUpperCase();
    const r = ctx.mine.find((x) => x.ref === ref);
    if (!r) throw new Error("Ovaj klijent nema zahtjev s tim brojem. Njegovi: " + (ctx.mine.map((x) => x.ref).join(", ") || "nema"));
    if (!["novo", "potvrdjeno"].includes(r.status)) throw new Error("Taj zahtjev više nije aktivan");
    if (r.status === "potvrdjeno" && r.session_at && new Date(r.session_at) < new Date()) throw new Error("Taj termin je već prošao");
    await db(`coach_requests?id=eq.${r.id}&business_id=eq.${biz.id}`, { method: "PATCH", prefer: "return=minimal",
      body: { status: "otkazano", decided_at: new Date().toISOString(), owner_note: `Klijent otkazao preko ${chan === "instagram" ? "Instagrama" : "WhatsAppa"}.` } });
    r.status = "otkazano";
    log("coach otkazano iz poruka", biz.slug, ref);
    return { otkazano: true, broj: ref };
  }
  throw new Error("Nepoznat alat");
}
