// Hostio · rent-a-car owner dashboard
import { carSvg, esc } from "/rent/car.js";
import { fromPrice } from "/rent/core.js";

const $ = (id) => document.getElementById(id);
const DAY = 864e5;
let sess = null, D = null, view = "pregled";
const ui = { filter: "na_cekanju", q: "", calStart: null, clientQ: "" };

// ---------- formatting (agency time zone, Bosnian names) ----------
const WD = ["ned", "pon", "uto", "sri", "čet", "pet", "sub"];
const MON = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const MONL = ["januar", "februar", "mart", "april", "maj", "juni", "juli", "august", "septembar", "oktobar", "novembar", "decembar"];
const tz = () => D?.agencija?.tz || "Europe/Sarajevo";
function parts(iso) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz(), year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const key = `${p.year}-${p.month}-${p.day}`;
  return { key, y: +p.year, m: +p.month, d: +p.day, hm: `${p.hour}:${p.minute}`, wd: new Date(key + "T12:00:00Z").getUTCDay() };
}
const todayKey = () => parts(new Date().toISOString()).key;
const addDays = (key, n) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const dShort = (iso) => { const p = parts(iso); return `${WD[p.wd]}, ${p.d}.${p.m}.`; };
const dFull = (iso) => { const p = parts(iso); return `${WD[p.wd]}, ${p.d}. ${MON[p.m - 1]} ${p.y}. u ${p.hm}`; };
const dRange = (b) => { const a = parts(b.start_at), z = parts(b.end_at); return `${a.d}.${a.m}. ${a.hm} → ${z.d}.${z.m}.${z.y !== a.y ? z.y + "." : ""} ${z.hm}`; };
const rel = (iso) => { const k = parts(iso).key, t = todayKey(); return k === t ? "danas" : k === addDays(t, 1) ? "sutra" : k === addDays(t, -1) ? "jučer" : dShort(iso); };
const cur = () => D?.agencija?.postavke?.currency || "KM";
const money = (n) => n == null || n === "" ? "—" : `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(Number(n))} ${cur()}`;
const name = (b) => [b.first_name, b.last_name].filter(Boolean).join(" ") || (b.status === "blokirano" ? "Blokada" : "—");
const initials = (s) => String(s || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();
const plural = (n, one, few, many) => { const a = n % 10, b = n % 100; return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many; };
const dana = (n) => `${n} ${plural(n, "dan", "dana", "dana")}`;
const veh = (id) => D.vozila.find((v) => v.id === id) || { make: "?", model: "", id };
const vname = (v) => `${v.make} ${v.model}`.trim();
const nm = (o) => (o && typeof o === "object" ? o.bs || o.en || "" : o || "");
const locName = (id) => nm((D.agencija.postavke.locations || []).find((l) => l.id === id)?.name) || id || "—";
const extraName = (id) => nm((D.agencija.postavke.extras || []).find((x) => x.id === id)?.name) || id;
const photo = (v) => { const p = (v.photos || [])[0]; return typeof p === "string" ? p : p?.url; };
const carPic = (v) => photo(v) ? `<img src="${esc(photo(v))}" alt="${esc(vname(v))}">` : carSvg(v);
const SRC = { web: "Web stranica", whatsapp: "WhatsApp", instagram: "Instagram", vlasnik: "Upisao vlasnik", demo: "Demo" };
const LANG = { bs: "bosanski", en: "engleski", de: "njemački", ar: "arapski" };
const I = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  inbox: '<path d="M4 4h16v12H15l-1.5 3h-3L9 16H4z"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  car: '<path d="M5 16h14M4 16l1.6-5.2A2 2 0 0 1 7.5 9.3h9a2 2 0 0 1 1.9 1.5L20 16v3h-2.5M4 16v3h2.5"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.6c2 .7 3.5 2.4 3.5 5.4"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', back: '<path d="M15 6l-6 6 6 6"/>', next: '<path d="M9 6l6 6-6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  chat: '<path d="M4 20l1.3-3.9A8.5 8.5 0 1 1 8 19z"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/>', id: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="11" r="2"/><path d="M6 16c1-2 5-2 6 0M14 10h4M14 14h4"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>', down: '<path d="M12 5v14M5 12l7 7 7-7"/>', ext: '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
};
const ic = (n) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${I[n]}</svg>`;

// Status for display: approved rentals are "coming", "on the road" or "finished" depending on the time.
function st(b, now = Date.now()) {
  if (b.status !== "odobreno") return b.status;
  const s = new Date(b.start_at).getTime(), e = new Date(b.end_at).getTime();
  if (b.returned_at) return "vraceno";
  if (b.picked_up_at) return now < e ? "u_najmu" : "kasni";
  return now < s ? "predstoji" : now < e ? "ceka_preuzimanje" : "nije_preuzeto";
}
const ST = { na_cekanju: "Na čekanju", predstoji: "Potvrđeno", ceka_preuzimanje: "Čeka preuzimanje", u_najmu: "U najmu", kasni: "Kasni s vraćanjem",
  vraceno: "Vraćeno", nije_preuzeto: "Nije preuzeto", odbijeno: "Odbijeno", otkazano: "Otkazano", blokirano: "Blokada" };
const ACTIVE = ["predstoji", "ceka_preuzimanje", "u_najmu", "kasni"];
// When the car is really free again: back = return time, still out = now.
const realEnd = (b) => b.returned_at ? +new Date(b.returned_at) : b.picked_up_at && +new Date(b.end_at) < Date.now() ? Date.now() : +new Date(b.end_at);
const badge = (b) => `<span class="st ${st(b)}">${ST[st(b)]}</span>`;
const isRental = (b) => b.status !== "blokirano";
const counted = (b) => b.status === "odobreno";

// ---------- session & API ----------
const store = { get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch {} } };
async function api(path, opts = {}) {
  if (sess && sess.expires_at - Date.now() < 60000) {
    const r = await fetch("/api/osvjezi", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refresh_token: sess.refresh_token }) });
    if (r.ok) { sess = await r.json(); store.set("hostio_rc_sess", sess); } else { logout("Prijava je istekla. Prijavite se ponovo."); throw new Error("auth"); }
  }
  const r = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...(sess ? { authorization: "Bearer " + sess.access_token } : {}) } });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { logout(d.greska); throw new Error("auth"); }
  if (!r.ok) throw new Error(d.greska || "Nešto nije u redu. Pokušajte ponovo.");
  return d;
}
const post = (route, body) => api("/api/rco/" + route, { method: "POST", body: JSON.stringify(body) });

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("in");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("in"), 2800);
}

// ---------- login ----------
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim(), lozinka = $("password").value;
  const btn = $("loginBtn"); btn.disabled = true; btn.textContent = "Prijava…"; $("loginErr").textContent = "";
  try {
    const r = await fetch("/api/prijava", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, lozinka }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.greska || "Prijava nije uspjela.");
    sess = d; store.set("hostio_rc_sess", d); $("password").value = "";
    await start();
  } catch (err) { $("loginErr").textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = "Prijavi se"; }
});
function logout(msg) {
  sess = null; store.set("hostio_rc_sess", null); closeAll();
  $("app").hidden = true; $("login").hidden = false; if (msg) $("loginErr").textContent = msg;
}
$("logout").onclick = () => logout(); $("logoutM").onclick = () => logout();

// ---------- load ----------
async function load() {
  D = await api("/api/rco/pregled");
  D.najmovi.forEach((b) => { b._v = veh(b.vehicle_id); });
}
async function start() {
  $("login").hidden = true; $("app").hidden = false;
  try { await load(); }
  catch (e) { if (e.message !== "auth") { $("view").innerHTML = `<div class="loading"><p>${esc(e.message)}</p></div>`; if (/agencij/.test(e.message)) setTimeout(() => logout(e.message), 50); } return; }
  $("agName").textContent = D.agencija.naziv; $("agNameM").textContent = D.agencija.naziv; $("meEmail").textContent = D.korisnik || "";
  $("agLink").href = `/r/${D.agencija.slug}`;
  const h = location.hash.slice(1); if (PAGES[h]) view = h;
  render();
}
async function refresh(keep) { await load(); render(); if (keep) keep(); }

// ---------- navigation ----------
const PAGES = {
  pregled: { t: "Pregled", i: "home", r: renderOverview },
  najmovi: { t: "Zahtjevi i najmovi", n: "Zahtjevi", s: "Zahtjevi", i: "inbox", r: renderBookings },
  kalendar: { t: "Kalendar", i: "cal", r: renderCalendar },
  vozila: { t: "Vozni park", s: "Vozila", i: "car", r: renderFleet },
  klijenti: { t: "Klijenti", i: "users", r: renderClients },
  postavke: { t: "Postavke", i: "cog", r: renderSettings, side: true },
};
function go(v) { view = v; history.replaceState(null, "", "#" + v); render(); window.scrollTo(0, 0); }
function render() {
  const pend = D.najmovi.filter((b) => b.status === "na_cekanju").length;
  const nav = (mobile) => Object.entries(PAGES).filter(([k, p]) => !(mobile && p.side)).map(([k, p]) =>
    `<button data-go="${k}" ${view === k ? 'aria-current="page"' : ""}>${ic(p.i)}${mobile ? `<span>${p.s || p.t}</span>${k === "najmovi" && pend ? '<i class="dot"></i>' : ""}` : `${p.n || p.t}${k === "najmovi" && pend ? `<span class="cnt">${pend}</span>` : ""}`}</button>`).join("");
  $("sideNav").innerHTML = nav(false); $("botNav").innerHTML = nav(true);
  PAGES[view].r();
}
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]"); if (g) { go(g.dataset.go); return; }
  const o = e.target.closest("[data-open]"); if (o) { openBooking(o.dataset.open); return; }
  const v = e.target.closest("[data-veh]"); if (v) { openVehicle(v.dataset.veh); return; }
  const c = e.target.closest("[data-client]"); if (c) { openClient(c.dataset.client); return; }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

// ---------- shared rows ----------
function bookingRow(b, extra = "") {
  return `<div class="li" data-open="${b.id}">
    <div class="av">${esc(initials(name(b)))}</div>
    <div class="t"><b>${esc(name(b))} · ${esc(vname(b._v))}</b><small>${dRange(b)} · ${dana(b.days || 1)}${extra}</small></div>
    <div class="r"><b class="num">${b.status === "blokirano" ? "" : money(b.price_total)}</b>${badge(b)}</div></div>`;
}

// ---------- 1. overview ----------
function renderOverview() {
  const now = Date.now(), t = todayKey(), tm = addDays(t, 1);
  const N = D.najmovi, active = D.vozila.filter((v) => v.active);
  const pend = N.filter((b) => b.status === "na_cekanju").sort((a, b) => a.start_at.localeCompare(b.start_at));
  const outs = N.filter((b) => counted(b) && parts(b.start_at).key === t), ins = N.filter((b) => counted(b) && parts(b.end_at).key === t);
  const onRoad = new Set(N.filter((b) => ["u_najmu", "kasni"].includes(st(b, now))).map((b) => b.vehicle_id));
  const late = N.filter((b) => st(b, now) === "kasni"), waiting = N.filter((b) => st(b, now) === "ceka_preuzimanje");
  const p0 = parts(new Date().toISOString());
  const monthKey = (iso) => { const p = parts(iso); return p.y * 12 + p.m - 1; };
  const curM = p0.y * 12 + p0.m - 1;
  const revM = (m) => N.filter((b) => counted(b) && monthKey(b.start_at) === m).reduce((s, b) => s + Number(b.price_total || 0), 0);
  // utilisation over the last 30 days
  const from = now - 30 * DAY;
  const used = N.filter((b) => counted(b)).reduce((s, b) => s + Math.max(0, Math.min(now, +new Date(b.end_at)) - Math.max(from, +new Date(b.start_at))), 0);
  const util = active.length ? Math.round(used / (30 * DAY * active.length) * 100) : 0;
  const events = [];
  for (const b of N.filter(counted)) {
    const s = st(b, now);
    if (s === "kasni") { events.push({ b, iso: b.end_at, kind: "in", day: "Kasni", late: true }); continue; }
    if (s === "ceka_preuzimanje" && parts(b.start_at).key < t) { events.push({ b, iso: b.start_at, kind: "out", day: "Čeka", late: true }); continue; }
    if (!b.picked_up_at && [t, tm].includes(parts(b.start_at).key)) events.push({ b, iso: b.start_at, kind: "out", day: parts(b.start_at).key === t ? "Danas" : "Sutra" });
    if (b.picked_up_at && !b.returned_at && [t, tm].includes(parts(b.end_at).key)) events.push({ b, iso: b.end_at, kind: "in", day: parts(b.end_at).key === t ? "Danas" : "Sutra" });
    if (b.returned_at && parts(b.returned_at).key === t) events.push({ b, iso: b.returned_at, kind: "in", day: "Vraćeno", done: true });
    if (b.picked_up_at && parts(b.picked_up_at).key === t && !b.returned_at) events.push({ b, iso: b.picked_up_at, kind: "out", day: "Preuzeto", done: true });
  }
  events.sort((a, b) => (b.late ? 1 : 0) - (a.late ? 1 : 0) || (a.done ? 1 : 0) - (b.done ? 1 : 0) || a.iso.localeCompare(b.iso));
  const months = Array.from({ length: 6 }, (_, i) => curM - 5 + i);
  const maxRev = Math.max(1, ...months.map(revM));

  $("view").innerHTML = `
  <div class="ph"><div><h1>Dobar dan 👋</h1><p>${WD[p0.wd]}, ${p0.d}. ${MONL[p0.m - 1]} ${p0.y}. · ${esc(D.agencija.naziv)}</p></div>
    <div class="acts"><button class="btn ghost" data-go="kalendar">${ic("cal")}Kalendar</button><button class="btn primary" id="addManual">${ic("plus")}Blokada / ručni najam</button></div></div>
  <div class="kpis">
    <div class="card kpi hot click" data-go="najmovi"><span>Čeka Vašu odluku</span><b class="num">${pend.length}</b><small>${pend.length ? "zahtjeva za rezervaciju" : "sve je riješeno"}</small></div>
    <div class="card kpi ${late.length ? "alert" : ""}"><span>Danas preuzimanja</span><b class="num">${outs.length}</b><small>${late.length ? `<b style="color:var(--red)">${late.length} ${plural(late.length, "vozilo kasni", "vozila kasne", "vozila kasni")} s vraćanjem</b>` : `${ins.length} ${plural(ins.length, "vraćanje", "vraćanja", "vraćanja")} danas`}</small></div>
    <div class="card kpi click" data-go="vozila"><span>Trenutno u najmu</span><b class="num">${onRoad.size}<span style="font-size:1rem;color:var(--ink-3);font-weight:500"> / ${active.length}</span></b><small>iskorištenost 30 dana: ${util}%</small></div>
    <div class="card kpi"><span>Prihod (${MONL[p0.m - 1]})</span><b class="num">${money(revM(curM))}</b><small>potvrđeni najmovi s početkom ovaj mjesec</small></div>
  </div>
  <div class="cols">
    <div class="card"><div class="card-h"><h2>Zahtjevi koji čekaju</h2><button class="link" data-go="najmovi">Svi zahtjevi →</button></div>
      <div class="list">${pend.length ? pend.slice(0, 6).map((b) => bookingRow(b, ` · ${SRC[b.source] || b.source}`)).join("") : '<div class="empty">Nema novih zahtjeva. Kad kupac pošalje zahtjev, pojavit će se ovdje.</div>'}</div></div>
    <div class="card"><div class="card-h"><h2>Danas i sutra</h2><span style="font-size:12px;color:var(--ink-3)">preuzimanja i vraćanja</span></div>
      <div class="list">${events.length ? events.map((e) => `<div class="li ${e.late ? "late" : ""} ${e.done ? "done" : ""}" data-open="${e.b.id}">
        <div class="av ${e.done ? "" : e.kind === "out" ? "up" : "down"}">${e.done ? ic("check") : ic(e.kind === "out" ? "up" : "down")}</div>
        <div class="t"><b>${e.done ? (e.kind === "out" ? "Preuzeto" : "Vraćeno") : e.kind === "out" ? "Preuzimanje" : "Vraćanje"} · ${esc(vname(e.b._v))}</b><small>${esc(name(e.b))} · ${e.late ? (e.kind === "in" ? "trebalo vratiti " : "trebalo preuzeti ") + dShort(e.iso) + " " + parts(e.iso).hm : esc(locName(e.kind === "out" ? e.b.pickup_location : e.b.dropoff_location))}</small></div>
        ${e.done ? `<div class="r"><b class="num">${parts(e.iso).hm}</b></div>` : `<button class="btn sm ${e.late ? "danger" : "primary"} quick" data-hand="${e.kind === "out" ? "preuzeto" : "vraceno"}" data-id="${e.b.id}">${e.kind === "out" ? "Preuzeto" : "Vraćeno"}</button>`}
        <div class="r hide-s"><b class="num">${parts(e.iso).hm}</b><small style="color:${e.late ? "var(--red)" : "var(--ink-3)"};font-size:12px">${e.day}</small></div></div>`).join("") : '<div class="empty">Danas i sutra nema preuzimanja ni vraćanja.</div>'}</div></div>
  </div>
  <div class="card"><div class="card-h"><h2>Prihod po mjesecima</h2><span style="font-size:12px;color:var(--ink-3)">potvrđeni najmovi</span></div>
    <div class="chart">${months.map((m) => { const r = revM(m); return `<div class="${m === curM ? "cur" : ""}"><b class="num">${r ? money(r) : "—"}</b><i style="height:${Math.max(4, Math.round(r / maxRev * 100))}px"></i><small>${MON[m % 12]}</small></div>`; }).join("")}</div></div>`;
  $("addManual").onclick = () => openManual();
  wireQuick($("view"));
}

// Quick "Preuzeto" / "Vraćeno" buttons (overview list and fleet cards).
function wireQuick(root) {
  root.querySelectorAll("[data-hand]").forEach((btn) => (btn.onclick = async (e) => {
    e.stopPropagation(); btn.disabled = true;
    try { await post(btn.dataset.hand, { id: btn.dataset.id }); toast(btn.dataset.hand === "preuzeto" ? "Vozilo je označeno kao preuzeto." : "Vozilo je vraćeno i ponovo je slobodno."); await refresh(); }
    catch (err) { toast(err.message); btn.disabled = false; }
  }));
}

// ---------- 2. bookings ----------
const FILTERS = [
  ["na_cekanju", "Na čekanju", (b) => b.status === "na_cekanju"],
  ["aktivni", "Potvrđeni", (b) => ["predstoji", "ceka_preuzimanje"].includes(st(b))],
  ["najam", "U najmu", (b) => ["u_najmu", "kasni"].includes(st(b))],
  ["zavrseni", "Završeni", (b) => ["vraceno", "nije_preuzeto"].includes(st(b))],
  ["odbijeni", "Odbijeni i otkazani", (b) => ["odbijeno", "otkazano"].includes(b.status)],
  ["blokade", "Blokade", (b) => b.status === "blokirano"],
  ["svi", "Svi", () => true],
];
function renderBookings() {
  const f = FILTERS.find((x) => x[0] === ui.filter) || FILTERS[0];
  const q = ui.q.trim().toLowerCase();
  let rows = D.najmovi.filter(f[2]).filter((b) => !q || [b.ref, name(b), b.email, b.phone, vname(b._v)].join(" ").toLowerCase().includes(q));
  rows.sort((a, b) => ["na_cekanju", "aktivni", "najam"].includes(ui.filter) ? a.start_at.localeCompare(b.start_at) : b.start_at.localeCompare(a.start_at));
  $("view").innerHTML = `
  <div class="ph"><div><h1>Zahtjevi i najmovi</h1><p>Sve rezervacije s web stranice, WhatsAppa i Instagrama na jednom mjestu.</p></div>
    <div class="acts"><button class="btn primary" id="addManual">${ic("plus")}Blokada / ručni najam</button></div></div>
  <div class="tools"><div class="chips">${FILTERS.map(([k, l, fn]) => `<button class="chip" data-f="${k}" aria-pressed="${k === ui.filter}">${l}<em>${D.najmovi.filter(fn).length}</em></button>`).join("")}</div>
    <label class="search">${ic("search")}<input id="q" placeholder="Traži ime, broj, email, vozilo…" value="${esc(ui.q)}"></label></div>
  <div class="card tblwrap">${rows.length ? `<table class="tbl"><thead><tr><th>Broj</th><th>Kupac</th><th>Vozilo</th><th>Termin</th><th class="r">Iznos</th><th>Izvor</th><th>Status</th></tr></thead><tbody>
    ${rows.map((b) => `<tr data-open="${b.id}">
      <td class="hide-m num" style="font-weight:600">${esc(b.ref)}</td>
      <td class="who"><b>${esc(name(b))}</b><small>${esc(b.phone || b.email || "")}</small></td>
      <td>${esc(vname(b._v))}</td>
      <td class="num">${dRange(b)}<br><small style="color:var(--ink-3)">${dana(b.days || 1)}</small></td>
      <td class="r num" style="font-weight:600">${b.status === "blokirano" ? "—" : money(b.price_total)}</td>
      <td class="hide-m"><span class="src">${SRC[b.source] || esc(b.source)}</span></td>
      <td>${badge(b)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty" style="border:0">Nema ničega za prikaz.</div>`}</div>`;
  document.querySelectorAll("[data-f]").forEach((x) => (x.onclick = () => { ui.filter = x.dataset.f; renderBookings(); }));
  const qi = $("q"); qi.oninput = () => { ui.q = qi.value; clearTimeout(qi.t); qi.t = setTimeout(() => { const pos = qi.selectionStart; renderBookings(); const n = $("q"); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
  $("addManual").onclick = () => openManual();
}

// ---------- 3. calendar ----------
function renderCalendar() {
  const days = window.innerWidth < 700 ? 10 : 21;
  if (!ui.calStart) ui.calStart = addDays(todayKey(), -2);
  const s0 = ui.calStart, t = todayKey();
  const startMs = new Date(s0 + "T00:00:00Z").getTime();
  // day boundaries in local time: use UTC-midnight grid shifted by the agency offset at the start
  const off = (() => { const p = parts(new Date(startMs).toISOString()); return Date.UTC(p.y, p.m - 1, p.d, +p.hm.slice(0, 2), +p.hm.slice(3)) - startMs; })();
  const t0 = startMs - off, t1 = t0 + days * DAY;
  const keys = Array.from({ length: days }, (_, i) => addDays(s0, i));
  const pct = (ms) => ((ms - t0) / (t1 - t0)) * 100;
  const bars = (v) => D.najmovi.filter((b) => b.vehicle_id === v.id && ["na_cekanju", "odobreno", "blokirano"].includes(b.status) && realEnd(b) > t0 && +new Date(b.start_at) < t1)
    .map((b) => { const l = Math.max(0, pct(+new Date(b.picked_up_at || b.start_at))), r = Math.min(100, pct(realEnd(b)));
      return `<div class="g-bar ${st(b)}" data-open="${b.id}" style="left:calc(${l}% + 2px);width:calc(${r - l}% - 4px)" title="${esc(name(b))} · ${dRange(b)}">${esc(b.status === "blokirano" ? (b.note || "Blokada") : name(b))}</div>`; }).join("");
  const nowPct = pct(Date.now());
  const label = (() => { const a = parts(new Date(t0 + 12 * 3600e3).toISOString()), z = parts(new Date(t1 - 12 * 3600e3).toISOString()); return `${a.d}. ${MON[a.m - 1]} – ${z.d}. ${MON[z.m - 1]} ${z.y}.`; })();
  const grid = keys.map((k) => { const wd = new Date(k + "T12:00:00Z").getUTCDay(); return `<i class="${wd === 0 || wd === 6 ? "we" : ""}"></i>`; }).join("");
  $("view").innerHTML = `
  <div class="ph"><div><h1>Kalendar</h1><p>${label}</p></div>
    <div class="acts"><button class="iconbtn" id="cPrev" aria-label="Ranije">${ic("back")}</button><button class="btn ghost sm" id="cToday" style="height:38px">Danas</button><button class="iconbtn" id="cNext" aria-label="Kasnije">${ic("next")}</button>
    <button class="btn primary" id="addManual">${ic("plus")}Blokada / ručni najam</button></div></div>
  <div class="card gantt" style="--days:${days}">
    <div class="g-head"><div class="g-name">Vozilo</div><div class="g-days">${keys.map((k) => { const d = new Date(k + "T12:00:00Z"), wd = d.getUTCDay(); return `<div class="${wd === 0 || wd === 6 ? "we" : ""} ${k === t ? "td" : ""}">${WD[wd]}<b>${d.getUTCDate()}.${d.getUTCMonth() + 1}.</b></div>`; }).join("")}</div></div>
    ${D.vozila.map((v) => `<div class="g-row"><div class="g-name" data-veh="${v.id}"><b>${esc(vname(v))}</b><small>${v.active ? esc(v.category) + " · " + (v.transmission === "automatic" ? "automatik" : "manuelni") : "isključeno"}</small></div>
      <div class="g-track">${grid}${bars(v)}${nowPct > 0 && nowPct < 100 ? `<div class="g-now" style="left:${nowPct}%"></div>` : ""}</div></div>`).join("")}
  </div>
  <div class="legend"><span><i style="background:var(--amber-soft);border:1px dashed #f5d48a"></i>Na čekanju</span><span><i style="background:var(--green-soft);border:1px solid #b7e6a0"></i>Potvrđeno</span><span><i style="background:#efe9ff;border:1px solid #d4c4fb"></i>Čeka preuzimanje</span><span><i style="background:var(--blue-soft);border:1px solid #b8cbfb"></i>U najmu</span><span><i style="background:var(--red-soft);border:1px solid #f4b4ad"></i>Kasni</span><span><i style="background:var(--gray-soft);border:1px solid var(--line-2)"></i>Vraćeno</span><span><i style="background:repeating-linear-gradient(135deg,#e2e8f0 0 3px,#f1f5f9 3px 6px)"></i>Blokada</span></div>`;
  $("cPrev").onclick = () => { ui.calStart = addDays(ui.calStart, -7); renderCalendar(); };
  $("cNext").onclick = () => { ui.calStart = addDays(ui.calStart, 7); renderCalendar(); };
  $("cToday").onclick = () => { ui.calStart = null; renderCalendar(); };
  $("addManual").onclick = () => openManual();
}

// ---------- 4. fleet ----------
function vehicleStats(v) {
  const rs = D.najmovi.filter((b) => b.vehicle_id === v.id && counted(b));
  const done = rs.filter((b) => b.picked_up_at);
  return { count: done.length, days: done.reduce((s, b) => s + (b.days || 0), 0), revenue: done.reduce((s, b) => s + Number(b.price_total || 0), 0), all: rs };
}
function vehicleNow(v) {
  const now = Date.now();
  const out = D.najmovi.find((b) => b.vehicle_id === v.id && b.status === "odobreno" && b.picked_up_at && !b.returned_at);
  if (out) return st(out) === "kasni" ? `<b style="color:var(--red)">Kasni s vraćanjem</b> · trebalo ${dShort(out.end_at)} ${parts(out.end_at).hm} · ${esc(name(out))}` : `<b>U najmu</b> do ${dShort(out.end_at)} ${parts(out.end_at).hm} · ${esc(name(out))}`;
  const cur = D.najmovi.find((b) => b.vehicle_id === v.id && b.status === "blokirano" && +new Date(b.start_at) <= now && +new Date(b.end_at) > now);
  if (cur) return `<b>Blokirano</b> do ${dShort(cur.end_at)} ${parts(cur.end_at).hm}`;
  const wait = D.najmovi.find((b) => b.vehicle_id === v.id && st(b) === "ceka_preuzimanje");
  if (wait) return `<b style="color:var(--amber)">Čeka preuzimanje</b> · ${esc(name(wait))} od ${parts(wait.start_at).hm}`;
  const next = D.najmovi.filter((b) => b.vehicle_id === v.id && ["odobreno", "na_cekanju", "blokirano"].includes(b.status) && +new Date(b.start_at) > now).sort((a, b) => a.start_at.localeCompare(b.start_at))[0];
  return `<b>Slobodno</b>${next ? ` · sljedeće: ${rel(next.start_at)}` : ""}`;
}
function renderFleet() {
  $("view").innerHTML = `
  <div class="ph"><div><h1>Vozni park</h1><p>${D.vozila.filter((v) => v.active).length} aktivnih od ${D.vozila.length} vozila · klik na „Historija najma“ za sve dosadašnje kupce vozila.</p></div></div>
  <div class="fleet">${D.vozila.map((v) => { const s = vehicleStats(v); return `<div class="card veh">
    <div class="pic">${carPic(v)}${v.featured ? '<span class="st predstoji">Preporuka</span>' : ""}${v.active ? "" : '<span class="st off">Isključeno</span>'}</div>
    <div class="body"><div><h3>${esc(vname(v))}</h3><div class="meta">${v.year || ""} · ${esc(v.category)} · ${v.transmission === "automatic" ? "automatik" : "manuelni"} · ${esc(v.fuel)} · od ${money(fromPrice(v.price_tiers))}/dan</div></div>
      <div class="stats"><div><span>Najmova</span><b class="num">${s.count}</b></div><div><span>Dana u najmu</span><b class="num">${s.days}</b></div><div><span>Prihod</span><b class="num">${money(s.revenue)}</b></div></div>
      <div class="now">${vehicleNow(v)}</div>
      <div class="row"><button class="btn dark sm" data-veh="${v.id}">Historija najma</button><button class="btn ghost sm" data-edit="${v.id}">Uredi</button></div></div></div>`; }).join("")}</div>`;
  document.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); openEditVehicle(b.dataset.edit); }));
}

