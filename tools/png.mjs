// Minimal PNG reading and writing with Node's zlib only: 8-bit RGB or RGBA, not interlaced (what the
// concept sheets and covers are). Pixels are always handed out and taken in as RGBA. Used by
// cut-characters.mjs and cut-covers.mjs.
import { inflateSync, deflateSync, crc32 } from 'node:zlib';

const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };

export function readPng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, w = 0, h = 0, bpp = 4, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 6 && data[9] !== 2) || data[12] !== 0) throw new Error('only 8-bit RGB or RGBA, not interlaced');
      bpp = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = w * bpp, rows = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? rows[dst + x - bpp] : 0, b = y ? rows[dst - stride + x] : 0, c = x >= bpp && y ? rows[dst - stride + x - bpp] : 0;
      let v = raw[src + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) v += paeth(a, b, c);
      rows[dst + x] = v & 255;
    }
  }
  if (bpp === 4) return { w, h, px: rows };
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < w * h; i++, j += 3) { px[i * 4] = rows[j]; px[i * 4 + 1] = rows[j + 1]; px[i * 4 + 2] = rows[j + 2]; px[i * 4 + 3] = 255; }
  return { w, h, px };
}

// alpha: false writes RGB (smaller, for opaque pictures). Each row gets whichever filter leaves the
// smallest values, the usual heuristic, which compresses photos and renders far better than one filter.
export function writePng({ w, h, px }, { alpha = true } = {}) {
  const chunk = (type, data) => {
    const out = Buffer.alloc(12 + data.length), td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    out.writeUInt32BE(data.length, 0); td.copy(out, 4); out.writeUInt32BE(crc32(td), 8 + data.length);
    return out;
  };
  const bpp = alpha ? 4 : 3, stride = w * bpp, src = Buffer.alloc(h * stride);
  for (let i = 0; i < w * h; i++) for (let k = 0; k < bpp; k++) src[i * bpp + k] = px[i * 4 + k];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
  const raw = Buffer.alloc(h * (stride + 1)), line = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    let best = Infinity, bestF = 0, bestLine = null;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const i = y * stride + x, a = x >= bpp ? src[i - bpp] : 0, b = y ? src[i - stride] : 0, c = x >= bpp && y ? src[i - stride - bpp] : 0;
        const v = (src[i] - [0, a, b, (a + b) >> 1, paeth(a, b, c)][f]) & 255;
        line[x] = v; sum += v < 128 ? v : 256 - v;
      }
      if (sum < best) { best = sum; bestF = f; bestLine = Buffer.from(line); }
    }
    raw[y * (stride + 1)] = bestF; bestLine.copy(raw, y * (stride + 1) + 1);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
