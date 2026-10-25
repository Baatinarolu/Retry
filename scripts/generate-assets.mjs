import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const out = new URL("../public/", import.meta.url);
await mkdir(out, { recursive: true });
const file = (name) => new URL(name, out).pathname;

// A typographic print mark: paper, ink, and one restrained moss accent.
const logo = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect x="10" y="10" width="492" height="492" fill="#efeadf" stroke="#262923" stroke-width="20"/>
  <rect x="42" y="42" width="428" height="428" fill="none" stroke="#b9b3a5" stroke-width="2"/>
  <path d="M74 98h38M74 98v38M438 98h-38M438 98v38M74 414h38M74 414v-38M438 414h-38M438 414v-38" fill="none" stroke="#5d6b50" stroke-width="6"/>
  <text x="256" y="300" text-anchor="middle" fill="#262923" font-family="Georgia, 'Times New Roman', serif" font-size="210" letter-spacing="-24">TM</text>
  <path d="M116 354h280" stroke="#b9b3a5" stroke-width="3"/>
  <path d="M126 388l54-30 48 15 62-49 44 20 54-42" fill="none" stroke="#5d6b50" stroke-width="10" stroke-linecap="square" stroke-linejoin="miter"/>
  <path d="M366 302h22v22" fill="none" stroke="#5d6b50" stroke-width="8"/>
</svg>`;

const empty = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect x="12" y="12" width="488" height="488" fill="#efeadf" stroke="#c8c1b2" stroke-width="3"/>
  <path d="M70 110h146c18 0 32 14 32 32v254c0-18-14-32-32-32H70z" fill="#f8f4ea" stroke="#353831" stroke-width="5"/>
  <path d="M442 110H296c-18 0-32 14-32 32v254c0-18 14-32 32-32h146z" fill="#f8f4ea" stroke="#353831" stroke-width="5"/>
  <path d="M256 142v254" stroke="#353831" stroke-width="5"/>
  <path d="M98 160h112M98 190h94M98 220h112M98 250h78M98 312h112M98 342h84" stroke="#c8c1b2" stroke-width="5"/>
  <path d="M294 162h116M294 192h82" stroke="#c8c1b2" stroke-width="5"/>
  <path d="M296 318V230M296 318h116M296 282h116M296 254h116" fill="none" stroke="#d5cfc1" stroke-width="3"/>
  <path d="M304 300l26-24 22 12 26-42 28 14" fill="none" stroke="#5d6b50" stroke-width="7" stroke-linecap="square" stroke-linejoin="miter"/>
  <path d="M106 398l244 34" stroke="#a96f4b" stroke-width="13" stroke-linecap="square"/>
  <path d="M350 432l30 5-26-19z" fill="#353831"/>
</svg>`;

const og = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#efeadf"/>
  <path d="M64 54h1072M64 576h1072" stroke="#aaa496" stroke-width="2"/>
  <path d="M64 86h170" stroke="#5d6b50" stroke-width="8"/>
  <text x="1110" y="86" text-anchor="end" fill="#62645c" font-family="Arial, sans-serif" font-size="18" letter-spacing="4">AN INDEPENDENT TRADING JOURNAL</text>
  <rect x="70" y="174" width="284" height="284" fill="none" stroke="#262923" stroke-width="8"/>
  <rect x="88" y="192" width="248" height="248" fill="none" stroke="#b9b3a5" stroke-width="2"/>
  <text x="212" y="358" text-anchor="middle" fill="#262923" font-family="Georgia, 'Times New Roman', serif" font-size="142" letter-spacing="-18">TM</text>
  <path d="M112 406l40-24 34 12 42-34 30 16 50-34" fill="none" stroke="#5d6b50" stroke-width="8"/>
  <text x="424" y="252" fill="#262923" font-family="Georgia, 'Times New Roman', serif" font-size="102">TradeMind</text>
  <text x="430" y="334" fill="#5d6b50" font-family="Georgia, 'Times New Roman', serif" font-size="45" font-style="italic">Review with intent.</text>
  <path d="M430 374h630" stroke="#b9b3a5" stroke-width="2"/>
  <text x="430" y="424" fill="#555850" font-family="Arial, sans-serif" font-size="25">Performance, psychology, and risk—on the record.</text>
  <text x="70" y="544" fill="#62645c" font-family="Arial, sans-serif" font-size="18" letter-spacing="3">PROCESS OVER PREDICTION</text>
  <text x="1110" y="544" text-anchor="end" fill="#62645c" font-family="Arial, sans-serif" font-size="18" letter-spacing="3">RECORD / REVIEW / REFINE</text>
</svg>`;

await sharp(Buffer.from(logo)).png().toFile(file("logo.png"));
await sharp(Buffer.from(logo)).resize(192, 192).png().toFile(file("icon-192.png"));
await sharp(Buffer.from(logo)).resize(512, 512).png().toFile(file("icon-512.png"));
await sharp(Buffer.from(empty)).png().toFile(file("empty-journal.png"));
await sharp(Buffer.from(og)).png().toFile(file("og-image.png"));
// hero-desk.jpg is a curated editorial photograph and is intentionally preserved.
console.log("Generated editorial brand, empty-state, and PWA assets.");
