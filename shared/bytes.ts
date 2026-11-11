// Byte helpers shared by the browser and the server.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const utf8 = (s: string): Uint8Array => enc.encode(s);
export const fromUtf8 = (b: Uint8Array): string => dec.decode(b);

export function toHex(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export function fromHex(h: string): Uint8Array {
  if (h.length % 2 !== 0 || /[^0-9a-f]/i.test(h)) throw new Error("bad hex");
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function toB64url(b: Uint8Array): string {
  let s = "";
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    s += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < b.length) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8);
    s += B64[n >> 18] + B64[(n >> 12) & 63];
    if (i + 1 < b.length) s += B64[(n >> 6) & 63];
  }
  return s;
}

/**
 * Strict: only the encoding toB64url would produce is accepted. A loose decoder lets one value
 * have several spellings (a 1-char tail, or stray bits in the last char), so the same signature
 * or QR payload could show up as different strings.
 */
export function fromB64url(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  if (clean.length % 4 === 1) throw new Error("bad base64url length");
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of clean) {
    const v = B64.indexOf(ch);
    if (v < 0) throw new Error("bad base64url");
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  if (bits > 0 && (buf & ((1 << bits) - 1)) !== 0) throw new Error("bad base64url padding bits");
  return new Uint8Array(out);
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

/** Values JSON leaves out of an object (and writes as null in an array). */
const skipped = (v: unknown) => v === undefined || typeof v === "function" || typeof v === "symbol";

/**
 * Deterministic JSON: object keys sorted at every level, so equal data always gives equal bytes.
 *
 * It follows JSON.stringify's rules for every value, because a body is signed on one side and
 * verified on the other after a JSON round trip: canonical(v) must equal
 * canonical(JSON.parse(JSON.stringify(v))). Before, an array hole or undefined became an empty
 * slot ("[1,]") instead of null, and a Date became "{}" instead of its ISO string, so such a body
 * failed verification after transport, and every Date signed the same.
 */
export function canonical(v: unknown): string {
  if (v !== null && typeof v === "object" && typeof (v as { toJSON?: unknown }).toJSON === "function") {
    v = (v as { toJSON: () => unknown }).toJSON(); // Date and anything else that defines toJSON
  }
  if (v === null || typeof v !== "object") return skipped(v) ? "null" : JSON.stringify(v);
  if (Array.isArray(v)) return "[" + Array.from(v, (x) => (skipped(x) ? "null" : canonical(x))).join(",") + "]";
  const o = v as Record<string, unknown>;
  return (
    "{" +
    Object.keys(o)
      .filter((k) => !skipped(o[k]))
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonical(o[k]))
      .join(",") +
    "}"
  );
}
