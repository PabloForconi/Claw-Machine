// Scales the worlds' covers (concept/cover_<world>.png, 1122 × 1402) down to assets/covers/<world>.png,
// W wide, for the worlds screen, the banners and the machine's back wall. Run from the project folder:
// node tools/cut-covers.mjs
import fs from 'node:fs';
import { readPng, writePng } from './png.mjs';

const WORLDS = ['animales', 'monstruos', 'halloween', 'navidad'], W = 600;

fs.mkdirSync('assets/covers', { recursive: true });
for (const world of WORLDS) {
  const { w, h, px } = readPng(fs.readFileSync(`concept/cover_${world}.png`));
  const H = Math.round(h * W / w), s = w / W, out = Buffer.alloc(W * H * 4);
  // Area average: each output pixel is the mean of the source pixels it covers
  for (let oy = 0; oy < H; oy++) for (let ox = 0; ox < W; ox++) {
    const x0 = ox * s, y0 = oy * s, acc = [0, 0, 0];
    let n = 0;
    for (let y = Math.floor(y0); y < Math.min(h, Math.ceil(y0 + s)); y++) for (let x = Math.floor(x0); x < Math.min(w, Math.ceil(x0 + s)); x++) {
      const i = (y * w + x) * 4;
      acc[0] += px[i]; acc[1] += px[i + 1]; acc[2] += px[i + 2]; n++;
    }
    const o = (oy * W + ox) * 4;
    out[o] = acc[0] / n; out[o + 1] = acc[1] / n; out[o + 2] = acc[2] / n; out[o + 3] = 255;
  }
  fs.writeFileSync(`assets/covers/${world}.png`, writePng({ w: W, h: H, px: out }, { alpha: false }));
  console.log(world, W + '×' + H, (fs.statSync(`assets/covers/${world}.png`).size / 1024 | 0) + ' KB');
}
