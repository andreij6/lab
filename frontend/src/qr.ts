// A QR code for one short string (a payment page's link), as an SVG: byte mode, error correction
// level L, versions 1 to 10 (up to 271 bytes). Written by the book (ISO/IEC 18004) and nothing
// more: ponytail: one fixed mask (pattern 0) instead of scoring all eight; every reader decodes it.

// per version at level L: total codewords, error-correction codewords per block, blocks (short), extra long blocks
const VERSIONS: [number, number, number, number][] = [[26, 7, 1, 0], [44, 10, 1, 0], [70, 15, 1, 0], [100, 20, 1, 0], [134, 26, 1, 0], [172, 18, 2, 0], [196, 20, 2, 0], [242, 24, 2, 0], [292, 30, 2, 0], [346, 18, 2, 2]];
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const VERSION_INFO = [0x07c94, 0x085bc, 0x09a99, 0x0a4d3]; // versions 7 to 10
const FORMAT_L_MASK0 = 0x77c4;

// GF(256) with the QR polynomial 0x11d
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a: number, b: number) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function ecc(data: number[], n: number): number[] {
  let gen = [1];
  for (let i = 0; i < n; i++) { const next = new Array(gen.length + 1).fill(0); for (let j = 0; j < gen.length; j++) { next[j] ^= gen[j]; next[j + 1] ^= mul(gen[j], EXP[i]); } gen = next; }
  const out = new Array(n).fill(0);
  for (const d of data) { const f = d ^ out.shift()!; out.push(0); for (let j = 0; j < n; j++) out[j] ^= mul(gen[j + 1], f); }
  return out;
}

/** The modules of the smallest code that holds `text`: true is dark. */
export function qrMatrix(text: string): boolean[][] {
  const bytes = [...new TextEncoder().encode(text)];
  const v = VERSIONS.findIndex(([total, ec, short, long], i) => total - ec * (short + long) >= bytes.length + (i >= 9 ? 3 : 2));
  if (v < 0) throw new Error("too long for a QR code here");
  const [total, ecLen, short, long] = VERSIONS[v], version = v + 1, size = version * 4 + 17;
  const dataLen = total - ecLen * (short + long);
  // the bit stream: mode 0100, count (8 bits up to version 9, 16 from 10), bytes, terminator, pad
  const bits: number[] = [];
  const push = (val: number, n: number) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(4, 4); push(bytes.length, version >= 10 ? 16 : 8); for (const b of bytes) push(b, 8);
  push(0, Math.min(4, dataLen * 8 - bits.length)); while (bits.length % 8) bits.push(0);
  const data: number[] = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(""), 2));
  for (let i = 0; data.length < dataLen; i++) data.push(i % 2 ? 0x11 : 0xec);
  // blocks: `short` of the base length, then `long` one byte longer; interleaved by column
  const blocks: number[][] = [], base = Math.floor(dataLen / (short + long));
  for (let i = 0, at = 0; i < short + long; i++) { const len = base + (i >= short ? 1 : 0); blocks.push(data.slice(at, at + len)); at += len; }
  const codewords: number[] = [];
  for (let i = 0; i <= base; i++) for (const b of blocks) if (i < b.length) codewords.push(b[i]);
  const eccs = blocks.map((b) => ecc(b, ecLen));
  for (let i = 0; i < ecLen; i++) for (const e of eccs) codewords.push(e[i]);
  // the grid: function patterns first, then the data snake over what is free
  const m: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed: boolean[][] = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (r: number, c: number, on: boolean) => { if (r >= 0 && c >= 0 && r < size && c < size) { m[r][c] = on; fixed[r][c] = true; } };
  const finder = (r: number, c: number) => { for (let i = -1; i <= 7; i++) for (let j = -1; j <= 7; j++) set(r + i, c + j, i >= 0 && j >= 0 && i <= 6 && j <= 6 && (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4))); };
  finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
  for (let i = 8; i < size - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const al = ALIGN[v];
  const last = al[al.length - 1];
  for (const r of al) for (const c of al) { if ((r === 6 && (c === 6 || c === last)) || (c === 6 && r === last)) continue; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) set(r + i, c + j, Math.max(Math.abs(i), Math.abs(j)) !== 1); } // not over the finders; over the timing lines is fine
  set(size - 8, 8, true);
  const fb = (i: number) => ((FORMAT_L_MASK0 >> (14 - i)) & 1) === 1; // format info, twice, most significant bit first
  for (let i = 0; i <= 5; i++) set(8, i, fb(i));
  set(8, 7, fb(6)); set(8, 8, fb(7)); set(7, 8, fb(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, fb(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, fb(i));
  for (let i = 7; i < 15; i++) set(8, size - 15 + i, fb(i));
  if (version >= 7) { const info = VERSION_INFO[version - 7]; for (let i = 0; i < 18; i++) { const bit = ((info >> i) & 1) === 1; set(Math.floor(i / 3), size - 11 + (i % 3), bit); set(size - 11 + (i % 3), Math.floor(i / 3), bit); } }
  let k = 0, up = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let n = 0; n < size; n++) {
      const r = up ? size - 1 - n : n;
      for (const c of [right, right - 1]) {
        if (fixed[r][c]) continue;
        const bit = k < codewords.length * 8 ? ((codewords[k >> 3] >> (7 - (k & 7))) & 1) === 1 : false;
        k++;
        m[r][c] = bit !== ((r + c) % 2 === 0); // mask 0
      }
    }
    up = !up;
  }
  return m;
}

/** The code as an SVG, dark on light, with a quiet zone, scaled to `px`. */
export function qrSvg(text: string, px = 180): string {
  const m = qrMatrix(text), n = m.length + 8;
  const d = m.flatMap((row, r) => row.flatMap((on, c) => (on ? [`M${c + 4} ${r + 4}h1v1h-1z`] : []))).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges" role="img" aria-label="QR code"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
