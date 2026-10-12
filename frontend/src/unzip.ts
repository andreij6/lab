// Read a ZIP archive in the browser (or Node 26): central directory walk, stored and deflated
// entries (DecompressionStream "deflate-raw"), UTF-8 names. Enough to import an exported vault.

export type Unzipped = { path: string; dir: boolean; data: Uint8Array };

export async function unzip(buf: ArrayBuffer): Promise<Unzipped[]> {
  const b = new Uint8Array(buf);
  const dv = new DataView(buf);
  // end of central directory: scan back over a possible comment
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out: Unzipped[] = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error("bad central directory");
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const path = dec.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    const lnameLen = dv.getUint16(local + 26, true);
    const lextraLen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnameLen + lextraLen;
    const raw = b.slice(start, start + csize);
    const dir = path.endsWith("/");
    let data: Uint8Array;
    if (dir || csize === 0) data = new Uint8Array(0);
    else if (method === 0) data = raw;
    else if (method === 8) data = await inflate(raw);
    else throw new Error(`${path}: unsupported compression method ${method}`);
    out.push({ path, dir, data });
  }
  return out;
}

async function inflate(raw: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
