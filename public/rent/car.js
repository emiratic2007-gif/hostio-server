// Side-view car illustrations drawn from the vehicle's body type and colour.
// Used until the agency uploads its own photos (no third-party car photos needed).
const SHAPES = {
  hatch: {
    body: "M54 136 L48 120 Q46 106 60 100 L140 88 Q160 70 196 56 Q206 52 222 52 L286 52 Q300 52 312 60 L338 80 Q348 88 350 104 L350 128 Q350 136 342 136 L319 136 A29 29 0 0 0 261 136 L141 136 A29 29 0 0 0 83 136 Z",
    glass: "M152 88 Q170 72 200 60 Q208 57 220 57 L284 57 Q296 57 306 64 L328 82 L326 88 Z",
    pillars: [240], wheels: [112, 290], cy: 136, r: 24, head: [58, 106], tail: [346, 88], door: [182, 240, 300],
  },
  sedan: {
    body: "M50 136 L45 120 Q44 106 58 101 L142 90 Q166 70 200 58 Q210 54 226 54 L270 54 Q284 54 296 64 L322 86 L352 90 Q358 92 358 106 L358 128 Q358 136 350 136 L325 136 A29 29 0 0 0 267 136 L143 136 A29 29 0 0 0 85 136 Z",
    glass: "M154 90 Q172 74 202 62 Q210 59 222 59 L268 59 Q280 59 290 67 L312 88 Z",
    pillars: [246], wheels: [114, 296], cy: 136, r: 24, head: [56, 107], tail: [354, 96], door: [184, 246, 300],
  },
  karavan: {
    body: "M50 136 L45 120 Q44 106 58 101 L142 90 Q166 70 200 58 Q210 54 226 54 L320 54 Q334 54 340 62 L352 84 Q358 92 358 106 L358 128 Q358 136 350 136 L329 136 A29 29 0 0 0 271 136 L143 136 A29 29 0 0 0 85 136 Z",
    glass: "M154 90 Q172 74 202 62 Q210 59 222 59 L318 59 Q328 59 334 66 L344 88 Z",
    pillars: [246, 300], wheels: [114, 300], cy: 136, r: 24, head: [56, 107], tail: [354, 94], door: [184, 246, 304],
  },
  suv: {
    body: "M50 130 L46 112 Q46 98 60 94 L138 84 Q156 62 186 46 Q196 42 212 42 L310 42 Q326 42 334 52 L348 80 Q354 90 354 104 L354 124 Q354 130 346 130 L328 130 A32 32 0 0 0 264 130 L148 130 A32 32 0 0 0 84 130 Z",
    glass: "M150 84 Q166 64 190 52 Q198 48 210 48 L306 48 Q318 48 324 56 L338 84 Z",
    pillars: [238, 292], wheels: [116, 296], cy: 131, r: 27, arch: 32, bottom: 130, head: [58, 100], tail: [350, 90], door: [180, 238, 296], rails: true,
  },
  kombi: {
    body: "M42 135 L40 112 Q40 96 54 90 L92 74 Q110 40 140 32 Q150 30 164 30 L346 30 Q358 30 358 42 L358 128 Q358 135 350 135 L330 135 A30 30 0 0 0 270 135 L138 135 A30 30 0 0 0 78 135 Z",
    glass: "M100 74 Q116 44 140 38 L196 38 L196 74 Z M206 38 L270 38 L270 72 L206 72 Z M278 38 L348 38 L348 72 L278 72 Z",
    pillars: [], wheels: [108, 300], cy: 135, r: 25, arch: 30, head: [48, 100], tail: [355, 82], door: [200, 274],
  },
};

let uid = 0;
export function carSvg(v, { className = "" } = {}) {
  const s = SHAPES[v.body] || SHAPES.hatch;
  const c = /^#[0-9a-f]{6}$/i.test(v.color || "") ? v.color : "#9aa3ad";
  const light = luminance(c) > 0.75;
  const id = "c" + ++uid;
  const wheel = (x) => `
    <g transform="translate(${x} ${s.cy})">
      <circle r="${s.r}" fill="#15181c"/>
      <circle r="${s.r * 0.62}" fill="url(#${id}r)"/>
      ${[0, 72, 144, 216, 288].map((a) => `<rect x="-2" y="${-s.r * 0.58}" width="4" height="${s.r * 0.46}" rx="2" fill="#7c848f" transform="rotate(${a})"/>`).join("")}
      <circle r="${s.r * 0.18}" fill="#5b636e"/>
    </g>`;
  return `<svg class="${className}" viewBox="20 18 360 150" role="img" aria-label="${esc(v.make + " " + v.model)}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity=".04"/>
      <stop offset=".7" stop-color="#000" stop-opacity=".02"/><stop offset="1" stop-color="#000" stop-opacity=".28"/>
    </linearGradient>
    <linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#3a4656"/><stop offset=".55" stop-color="#1b222c"/><stop offset="1" stop-color="#2a3442"/>
    </linearGradient>
    <radialGradient id="${id}r"><stop offset="0" stop-color="#e9edf1"/><stop offset="1" stop-color="#a7afb9"/></radialGradient>
    <clipPath id="${id}k"><path d="${s.glass}"/></clipPath>
    <radialGradient id="${id}s"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="200" cy="${s.cy + s.r + 1}" rx="170" ry="9" fill="url(#${id}s)"/>
  ${s.rails ? `<rect x="196" y="36" width="118" height="5" rx="2.5" fill="#2a2f36"/>` : ""}
  <path d="${s.body}" fill="${c}" ${light ? 'stroke="rgba(0,0,0,.14)" stroke-width="1.2"' : ""}/>
  <path d="${s.body}" fill="url(#${id}b)"/>
  <path d="${s.glass}" fill="url(#${id}g)"/>
  <g clip-path="url(#${id}k)">${s.pillars.map((x) => `<rect x="${x}" y="30" width="6" height="64" fill="${c}"/><rect x="${x}" y="30" width="6" height="64" fill="rgba(0,0,0,.12)"/>`).join("")}</g>
  ${s.door.map((x) => `<line x1="${x}" y1="${s.cy - 46}" x2="${x}" y2="${s.cy - 6}" stroke="rgba(0,0,0,.18)" stroke-width="1.2"/>`).join("")}
  ${s.door.slice(0, -1).map((x, i) => `<rect x="${(x + s.door[i + 1]) / 2 + 8}" y="${s.cy - 40}" width="14" height="3.5" rx="1.75" fill="rgba(0,0,0,.28)"/>`).join("")}
  <rect x="${s.head[0] - 6}" y="${s.head[1] - 4}" width="20" height="8" rx="4" fill="#fdf6d8" stroke="rgba(0,0,0,.15)"/>
  <rect x="${s.tail[0] - 8}" y="${s.tail[1] - 5}" width="10" height="12" rx="3" fill="#d2333b"/>
  <rect x="44" y="${s.cy - 14}" width="${s === SHAPES.kombi ? 22 : 30}" height="6" rx="3" fill="rgba(0,0,0,.35)"/>
  ${s.wheels.map((x) => { const R = s.arch || s.r + 5, y = s.bottom || s.cy; return `<path d="M${x - R + 1} ${y} A${R - 1} ${R - 1} 0 0 1 ${x + R - 1} ${y} Z" fill="#23272d"/>`; }).join("")}
  ${s.wheels.map(wheel).join("")}
</svg>`;
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
