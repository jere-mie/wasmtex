// Minimal uncompressed (store) ZIP builder - no dependencies needed.

import { getVFSFileBytes } from "@/lib/project-files";

const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function u16(v: DataView, o: number, n: number) { v.setUint16(o, n, true); }
function u32(v: DataView, o: number, n: number) { v.setUint32(o, n, true); }

export interface ZipEntry {
  name: string;
  content: string | Uint8Array;
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = enc.encode(entry.name);
    const data = getVFSFileBytes({
      name: entry.name,
      content: entry.content,
      kind: typeof entry.content === "string" ? "text" : "binary",
    });
    const crc = crc32(data);
    const hdr = new Uint8Array(30 + name.length);
    const dv = new DataView(hdr.buffer);
    u32(dv, 0, 0x04034b50); u16(dv, 4, 20);  u16(dv, 6, 0);   u16(dv, 8, 0);
    u16(dv, 10, 0);          u16(dv, 12, 0);  u32(dv, 14, crc);
    u32(dv, 18, data.length); u32(dv, 22, data.length);
    u16(dv, 26, name.length); u16(dv, 28, 0);
    hdr.set(name, 30);
    locals.push({ name, data, crc, offset });
    parts.push(hdr, data);
    offset += hdr.length + data.length;
  }

  const cdParts: Uint8Array[] = [];
  let cdSize = 0;
  for (const local of locals) {
    const cd = new Uint8Array(46 + local.name.length);
    const dv = new DataView(cd.buffer);
    u32(dv, 0, 0x02014b50); u16(dv, 4, 20); u16(dv, 6, 20);
    u16(dv, 8, 0);           u16(dv, 10, 0); u16(dv, 12, 0); u16(dv, 14, 0);
    u32(dv, 16, local.crc);  u32(dv, 20, local.data.length); u32(dv, 24, local.data.length);
    u16(dv, 28, local.name.length); u16(dv, 30, 0); u16(dv, 32, 0);
    u16(dv, 34, 0); u16(dv, 36, 0); u32(dv, 38, 0);
    u32(dv, 42, local.offset);
    cd.set(local.name, 46);
    cdParts.push(cd);
    cdSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  u32(ev, 0, 0x06054b50); u16(ev, 4, 0); u16(ev, 6, 0);
  u16(ev, 8, locals.length); u16(ev, 10, locals.length);
  u32(ev, 12, cdSize); u32(ev, 16, offset); u16(ev, 20, 0);

  const all = [...parts, ...cdParts, eocd];
  const result = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
  let pos = 0;
  for (const p of all) { result.set(p, pos); pos += p.length; }
  return result;
}
