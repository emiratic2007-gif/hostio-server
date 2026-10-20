// Hostio · shared behaviour for the sub-pages: mobile menu, FAQ accordion, reveal on scroll.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const yr = $("#yr"); if (yr) yr.textContent = new Date().getFullYear();

  const burger = $("#burger"), mmenu = $("#mmenu");
  function setMenu(open) {
    document.body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open ? "true" : "false");
    burger.setAttribute("aria-label", open ? "Zatvori meni" : "Otvori meni");
    mmenu.setAttribute("aria-hidden", open ? "false" : "true");
    document.documentElement.style.overflow = open ? "hidden" : "";
  }
  if (burger && mmenu) {
    burger.addEventListener("click", () => setMenu(!document.body.classList.contains("menu-open")));
    $$("a", mmenu).forEach(a => a.addEventListener("click", () => setMenu(false)));
    addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
    addEventListener("resize", () => { if (innerWidth > 900) setMenu(false); });
  }

  $$(".q button").forEach(b => b.addEventListener("click", () => {
    const q = b.parentElement, open = q.classList.contains("open");
    $$(".q.open").forEach(x => x.classList.remove("open"));
    if (!open) q.classList.add("open");
    b.setAttribute("aria-expanded", open ? "false" : "true");
  }));

  if (!("IntersectionObserver" in window)) { document.documentElement.classList.add("no-io"); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { threshold: .12, rootMargin: "0px 0px -6% 0px" });
  $$(".rv").forEach((el, i) => { el.style.transitionDelay = (el.dataset.d || 0) + "ms"; io.observe(el); });
})();
