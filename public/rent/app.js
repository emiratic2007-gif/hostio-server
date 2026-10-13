// Hostio rent-a-car website: one page per agency at /r/{slug}.
import { LANGS, T, daysLabel } from "/rent/i18n.js";
import { carSvg, esc } from "/rent/car.js";
import { quote, isFree, todayLocal, addDays, localToUtc, validDate, validTime, fromPrice, dayPrice } from "/rent/core.js";

const params = new URLSearchParams(location.search);
const slug = (location.pathname.match(/^\/r\/([a-z0-9-]+)/) || [])[1] || params.get("slug") || "vrelo";
const API = "/api/rc/";
const app = document.getElementById("app");
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const WA_TEXT = { bs: "Pozdrav! Zanima me najam vozila.", en: "Hello! I'm interested in renting a car.", de: "Hallo! Ich interessiere mich für eine Automiete.", ar: "مرحبًا! أرغب في استئجار سيارة." };
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(i >> 1).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const S = { lang: null, ag: null, cars: [], cat: "all", auto: false, avail: null, searched: false, search: null, panel: null, menu: false, err: "" };

// ---------- helpers ----------
const t = (k, vars = {}) => String(T[S.lang]?.[k] ?? T.bs[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => vars[x] ?? "");
const locale = () => ({ bs: "bs-BA", en: "en-GB", de: "de-DE", ar: "ar-u-nu-latn" })[S.lang] || "bs-BA";
const set = () => S.ag.postavke;
const tz = () => S.ag.tz || "Europe/Sarajevo";
// Isolated left-to-right so "45 KM" never flips inside Arabic text.
const money = (n) => `\u2066${new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n)} ${set().currency || "KM"}\u2069`;
// Bosnian names written out: not every browser ships Bosnian date names.
const BS = {
  wd: ["ned", "pon", "uto", "sri", "čet", "pet", "sub"], wn: ["N", "P", "U", "S", "Č", "P", "S"],
  m: ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"],
};
const fmtDay = (d, o = { weekday: "short", day: "numeric", month: "short" }) => {
  const x = new Date(d + "T12:00:00Z");
  if (S.lang === "bs") {
    const m = BS.m[x.getUTCMonth()];
    return `${o.weekday ? BS.wd[x.getUTCDay()] + ", " : ""}${x.getUTCDate()}. ${o.month === "long" ? m : m.slice(0, 3)}`;
  }
  return new Intl.DateTimeFormat(locale(), { ...o, timeZone: "UTC" }).format(x);
};
const monthTitle = (y, m) => S.lang === "bs" ? `${BS.m[m - 1]} ${y}` : new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
const weekdayNarrow = (i) => S.lang === "bs" ? BS.wn[(i + 1) % 7] : new Intl.DateTimeFormat(locale(), { weekday: "narrow", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + i)));
const nm = (o) => (o && typeof o === "object" ? o[S.lang] || o.bs || o.en || "" : o || "");
const photo = (v) => { const p = (v.photos || [])[0]; return typeof p === "string" ? p : p?.url; };
const carPic = (v, cls = "") => photo(v) ? `<img class="${cls}" src="${esc(photo(v))}" alt="${esc(v.make + " " + v.model)}" loading="lazy">` : carSvg(v, { className: cls });
const waLink = (extra = "") => { const n = set().contact?.whatsapp; return n ? `https://wa.me/${encodeURIComponent(n)}?text=${encodeURIComponent(WA_TEXT[S.lang] + extra)}` : ""; };
const now2h = () => Date.now() + 2 * 3600e3;

