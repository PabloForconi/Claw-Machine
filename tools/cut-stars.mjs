// Cuts the user's two stars (concept/estrellas.png: one with a dark outline on the left, one without on
// the right, on a transparent background) into assets/ui/star.png and assets/ui/star-plain.png, each
// trimmed to the star, centred on a transparent square and scaled to SIZE. Run from the project folder:
// node tools/cut-stars.mjs
import fs from 'node:fs';
import { readPng, writePng } from './png.mjs';

const SIZE = 128, PAD = .03;   // the output's side, and the margin round the star (a share of it)

const { w, h, px } = readPng(fs.readFileSync('concept/estrellas.png'));
fs.mkdirSync('assets/ui', { recursive: true });
for (const [name, x0, x1] of [['star', 0, w >> 1], ['star-plain', w >> 1, w]]) {
  // The star's bounding box in its half (pixels that are more than faintly visible)
  let l = x1, r = x0, t = h, b = 0;
  for (let y = 0; y < h; y++) for (let x = x0; x < x1; x++) if (px[(y * w + x) * 4 + 3] > 8) {
    l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
  }
  // A square round it, centred, with a little margin
  const side = Math.max(r - l, b - t) * (1 + 2 * PAD), cx = (l + r) / 2, cy = (t + b) / 2;
  const sx = cx - side / 2, sy = cy - side / 2, s = side / SIZE, out = Buffer.alloc(SIZE * SIZE * 4);
  // Area average with the colour weighted by alpha, so the soft edges don't go dark
  for (let oy = 0; oy < SIZE; oy++) for (let ox = 0; ox < SIZE; ox++) {
    const ax = sx + ox * s, ay = sy + oy * s, acc = [0, 0, 0, 0];
    let n = 0;
    for (let y = Math.floor(ay); y < Math.ceil(ay + s); y++) for (let x = Math.floor(ax); x < Math.ceil(ax + s); x++) {
      n++;
      if (x < x0 || x >= x1 || y < 0 || y >= h) continue;
      const i = (y * w + x) * 4, a = px[i + 3];
      acc[0] += px[i] * a; acc[1] += px[i + 1] * a; acc[2] += px[i + 2] * a; acc[3] += a;
    }
    const o = (oy * SIZE + ox) * 4;
    if (acc[3]) { out[o] = acc[0] / acc[3]; out[o + 1] = acc[1] / acc[3]; out[o + 2] = acc[2] / acc[3]; }
    out[o + 3] = acc[3] / n;
  }
  fs.writeFileSync(`assets/ui/${name}.png`, writePng({ w: SIZE, h: SIZE, px: out }));
  console.log(name, SIZE + '×' + SIZE, (fs.statSync(`assets/ui/${name}.png`).size / 1024 | 0) + ' KB');
}
