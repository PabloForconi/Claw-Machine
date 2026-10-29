// Cuts the 20 characters out of each concept sheet (concept/char_<world>.png, 5 across and 4 down, on a
// transparent background) into assets/chars/<world>/<row><col>.png: each one square, SIZE pixels, the
// character centred. The sheets have no floor shadow: the user redrew them without it (October 2026,
// 1920 × 1080, 384 × 270 px a cell), and the page draws the shadow itself. The first sheets had it baked
// in, which showed as a haze round the character when it was tinted white. All are cut at one scale:
// SIDE pixels of the sheet make the square, so they keep their sizes as drawn (the new sheets draw them
// at the old ones' size; the biggest is about 320 px wide and 260 high). The user asked for that: each
// used to be scaled to fill its own square. Run from the project folder: node tools/cut-characters.mjs
import fs from 'node:fs';
import { readPng, writePng } from './png.mjs';

// (SIZE is SIDE, the sheets' own resolution: at 220 they looked soft on the user's iPhone, drawn 222 px
// wide in the capsule's opening on a 3× screen, October 2026)
const WORLDS = ['animales', 'monstruos', 'halloween', 'navidad'], SIDE = 360, SIZE = SIDE, BASE = .88;

for (const world of WORLDS) {
  const img = readPng(fs.readFileSync(`concept/char_${world}.png`)), { w, h, px } = img;
  // The solid parts (alpha over 128), labelled into connected blobs; each character is its biggest blob
  // in its cell of the 5 × 4 grid
  const label = new Int32Array(w * h).fill(-1), blobs = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] >= 0 || px[s * 4 + 3] <= 128) continue;
    const b = { n: 0, x0: w, y0: h, x1: 0, y1: 0, sx: 0, sy: 0 }, stack = [s];
    label[s] = blobs.length;
    while (stack.length) {
      const p = stack.pop(), x = p % w, y = (p - x) / w;
      b.n++; b.sx += x; b.sy += y;
      if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
      for (const q of [p - 1, p + 1, p - w, p + w]) {
        if (q < 0 || q >= w * h || label[q] >= 0 || px[q * 4 + 3] <= 128) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === w - 1)) continue;
        label[q] = blobs.length; stack.push(q);
      }
    }
    blobs.push(b);
  }
  const cells = [];
  for (const b of blobs) {
    if (b.n < 2000) continue;
    const col = Math.min(4, Math.floor(b.sx / b.n / (w / 5))), row = Math.min(3, Math.floor(b.sy / b.n / (h / 4))), k = row * 5 + col;
    if (!cells[k] || cells[k].n < b.n) cells[k] = b;
  }
  fs.mkdirSync(`assets/chars/${world}`, { recursive: true });
  cells.forEach((b, k) => {
    // The box: SIDE square round the blob, the same for all. Every character's base (the bottom of its
    // solid part) is at BASE of the height, so they all stand at the same level in the collection.
    const side = SIDE;
    const cx = (b.x0 + b.x1) / 2, top = b.y1 + 1 - side * BASE;
    const out = Buffer.alloc(SIZE * SIZE * 4), scale = side / SIZE;
    // Area-averaged downscale with premultiplied alpha (the transparent pixels carry junk colours);
    // only this blob's own solid pixels and the faint ones around it count, not a neighbour's
    for (let oy = 0; oy < SIZE; oy++) for (let ox = 0; ox < SIZE; ox++) {
      let r = 0, g = 0, bl = 0, a = 0, n = 0;
      const sx0 = cx - side / 2 + ox * scale, sy0 = top + oy * scale;
      for (let yy = Math.floor(sy0); yy < sy0 + scale; yy++) for (let xx = Math.floor(sx0); xx < sx0 + scale; xx++) {
        n++;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const p = yy * w + xx, l = label[p];
        if (l >= 0 && blobs[l] !== b) continue;
        // (faint pixels only next to the blob: further out they are the neighbours' soft edges)
        if (l < 0 && (xx < b.x0 - 6 || xx > b.x1 + 6 || yy < b.y0 - 6 || yy > b.y1 + 6)) continue;
        const i = p * 4, al = px[i + 3] < 10 ? 0 : px[i + 3];
        r += px[i] * al; g += px[i + 1] * al; bl += px[i + 2] * al; a += al;
      }
      const o = (oy * SIZE + ox) * 4;
      if (a > 0) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = bl / a; out[o + 3] = a / n; }
    }
    fs.writeFileSync(`assets/chars/${world}/${Math.floor(k / 5)}${k % 5}.png`, writePng({ w: SIZE, h: SIZE, px: out }));
  });
  console.log(world, cells.filter(Boolean).length, 'characters');
}
