// Customer emails for rent-a-car bookings (request received, confirmed, not confirmed, cancelled),
// in the customer's language. Sent with Resend (RESEND_API_KEY); every attempt is written to rc_bookings.email_log.
import { env } from "./env.js";
import { db, log } from "./db.js";
import { daysLabel } from "../public/rent/i18n.js";

const KEY = env("RESEND_API_KEY");
const FROM = env("EMAIL_FROM", "onboarding@resend.dev");      // address only; the agency name is put in front
const SITE = env("PUBLIC_SITE_URL", "https://hostio-server.emir-atic2007.workers.dev").replace(/\/$/, "");

const E = {
  bs: {
    subj: { primljen: "Zahtjev {ref} je primljen – {ag}", potvrdjen: "Rezervacija {ref} je potvrđena – {ag}", odbijen: "Zahtjev {ref} nažalost ne možemo potvrditi – {ag}", otkazan: "Rezervacija {ref} je otkazana – {ag}" },
    pill: { primljen: "Čeka potvrdu", potvrdjen: "Potvrđeno", odbijen: "Nije potvrđeno", otkazan: "Otkazano" },
    head: { primljen: "Zahtjev je primljen", potvrdjen: "Rezervacija je potvrđena", odbijen: "Zahtjev nije potvrđen", otkazan: "Rezervacija je otkazana" },
    hi: "Poštovani/a {name},",
    intro: {
      primljen: "hvala Vam na zahtjevu. Vozilo je rezervisano za Vas dok agencija ne pregleda zahtjev, a potvrdu ćete dobiti na ovaj email u najkraćem roku.",
      potvrdjen: "Vaša rezervacija je potvrđena. Sve detalje imate ispod, a mi se radujemo Vašem dolasku!",
      odbijen: "nažalost ne možemo potvrditi Vaš zahtjev za ovaj termin. Rado ćemo Vam ponuditi drugo vozilo ili termin, samo nam se javite.",
      otkazan: "Vaša rezervacija je otkazana. Ako je u pitanju greška ili želite novi termin, slobodno nam se javite.",
    },
    ref: "Broj rezervacije", car: "Vozilo", pickup: "Preuzimanje", ret: "Vraćanje", dur: "Trajanje", price: "Obračun", total: "Ukupno",
    rental: "Najam: {d} × {p}", ah_out: "Preuzimanje van radnog vremena", ah_in: "Vraćanje van radnog vremena", fee_out: "Preuzimanje: {loc}", fee_in: "Vraćanje: {loc}",
    pay: "Plaćanje je na licu mjesta pri preuzimanju vozila. Ništa ne plaćate unaprijed.", deposit: "Depozit od {p} uzima se pri preuzimanju i vraća po povratku vozila.",
    bring: "Ponesite sa sobom", b1: "Važeću vozačku dozvolu (najmanje {n} godine)", b2: "Ličnu kartu ili pasoš", b3: "Depozit od {p}",
    cancel: "Besplatno otkazivanje do {n} sati prije preuzimanja.", q: "Imate pitanje?", wa: "Pišite nam na WhatsApp", call: "Pozovite nas", map: "Lokacija na mapi",
    why: "Ovaj email ste dobili jer ste poslali zahtjev za rezervaciju kod agencije {ag}.", powered: "Rezervacije pokreće",
    man: { manual: "manuelni mjenjač", automatic: "automatik" }, seats: "{n} sjedišta",
  },
  en: {
    subj: { primljen: "We received your request {ref} – {ag}", potvrdjen: "Your booking {ref} is confirmed – {ag}", odbijen: "We can't confirm your request {ref} – {ag}", otkazan: "Your booking {ref} has been cancelled – {ag}" },
    pill: { primljen: "Awaiting confirmation", potvrdjen: "Confirmed", odbijen: "Not confirmed", otkazan: "Cancelled" },
    head: { primljen: "Request received", potvrdjen: "Booking confirmed", odbijen: "Request not confirmed", otkazan: "Booking cancelled" },
    hi: "Dear {name},",
    intro: {
      primljen: "thank you for your request. The car is held for you while the agency reviews it, and you will receive the confirmation at this email address shortly.",
      potvrdjen: "your booking is confirmed. You will find all the details below. We look forward to seeing you!",
      odbijen: "unfortunately we can't confirm your request for these dates. We would be happy to offer you another car or other dates, just get in touch.",
      otkazan: "your booking has been cancelled. If this is a mistake or you would like new dates, please get in touch.",
    },
    ref: "Booking number", car: "Car", pickup: "Pick-up", ret: "Return", dur: "Duration", price: "Price", total: "Total",
    rental: "Rental: {d} × {p}", ah_out: "Pick-up outside office hours", ah_in: "Return outside office hours", fee_out: "Pick-up: {loc}", fee_in: "Return: {loc}",
    pay: "Payment is made on the spot when you collect the car. Nothing is paid in advance.", deposit: "A deposit of {p} is taken at pick-up and returned when you bring the car back.",
    bring: "Please bring", b1: "A valid driving licence (held for at least {n} years)", b2: "ID card or passport", b3: "A deposit of {p}",
    cancel: "Free cancellation up to {n} hours before pick-up.", q: "Any questions?", wa: "Message us on WhatsApp", call: "Call us", map: "Location on map",
    why: "You received this email because you sent a booking request to {ag}.", powered: "Bookings powered by",
    man: { manual: "manual", automatic: "automatic" }, seats: "{n} seats",
  },
  de: {
    subj: { primljen: "Ihre Anfrage {ref} ist eingegangen – {ag}", potvrdjen: "Ihre Buchung {ref} ist bestätigt – {ag}", odbijen: "Wir können Ihre Anfrage {ref} leider nicht bestätigen – {ag}", otkazan: "Ihre Buchung {ref} wurde storniert – {ag}" },
    pill: { primljen: "Wartet auf Bestätigung", potvrdjen: "Bestätigt", odbijen: "Nicht bestätigt", otkazan: "Storniert" },
    head: { primljen: "Anfrage erhalten", potvrdjen: "Buchung bestätigt", odbijen: "Anfrage nicht bestätigt", otkazan: "Buchung storniert" },
    hi: "Guten Tag {name},",
    intro: {
      primljen: "vielen Dank für Ihre Anfrage. Das Auto ist für Sie reserviert, während die Agentur Ihre Anfrage prüft. Die Bestätigung erhalten Sie in Kürze an diese E-Mail-Adresse.",
      potvrdjen: "Ihre Buchung ist bestätigt. Alle Details finden Sie unten. Wir freuen uns auf Sie!",
      odbijen: "leider können wir Ihre Anfrage für diesen Zeitraum nicht bestätigen. Gerne bieten wir Ihnen ein anderes Auto oder einen anderen Zeitraum an, melden Sie sich einfach.",
      otkazan: "Ihre Buchung wurde storniert. Falls das ein Irrtum ist oder Sie einen neuen Termin möchten, melden Sie sich gerne.",
    },
    ref: "Buchungsnummer", car: "Fahrzeug", pickup: "Abholung", ret: "Rückgabe", dur: "Dauer", price: "Preis", total: "Gesamt",
    rental: "Miete: {d} × {p}", ah_out: "Abholung außerhalb der Öffnungszeiten", ah_in: "Rückgabe außerhalb der Öffnungszeiten", fee_out: "Abholung: {loc}", fee_in: "Rückgabe: {loc}",
    pay: "Bezahlt wird vor Ort bei der Abholung. Sie zahlen nichts im Voraus.", deposit: "Eine Kaution von {p} wird bei Abholung hinterlegt und bei Rückgabe erstattet.",
    bring: "Bitte mitbringen", b1: "Gültigen Führerschein (seit mindestens {n} Jahren)", b2: "Personalausweis oder Reisepass", b3: "Kaution von {p}",
    cancel: "Kostenlose Stornierung bis {n} Stunden vor der Abholung.", q: "Fragen?", wa: "Schreiben Sie uns auf WhatsApp", call: "Rufen Sie uns an", map: "Standort auf der Karte",
    why: "Sie erhalten diese E-Mail, weil Sie eine Buchungsanfrage bei {ag} gesendet haben.", powered: "Buchungen betrieben von",
    man: { manual: "Schaltgetriebe", automatic: "Automatik" }, seats: "{n} Sitze",
  },
  ar: {
    subj: { primljen: "تم استلام طلبك {ref} – {ag}", potvrdjen: "تم تأكيد حجزك {ref} – {ag}", odbijen: "نعتذر، لا يمكننا تأكيد طلبك {ref} – {ag}", otkazan: "تم إلغاء حجزك {ref} – {ag}" },
    pill: { primljen: "بانتظار التأكيد", potvrdjen: "مؤكد", odbijen: "غير مؤكد", otkazan: "ملغى" },
    head: { primljen: "تم استلام الطلب", potvrdjen: "تم تأكيد الحجز", odbijen: "لم يتم تأكيد الطلب", otkazan: "تم إلغاء الحجز" },
    hi: "مرحبًا {name}،",
    intro: {
      primljen: "شكرًا لطلبك. السيارة محجوزة لك أثناء مراجعة الوكالة للطلب، وستصلك رسالة التأكيد على هذا البريد قريبًا.",
      potvrdjen: "تم تأكيد حجزك. تجد كل التفاصيل أدناه، ونتطلع لاستقبالك!",
      odbijen: "للأسف لا يمكننا تأكيد طلبك في هذه الفترة. يسعدنا أن نقترح عليك سيارة أو موعدًا آخر، فقط تواصل معنا.",
      otkazan: "تم إلغاء حجزك. إذا كان ذلك خطأ أو كنت ترغب في موعد جديد، تواصل معنا.",
    },
    ref: "رقم الحجز", car: "السيارة", pickup: "الاستلام", ret: "التسليم", dur: "المدة", price: "السعر", total: "المجموع",
    rental: "الإيجار: {d} × {p}", ah_out: "استلام خارج أوقات العمل", ah_in: "تسليم خارج أوقات العمل", fee_out: "الاستلام: {loc}", fee_in: "التسليم: {loc}",
    pay: "الدفع في المكان عند استلام السيارة. لا تدفع شيئًا مقدمًا.", deposit: "يُدفع تأمين بقيمة {p} عند الاستلام ويُعاد عند إرجاع السيارة.",
    bring: "يرجى إحضار", b1: "رخصة قيادة سارية (لا تقل مدتها عن {n} سنوات)", b2: "بطاقة هوية أو جواز سفر", b3: "تأمين بقيمة {p}",
    cancel: "إلغاء مجاني حتى {n} ساعة قبل الاستلام.", q: "هل لديك سؤال؟", wa: "راسلنا عبر واتساب", call: "اتصل بنا", map: "الموقع على الخريطة",
    why: "وصلك هذا البريد لأنك أرسلت طلب حجز إلى {ag}.", powered: "الحجوزات بواسطة",
    man: { manual: "يدوي", automatic: "أوتوماتيك" }, seats: "{n} مقاعد",
  },
};
const BS_WD = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"];
const BS_M = ["januara", "februara", "marta", "aprila", "maja", "juna", "jula", "augusta", "septembra", "oktobra", "novembra", "decembra"];
const LOCALE = { en: "en-GB", de: "de-DE", ar: "ar-u-nu-latn" };
const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => v[k] ?? "");
const h = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const nm = (o, lang) => (o && typeof o === "object" ? o[lang] || o.bs || o.en || "" : o || "");

