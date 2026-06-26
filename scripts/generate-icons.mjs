import { createWriteStream, mkdirSync } from "fs";
import { createDeflate } from "zlib";
import { Readable } from "stream";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/icons");
mkdirSync(OUT_DIR, { recursive: true });

function crc32(buf) {
  if (!crc32._t) {
    crc32._t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crc32._t[n] = c;
    }
  }
  let c = 0xffffffff;
  for (const b of buf) c = (c >>> 8) ^ crc32._t[(c ^ b) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const payload = Buffer.concat([t, data]);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(payload), 0);
  return Buffer.concat([len, payload, crcBuf]);
}

function deflate(buf) {
  return new Promise((res, rej) => {
    const chunks = []; const d = createDeflate({ level: 9 });
    const r = new Readable(); r.push(buf); r.push(null); r.pipe(d);
    d.on("data", c => chunks.push(c));
    d.on("end", () => res(Buffer.concat(chunks)));
    d.on("error", rej);
  });
}

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

// Correct rounded rect check
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x+w || py < y || py > y+h) return false;
  if (px < x+r && py < y+r) return (px-x-r)**2 + (py-y-r)**2 <= r*r;
  if (px > x+w-r && py < y+r) return (px-x-w+r)**2 + (py-y-r)**2 <= r*r;
  if (px < x+r && py > y+h-r) return (px-x-r)**2 + (py-y-h+r)**2 <= r*r;
  if (px > x+w-r && py > y+h-r) return (px-x-w+r)**2 + (py-y-h+r)**2 <= r*r;
  return true;
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2-x1, dy = y2-y1, len2 = dx*dx+dy*dy;
  if (len2 === 0) return Math.sqrt((px-x1)**2+(py-y1)**2);
  const t = Math.max(0, Math.min(1, ((px-x1)*dx+(py-y1)*dy)/len2));
  return Math.sqrt((px-x1-t*dx)**2+(py-y1-t*dy)**2);
}

function star4(px, py, cx, cy, outer, inner) {
  const dx = px-cx, dy = py-cy;
  const dist = Math.sqrt(dx*dx+dy*dy);
  if (dist > outer+1) return 0;
  const angle = Math.atan2(dy, dx);
  const seg = ((angle + Math.PI*10) % (Math.PI/2)) - Math.PI/4;
  const edge = inner + (outer-inner)*Math.abs(Math.cos(seg*2));
  return Math.max(0, Math.min(1, (edge-dist+0.5)));
}

function getPixel(px, py, s) {
  const radius = s * 0.20;
  const inBg = inRoundedRect(px, py, 0, 0, s-1, s-1, radius);

  if (!inBg) return { r:255, g:255, b:255 }; // outside = white

  // Violet gradient: #8b5cf6 top-left → #4c1d95 bottom-right
  const t = (px + py) / (s * 2);
  let r = lerp(139, 76, t);
  let g = lerp(92,  29, t);
  let b = lerp(246, 149, t);

  // Soft top-left highlight
  const shine = Math.max(0, 1 - (px + py) / (s * 1.1));
  r = lerp(r, 180, shine * 0.2);
  g = lerp(g, 140, shine * 0.2);
  b = lerp(b, 255, shine * 0.2);

  let alpha = 0;

  // Wand line: bottom-left to upper-right-center
  const wandW = Math.max(2, s * 0.055);
  const d = distToSegment(px, py, s*0.22, s*0.78, s*0.60, s*0.36);
  alpha = Math.max(alpha, Math.max(0, Math.min(1, (wandW/2 - d + 0.8))));

  // 4-point star at wand tip
  alpha = Math.max(alpha, star4(px, py, s*0.65, s*0.28, s*0.17, s*0.07));

  // Small sparkle bottom-right
  if (s >= 32) {
    alpha = Math.max(alpha, star4(px, py, s*0.75, s*0.70, s*0.075, s*0.030) * 0.9);
  }

  // Tiny dot top-left area
  if (s >= 48) {
    const dot = Math.sqrt((px-s*0.26)**2+(py-s*0.30)**2);
    alpha = Math.max(alpha, Math.max(0, Math.min(1, (s*0.028-dot)/2)) * 0.6);
  }

  if (alpha > 0) {
    r = lerp(r, 255, alpha);
    g = lerp(g, 255, alpha);
    b = lerp(b, 255, alpha);
  }

  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

async function createPNG(s) {
  const SIG = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(s,0); ihdr.writeUInt32BE(s,4);
  ihdr[8]=8; ihdr[9]=2;
  const IHDR = chunk("IHDR", ihdr);
  const rows = [];
  for (let y=0; y<s; y++) {
    rows.push(0);
    for (let x=0; x<s; x++) {
      const { r,g,b } = getPixel(x,y,s);
      rows.push(r,g,b);
    }
  }
  const IDAT = chunk("IDAT", await deflate(Buffer.from(rows)));
  const IEND = chunk("IEND", Buffer.alloc(0));
  return Buffer.concat([SIG, IHDR, IDAT, IEND]);
}

async function generate(size) {
  const buf = await createPNG(size);
  const path = resolve(OUT_DIR, `icon${size}.png`);
  await new Promise((res, rej) => {
    const ws = createWriteStream(path);
    ws.write(buf); ws.end();
    ws.on("finish", res); ws.on("error", rej);
  });
  console.log(`✓ icon${size}.png`);
}

console.log("Generating PromptBoost icons...\n");
await Promise.all([16,32,48,128].map(generate));
console.log("\nDone! → public/icons/");
