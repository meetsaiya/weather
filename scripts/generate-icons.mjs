// Generates PWA icons (192/512 + maskable + favicon) into public/ with no
// external image deps — pure Node zlib + a hand-written PNG encoder.
//
// Design: dark slate-900 background, sky-400 stylized "W" drawn from four
// diagonal strokes. Rounded square for the standard icon, full-bleed for
// the maskable variant.

import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, c]);
}

function encodePNG(width, height, pixels) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const offset = y * (1 + width * 4);
    scanlines[offset] = 0; // filter: None
    Buffer.from(pixels.subarray(y * width * 4, (y + 1) * width * 4)).copy(scanlines, offset + 1);
  }
  const idat = zlib.deflateSync(scanlines, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [0x0f, 0x17, 0x2a, 0xff];      // slate-900
const FG = [0x38, 0xbd, 0xf8, 0xff];      // sky-400
const CLEAR = [0, 0, 0, 0];

function makeIcon(size, { maskable = false } = {}) {
  const pixels = Buffer.alloc(size * size * 4);
  const setPixel = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = c[0]; pixels[i + 1] = c[1]; pixels[i + 2] = c[2]; pixels[i + 3] = c[3];
  };

  // Background: full-bleed for maskable, rounded square otherwise.
  const radius = maskable ? 0 : Math.floor(size * 0.22);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (radius === 0) {
        setPixel(x, y, BG);
        continue;
      }
      const dx = Math.max(0, radius - x, x - (size - 1 - radius));
      const dy = Math.max(0, radius - y, y - (size - 1 - radius));
      const outsideCorner = dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > radius;
      setPixel(x, y, outsideCorner ? CLEAR : BG);
    }
  }

  // "W" — four diagonal strokes inside a safe zone.
  const safe = maskable ? 0.55 : 0.65; // maskable needs ~80% safe zone, leave extra room
  const padding = (1 - safe) / 2;
  const left = Math.floor(size * padding);
  const right = size - 1 - left;
  const top = Math.floor(size * (padding + 0.05));
  const bottom = size - 1 - Math.floor(size * (padding + 0.05));
  const midX = Math.floor(size / 2);
  const peak1X = Math.floor(left + (midX - left) * 0.55);
  const peak2X = Math.floor(right - (right - midX) * 0.55);
  const midY = Math.floor(top + (bottom - top) * 0.55);
  const stroke = Math.max(2, Math.floor(size * 0.07));

  const drawLine = (x0, y0, x1, y1) => {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const steps = Math.max(dx, dy);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = Math.round(x0 + (x1 - x0) * t);
      const cy = Math.round(y0 + (y1 - y0) * t);
      const half = Math.floor(stroke / 2);
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          if (ox * ox + oy * oy <= half * half) setPixel(cx + ox, cy + oy, FG);
        }
      }
    }
  };

  drawLine(left, top, peak1X, bottom);
  drawLine(peak1X, bottom, midX, midY);
  drawLine(midX, midY, peak2X, bottom);
  drawLine(peak2X, bottom, right, top);

  return pixels;
}

const outDir = 'public';
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'maskable-512x512.png', size: 512, maskable: true },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
];
for (const t of targets) {
  const pixels = makeIcon(t.size, { maskable: !!t.maskable });
  const png = encodePNG(t.size, t.size, pixels);
  fs.writeFileSync(path.join(outDir, t.name), png);
  console.log(`wrote ${outDir}/${t.name} (${png.length} bytes)`);
}