function when(iso, tz, lang) {
  const d = new Date(iso);
  if (lang === "bs" || !LOCALE[lang]) {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
    const wd = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay();
    return { day: `${BS_WD[wd]}, ${+p.day}. ${BS_M[+p.month - 1]} ${p.year}.`, time: `${p.hour}:${p.minute}` };
  }
  return {
    day: new Intl.DateTimeFormat(LOCALE[lang], { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d),
    time: new Intl.DateTimeFormat(LOCALE[lang], { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d),
  };
}

/** Builds { subject, html, text } for one booking. kind: primljen | potvrdjen | odbijen | otkazan */
export function bookingEmail(kind, { booking: b, vehicle: v, biz }) {
  const lang = E[b.lang] ? b.lang : "bs", L = E[lang], s = biz.settings || {}, tz = biz.timezone || "Europe/Sarajevo";
  const rtl = lang === "ar", al = rtl ? "right" : "left", ar = rtl ? "left" : "right";
  const cur = s.currency || "KM";
  const money = (n) => `${rtl ? "\u200E" : ""}${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n || 0))} ${cur}${rtl ? "\u200E" : ""}`;
  const accent = /^#[0-9a-f]{6}$/i.test(s.brand?.color || "") ? s.brand.color : "#2ee6a6";
  const ag = biz.name, c = s.contact || {};
  const loc = (id) => (s.locations || []).find((l) => l.id === id);
  const pu = loc(b.pickup_location), dr = loc(b.dropoff_location);
  const a = when(b.start_at, tz, lang), z = when(b.end_at, tz, lang);
  const carName = `${v.make} ${v.model}`;
  const carMeta = [v.year, L.man[v.transmission], v.seats ? fill(L.seats, { n: v.seats }) : ""].filter(Boolean).join(" · ");
  const lines = (Array.isArray(b.price_breakdown) ? b.price_breakdown : []).map((l) => {
    let label = l.key;
    if (l.key === "najam") label = fill(L.rental, { d: daysLabel(lang, l.days), p: money(l.perDay) });
    else if (l.key === "dodatak") label = nm((s.extras || []).find((x) => x.id === l.id)?.name, lang) || l.id;
    else if (l.key === "preuzimanje") label = fill(L.fee_out, { loc: nm(loc(l.id)?.name, lang) });
    else if (l.key === "vracanje") label = fill(L.fee_in, { loc: nm(loc(l.id)?.name, lang) });
    else if (l.key === "van_radnog_preuzimanje") label = L.ah_out;
    else if (l.key === "van_radnog_vracanje") label = L.ah_in;
    return [label, money(l.total)];
  });
  if (!lines.length && b.price_total) lines.push([fill(L.rental, { d: daysLabel(lang, b.days || 1), p: "" }).replace(/ × $/, ""), money(b.price_total)]);
  const pillColor = { primljen: ["#fff3d6", "#8a5300"], potvrdjen: ["#e3f9ee", "#0d7a4f"], odbijen: ["#fde8e6", "#b42318"], otkazan: ["#eef0f3", "#4b5563"] }[kind];
  const showDetails = kind === "primljen" || kind === "potvrdjen";
  const wa = String(c.whatsapp || "").replace(/\D/g, "");
  const mapQ = pu?.address || c.address;
  const vars = { ref: b.ref, ag, name: b.first_name || "" };
  const subject = fill(L.subj[kind], vars);

  const btn = (href, label, primary) => `<a href="${h(href)}" style="display:inline-block;margin:4px;padding:12px 20px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;${primary ? `background:${accent};color:#06261b` : "background:#f1f3f6;color:#151a21"}">${h(label)}</a>`;
  const placeCell = (title, w, l) => `<td class="stack" valign="top" width="50%" style="padding:16px;background:#f7f8fa;border-radius:14px;text-align:${al}">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3">${h(title)}</div>
      <div style="font-size:16px;font-weight:700;color:#151a21;margin-top:6px">${h(w.time)}</div>
      <div style="font-size:14px;color:#151a21">${h(w.day)}</div>
      ${l ? `<div style="font-size:13px;color:#556070;margin-top:6px">${h(nm(l.name, lang))}${l.address ? `<br>${h(l.address)}` : ""}</div>` : ""}</td>`;

  const html = `<!doctype html><html lang="${lang}" dir="${rtl ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${h(subject)}</title>
<style>@media (max-width:520px){.stack{display:block!important;width:100%!important;box-sizing:border-box;text-align:${al}!important}.gap{display:block!important;height:10px!important;width:auto!important}.px{padding-left:18px!important;padding-right:18px!important}}</style></head>
<body style="margin:0;padding:0;background:#eef1f4;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#151a21">
<div style="display:none;max-height:0;overflow:hidden">${h(fill(L.head[kind], vars))} · ${h(carName)} · ${h(a.day)} ${h(a.time)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden" dir="${rtl ? "rtl" : "ltr"}">
  <tr><td style="background:#111316;padding:24px 28px;text-align:${al}">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="text-align:${al}"><span style="display:inline-block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:10px;background:${accent};color:#06261b;font-weight:800;font-size:17px">${h(ag[0] || "R")}</span>
        <span style="color:#ffffff;font-weight:700;font-size:17px;vertical-align:middle;padding:0 10px">${h(ag)}</span></td>
      <td style="text-align:${ar}"><span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${pillColor[0]};color:${pillColor[1]};font-size:12px;font-weight:700">${h(L.pill[kind])}</span></td>
    </tr></table></td></tr>
  <tr><td style="height:4px;background:${accent};line-height:4px;font-size:0">&nbsp;</td></tr>
  <tr><td style="padding:30px 28px 8px;text-align:${al}">
    <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#151a21">${h(L.head[kind])}</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;color:#3d4653">${h(fill(L.hi, vars))} ${h(L.intro[kind])}</p>
  </td></tr>
  <tr><td style="padding:18px 28px 6px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e8ed;border-radius:16px"><tr>
      <td class="stack" style="padding:16px 18px 6px;text-align:${al}"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3">${h(L.ref)}</div>
        <div style="font-size:26px;font-weight:800;letter-spacing:.12em;color:#151a21;margin-top:4px">${h(b.ref)}</div></td>
      <td class="stack" style="padding:16px 18px;text-align:${ar}"><div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3">${h(L.car)}</div>
        <div style="font-size:16px;font-weight:700;color:#151a21;margin-top:4px">${h(carName)}</div><div style="font-size:13px;color:#556070">${h(carMeta)}</div></td>
    </tr></table></td></tr>
  <tr><td style="padding:12px 28px 4px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${placeCell(L.pickup, a, pu)}<td class="gap" width="10" style="width:10px">&nbsp;</td>${placeCell(L.ret, z, dr)}</tr></table>
    <div style="font-size:13px;color:#556070;margin-top:10px;text-align:${al}">${h(L.dur)}: <b style="color:#151a21">${h(daysLabel(lang, b.days || 1))}</b></div>
  </td></tr>
  ${showDetails && (lines.length || b.price_total) ? `<tr><td style="padding:18px 28px 4px">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3;margin-bottom:8px;text-align:${al}">${h(L.price)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">
      ${lines.map(([l, m]) => `<tr><td style="padding:7px 0;color:#3d4653;text-align:${al};border-bottom:1px solid #eef0f3">${h(l)}</td><td style="padding:7px 0;text-align:${ar};font-weight:600;white-space:nowrap;border-bottom:1px solid #eef0f3">${h(m)}</td></tr>`).join("")}
      <tr><td style="padding:12px 0 4px;font-size:16px;font-weight:800;text-align:${al}">${h(L.total)}</td><td style="padding:12px 0 4px;font-size:20px;font-weight:800;text-align:${ar};white-space:nowrap">${h(money(b.price_total))}</td></tr>
    </table>
    <div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#eaf8f1;color:#0d5c3c;font-size:13px;line-height:1.5;text-align:${al}">${h(L.pay)}${b.deposit ? `<br>${h(fill(L.deposit, { p: money(b.deposit) }))}` : ""}</div>
  </td></tr>
  <tr><td style="padding:18px 28px 4px;text-align:${al}">
    <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#8b95a3;margin-bottom:8px">${h(L.bring)}</div>
    <div style="font-size:14px;line-height:1.9;color:#151a21">✓ ${h(fill(L.b1, { n: s.license_years || 2 }))}<br>✓ ${h(L.b2)}${b.deposit ? `<br>✓ ${h(fill(L.b3, { p: money(b.deposit) }))}` : ""}</div>
    ${s.cancellation_hours ? `<div style="font-size:13px;color:#556070;margin-top:10px">${h(fill(L.cancel, { n: s.cancellation_hours }))}</div>` : ""}
  </td></tr>` : ""}
  <tr><td style="padding:22px 28px 26px;text-align:center">
    <div style="font-size:15px;font-weight:700;margin-bottom:8px">${h(L.q)}</div>
    ${wa ? btn(`https://wa.me/${wa}?text=${encodeURIComponent(b.ref)}`, L.wa, true) : ""}${c.phone ? btn(`tel:${String(c.phone).replace(/\s/g, "")}`, L.call, !wa) : ""}${mapQ ? btn(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQ)}`, L.map, false) : ""}
  </td></tr>
  <tr><td style="padding:18px 28px;background:#f7f8fa;font-size:12px;line-height:1.6;color:#8b95a3;text-align:center">
    <b style="color:#3d4653">${h(ag)}</b>${c.address ? ` · ${h(c.address)}` : ""}${c.phone ? ` · ${h(c.phone)}` : ""}${c.email ? ` · ${h(c.email)}` : ""}<br>
    ${h(fill(L.why, vars))}<br>${h(L.powered)} <a href="${h(SITE)}" style="color:#151a21;font-weight:700;text-decoration:none">hostio<span style="color:${accent}">.</span></a>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    fill(L.head[kind], vars), "", `${fill(L.hi, vars)} ${L.intro[kind]}`, "",
    `${L.ref}: ${b.ref}`, `${L.car}: ${carName} (${carMeta})`,
    `${L.pickup}: ${a.day} ${a.time}${pu ? ", " + nm(pu.name, lang) : ""}`, `${L.ret}: ${z.day} ${z.time}${dr ? ", " + nm(dr.name, lang) : ""}`,
    ...(showDetails ? ["", ...lines.map(([l, m]) => `${l}: ${m}`), `${L.total}: ${money(b.price_total)}`, L.pay, b.deposit ? fill(L.deposit, { p: money(b.deposit) }) : ""] : []),
    "", [ag, c.phone, c.email].filter(Boolean).join(" · "),
  ].filter((x) => x !== null).join("\n");
  return { subject, html, text };
}

export const emailReady = () => !!KEY;

/** Sends one email kind for a booking and records the result. Never throws. */
export async function sendBookingEmail(kind, { booking, vehicle, biz }) {
  const entry = { vrsta: kind, at: new Date().toISOString() };
  try {
    if (!booking.email) return { ok: false, skipped: true };
    if (!KEY) throw new Error("email nije podešen (RESEND_API_KEY)");
    const { subject, html, text } = bookingEmail(kind, { booking, vehicle, biz });
    const replyTo = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(biz.settings?.contact?.email || "") ? biz.settings.contact.email : undefined;
    const fromName = String(biz.name || "Rezervacije").replace(/[<>"]/g, "");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json", "Idempotency-Key": `${booking.id}-${kind}-${Math.floor(Date.now() / 60000)}` },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ from: `${fromName} <${FROM}>`, to: [booking.email], subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}), tags: [{ name: "vrsta", value: kind }] }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.message || d.error?.message || "status " + res.status);
    Object.assign(entry, { ok: true, id: d.id });
  } catch (e) {
    Object.assign(entry, { ok: false, greska: String(e.message || e).slice(0, 200) });
    log("GREŠKA email", kind, booking.ref, entry.greska);
  }
  try {
    const [row] = await db(`rc_bookings?id=eq.${booking.id}&select=email_log`);
    await db(`rc_bookings?id=eq.${booking.id}`, { method: "PATCH", prefer: "return=minimal", body: { email_log: [...(row?.email_log || []), entry].slice(-20) } });
  } catch (e) { log("GREŠKA email log", e.message); }
  return entry;
}