// ---------- 5. clients ----------
const clientKey = (b) => (b.email || "").toLowerCase() || (b.phone || "").replace(/\D/g, "") || name(b).toLowerCase();
function clients() {
  const map = new Map();
  for (const b of D.najmovi.filter(isRental)) {
    if (!b.first_name && !b.last_name) continue;
    const k = clientKey(b);
    const c = map.get(k) || { key: k, name: name(b), email: b.email, phone: b.phone, lang: b.lang, rentals: [], total: 0, last: null };
    c.rentals.push(b);
    if (counted(b)) c.total += Number(b.price_total || 0);
    if (!c.last || b.start_at > c.last) { c.last = b.start_at; c.name = name(b); c.phone = b.phone || c.phone; c.email = b.email || c.email; }
    map.set(k, c);
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last));
}
function renderClients() {
  const q = ui.clientQ.trim().toLowerCase();
  const list = clients().filter((c) => !q || [c.name, c.email, c.phone].join(" ").toLowerCase().includes(q));
  $("view").innerHTML = `
  <div class="ph"><div><h1>Klijenti</h1><p>Svi koji su slali zahtjev ili iznajmljivali kod Vas, s historijom najmova.</p></div></div>
  <div class="tools"><label class="search" style="margin-left:0">${ic("search")}<input id="cq" placeholder="Traži ime, email ili telefon…" value="${esc(ui.clientQ)}"></label></div>
  <div class="card tblwrap">${list.length ? `<table class="tbl"><thead><tr><th>Klijent</th><th>Kontakt</th><th class="r">Najmova</th><th class="r">Ukupno</th><th>Zadnji najam</th><th>Vozila</th></tr></thead><tbody>
    ${list.map((c) => { const done = c.rentals.filter(counted).length; return `<tr data-client="${esc(c.key)}">
      <td class="who"><b>${esc(c.name)}</b><small>${LANG[c.lang] || ""}</small></td>
      <td class="hide-m">${esc(c.phone || "")}<br><small style="color:var(--ink-3)">${esc(c.email || "")}</small></td>
      <td class="r num">${done}${c.rentals.length > done ? `<small style="color:var(--ink-3)"> / ${c.rentals.length}</small>` : ""}</td>
      <td class="r num" style="font-weight:600">${money(c.total)}</td>
      <td class="num">${dShort(c.last)}</td>
      <td class="hide-m">${[...new Set(c.rentals.map((b) => vname(b._v)))].map((n) => `<span class="tag">${esc(n)}</span>`).join("")}</td></tr>`; }).join("")}</tbody></table>` : '<div class="empty" style="border:0">Nema klijenata za prikaz.</div>'}</div>`;
  const qi = $("cq"); qi.oninput = () => { ui.clientQ = qi.value; clearTimeout(qi.t); qi.t = setTimeout(() => { const pos = qi.selectionStart; renderClients(); const n = $("cq"); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
}

// ---------- 6. settings ----------
function renderSettings() {
  const s = D.agencija.postavke, c = s.contact || {}, h = s.hours || { open: "08:00", close: "20:00" };
  const times = Array.from({ length: 48 }, (_, i) => `${String(i >> 1).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const sel = (id, v) => `<select class="inp" id="${id}">${times.map((t) => `<option ${t === v ? "selected" : ""}>${t}</option>`).join("")}</select>`;
  const n = (id, label, v, hint) => `<label class="f">${label}<input class="inp num" id="${id}" type="number" inputmode="numeric" value="${v ?? ""}">${hint ? `<small style="color:var(--ink-3);font-weight:400">${hint}</small>` : ""}</label>`;
  const site = `${location.origin}/r/${D.agencija.slug}`;
  $("view").innerHTML = `
  <div class="ph"><div><h1>Postavke</h1><p>Promjene se odmah vide na Vašoj stranici i u odgovorima Hostia.</p></div><div class="acts"><button class="btn primary" id="save">Sačuvaj promjene</button></div></div>
  <div class="settings">
    <div class="card"><h2>Vaša stranica</h2><p class="h">Ovaj link šaljite kupcima ili ga stavite na Instagram profil.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input class="inp" readonly value="${esc(site)}" style="flex:1;min-width:220px"><button class="btn ghost" id="copy">Kopiraj</button><a class="btn ghost" href="${esc(site)}" target="_blank" rel="noopener">${ic("ext")}Otvori</a></div></div>
    <div class="card"><h2>Radno vrijeme i pravila</h2><p class="h">Van radnog vremena preuzimanje i vraćanje imaju doplatu.</p>
      <div class="settings grid3" style="max-width:none">
        <label class="f">Otvara${sel("hOpen", h.open)}</label><label class="f">Zatvara${sel("hClose", h.close)}</label>
        ${n("afterFee", `Doplata van radnog vremena (${cur()})`, s.after_hours_fee)}
        ${n("buffer", "Razmak između najmova (sati)", s.buffer_hours)}
        ${n("minAge", "Najmanja starost vozača", s.min_age)}
        ${n("licYears", "Vozačka najmanje (godina)", s.license_years)}
        ${n("cancelH", "Besplatno otkazivanje (sati prije)", s.cancellation_hours)}
        ${n("minDays", "Najkraći najam (dana)", s.min_days || 1)}
      </div></div>
    <div class="card"><h2>Kontakt</h2><p class="h">Prikazuje se na stranici; WhatsApp broj koristi dugme za poruke.</p>
      <div class="grid2">
        <label class="f">Telefon<input class="inp" id="cPhone" value="${esc(c.phone || "")}"></label>
        <label class="f">WhatsApp (s pozivnim, bez +)<input class="inp" id="cWa" inputmode="numeric" value="${esc(c.whatsapp || "")}"></label>
        <label class="f">Email<input class="inp" id="cEmail" type="email" value="${esc(c.email || "")}"></label>
        <label class="f">Adresa<input class="inp" id="cAddr" value="${esc(c.address || "")}"></label>
      </div></div>
    <div class="card"><h2>Lokacije i dodatna oprema</h2><p class="h">Za izmjene lokacija i dodatne opreme javite se Hostio podršci.</p>
      <div>${(s.locations || []).map((l) => `<span class="tag">${esc(nm(l.name))}${l.fee ? " +" + money(l.fee) : ""}</span>`).join("")}</div>
      <div style="margin-top:8px">${(s.extras || []).map((x) => `<span class="tag">${esc(nm(x.name))} · ${money(x.price)}/${x.per === "dan" ? "dan" : "najam"}</span>`).join("")}</div></div>
  </div>`;
  $("copy").onclick = async () => { try { await navigator.clipboard.writeText(site); toast("Link je kopiran."); } catch { toast(site); } };
  $("save").onclick = async () => {
    const btn = $("save"); btn.disabled = true;
    try {
      const r = await post("postavke", {
        hours: { open: $("hOpen").value, close: $("hClose").value }, after_hours_fee: $("afterFee").value, buffer_hours: $("buffer").value,
        min_age: $("minAge").value, license_years: $("licYears").value, cancellation_hours: $("cancelH").value, min_days: $("minDays").value,
        contact: { phone: $("cPhone").value, whatsapp: $("cWa").value, email: $("cEmail").value, address: $("cAddr").value },
      });
      D.agencija.postavke = r.postavke; toast("Postavke su sačuvane.");
    } catch (e) { toast(e.message); }
    btn.disabled = false;
  };
}

// ---------- drawer / modal ----------
function closeAll() { document.querySelectorAll(".ov,.drawer,.modal").forEach((el) => { el.classList.remove("in"); setTimeout(() => el.remove(), 250); }); }
function drawer(title, body, foot = "") {
  const hadDrawer = !!document.querySelector(".drawer");
  closeAll();
  const ov = document.createElement("div"); ov.className = "ov"; ov.onclick = closeAll;
  const d = document.createElement("div"); d.className = "drawer"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true");
  d.innerHTML = `<div class="d-top"><h2>${title}</h2><button class="iconbtn" aria-label="Zatvori" id="dClose">${ic("x")}</button></div><div class="d-body">${body}</div>${foot ? `<div class="d-foot">${foot}</div>` : ""}`;
  const show = () => { document.body.append(ov, d); requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add("in"); d.classList.add("in"); })); };
  if (hadDrawer) setTimeout(show, 260); else show();
  d.querySelector("#dClose").onclick = closeAll;
  return d;
}
function modal(html) {
  document.querySelectorAll(".modal").forEach((m) => m.remove());
  const m = document.createElement("div"); m.className = "modal"; m.setAttribute("role", "dialog"); m.innerHTML = html;
  if (!document.querySelector(".ov")) { const ov = document.createElement("div"); ov.className = "ov"; ov.onclick = closeAll; document.body.append(ov); requestAnimationFrame(() => ov.classList.add("in")); }
  document.body.append(m); requestAnimationFrame(() => m.classList.add("in"));
  return m;
}
function confirmBox(title, text, okLabel, danger, withNote) {
  return new Promise((resolve) => {
    const m = modal(`<h2>${title}</h2><p>${text}</p>${withNote ? `<label class="f">Napomena (vidite samo Vi)<textarea class="inp" id="mNote" maxlength="1000"></textarea></label>` : ""}
      <div class="acts"><button class="btn ghost" id="mNo">Odustani</button><button class="btn ${danger ? "danger" : "primary"}" id="mYes">${okLabel}</button></div>`);
    const done = (v) => { m.classList.remove("in"); setTimeout(() => m.remove(), 200); if (!document.querySelector(".drawer")) closeAll(); resolve(v); };
    m.querySelector("#mNo").onclick = () => done(null);
    m.querySelector("#mYes").onclick = () => done({ note: m.querySelector("#mNote")?.value || "" });
  });
}

// WhatsApp / email text for the customer, in their language.
function customerMessage(b) {
  const v = vname(b._v), when = `${dShort(b.start_at)} ${parts(b.start_at).hm} – ${dShort(b.end_at)} ${parts(b.end_at).hm}`, ag = D.agencija.naziv, n = b.first_name || "";
  const ok = b.status === "odobreno";
  const T = {
    bs: ok ? `Poštovani ${n}, Vaša rezervacija ${b.ref} (${v}, ${when}) je potvrđena. Preuzimanje: ${locName(b.pickup_location)}. Plaćanje je na licu mjesta. Vidimo se! ${ag}` : `Poštovani ${n}, nažalost ne možemo potvrditi Vaš zahtjev ${b.ref} (${v}, ${when}). Rado ćemo Vam ponuditi drugo vozilo ili termin. ${ag}`,
    en: ok ? `Dear ${n}, your booking ${b.ref} (${v}, ${when}) is confirmed. Pick-up: ${locName(b.pickup_location)}. Payment is made on pick-up. See you soon! ${ag}` : `Dear ${n}, unfortunately we cannot confirm your request ${b.ref} (${v}, ${when}). We would be happy to offer another car or dates. ${ag}`,
    de: ok ? `Guten Tag ${n}, Ihre Buchung ${b.ref} (${v}, ${when}) ist bestätigt. Abholung: ${locName(b.pickup_location)}. Bezahlt wird bei der Abholung. Bis bald! ${ag}` : `Guten Tag ${n}, leider können wir Ihre Anfrage ${b.ref} (${v}, ${when}) nicht bestätigen. Gerne bieten wir Ihnen ein anderes Auto oder einen anderen Zeitraum an. ${ag}`,
    ar: ok ? `مرحبًا ${n}، تم تأكيد حجزك ${b.ref} (${v}، ${when}). الاستلام: ${locName(b.pickup_location)}. الدفع عند الاستلام. نراك قريبًا! ${ag}` : `مرحبًا ${n}، للأسف لا يمكننا تأكيد طلبك ${b.ref} (${v}، ${when}). يسعدنا أن نقترح عليك سيارة أو موعدًا آخر. ${ag}`,
  };
  return T[b.lang] || T.bs;
}

function openBooking(id) {
  const b = D.najmovi.find((x) => x.id === id); if (!b) return;
  const v = b._v, s = st(b), lines = Array.isArray(b.price_breakdown) ? b.price_breakdown : [];
  const label = (l) => l.key === "najam" ? `Najam: ${dana(l.days)} × ${money(l.perDay)}` : l.key === "dodatak" ? extraName(l.id) : l.key === "preuzimanje" ? `Preuzimanje: ${locName(l.id)}` : l.key === "vracanje" ? `Vraćanje: ${locName(l.id)}` : l.key === "van_radnog_preuzimanje" ? "Preuzimanje van radnog vremena" : l.key === "van_radnog_vracanje" ? "Vraćanje van radnog vremena" : l.key;
  const phone = String(b.phone || "").replace(/\D/g, "");
  const age = b.birth_date ? Math.floor((new Date(b.start_at) - new Date(b.birth_date)) / (365.25 * DAY)) : null;
  const block = b.status === "blokirano";
  const body = `
    <div class="card sec"><div class="hero"><div class="pic">${carPic(v)}</div><div><b>${esc(vname(v))}</b><small>${v.year || ""} · ${esc(v.category || "")}</small><div style="margin-top:6px">${badge(b)}</div></div></div></div>
    <div class="card sec"><h3>Termin</h3><div class="kv">
      <span>Preuzimanje</span><b>${dFull(b.start_at)}${b.pickup_location ? `<br><small style="color:var(--ink-2);font-weight:400">${esc(locName(b.pickup_location))}</small>` : ""}</b>
      <span>Vraćanje</span><b>${dFull(b.end_at)}${b.dropoff_location ? `<br><small style="color:var(--ink-2);font-weight:400">${esc(locName(b.dropoff_location))}</small>` : ""}${b.planned_end_at && b.planned_end_at !== b.end_at ? `<br><small style="color:var(--ink-3);font-weight:400">dogovoreno: ${dFull(b.planned_end_at)}</small>` : ""}</b>
      <span>Trajanje</span><b>${dana(b.days || 1)}</b>
      ${b.flight_number ? `<span>Let</span><b>${esc(b.flight_number)}</b>` : ""}</div></div>
    ${block ? (b.note ? `<div class="card sec"><h3>Razlog</h3>${esc(b.note)}</div>` : "") : `
    <div class="card sec"><h3>Kupac</h3><div class="kv">
      <span>Ime i prezime</span><b><button data-client="${esc(clientKey(b))}" style="font-weight:500;text-decoration:underline">${esc(name(b))}</button></b>
      ${b.phone ? `<span>Telefon</span><b>${esc(b.phone)}</b>` : ""}
      ${b.email ? `<span>Email</span><b>${esc(b.email)}</b>` : ""}
      ${b.birth_date ? `<span>Datum rođenja</span><b>${esc(b.birth_date.split("-").reverse().join("."))}.${age ? ` (${age} god.)` : ""}</b>` : ""}
      ${b.license_number ? `<span>Broj vozačke</span><b>${esc(b.license_number)}</b>` : ""}
      ${b.lang ? `<span>Jezik</span><b>${LANG[b.lang] || esc(b.lang)}</b>` : ""}
      <span>Izvor</span><b>${SRC[b.source] || esc(b.source)}</b>
      <span>Poslano</span><b>${dFull(b.created_at)}</b></div>
      <div class="contact">${phone ? `<a class="btn ghost sm" href="https://wa.me/${phone}" target="_blank" rel="noopener">${ic("chat")}WhatsApp</a><a class="btn ghost sm" href="tel:+${phone}">${ic("phone")}Pozovi</a>` : ""}${b.email ? `<a class="btn ghost sm" href="mailto:${esc(b.email)}">${ic("mail")}Email</a>` : ""}</div></div>
    ${b.note ? `<div class="note-box"><b>Napomena kupca:</b> ${esc(b.note)}</div>` : ""}
    ${b.source !== "vlasnik" ? `<div class="card sec"><h3>Vozačka dozvola</h3><div class="lic">
      <button data-lic="prednja" ${b.ima_prednju ? "" : "disabled"}>${b.ima_prednju ? `${ic("id")}Prednja strana<small style="color:var(--ink-3)">klik za prikaz</small>` : '<span class="none">Nema fotografije</span>'}</button>
      <button data-lic="zadnja" ${b.ima_zadnju ? "" : "disabled"}>${b.ima_zadnju ? `${ic("id")}Zadnja strana<small style="color:var(--ink-3)">klik za prikaz</small>` : '<span class="none">Nema fotografije</span>'}</button></div>
      <small style="display:block;margin-top:8px;color:var(--ink-3)">Fotografije vidite samo Vi. Link za prikaz traje 5 minuta.</small></div>` : ""}
    ${b.price_total != null ? `<div class="card sec"><h3>Obračun</h3><div class="lines">${lines.map((l) => `<div><span>${esc(label(l))}</span><b class="num">${money(l.total)}</b></div>`).join("")}
      <div class="tot"><span>Ukupno</span><b class="num">${money(b.price_total)}</b></div></div>
      ${b.deposit ? `<small style="display:block;margin-top:8px;color:var(--ink-2)">Depozit pri preuzimanju: <b>${money(b.deposit)}</b> · plaćanje na licu mjesta</small>` : ""}</div>` : ""}`}
    ${b.status === "odobreno" ? handoverHtml(b) : ""}
    <div class="card sec"><h3>Interna napomena</h3><textarea class="inp" id="ownNote" maxlength="1000" placeholder="Vidite samo Vi, npr. dogovor s kupcem…">${esc(b.owner_note || "")}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn ghost sm" id="saveNote">Sačuvaj napomenu</button></div></div>`;
  let foot = "";
  if (b.status === "na_cekanju") foot = `<button class="btn danger" id="aNo">Odbij</button><button class="btn primary" id="aYes">Odobri zahtjev</button>`;
  else if (["predstoji", "ceka_preuzimanje"].includes(s)) foot = `<button class="btn danger" id="aCancel">Otkaži</button>${phone ? `<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(customerMessage(b))}">${ic("chat")}Potvrda kupcu</a>` : ""}<button class="btn primary" data-hand2="preuzeto">${ic("up")}Preuzeto</button>`;
  else if (["u_najmu", "kasni"].includes(s)) foot = `<button class="btn primary" data-hand2="vraceno">${ic("down")}Vozilo vraćeno</button>`;
  else if (b.status === "odbijeno" && phone) foot = `<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${phone}?text=${encodeURIComponent(customerMessage(b))}">${ic("chat")}Javi kupcu na WhatsApp</a>`;
  else if (block && +new Date(b.end_at) > Date.now()) foot = `<button class="btn danger" id="aCancel">${ic("trash")}Ukloni blokadu</button>`;
  const d = drawer(`${block ? "Blokada" : "Zahtjev"} ${esc(b.ref)}`, body, foot);
  const wire = () => {
    d.querySelectorAll("[data-lic]").forEach((btn) => (btn.onclick = async () => {
      btn.innerHTML = '<div class="spin"></div>';
      try {
        const r = await api(`/api/rco/dozvola?id=${b.id}&strana=${btn.dataset.lic}`);
        if (r.pdf) { window.open(r.url, "_blank", "noopener"); btn.innerHTML = `${ic("id")}PDF otvoren`; }
        else { btn.innerHTML = `<img src="${esc(r.url)}" alt="Vozačka dozvola, ${btn.dataset.lic} strana">`; btn.onclick = () => window.open(r.url, "_blank", "noopener"); }
      } catch (e) { btn.innerHTML = `<span class="none">${esc(e.message)}</span>`; }
    }));
    const sn = d.querySelector("#saveNote");
    if (sn) sn.onclick = async () => { try { await post("napomena", { id: b.id, napomena: d.querySelector("#ownNote").value }); b.owner_note = d.querySelector("#ownNote").value; toast("Napomena je sačuvana."); } catch (e) { toast(e.message); } };
    d.querySelectorAll("[data-hand2]").forEach((btn) => (btn.onclick = async () => {
      const t = d.querySelector("#handTime")?.value;
      btn.disabled = true;
      try {
        await post(btn.dataset.hand2, { id: b.id, ...(t ? { vrijeme: t } : {}) });
        toast(btn.dataset.hand2 === "preuzeto" ? "Vozilo je označeno kao preuzeto." : "Vozilo je vraćeno i ponovo je slobodno.");
        await refresh(() => openBooking(id));
      } catch (e) { toast(e.message); btn.disabled = false; }
    }));
    const undo = d.querySelector("#undoHand");
    if (undo) undo.onclick = async () => {
      const ok = await confirmBox("Poništiti zadnji korak?", b.returned_at ? "Vozilo će ponovo biti označeno kao u najmu." : "Vozilo više neće biti označeno kao preuzeto.", "Poništi", true, false);
      if (!ok) return;
      try { await post("ponisti", { id: b.id }); toast("Poništeno."); await refresh(() => openBooking(id)); } catch (e) { toast(e.message); }
    };
    const yes = d.querySelector("#aYes"), no = d.querySelector("#aNo"), cancel = d.querySelector("#aCancel");
    if (yes) yes.onclick = async () => {
      yes.disabled = true;
      try { await post("odluka", { id: b.id, odluka: "odobri", napomena: d.querySelector("#ownNote")?.value }); toast("Zahtjev je odobren."); await refresh(() => openBooking(id)); }
      catch (e) { toast(e.message); yes.disabled = false; }
    };
    if (no) no.onclick = async () => {
      const ok = await confirmBox("Odbiti zahtjev?", `Vozilo ${esc(vname(v))} će ponovo biti slobodno za ${dRange(b)}.`, "Odbij zahtjev", true, false);
      if (!ok) return;
      try { await post("odluka", { id: b.id, odluka: "odbij", napomena: d.querySelector("#ownNote")?.value }); toast("Zahtjev je odbijen."); await refresh(() => openBooking(id)); } catch (e) { toast(e.message); }
    };
    if (cancel) cancel.onclick = async () => {
      const ok = await confirmBox(block ? "Ukloniti blokadu?" : "Otkazati najam?", block ? "Vozilo će ponovo biti slobodno u tom periodu." : `Najam ${esc(b.ref)} (${esc(name(b))}) bit će otkazan i vozilo ponovo slobodno. Kupca obavijestite sami.`, block ? "Ukloni" : "Otkaži najam", true, false);
      if (!ok) return;
      try { await post("otkazi", { id: b.id }); toast(block ? "Blokada je uklonjena." : "Najam je otkazan."); await refresh(); closeAll(); } catch (e) { toast(e.message); }
    };
  };
  wire();
}

// Hand-over card: when the customer took the car and brought it back.
function handoverHtml(b) {
  const s = st(b), step = (done, label, iso, planned) => `<div class="step ${done ? "ok" : ""}"><i>${done ? ic("check") : ""}</i><div><b>${label}</b><small>${done ? dFull(iso) : "planirano " + dFull(planned)}</small></div></div>`;
  const plannedEnd = b.planned_end_at || b.end_at;
  let note = "";
  if (b.returned_at && b.planned_end_at) {
    const diffH = Math.round((new Date(b.returned_at) - new Date(b.planned_end_at)) / 3600e3);
    if (diffH >= 1) note = `<div class="note-box" style="background:var(--red-soft);color:var(--red)">Vraćeno ${diffH} h kasnije od dogovorenog.</div>`;
    else if (diffH <= -1) note = `<div class="note-box" style="background:var(--green-soft);color:var(--green-dark)">Vraćeno ranije, vozilo je od tada slobodno za nove rezervacije.</div>`;
  }
  if (s === "kasni") note = `<div class="note-box" style="background:var(--red-soft);color:var(--red)">Vozilo je trebalo biti vraćeno ${dFull(b.end_at)}. Dok ga ne označite kao vraćeno, ostaje zauzeto na stranici.</div>`;
  const pickable = ["predstoji", "ceka_preuzimanje", "u_najmu", "kasni"].includes(s);
  return `<div class="card sec"><h3>Predaja vozila</h3><div class="steps">
      ${step(!!b.picked_up_at, "Preuzeto", b.picked_up_at, b.start_at)}${step(!!b.returned_at, "Vraćeno", b.returned_at, plannedEnd)}</div>
    ${note}
    ${pickable ? `<details class="when"><summary>Upiši drugo vrijeme</summary><input class="inp" id="handTime" type="datetime-local" max="${new Date(Date.now() + 864e5).toISOString().slice(0, 16)}"><small>Ako ne upišete, uzima se trenutno vrijeme.</small></details>` : ""}
    ${b.picked_up_at ? `<button class="link-btn" id="undoHand">Poništi zadnji korak</button>` : ""}</div>`;
}

function historyRow(b, showCar) {
  return `<div class="li" data-open="${b.id}"><div class="av">${esc(initials(showCar ? vname(b._v) : name(b)))}</div>
    <div class="t"><b>${esc(showCar ? vname(b._v) : name(b))}</b><small>${dRange(b)} · ${dana(b.days || 1)}${!showCar && b.phone ? " · " + esc(b.phone) : ""}</small></div>
    <div class="r"><b class="num">${money(b.price_total)}</b>${badge(b)}</div></div>`;
}

function openVehicle(vid) {
  const v = veh(vid), s = vehicleStats(v);
  const all = D.najmovi.filter((b) => b.vehicle_id === v.id && isRental(b)).sort((a, b) => b.start_at.localeCompare(a.start_at));
  const coming = all.filter((b) => ["na_cekanju", ...ACTIVE].includes(st(b)));
  const past = all.filter((b) => ["vraceno", "nije_preuzeto"].includes(st(b)));
  const other = all.filter((b) => ["odbijeno", "otkazano"].includes(b.status));
  const people = new Set(past.map(clientKey)).size;
  const avg = s.count ? Math.round(s.days / s.count * 10) / 10 : 0;
  const dv = drawer(`Historija · ${esc(vname(v))}`, `
    <div class="card sec"><div class="hero"><div class="pic">${carPic(v)}</div><div><b>${esc(vname(v))}</b><small>${v.year || ""} · ${esc(v.category)} · ${v.transmission === "automatic" ? "automatik" : "manuelni"}</small><div class="now" style="margin-top:6px;font-size:12.5px">${vehicleNow(v)}</div></div></div></div>
    <div class="minis"><div class="card mini"><span>Završenih najmova</span><b class="num">${s.count}</b></div><div class="card mini"><span>Različitih kupaca</span><b class="num">${people}</b></div><div class="card mini"><span>Prihod</span><b class="num">${money(s.revenue)}</b></div></div>
    <div class="minis"><div class="card mini"><span>Dana u najmu</span><b class="num">${s.days}</b></div><div class="card mini"><span>Prosječan najam</span><b class="num">${avg} d</b></div><div class="card mini"><span>Odbijeno / otkazano</span><b class="num">${other.length}</b></div></div>
    ${coming.length ? `<div class="card"><div class="card-h"><h2>Trenutni i predstojeći</h2></div><div class="hist">${coming.map((b) => historyRow(b, false)).join("")}</div></div>` : ""}
    <div class="card"><div class="card-h"><h2>Prethodni kupci (${past.length})</h2></div><div class="hist">${past.length ? past.map((b) => historyRow(b, false)).join("") : '<div class="empty" style="border:0">Ovo vozilo još nije iznajmljivano.</div>'}</div></div>
    ${other.length ? `<div class="card"><div class="card-h"><h2>Odbijeni i otkazani</h2></div><div class="hist">${other.map((b) => historyRow(b, false)).join("")}</div></div>` : ""}`,
    `<button class="btn ghost" data-editv="${v.id}">Uredi vozilo</button><button class="btn dark" id="vCal">${ic("cal")}Kalendar</button>`);
  dv.querySelector("[data-editv]").addEventListener("click", () => openEditVehicle(v.id));
  dv.querySelector("#vCal").addEventListener("click", () => { closeAll(); go("kalendar"); });
}

function openClient(key) {
  const c = clients().find((x) => x.key === key); if (!c) return;
  const rs = [...c.rentals].sort((a, b) => b.start_at.localeCompare(a.start_at));
  const phone = String(c.phone || "").replace(/\D/g, "");
  const done = rs.filter(counted);
  drawer(esc(c.name), `
    <div class="card sec"><div class="hero"><div class="av" style="width:56px;height:56px;font-size:16px">${esc(initials(c.name))}</div><div><b>${esc(c.name)}</b><small>${esc(c.phone || "")}${c.email ? " · " + esc(c.email) : ""}</small></div></div>
      <div class="contact">${phone ? `<a class="btn ghost sm" href="https://wa.me/${phone}" target="_blank" rel="noopener">${ic("chat")}WhatsApp</a><a class="btn ghost sm" href="tel:+${phone}">${ic("phone")}Pozovi</a>` : ""}${c.email ? `<a class="btn ghost sm" href="mailto:${esc(c.email)}">${ic("mail")}Email</a>` : ""}</div></div>
    <div class="minis"><div class="card mini"><span>Najmova</span><b class="num">${done.length}</b></div><div class="card mini"><span>Dana ukupno</span><b class="num">${done.reduce((s, b) => s + (b.days || 0), 0)}</b></div><div class="card mini"><span>Potrošeno</span><b class="num">${money(c.total)}</b></div></div>
    <div class="card"><div class="card-h"><h2>Svi zahtjevi i najmovi</h2></div><div class="hist">${rs.map((b) => historyRow(b, true)).join("")}</div></div>`);
}

function openEditVehicle(vid) {
  const v = veh(vid);
  let tiers = [...(v.price_tiers || [])].sort((a, b) => a.od - b.od).map((t) => ({ ...t }));
  const tierHtml = () => tiers.map((t, i) => `<div class="tier"><label class="f">Od dana<input class="inp num" data-t="${i}" data-k="od" type="number" min="1" value="${t.od}" ${i === 0 ? "readonly" : ""}></label>
    <label class="f">Cijena po danu (${cur()})<input class="inp num" data-t="${i}" data-k="cijena" type="number" min="1" step="0.5" value="${t.cijena}"></label>
    <button class="iconbtn" data-rm="${i}" ${i === 0 ? "disabled style='opacity:.3'" : ""} aria-label="Ukloni">${ic("trash")}</button></div>`).join("");
  const d = drawer(`Uredi · ${esc(vname(v))}`, `
    <div class="card sec"><div class="hero"><div class="pic">${carPic(v)}</div><div><b>${esc(vname(v))}</b><small>${v.year || ""} · ${esc(v.engine || "")}</small></div></div></div>
    <div class="card sec"><h3>Prikaz</h3>
      <label class="switch"><span><b>Aktivno</b><small>Vozilo se prikazuje na stranici i može se rezervisati.</small></span><input type="checkbox" id="vAct" ${v.active ? "checked" : ""}></label>
      <label class="switch"><span><b>Preporuka</b><small>Istaknuto na početku stranice.</small></span><input type="checkbox" id="vFeat" ${v.featured ? "checked" : ""}></label></div>
    <div class="card sec"><h3>Cijene po trajanju najma</h3><div class="tiers" id="tiers">${tierHtml()}</div>
      <button class="btn ghost sm" id="addTier" style="margin-top:10px">${ic("plus")}Dodaj cjenovni razred</button></div>
    <div class="card sec"><h3>Depozit</h3><label class="f">Iznos depozita (${cur()})<input class="inp num" id="vDep" type="number" min="0" value="${v.deposit ?? 0}"></label></div>
    <div class="err" id="vErr"></div>`, `<button class="btn ghost" id="vCancel">Odustani</button><button class="btn primary" id="vSave">Sačuvaj</button>`);
  {
    const box = d.querySelector("#tiers");
    const rewire = () => {
      box.innerHTML = tierHtml();
      box.querySelectorAll("[data-t]").forEach((inp) => (inp.oninput = () => { tiers[+inp.dataset.t][inp.dataset.k] = Number(inp.value); }));
      box.querySelectorAll("[data-rm]").forEach((b) => (b.onclick = () => { tiers.splice(+b.dataset.rm, 1); rewire(); }));
    };
    rewire();
    d.querySelector("#addTier").onclick = () => { const last = tiers[tiers.length - 1]; tiers.push({ od: (last?.od || 1) + 3, cijena: Math.max(1, Math.round((last?.cijena || 50) * 0.9)) }); rewire(); };
    d.querySelector("#vCancel").onclick = closeAll;
    d.querySelector("#vSave").onclick = async () => {
      d.querySelector("#vErr").textContent = "";
      try {
        const r = await post("vozilo", { id: v.id, active: d.querySelector("#vAct").checked, featured: d.querySelector("#vFeat").checked, price_tiers: tiers, deposit: d.querySelector("#vDep").value });
        Object.assign(v, r.vozilo); toast("Vozilo je sačuvano."); closeAll(); render();
      } catch (e) { d.querySelector("#vErr").textContent = e.message; }
    };
  }
}

function openManual() {
  const t = todayKey();
  const times = Array.from({ length: 48 }, (_, i) => `${String(i >> 1).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
  const tsel = (id, v) => `<select class="inp" id="${id}">${times.map((x) => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  let kind = "blokada";
  const m = modal(`<h2>Blokada ili ručni najam</h2><p>Blokada zatvara vozilo (servis, popravka). Ručni najam je najam dogovoren telefonom ili u poslovnici.</p>
    <div class="seg2"><button data-k="blokada" aria-pressed="true">Blokada</button><button data-k="najam" aria-pressed="false">Ručni najam</button></div>
    <label class="f">Vozilo<select class="inp" id="mVeh">${D.vozila.map((v) => `<option value="${v.id}">${esc(vname(v))}${v.active ? "" : " (isključeno)"}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">Od<input class="inp" id="mOd" type="date" value="${t}"></label><label class="f">Vrijeme${tsel("mOdT", "08:00")}</label>
      <label class="f">Do<input class="inp" id="mDo" type="date" value="${addDays(t, 1)}"></label><label class="f">Vrijeme${tsel("mDoT", "18:00")}</label></div>
    <div id="mCust" hidden><div class="grid2"><label class="f">Ime<input class="inp" id="mIme"></label><label class="f">Prezime<input class="inp" id="mPrez"></label>
      <label class="f">Telefon<input class="inp" id="mTel" inputmode="tel"></label><label class="f">Email<input class="inp" id="mMail" type="email"></label></div>
      <label class="f" style="margin-top:10px">Dogovorena cijena (${cur()})<input class="inp num" id="mCij" type="number" min="0"></label></div>
    <label class="f">Napomena<input class="inp" id="mNote" placeholder="npr. Redovni servis"></label>
    <div class="err" id="mErr"></div>
    <div class="acts"><button class="btn ghost" id="mNo">Odustani</button><button class="btn primary" id="mYes">Sačuvaj</button></div>`);
  m.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { kind = b.dataset.k; m.querySelectorAll("[data-k]").forEach((x) => x.setAttribute("aria-pressed", x === b)); m.querySelector("#mCust").hidden = kind !== "najam"; }));
  m.querySelector("#mNo").onclick = closeAll;
  m.querySelector("#mYes").onclick = async () => {
    const g = (id) => m.querySelector("#" + id).value;
    try {
      const r = await post("rucno", { vrsta: kind, vozilo: g("mVeh"), od: `${g("mOd")}T${g("mOdT")}`, do: `${g("mDo")}T${g("mDoT")}`, napomena: g("mNote"), ime: g("mIme"), prezime: g("mPrez"), telefon: g("mTel"), email: g("mMail"), cijena: g("mCij") });
      closeAll(); toast(kind === "najam" ? `Najam ${r.ref} je upisan.` : "Blokada je upisana."); await refresh();
    } catch (e) { m.querySelector("#mErr").textContent = e.message; }
  };
}

// ---------- boot ----------
sess = store.get("hostio_rc_sess");
if (sess) start(); else $("login").hidden = false;
setInterval(() => { if (sess && !document.hidden && !document.querySelector(".drawer,.modal")) refresh().catch(() => {}); }, 60000);
