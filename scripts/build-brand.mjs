// Gera todos os logos e ícones do GoMob a partir de assets/branding/gomob-logo-source.webp.
// Uso: node scripts/build-brand.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const SRC = "assets/branding/gomob-logo-source.webp";
const ORANGE = { r: 253, g: 89, b: 1 }; // laranja do logo (#FD5901)

mkdirSync("public/branding", { recursive: true });
mkdirSync("public/icons", { recursive: true });

const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width;
const H = info.height;

/**
 * Fundo branco -> transparente. Para laranja sobre branco, o canal azul cai de 255 a ~0,
 * então alpha = (255 - B) / 255 recupera inclusive as bordas suavizadas.
 */
function silhouette(color, keep = () => true, solidInside = false) {
  const out = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      const o = (y * W + x) * 4;
      // miolo do pin (dentro do anel laranja) fica opaco: o ônibus aparece igual em qualquer fundo
      if (solidInside && (x - C.x) ** 2 + (y - C.y) ** 2 <= (C.r - 40) ** 2) {
        out[o] = data[i];
        out[o + 1] = data[i + 1];
        out[o + 2] = data[i + 2];
        out[o + 3] = 255;
        continue;
      }
      const a = keep(x, y) ? Math.max(0, Math.min(255, 255 - data[i + 2])) : 0;
      out[o] = color.r;
      out[o + 1] = color.g;
      out[o + 2] = color.b;
      out[o + 3] = a < 8 ? 0 : a;
    }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } });
}

// Símbolo (só o pin com o ônibus): círculo + triângulo até a ponta, sem a linha de rota.
const C = { x: 622.5, y: 454.5, r: 332.5 + 3 };
const TIP = { x: 622.5, y: 962 };
const d = TIP.y - C.y;
const phi = Math.acos(C.r / d);
const tl = { x: C.x - C.r * Math.sin(phi), y: C.y + C.r * Math.cos(phi) };
const tr = { x: C.x + C.r * Math.sin(phi), y: C.y + C.r * Math.cos(phi) };
const cross = (a, b, p) => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
function inPin(x, y) {
  if ((x - C.x) ** 2 + (y - C.y) ** 2 <= C.r ** 2) return true;
  const p = { x, y };
  const s1 = cross(tl, tr, p), s2 = cross(tr, TIP, p), s3 = cross(TIP, tl, p);
  return (s1 >= -3 && s2 >= -3 && s3 >= -3) || (s1 <= 3 && s2 <= 3 && s3 <= 3);
}

/** Recorta o conteúdo, centraliza em um quadrado com margem e exporta em PNG. */
async function square(img, size, { pad = 0.06, background = { r: 0, g: 0, b: 0, alpha: 0 } } = {}) {
  const trimmed = await img.png().toBuffer().then((b) => sharp(b).trim({ threshold: 1 }).toBuffer());
  const inner = Math.round(size * (1 - pad * 2));
  const fitted = await sharp(trimmed).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: fitted, gravity: "center" }])
    .png({ compressionLevel: 9 });
}

const WHITE_BG = { r: 255, g: 255, b: 255, alpha: 1 };
const full = () => silhouette(ORANGE, () => true, true);
const fullWhite = () => silhouette({ r: 255, g: 255, b: 255 });
const mark = () => silhouette(ORANGE, inPin, true);

const jobs = [
  // logo completo (pin + ônibus + rota)
  ["public/branding/gomob-logo-transparent.png", () => square(full(), 1024, { pad: 0.04 })],
  ["public/branding/gomob-logo-white.png", () => square(fullWhite(), 1024, { pad: 0.04 })],
  ["public/branding/gomob-logo.png", () => square(full(), 1024, { pad: 0.08, background: WHITE_BG })],
  // símbolo para tamanhos pequenos
  ["public/branding/gomob-mark.png", () => square(mark(), 512, { pad: 0.04 })],
  // ícones do app (fundo branco: legível em qualquer tela inicial)
  ["public/icons/favicon-64.png", () => square(mark(), 64, { pad: 0.04 })],
  ["public/icons/icon-192.png", () => square(full(), 192, { pad: 0.08, background: WHITE_BG })],
  ["public/icons/icon-512.png", () => square(full(), 512, { pad: 0.08, background: WHITE_BG })],
  ["public/icons/apple-touch-icon.png", () => square(full(), 180, { pad: 0.1, background: WHITE_BG })],
  // "maskable" (Android recorta em círculo): conteúdo dentro da zona segura de 80%
  ["public/icons/icon-maskable-512.png", () => square(full(), 512, { pad: 0.2, background: WHITE_BG })],
  // imagem de compartilhamento (WhatsApp, redes)
  ["public/branding/gomob-og.png", () => square(full(), 630, { pad: 0.12, background: WHITE_BG })],
];

for (const [file, make] of jobs) {
  await (await make()).toFile(file);
  console.log("ok", file);
}
await (await square(full(), 1024, { pad: 0.04 })).webp({ quality: 90 }).toFile("public/branding/gomob-logo.webp");
console.log("ok public/branding/gomob-logo.webp");

// favicon.ico com PNGs de 16, 32 e 48 px (formato ICO aceita PNG embutido)
const sizes = [16, 32, 48];
const pngs = await Promise.all(sizes.map(async (s) => (await square(mark(), s, { pad: 0.02 })).toBuffer()));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(s, 0);
  e.writeUInt8(s, 1);
  e.writeUInt8(0, 2);
  e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4);
  e.writeUInt16LE(32, 6);
  e.writeUInt32LE(pngs[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  return e;
});
writeFileSync("src/app/favicon.ico", Buffer.concat([header, ...dir, ...pngs]));
console.log("ok src/app/favicon.ico");
