import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const out = new URL("../public/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (name) => new URL(name, out).pathname;

const logo = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#172033"/><stop offset="1" stop-color="#070b14"/></linearGradient>
    <linearGradient id="line" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <rect x="16" y="16" width="480" height="480" rx="112" fill="url(#bg)" stroke="#33415f" stroke-width="4"/>
  <path d="M104 334V190M104 190h70M104 334h70M408 178v144M408 322h-70" fill="none" stroke="#8b9bb4" stroke-opacity=".32" stroke-width="12" stroke-linecap="round"/>
  <path d="M112 320l72-68 62 35 130-145" fill="none" stroke="url(#line)" stroke-width="22" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
  <path d="M337 142h39v39" fill="none" stroke="#2dd4bf" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="184" cy="252" r="14" fill="#e8eef9"/><circle cx="246" cy="287" r="14" fill="#e8eef9"/>
</svg>`;

const empty = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#172033"/><stop offset="1" stop-color="#0d1320"/></linearGradient></defs>
  <rect width="512" height="512" rx="80" fill="url(#b)"/>
  <circle cx="256" cy="236" r="170" fill="#2dd4bf" opacity=".05"/>
  <path d="M138 118h176c34 0 60 26 60 60v216H198c-34 0-60-26-60-60V118z" fill="#121a2b" stroke="#33415f" stroke-width="8"/>
  <path d="M198 394c-34 0-60-26-60-60V118c0-34 26-60 60-60v336z" fill="#172033" stroke="#33415f" stroke-width="8"/>
  <path d="M228 180h96M228 218h72M228 300l34-28 30 18 48-52" fill="none" stroke="#2dd4bf" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M104 164v168" stroke="#38bdf8" stroke-width="10" stroke-linecap="round"/>
</svg>`;

const hero = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#101b2d"/><stop offset=".55" stop-color="#070b14"/><stop offset="1" stop-color="#102a2c"/></linearGradient>
    <linearGradient id="chart" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="18" stdDeviation="20" flood-color="#000" flood-opacity=".45"/></filter>
  </defs>
  <rect width="1200" height="700" fill="url(#bg)"/>
  <circle cx="1040" cy="70" r="360" fill="#2dd4bf" opacity=".06"/><circle cx="130" cy="60" r="280" fill="#38bdf8" opacity=".05"/>
  <path d="M0 580h1200v120H0z" fill="#090e18"/><path d="M0 580h1200" stroke="#33415f" stroke-width="3"/>
  <g filter="url(#shadow)">
    <rect x="110" y="86" width="700" height="420" rx="24" fill="#0d1320" stroke="#33415f" stroke-width="4"/>
    <rect x="136" y="116" width="648" height="330" rx="12" fill="#111a2a"/>
    <path d="M136 166h648" stroke="#243049" stroke-width="3"/>
    <circle cx="162" cy="141" r="7" fill="#f87171"/><circle cx="185" cy="141" r="7" fill="#fbbf24"/><circle cx="208" cy="141" r="7" fill="#34d399"/>
    <path d="M176 390V206M176 390h568M176 322h568M176 254h568" stroke="#243049" stroke-width="2"/>
    <path d="M188 360l70-58 56 24 72-92 62 32 80-58 66 22 96-74 74 34" fill="none" stroke="url(#chart)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <g stroke-width="6"><path d="M280 242v96" stroke="#34d399"/><path d="M262 260h36v48h-36z" fill="#34d399"/><path d="M440 198v112" stroke="#f87171"/><path d="M422 220h36v58h-36z" fill="#f87171"/><path d="M596 168v94" stroke="#34d399"/><path d="M578 184h36v50h-36z" fill="#34d399"/></g>
    <rect x="366" y="476" width="190" height="20" rx="8" fill="#243049"/><path d="M460 506v60M330 566h260" stroke="#33415f" stroke-width="16" stroke-linecap="round"/>
  </g>
  <g filter="url(#shadow)" transform="rotate(-5 920 390)">
    <rect x="830" y="172" width="270" height="370" rx="18" fill="#e8eef9"/>
    <rect x="830" y="172" width="270" height="62" rx="18" fill="#2dd4bf"/><rect x="830" y="210" width="270" height="24" fill="#2dd4bf"/>
    <text x="866" y="213" fill="#04221d" font-family="Arial,sans-serif" font-size="25" font-weight="700">TRADE LOG</text>
    <path d="M876 276h178M876 318h178M876 360h178M876 402h178M876 444h132" stroke="#8b9bb4" stroke-width="8" stroke-linecap="round"/>
    <path d="M862 270v190" stroke="#f87171" stroke-width="4" opacity=".65"/>
  </g>
  <g filter="url(#shadow)"><ellipse cx="112" cy="580" rx="72" ry="24" fill="#05070c"/><path d="M60 466h104l-12 112H72z" fill="#172033" stroke="#33415f" stroke-width="4"/><path d="M164 492c56-4 56 64-4 62" fill="none" stroke="#33415f" stroke-width="14"/><ellipse cx="112" cy="466" rx="52" ry="14" fill="#8b5e3c"/></g>
  <path d="M712 590l264-26" stroke="#38bdf8" stroke-width="16" stroke-linecap="round"/><path d="M976 564l42-4-36 28z" fill="#e8eef9"/>
</svg>`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#070b14"/><stop offset="1" stop-color="#123134"/></linearGradient><linearGradient id="l" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#2dd4bf"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#bg)"/><circle cx="1050" cy="80" r="380" fill="#2dd4bf" opacity=".07"/>
  <path d="M90 470V160M90 470h450" stroke="#33415f" stroke-width="5"/><path d="M120 408l96-78 78 42 178-170" fill="none" stroke="url(#l)" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/><path d="M414 202h58v58" fill="none" stroke="#2dd4bf" stroke-width="20" stroke-linecap="round"/>
  <text x="620" y="245" fill="#e8eef9" font-family="Arial,sans-serif" font-size="68" font-weight="700">TradeMind</text><text x="620" y="325" fill="#2dd4bf" font-family="Arial,sans-serif" font-size="42" font-weight="600">JOURNAL</text><text x="620" y="392" fill="#8b9bb4" font-family="Arial,sans-serif" font-size="28">Process over prediction.</text><text x="620" y="442" fill="#8b9bb4" font-family="Arial,sans-serif" font-size="24">Performance · psychology · risk</text>
</svg>`;

await sharp(Buffer.from(logo)).png().toFile(file("logo.png"));
await sharp(Buffer.from(logo)).resize(192, 192).png().toFile(file("icon-192.png"));
await sharp(Buffer.from(logo)).resize(512, 512).png().toFile(file("icon-512.png"));
await sharp(Buffer.from(empty)).png().toFile(file("empty-journal.png"));
await sharp(Buffer.from(hero)).jpeg({ quality: 88, mozjpeg: true }).toFile(file("hero-desk.jpg"));
await sharp(Buffer.from(og)).png().toFile(file("og-image.png"));
console.log("Generated local brand and PWA assets.");