const I = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  gear: '<path d="M6 4v16M12 4v16M18 4v8M6 12h12"/>',
  fuel: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>',
  bag: '<rect x="5" y="7" width="14" height="13" rx="2.5"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M9 11v5M15 11v5"/>',
  door: '<path d="M6 21V5l9-2 3 4v14zM13 13h1.5"/>',
  snow: '<path d="M12 2v20M4.9 7l14.2 10M4.9 17l14.2-10"/>',
  gauge: '<path d="M4 18a8 8 0 1 1 16 0M12 18l4-6"/>',
  engine: '<path d="M4 10h3l2-3h6v3h3v6h-3v3H8l-2-3H4z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-4.5"/>',
  road: '<path d="M4 20L9 4M20 20L15 4M12 6v2M12 11v2M12 16v2"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
  plane: '<path d="M10.5 13.5L4 16v-2l6.5-4.5V5a1.5 1.5 0 0 1 3 0v4.5L20 14v2l-6.5-2.5v4l2 1.5v1.5l-3.5-1-3.5 1V19l2-1.5z"/>',
  undo: '<path d="M4 9h11a5 5 0 0 1 0 10H8M4 9l4-4M4 9l4 4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
  cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c1-2 5-2 6 0M14 10h4M14 14h4"/>',
  pump: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M14 9h2a2 2 0 0 1 2 2v5a1 1 0 0 0 2 0V8l-3-3M7 8h4"/>',
  left: '<path d="M15 6l-6 6 6 6"/>', right: '<path d="M9 6l6 6-6 6"/>',
  chat: '<path d="M4 20l1.3-3.9A8.5 8.5 0 1 1 8 19z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-1.8-1.8l.8-1-1-2z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
};
const ic = (n, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

// ---------- start ----------
async function start() {
  const pl = params.get("jezik");
  S.lang = LANGS.some((l) => l.code === pl) ? pl : LANGS.some((l) => l.code === store.get("hostio_rc_lang")) ? store.get("hostio_rc_lang") : null;
  if (pl && S.lang) store.set("hostio_rc_lang", S.lang);
  applyLang();
  try {
    const res = await fetch(API + "agencija?slug=" + encodeURIComponent(slug));
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    S.ag = data.agencija; S.cars = data.vozila || [];
  } catch (e) {
    app.innerHTML = `<div class="wrap" style="padding:120px 16px;text-align:center"><h2>${esc(t("not_found"))}</h2></div>`;
    return;
  }
  const brand = set().brand?.color;
  if (/^#[0-9a-f]{6}$/i.test(brand || "")) document.documentElement.style.setProperty("--accent", brand);
  document.title = `${S.ag.naziv} · Rent a Car ${S.ag.grad || ""}`.trim();
  initSearch();
  render();
  const vid = params.get("vozilo");
  if (S.lang && vid && S.cars.some((c) => c.id === vid)) openPanel(vid);
}

function initSearch() {
  const today = todayLocal(tz()), locs = set().locations || [];
  const s = { pd: addDays(today, 1), pt: "10:00", rd: addDays(today, 4), rt: "10:00", pu: locs[0]?.id || "", dr: locs[0]?.id || "", diff: false };
  const [od, ot] = (params.get("od") || "").split("T"), [dd, dt] = (params.get("do") || "").split("T");
  if (validDate(od) && od >= today) { s.pd = od; S.searched = true; }
  if (validTime(ot)) s.pt = ot;
  if (validDate(dd) && dd >= s.pd) s.rd = dd; else if (s.rd <= s.pd) s.rd = addDays(s.pd, 3);
  if (validTime(dt)) s.rt = dt;
  if (locs.some((l) => l.id === params.get("lok"))) s.pu = s.dr = params.get("lok");
  if (locs.some((l) => l.id === params.get("vrati")) && params.get("vrati") !== s.pu) { s.dr = params.get("vrati"); s.diff = true; }
  S.search = s;
  if (S.searched) fetchAvail();
}

function applyLang() {
  const L = LANGS.find((l) => l.code === S.lang);
  document.documentElement.lang = S.lang || "bs";
  document.documentElement.dir = L?.rtl ? "rtl" : "ltr";
}
function setLang(code) {
  S.lang = code; S.menu = false; store.set("hostio_rc_lang", code); applyLang(); render();
  if (S.panel) renderPanel();
}

// ---------- page ----------
function render() {
  if (!S.lang) return renderGate();
  const s = set();
  const feat = S.cars.find((c) => c.featured) || S.cars[0];
  app.innerHTML = `
  ${s.demo ? `<div class="demo">${esc(t("demo"))}</div>` : ""}
  <header class="top"><div class="wrap">
    <a class="logo" href="#"><b>${esc(S.ag.naziv[0] || "R")}</b><span>${esc(S.ag.naziv)}</span></a>
    <nav class="links"><a href="#vozila">${t("nav_fleet")}</a><a href="#kako">${t("nav_how")}</a><a href="#uslovi">${t("nav_terms")}</a><a href="#kontakt">${t("nav_contact")}</a></nav>
    <div class="tools">
      <button class="pill-btn" data-act="menu" aria-haspopup="true" aria-label="Language">${ic("globe")}${S.lang.toUpperCase()}</button>
      ${waLink() ? `<a class="round mint" href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("chat")}</a>` : ""}
    </div>
    ${S.menu ? `<div class="menu" role="menu">${LANGS.map((l) => `<button role="menuitem" data-act="lang" data-v="${l.code}" class="${l.code === S.lang ? "on" : ""}" lang="${l.code}">${l.name}</button>`).join("")}</div>` : ""}
  </div></header>

  <section class="hero"><div class="wrap">
    <div class="hero-grid">
      <div>
        <span class="kicker"><i></i>${esc(t("hero_kicker", { city: S.ag.grad || "" }))}</span>
        <h1>${heroTitle()}</h1>
        <p class="sub">${esc(t("hero_sub"))}</p>
      </div>
      <div class="stage">
        <div class="disc"></div><div class="ring"></div>
        ${feat ? carPic(feat, "car") : ""}
        ${feat ? `<div class="float f1"><b>${esc(feat.make + " " + feat.model)}</b>${t(feat.transmission)} · ${t(feat.fuel)}</div>
        <div class="float f2">${t("from_price")} <b>${money(fromPrice(feat.price_tiers))} ${t("per_day")}</b></div>` : ""}
      </div>
    </div>
    ${searchHtml()}
    <div class="usp">
      ${s.mileage === "unlimited" ? `<div><i>${ic("road")}</i>${t("usp_km")}</div>` : ""}
      <div><i>${ic("cash")}</i>${t("usp_pay")}</div>
      ${s.cancellation_hours ? `<div><i>${ic("undo")}</i>${t("usp_cancel", { n: s.cancellation_hours })}</div>` : ""}
      ${(s.locations || []).length > 1 ? `<div><i>${ic("plane")}</i>${t("usp_deliver")}</div>` : ""}
    </div>
  </div></section>

  <section class="block" id="vozila"><div class="wrap">
    <div class="head"><div><h2>${t("fleet")}</h2><p id="fleet-sub"></p></div></div>
    <div class="chips" id="chips"></div>
    <div class="grid" id="grid"></div>
  </div></section>

  <section class="block" id="kako"><div class="wrap">
    <div class="head"><h2>${t("how")}</h2></div>
    <div class="steps3">
      ${[1, 2, 3].map((n) => `<div class="st"><div class="n">${n}</div><h3>${t("how" + n)}</h3><p>${t("how" + n + "d")}</p></div>`).join("")}
    </div>
  </div></section>

  <section class="block" id="uslovi"><div class="wrap">
    <div class="head"><h2>${t("terms")}</h2></div>
    <div class="terms">${termsHtml()}</div>
    <div class="head" style="margin:36px 0 0"><h2 style="font-size:24px">${t("locs")}</h2></div>
    <div class="locs">${(s.locations || []).map((l) => `<div class="loc">${ic("pin")}<div><b>${esc(nm(l.name))}</b><small>${esc(l.address || "")}</small></div><em class="${l.fee ? "" : "free"}">${l.fee ? t("fee", { p: money(l.fee) }) : t("no_fee")}</em></div>`).join("")}</div>
  </div></section>

  <section class="block" id="faq"><div class="wrap">
    <div class="head"><h2>${t("faq")}</h2></div>
    <div class="faq">${faqHtml()}</div>
  </div></section>

  <section class="block" id="kontakt"><div class="wrap">
    <div class="contact">
      <div>
        <h2>${t("contact")}</h2>
        <div class="lines">
          ${s.contact?.address ? `<div>${ic("pin")}<span>${esc(s.contact.address)}</span></div>` : ""}
          ${s.contact?.phone ? `<div>${ic("phone")}<a href="tel:${esc(s.contact.phone.replace(/\s/g, ""))}">${esc(s.contact.phone)}</a></div>` : ""}
          ${s.contact?.email ? `<div>${ic("mail")}<a href="mailto:${esc(s.contact.email)}">${esc(s.contact.email)}</a></div>` : ""}
          ${s.hours ? `<div>${ic("clock")}<span>${t("hours")}: ${t("every_day")} ${esc(s.hours.open)}–${esc(s.hours.close)}</span></div>` : ""}
        </div>
      </div>
      <div class="acts">
        ${waLink() ? `<a class="btn mint" href="${waLink()}" target="_blank" rel="noopener">${ic("chat")}${t("wa")}</a>` : ""}
        ${s.contact?.phone ? `<a class="btn ghost" href="tel:${esc(s.contact.phone.replace(/\s/g, ""))}">${ic("phone")}${t("call")}</a>` : ""}
        ${s.contact?.address ? `<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.contact.address)}" target="_blank" rel="noopener">${ic("pin")}${t("map")}</a>` : ""}
      </div>
    </div>
  </div></section>

  <footer><div class="wrap">
    <span>© ${new Date().getFullYear()} ${esc(S.ag.naziv)}</span>
    <a href="/" target="_blank" rel="noopener">${t("powered")} <b>hostio</b></a>
  </div></footer>
  ${waLink() ? `<a class="fab" href="${waLink()}" target="_blank" rel="noopener" aria-label="WhatsApp">${ic("chat", "")}</a>` : ""}`;
  renderFleet();
}

function heroTitle() {
  const tag = nm(set().brand?.tagline) || S.ag.naziv;
  const words = tag.split(" ");
  if (words.length < 2) return esc(tag);
  return `${esc(words.slice(0, -1).join(" "))} <em>${esc(words.at(-1))}</em>`;
}

function timeOpts(sel) { return TIMES.map((x) => `<option ${x === sel ? "selected" : ""}>${x}</option>`).join(""); }
function locOpts(sel) { return (set().locations || []).map((l) => `<option value="${esc(l.id)}" ${l.id === sel ? "selected" : ""}>${esc(nm(l.name))}${l.fee ? " (+" + money(l.fee) + ")" : ""}</option>`).join(""); }

function dateFields(prefix) {
  const s = S.search, today = todayLocal(tz()), max = addDays(today, 365);
  return `
    <label class="field"><span>${t("from")}</span><div class="ctrl">${ic("cal")}<input type="date" name="${prefix}pd" value="${s.pd}" min="${today}" max="${max}" aria-label="${t("from")}"><select class="t" name="${prefix}pt" aria-label="${t("from")}">${timeOpts(s.pt)}</select></div></label>
    <label class="field"><span>${t("to")}</span><div class="ctrl">${ic("cal")}<input type="date" name="${prefix}rd" value="${s.rd}" min="${s.pd}" max="${addDays(max, 90)}" aria-label="${t("to")}"><select class="t" name="${prefix}rt" aria-label="${t("to")}">${timeOpts(s.rt)}</select></div></label>`;
}
function locFields(prefix) {
  const s = S.search;
  return `<label class="field"><span>${t("pickup")}</span><div class="ctrl">${ic("pin")}<select name="${prefix}pu">${locOpts(s.pu)}</select></div></label>
    ${s.diff ? `<label class="field"><span>${t("ret")}</span><div class="ctrl">${ic("pin")}<select name="${prefix}dr">${locOpts(s.dr)}</select></div></label>` : ""}`;
}
const diffCheck = (prefix) => `<label class="check full"><input type="checkbox" name="${prefix}diff" ${S.search.diff ? "checked" : ""}>${t("other_return")}</label>`;
function searchHtml() {
  return `<form class="search ${S.search.diff ? "diff" : ""}" id="search" onsubmit="return false">
    ${locFields("s_")}
    ${diffCheck("s_")}
    ${dateFields("s_")}
    <button class="btn mint" data-act="search" type="button">${t("search")}${ic("arrow", "ico flip")}</button>
    <div class="err-line" id="search-err" style="grid-column:1/-1">${esc(S.err)}</div>
  </form>`;
}

function termsHtml() {
  const s = set(), deps = S.cars.map((c) => Number(c.deposit) || 0).filter(Boolean);
  const dep = deps.length ? (Math.min(...deps) === Math.max(...deps) ? money(deps[0]) : `${money(Math.min(...deps))} – ${money(Math.max(...deps))}`) : "";
  const items = [
    s.min_age && ["user", t("t_age", { n: s.min_age }), t("t_age_d", { n: s.min_age })],
    s.license_years && ["id", t("t_lic", { n: s.license_years }), t("t_lic_d", { n: s.license_years })],
    dep && ["shield", `${t("t_dep")}: ${dep}`, t("t_dep_d")],
    s.mileage === "unlimited" && ["road", t("t_km"), t("t_km_d")],
    s.fuel_policy === "full_to_full" && ["pump", t("t_fuel"), t("t_fuel_d")],
    s.cancellation_hours && ["undo", t("t_cancel"), t("t_cancel_d", { n: s.cancellation_hours })],
    s.hours && ["clock", t("t_hours", { o: s.hours.open, c: s.hours.close }), s.after_hours_fee ? t("t_hours_d", { p: money(s.after_hours_fee) }) : ""],
    ["cal", t("t_late"), t("t_late_d")],
  ].filter(Boolean);
  return items.map(([i, b, p]) => `<div class="term"><i>${ic(i)}</i><div><b>${esc(b)}</b><p>${esc(p)}</p></div></div>`).join("");
}

function faqHtml() {
  const s = set();
  const qs = [1, 2, 3];
  if (s.cancellation_hours) qs.push(4);
  if ((s.extras || []).some((x) => x.id === "granica")) qs.push(5);
  qs.push(6);
  const v = { ly: s.license_years || 2, n: s.cancellation_hours || 48 };
  return qs.map((n) => `<details><summary>${esc(t("q" + n))}<i>${ic("plus")}</i></summary><p>${esc(t("a" + n, v))}</p></details>`).join("");
}

// ---------- fleet ----------
function renderFleet() {
  const cats = ["all", ...new Set(S.cars.map((c) => c.category))];
  const chips = document.getElementById("chips");
  if (!chips) return;
  chips.innerHTML = cats.map((c) => `<button class="chip ${S.cat === c ? "on" : ""}" data-act="cat" data-v="${esc(c)}">${esc(t("cat_" + c))}</button>`).join("") +
    (S.cars.some((c) => c.transmission === "automatic") ? `<button class="chip tog ${S.auto ? "on" : ""}" data-act="auto">${ic("gear")}${t("auto_only")}</button>` : "");
  const s = S.search;
  document.getElementById("fleet-sub").textContent = S.searched
    ? t("fleet_sub_dates", { from: `${fmtDay(s.pd)} ${s.pt}`, to: `${fmtDay(s.rd)} ${s.rt}` }) : t("fleet_sub");
  let list = S.cars.filter((c) => (S.cat === "all" || c.category === S.cat) && (!S.auto || c.transmission === "automatic"));
  if (S.searched && S.avail) list = [...list].sort((a, b) => (S.avail[b.id] ? 1 : 0) - (S.avail[a.id] ? 1 : 0));
  document.getElementById("grid").innerHTML = list.length ? list.map(cardHtml).join("") : `<div class="empty">${t("none")}</div>`;
}

function cardHtml(v) {
  const known = S.searched && S.avail && v.id in S.avail, free = known && S.avail[v.id];
  let price = `<small>${t("from_price")}</small><b>${money(fromPrice(v.price_tiers))} <span>${t("per_day")}</span></b>`;
  if (S.searched) {
    const q = quote(quoteInput(v, []));
    if (!q.greska) price = `<small>${t("total_for", { d: daysLabel(S.lang, q.days) })}</small><b>${money(q.total)}</b>`;
  }
  return `<article class="card ${known && !free ? "off" : ""}" data-act="open" data-id="${v.id}" tabindex="0" role="button" aria-label="${esc(v.make + " " + v.model)}">
    <div class="row1"><span class="tag">${esc(t("cat_" + v.category))}</span>${v.featured ? `<span class="tag feat">${t("featured")}</span>` : ""}
      ${known ? `<span class="avail ${free ? "" : "no"}"><i></i>${free ? t("free") : t("busy")}</span>` : ""}</div>
    <div class="pic">${carPic(v)}</div>
    <h3>${esc(v.make)} ${esc(v.model)}</h3>
    <div class="yr">${v.year || ""}${v.engine ? ` · <bdi>${esc(v.engine)}</bdi>` : ""}</div>
    <div class="specs">
      <span>${ic("gear")}${t(v.transmission)}</span><span>${ic("fuel")}${t(v.fuel)}</span>
      <span>${ic("user")}${v.seats}</span><span>${ic("bag")}${v.bags}</span>
    </div>
    <div class="foot"><div class="price">${price}</div><span class="go">${t("book")}<i>${ic("arrow")}</i></span></div>
  </article>`;
}

function quoteInput(v, extras) {
  const s = S.search;
  return { vehicle: v, settings: set(), tz: tz(), pickupDate: s.pd, pickupTime: s.pt, returnDate: s.rd, returnTime: s.rt, pickup: s.pu, dropoff: s.diff ? s.dr : s.pu, extras };
}

async function fetchAvail() {
  const s = S.search;
  try {
    const res = await fetch(`${API}dostupnost?slug=${encodeURIComponent(slug)}&od=${s.pd}T${s.pt}&do=${s.rd}T${s.rt}`);
    const d = await res.json();
    S.avail = res.ok ? d.slobodno : null;
  } catch { S.avail = null; }
  renderFleet();
}

function runSearch() {
  const q = quote(quoteInput(S.cars[0], []));
  const box = document.getElementById("search-err");
  if (q.greska) { S.err = t("e_" + q.greska, { min: q.min }); box.textContent = S.err; return; }
  if (new Date(q.start).getTime() < now2h()) { S.err = t("e_prerano"); box.textContent = S.err; return; }
  S.err = ""; box.textContent = "";
  S.searched = true; S.avail = null;
  renderFleet(); fetchAvail();
  document.getElementById("vozila").scrollIntoView({ behavior: "smooth" });
}

// ---------- language gate ----------
function renderGate() {
  app.innerHTML = `<div class="gate"><div class="box">
    <div class="logo"><b>${esc((S.ag?.naziv || "R")[0])}</b><span>${esc(S.ag?.naziv || "")}</span></div>
    <h1>${LANGS.map((l) => l.hello).join(" · ")}</h1>
    <div class="langs">${LANGS.map((l) => `<button data-act="lang" data-v="${l.code}" lang="${l.code}">${l.name}<small>${T[l.code].gate}</small></button>`).join("")}</div>
  </div></div>`;
}

// ---------- booking panel ----------
async function openPanel(id) {
  const v = S.cars.find((c) => c.id === id);
  if (!v) return;
  S.panel = { v, step: 1, extras: new Set(), busy: null, month: S.search.pd.slice(0, 7), pick: "start", d: S.panel?.d || {}, files: {}, err: "", sending: false, done: null };
  document.body.classList.add("lock");
  if (!document.getElementById("sheet")) {
    document.body.insertAdjacentHTML("beforeend", `<div class="ov" id="ov" data-act="close"></div><div class="sheet" id="sheet" role="dialog" aria-modal="true"></div>`);
  }
  renderPanel();
  requestAnimationFrame(() => { document.getElementById("ov").classList.add("in"); document.getElementById("sheet").classList.add("in"); });
  loadBusy();
}
async function loadBusy() {
  const P = S.panel;
  try {
    const r = await fetch(`${API}kalendar?slug=${encodeURIComponent(slug)}&vozilo=${P.v.id}`);
    const d = await r.json();
    P.busy = (d.zauzeto || []).map((b) => ({ start_at: b.od, end_at: b.do }));
  } catch { P.busy = []; }
  if (S.panel === P) renderPanel(true);
}
function closePanel() {
  const ov = document.getElementById("ov"), sh = document.getElementById("sheet");
  if (!sh) return;
  ov.classList.remove("in"); sh.classList.remove("in");
  setTimeout(() => { ov.remove(); sh.remove(); }, 300);
  document.body.classList.remove("lock");
  S.panel = null;
  const form = document.getElementById("search");
  if (form) form.outerHTML = searchHtml();
  if (S.searched) { renderFleet(); fetchAvail(); } else renderFleet();
}

function pq() { const P = S.panel; return quote(quoteInput(P.v, [...P.extras])); }
function pFree(q) { const P = S.panel; return !P.busy || q.greska ? true : isFree(P.busy, q.start, q.end, Number(set().buffer_hours) || 0); }

function renderPanel(keepScroll = true) {
  const P = S.panel, sh = document.getElementById("sheet");
  if (!P || !sh) return;
  const old = sh.querySelector(".scroll")?.scrollTop || 0;
  const v = P.v, q = pq();
  if (P.done) {
    sh.innerHTML = `<div class="scroll"><div class="sh-top"><span style="flex:1"></span><button class="round" data-act="close" aria-label="${t("close")}">${ic("close")}</button></div>
      <div class="done"><div class="ok">${ic("check")}</div><h3>${t("ok_title")}</h3><p>${t("ok_text")}</p>
      <div class="ref"><small>${t("ok_ref")}</small><b>${esc(P.done.ref)}</b></div>
      <div class="bill" style="text-align:start;max-width:420px;margin:0 auto 16px"><div class="ln"><span>${esc(v.make + " " + v.model)} · ${daysLabel(S.lang, P.done.dana)}</span><b>${money(P.done.ukupno)}</b></div>
      <div class="note">${ic("cash")}<span>${t("pay_note")} ${P.done.depozit ? t("deposit_note", { p: money(P.done.depozit) }) : ""}</span></div></div>
      ${waLink() ? `<a class="btn mint" href="${waLink(" (ref " + P.done.ref + ")")}" target="_blank" rel="noopener">${ic("chat")}${t("ok_wa")}</a>` : ""}
      </div></div>`;
    return;
  }
  const steps = [t("st1"), t("st2"), t("st3"), t("st4")];
  let body = "";
  if (P.step === 1) body = step1(v, q);
  if (P.step === 2) body = step2(q);
  if (P.step === 3) body = step3();
  if (P.step === 4) body = step4(v, q);
  const ok = !q.greska;
  sh.innerHTML = `
    <div class="scroll">
      <div class="sh-top">
        ${P.step > 1 ? `<button class="round" data-act="back" aria-label="${t("back")}">${ic("back", "ico flip")}</button>` : ""}
        <h2>${esc(v.make + " " + v.model)}</h2>
        <button class="round" data-act="close" aria-label="${t("close")}">${ic("close")}</button>
      </div>
      ${P.step === 1 ? `<div class="car-stage"><div class="pic">${carPic(v)}</div>
        <div class="t"><div><h3>${esc(v.make)} ${esc(v.model)}</h3><div class="yr">${v.year || ""} · ${esc(t("cat_" + v.category))}</div></div>
        <div class="price" style="text-align:end"><small>${t("from_price")}</small><b>${money(fromPrice(v.price_tiers))} <span>${t("per_day")}</span></b></div></div></div>` :
        `<div class="extra" style="cursor:default"><div style="flex:0 0 96px">${carPic(v)}</div><div><b>${esc(v.make + " " + v.model)}</b><small>${fmtDay(S.search.pd)} ${S.search.pt} → ${fmtDay(S.search.rd)} ${S.search.rt}</small></div></div>`}
      <div class="stepper">${steps.map((s, i) => `<div class="${i < P.step ? "on" : ""}">${s}</div>`).join("")}</div>
      ${body}
    </div>
    <div class="bar">
      <div class="sum"><small>${ok ? `${t("total")} · ${daysLabel(S.lang, q.days)}` : "&nbsp;"}</small><b>${ok ? money(q.total) : "—"}</b></div>
      ${P.step < 4 ? `<button class="btn mint" data-act="next">${t("next")}${ic("arrow", "ico flip")}</button>`
        : `<button class="btn mint" data-act="send" ${P.sending ? "disabled" : ""}>${P.sending ? t("sending") : t("send")}${P.sending ? "" : ic("check")}</button>`}
    </div>`;
  if (keepScroll) sh.querySelector(".scroll").scrollTop = old;
}

function billHtml(q) {
  if (q.greska) return "";
  const s = set(), loc = (id) => nm((s.locations || []).find((l) => l.id === id)?.name);
  const lines = q.lines.map((l) => {
    let label;
    if (l.key === "najam") label = t("l_najam", { d: daysLabel(S.lang, l.days), p: money(l.perDay) });
    else if (l.key === "dodatak") label = nm((s.extras || []).find((x) => x.id === l.id)?.name);
    else if (l.key === "preuzimanje" || l.key === "vracanje") label = t("l_" + l.key, { loc: loc(l.id) });
    else label = t("l_" + l.key);
    return `<div class="ln"><span>${esc(label)}</span><b>${money(l.total)}</b></div>`;
  }).join("");
  return `<div class="bill">${lines}<div class="ln tot"><span>${t("total")}</span><b>${money(q.total)}</b></div></div>`;
}

function step1(v, q) {
  const P = S.panel, tiers = [...(v.price_tiers || [])].sort((a, b) => a.od - b.od);
  const cur = q.greska ? null : dayPrice(v.price_tiers, q.days);
  const spec = [
    ["gear", "s_trans", t(v.transmission)], ["fuel", "s_fuel", t(v.fuel)], ["user", "s_seats", v.seats], ["door", "s_doors", v.doors],
    ["bag", "s_bags", v.bags], ["snow", "s_ac", v.ac === false ? "—" : t("yes")], ["gauge", "s_cons", v.consumption ? `${v.consumption} l/100km` : "—"], ["engine", "s_engine", v.engine || "—"],
  ];
  let msg = "";
  if (q.greska) msg = t("e_" + q.greska, { min: q.min });
  else if (new Date(q.start).getTime() < now2h()) msg = t("e_prerano");
  else if (!pFree(q)) msg = t("busy_pick");
  return `
    ${nm(v.description) ? `<p class="desc">${esc(nm(v.description))}</p>` : ""}
    <div class="sec"><div class="tiles">${spec.map(([i, k, val]) => `<div class="tile">${ic(i)}<small>${t(k)}</small><b title="${esc(val)}"><bdi>${esc(val)}</bdi></b></div>`).join("")}</div></div>
    <div class="sec"><h4>${t("tiers")}</h4><div class="tiers">${tiers.map((x, i) => {
      const nx = tiers[i + 1];
      return `<div class="${cur === Number(x.cijena) && q.days >= x.od && (!nx || q.days < nx.od) ? "on" : ""}"><small>${nx ? t("tier_range", { a: x.od, b: nx.od - 1 }) : t("tier_plus", { a: x.od })}</small><b>${money(x.cijena)}</b></div>`;
    }).join("")}</div></div>
    <div class="sec"><h4>${ic("cal")}${t("cal")}</h4>${calHtml()}</div>
    <div class="sec form2 two">${locFields("p_")}${diffCheck("p_")}</div>
    <div class="sec form2 two">${dateFields("p_")}</div>
    ${msg ? `<div class="sec warn">${ic("clock")}${esc(msg)}</div>` : ""}
    ${P.err ? `<div class="sec warn">${esc(P.err)}</div>` : ""}
    <div class="sec"><h4>${t("calc")}</h4>${billHtml(q)}</div>
    ${v.deposit ? `<div class="sec note">${ic("shield")}<span>${t("deposit_note", { p: money(v.deposit) })}</span></div>` : ""}
    <div class="sec note">${ic("cash")}<span>${t("pay_note")}</span></div>`;
}

function calHtml() {
  const P = S.panel, s = S.search, zone = tz(), today = todayLocal(zone), max = addDays(today, 365);
  const [y, m] = P.month.split("-").map(Number);
  const first = `${P.month}-01`, startDow = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const buf = (Number(set().buffer_hours) || 0) * 3600e3;
  const busy = (P.busy || []).map((b) => [new Date(b.start_at).getTime() - buf, new Date(b.end_at).getTime() + buf]);
  const wd = Array.from({ length: 7 }, (_, i) => weekdayNarrow(i));
  let cells = wd.map((w) => `<div class="wd">${w}</div>`).join("") + "<div></div>".repeat(startDow);
  for (let i = 0; i < daysIn; i++) {
    const d = addDays(first, i);
    const ds = new Date(localToUtc(d, "00:00", zone)).getTime(), de = new Date(localToUtc(addDays(d, 1), "00:00", zone)).getTime();
    let st = "";
    for (const [a, b] of busy) { if (a <= ds && b >= de) { st = "busy"; break; } if (a < de && b > ds) st = "part"; }
    const cls = [st, d === s.pd ? "s" : "", d === s.rd ? "e" : "", d > s.pd && d < s.rd ? "in" : "", d === today ? "today" : ""].join(" ");
    const dis = d < today || d > max || st === "busy";
    cells += `<button type="button" class="${cls}" data-act="day" data-d="${d}" ${dis ? "disabled" : ""} aria-label="${fmtDay(d, { day: "numeric", month: "long" })}">${i + 1}</button>`;
  }
  const minM = today.slice(0, 7), maxM = addDays(today, 365).slice(0, 7);
  const title = monthTitle(y, m);
  return `<div class="cal">
    <div class="cal-h"><button class="round" data-act="mon" data-v="-1" ${P.month <= minM ? "disabled" : ""} aria-label="‹">${ic("left", "ico flip")}</button><span>${esc(title)}</span>
    <button class="round" data-act="mon" data-v="1" ${P.month >= maxM ? "disabled" : ""} aria-label="›">${ic("right", "ico flip")}</button></div>
    <div class="cal-g">${cells}</div>
    <div class="legend"><span><i style="background:var(--accent)"></i>${t("leg_sel")}</span><span><i style="background:rgba(229,72,77,.35)"></i>${t("leg_busy")}</span></div>
    <div class="hint">${P.busy === null ? t("loading") : t("cal_hint")}</div>
  </div>`;
}

function step2(q) {
  const P = S.panel, s = set(), days = q.greska ? 1 : q.days;
  return `<div class="sec"><h4>${t("extras")}</h4><div class="form2">${(s.extras || []).map((x) => {
    let tot = x.per === "dan" ? x.price * days : x.price; if (x.max) tot = Math.min(tot, x.max);
    return `<button type="button" class="extra ${P.extras.has(x.id) ? "on" : ""}" data-act="extra" data-id="${esc(x.id)}" aria-pressed="${P.extras.has(x.id)}">
      <i class="box">${P.extras.has(x.id) ? ic("check") : ""}</i>
      <div><b>${esc(nm(x.name))}</b><small>${money(x.price)} ${t("per_" + x.per)}${x.max ? " · " + t("max", { p: money(x.max) }) : ""}</small></div>
      <b>${money(tot)}</b></button>`;
  }).join("")}</div></div>
    <div class="sec"><h4>${t("calc")}</h4>${billHtml(q)}</div>`;
}

function step3() {
  const P = S.panel, d = P.d, bad = P.bad || {};
  const f = (name, label, type = "text", extra = "") => `<label class="f">${label}<input class="inp ${bad[name] ? "bad" : ""}" name="d_${name}" type="${type}" value="${esc(d[name] || "")}" ${extra}></label>`;
  const up = (side, label) => {
    const file = P.files[side];
    return `<label class="up ${bad[side] ? "bad" : ""}">
      ${file ? (file.pdf ? `<span class="pdf">PDF ✓</span>` : `<img src="${file.url}" alt="">`) + `<span class="chg">${t("change")}</span>` : `<span class="ph">${ic("cam")}${label}<span style="font-weight:500">${t("upload")}</span></span>`}
      <input type="file" accept="image/*,application/pdf" data-side="${side}" aria-label="${label}"></label>`;
  };
  return `<div class="sec form2 two">
      ${f("ime", t("first"), "text", 'autocomplete="given-name" maxlength="60"')}
      ${f("prezime", t("last"), "text", 'autocomplete="family-name" maxlength="60"')}
      ${f("email", t("email"), "email", 'autocomplete="email" maxlength="160" inputmode="email"')}
      ${f("telefon", t("phone"), "tel", 'autocomplete="tel" maxlength="30" placeholder="+387 61 234 567"')}
      ${f("rodjen", t("birth"), "date", `max="${todayLocal(tz())}" min="1920-01-01"`)}
      ${f("dozvola", t("lic_no"), "text", 'maxlength="40" autocomplete="off"')}
    </div>
    <div class="sec"><h4>${ic("id")}${t("lic_photos")}</h4><div class="ups">${up("front", t("lic_front"))}${up("back", t("lic_back"))}</div>
      <div class="note" style="margin-top:10px">${ic("lock")}<span>${t("lic_private")}</span></div></div>
    <div class="sec form2">
      <label class="f">${t("flight")} <em>(${t("optional")})</em><input class="inp" name="d_let" value="${esc(d.let || "")}" maxlength="20"></label>
      <label class="f">${t("note")} <em>(${t("optional")})</em><textarea class="inp" name="d_napomena" maxlength="800">${esc(d.napomena || "")}</textarea></label>
      <input class="hp" name="d_website" tabindex="-1" autocomplete="off" aria-hidden="true">
    </div>
    ${P.err ? `<div class="sec warn">${esc(P.err)}</div>` : ""}`;
}

function step4(v, q) {
  const P = S.panel, d = P.d, s = S.search, loc = (id) => nm((set().locations || []).find((l) => l.id === id)?.name);
  return `<div class="sec rev">
      <div><small>${t("review_car")}</small><p>${esc(v.make + " " + v.model)} · ${t(v.transmission)}</p></div>
      <div><small>${t("review_when")}</small><p>${fmtDay(s.pd)} ${s.pt} · ${esc(loc(s.pu))}</p><p>${fmtDay(s.rd)} ${s.rt} · ${esc(loc(s.diff ? s.dr : s.pu))}</p></div>
      <div><small>${t("review_driver")}</small><p>${esc(d.ime)} ${esc(d.prezime)}</p><p style="font-weight:500;color:var(--muted)">${esc(d.email)} · ${esc(d.telefon)}</p></div>
    </div>
    <div class="sec">${billHtml(q)}</div>
    ${v.deposit ? `<div class="sec note">${ic("shield")}<span>${t("deposit_note", { p: money(v.deposit) })}</span></div>` : ""}
    <div class="sec note">${ic("cash")}<span>${t("pay_note")}</span></div>
    <label class="sec check" style="color:var(--text)"><input type="checkbox" name="d_uslovi" ${d.uslovi ? "checked" : ""}>${t("agree")}</label>
    ${P.err ? `<div class="sec warn">${esc(P.err)}</div>` : ""}`;
}

// ---------- validation + sending ----------
function ageOn(birth, on) {
  const [by, bm, bd] = birth.split("-").map(Number), [y, m, d] = on.split("-").map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}
function checkDriver() {
  const P = S.panel, d = P.d, bad = {}, min = set().min_age || 18;
  let msg = "";
  const need = (k, ok, e, vars) => { if (!ok) { bad[k] = 1; msg ||= t(e, vars); } };
  need("ime", (d.ime || "").trim(), "e_ime"); need("prezime", (d.prezime || "").trim(), "e_ime");
  need("email", /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i.test((d.email || "").trim()), "e_email");
  need("telefon", (d.telefon || "").replace(/\D/g, "").length >= 8, "e_telefon");
  need("rodjen", validDate(d.rodjen), "e_datum_rodjenja");
  if (validDate(d.rodjen)) need("rodjen", ageOn(d.rodjen, S.search.pd) >= min, "e_godine", { min });
  need("dozvola", (d.dozvola || "").trim().length >= 4, "e_dozvola");
  need("front", P.files.front, "e_slika_dozvole"); need("back", P.files.back, "e_slika_dozvole");
  P.bad = bad; P.err = msg;
  return !msg;
}

async function next() {
  const P = S.panel, q = pq();
  P.err = "";
  if (P.step === 1) {
    if (q.greska) return renderPanel();
    if (new Date(q.start).getTime() < now2h() || !pFree(q)) return renderPanel();
  }
  if (P.step === 3 && !checkDriver()) {
    renderPanel();
    document.querySelector(".sheet .bad")?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  P.step = Math.min(4, P.step + 1);
  renderPanel(false);
}

async function send() {
  const P = S.panel, d = P.d, s = S.search;
  if (!d.uslovi) { P.err = t("e_uslovi"); return renderPanel(); }
  P.sending = true; P.err = ""; renderPanel();
  const f = new FormData();
  const fields = {
    slug, vozilo: P.v.id, datum_od: s.pd, vrijeme_od: s.pt, datum_do: s.rd, vrijeme_do: s.rt, preuzimanje: s.pu, vracanje: s.diff ? s.dr : s.pu,
    dodaci: JSON.stringify([...P.extras]), ime: d.ime.trim(), prezime: d.prezime.trim(), email: d.email.trim(), telefon: d.telefon.trim(),
    datum_rodjenja: d.rodjen, broj_dozvole: d.dozvola.trim(), let: (d.let || "").trim(), napomena: (d.napomena || "").trim(),
    jezik: S.lang, uslovi: "da", website: d.website || "",
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  f.set("dozvola_prednja", P.files.front.blob, "prednja." + (P.files.front.pdf ? "pdf" : "jpg"));
  f.set("dozvola_zadnja", P.files.back.blob, "zadnja." + (P.files.back.pdf ? "pdf" : "jpg"));
  let res, data;
  try {
    res = await fetch(API + "zahtjev", { method: "POST", body: f });
    data = await res.json().catch(() => ({}));
  } catch { P.sending = false; P.err = t("e_mreza"); return renderPanel(); }
  P.sending = false;
  if (res.ok && data.ok) { P.done = data; return renderPanel(false); }
  const code = data.greska || "server";
  P.err = t("e_" + code, { min: data.min }) || t("e_server");
  if (!T.bs["e_" + code]) P.err = t("e_server");
  if (code === "zauzeto") { P.step = 1; P.busy = null; loadBusy(); }
  else if (["ime", "email", "telefon", "datum_rodjenja", "godine", "dozvola", "slika_dozvole", "slika_velika", "slika_format"].includes(code)) P.step = 3;
  else if (["datum", "redoslijed", "min_dana", "max_dana", "lokacija", "prerano", "predaleko"].includes(code)) P.step = 1;
  renderPanel(false);
}

// Licence photo: shrink big phone photos to max 1600 px JPEG (fast upload, below the 4 MB limit).
async function prepFile(file) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    if (file.size > 4 * 1024 * 1024) throw "e_slika_velika";
    return { blob: file, pdf: true };
  }
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw 0;
    return { blob, url: URL.createObjectURL(blob) };
  } catch {
    if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 4 * 1024 * 1024) return { blob: file, url: URL.createObjectURL(file) };
    throw "e_slika_format";
  }
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-act]");
  if (S.menu && !e.target.closest(".menu") && el?.dataset.act !== "menu") { S.menu = false; render(); if (!el) return; }
  if (!el) return;
  const act = el.dataset.act, v = el.dataset.v;
  if (act === "lang") return setLang(v);
  if (act === "menu") { S.menu = !S.menu; return render(); }
  if (act === "cat") { S.cat = v; return renderFleet(); }
  if (act === "auto") { S.auto = !S.auto; return renderFleet(); }
  if (act === "search") return runSearch();
  if (act === "open") return openPanel(el.dataset.id);
  if (act === "close") return closePanel();
  if (act === "next") return next();
  if (act === "back") { S.panel.step--; S.panel.err = ""; return renderPanel(false); }
  if (act === "send") return send();
  if (act === "extra") { const x = S.panel.extras; x.has(el.dataset.id) ? x.delete(el.dataset.id) : x.add(el.dataset.id); return renderPanel(); }
  if (act === "mon") {
    const [y, m] = S.panel.month.split("-").map(Number), d = new Date(Date.UTC(y, m - 1 + Number(v), 1));
    S.panel.month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    return renderPanel();
  }
  if (act === "day") return pickDay(el.dataset.d);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && S.panel) closePanel();
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".card[data-act=open]")) { e.preventDefault(); openPanel(e.target.dataset.id); }
});

function pickDay(d) {
  const P = S.panel, s = S.search;
  if (P.pick === "start" || d < s.pd) {
    s.pd = d;
    if (s.rd < d) s.rd = addDays(d, 1);
    P.pick = "end";
  } else { s.rd = d; P.pick = "start"; }
  S.searched = true; S.avail = null; P.err = "";
  renderPanel();
}

document.addEventListener("change", async (e) => {
  const el = e.target, name = el.name || "";
  if (el.type === "file" && el.dataset.side && S.panel) {
    const file = el.files?.[0]; if (!file) return;
    try {
      const prev = S.panel.files[el.dataset.side];
      if (prev?.url) URL.revokeObjectURL(prev.url);
      S.panel.files[el.dataset.side] = await prepFile(file);
      if (S.panel.bad) delete S.panel.bad[el.dataset.side];
      S.panel.err = "";
    } catch (code) { S.panel.err = t(typeof code === "string" ? code : "e_slika_format"); }
    return renderPanel();
  }
  const m = name.match(/^(s|p)_(pd|pt|rd|rt|pu|dr|diff)$/);
  if (m) {
    const s = S.search, k = m[2];
    if (k === "diff") { s.diff = el.checked; if (!s.diff) s.dr = s.pu; }
    else if (k === "pd" || k === "rd") { if (!validDate(el.value)) return; s[k] = el.value; if (s.rd < s.pd) s.rd = k === "pd" ? addDays(s.pd, 1) : s.pd; }
    else s[k] = el.value;
    if (k === "pu" && !s.diff) s.dr = s.pu;
    if (m[1] === "s") {
      const form = document.getElementById("search");
      if (k === "diff" || k === "pd" || k === "rd") form.outerHTML = searchHtml();
      if (S.searched) { S.avail = null; renderFleet(); fetchAvail(); }
    } else {
      S.searched = true; S.avail = null;
      S.panel.month = s.pd.slice(0, 7);
      renderPanel();
    }
    return;
  }
  if (name === "d_uslovi" && S.panel) { S.panel.d.uslovi = el.checked; S.panel.err = ""; }
});
document.addEventListener("input", (e) => {
  const m = (e.target.name || "").match(/^d_(\w+)$/);
  if (m && S.panel) {
    S.panel.d[m[1]] = e.target.value;
    if (S.panel.bad?.[m[1]]) { delete S.panel.bad[m[1]]; e.target.classList.remove("bad"); }
  }
});

start();
