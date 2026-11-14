import { describe, expect, it } from "vitest";
import { generateKeyPair, signMessage, verifyMessage } from "../shared/crypto";
import { canonical, fromB64url, toB64url } from "../shared/bytes";
import { decodePayload, dnaOf, encodePayload, signUnit, verifyUnit, type ItemFields } from "../shared/identity";
import { eventHash, signEvent, verifyChain, type EventBody } from "../shared/events";
import { merkleProof, merkleRoot, verifyProof } from "../shared/dsa/merkle";
import { HashMap } from "../shared/dsa/hashmap";
import { BinaryHeap, kWayMerge } from "../shared/dsa/heap";
import { Trie } from "../shared/dsa/trie";
import { AVLTree, ROTATION_LOG_MAX } from "../shared/dsa/avl";
import { Graph, bfs, dijkstra } from "../shared/dsa/graph";
import { greedyAllocate, knapsack2D } from "../shared/dsa/knapsack";
import { dfsCollect } from "../shared/dsa/tree";
import { haversineKm, impliedSpeedKmh } from "../shared/geo";
import { checkGstin, gstinCheckChar } from "../shared/gstin";
import { fmtDateIST, fmtDateTimeIST, isoDateIST } from "../shared/dates";
import { intParam, recallParams } from "../shared/params";
import { randomSample, secureRandomInt } from "../shared/sample";

const item = (over: Partial<ItemFields> = {}): ItemFields => ({
  kind: "item", id: "I-1", batch: "B-1024", mfr: "M-07", product: "PCM-500", mfg: "2026-10-02", exp: "2028-10-01", salt: "9f3a", ...over,
});

describe("identity", () => {
  it("signs, round-trips through the QR payload and verifies", () => {
    const k = generateKeyPair();
    const u = signUnit(item(), k.secretKey);
    const back = decodePayload(encodePayload(u));
    expect(dnaOf(back.f)).toBe(dnaOf(u.f));
    expect(verifyUnit(back, k.publicKey)).toBe(true);
  });
  it("fails after tampering or with the wrong key", () => {
    const k = generateKeyPair();
    const u = signUnit(item(), k.secretKey);
    expect(verifyUnit({ ...u, f: item({ batch: "B-1025" }) }, k.publicKey)).toBe(false);
    expect(verifyUnit(u, generateKeyPair().publicKey)).toBe(false);
  });
});

describe("hash chain", () => {
  it("detects an edited record", () => {
    const k = generateKeyPair();
    const recs: any[] = [];
    let prev = "0";
    for (const type of ["MANUFACTURED", "DISPATCHED", "RECEIVED"] as const) {
      const body: EventBody = { unit: "I-1", type, actor: "M-07", ts: Date.now(), lat: 1, lng: 2, acc: 5, site: null, prev, data: {} };
      const sig = signEvent(body, k.secretKey);
      const hash = eventHash(body, sig);
      recs.push({ body, sig, hash });
      prev = hash;
    }
    const pk = () => k.publicKey;
    expect(verifyChain(recs, pk).ok).toBe(true);
    recs[1] = { ...recs[1], body: { ...recs[1].body, ts: 1 } };
    expect(verifyChain(recs, pk)).toMatchObject({ ok: false, brokenAt: 1 });
  });
});

describe("merkle", () => {
  it("proves every leaf, including odd counts", () => {
    for (const n of [1, 2, 3, 5, 48]) {
      const ids = Array.from({ length: n }, (_, i) => "I-" + i);
      const root = merkleRoot(ids);
      ids.forEach((id, i) => expect(verifyProof(id, merkleProof(ids, i), root)).toBe(true));
      expect(verifyProof("I-x", merkleProof(ids, 0), root)).toBe(false);
    }
    expect(merkleProof(Array.from({ length: 48 }, (_, i) => "I-" + i), 3).length).toBe(6);
  });
});

describe("structures", () => {
  it("hash map grows and keeps every key", () => {
    const m = new HashMap<number>(4);
    for (let i = 0; i < 100; i++) m.set("k" + i, i);
    expect(m.size).toBe(100);
    expect(m.get("k57")).toBe(57);
    expect(m.capacity).toBeGreaterThan(100 / 0.75);
    m.delete("k57");
    expect(m.has("k57")).toBe(false);
  });
  it("heap pops by priority and k-way merge sorts", () => {
    const h = new BinaryHeap<number>((a, b) => a > b);
    [2, 5, 3, 9, 1].forEach((x) => h.push(x));
    expect([h.pop(), h.pop(), h.pop()]).toEqual([9, 5, 3]);
    expect(kWayMerge([[1, 4, 7], [2, 5], [0, 9]], (x) => x)).toEqual([0, 1, 2, 4, 5, 7, 9]);
  });
  it("k-way merge keeps equal keys in list order", () => {
    const lists = [[{ k: 1, n: "a1" }, { k: 1, n: "a2" }], [{ k: 1, n: "b1" }], [{ k: 1, n: "c1" }], [{ k: 0, n: "d0" }, { k: 1, n: "d1" }]];
    expect(kWayMerge(lists, (x) => x.k).map((x) => x.n)).toEqual(["d0", "a1", "a2", "b1", "c1", "d1"]);
  });
  it("trie finds by prefix", () => {
    const t = new Trie();
    ["B-1024", "B-1025", "B-2001"].forEach((k) => t.insert(k));
    expect(t.search("b-10")).toMatchObject({ total: 2, keys: ["B-1024", "B-1025"] });
  });
  it("AVL stays balanced and answers ranges", () => {
    const t = new AVLTree<string>();
    ["2027-01-10", "2027-01-20", "2027-01-30"].forEach((d) => t.insert(d, d));
    expect(t.rotations[0]).toContain("left rotation");
    expect(t.snapshot().key).toBe("2027-01-20");
    for (let i = 1; i <= 28; i++) t.insert(`2027-02-${String(i).padStart(2, "0")}`, "x");
    expect(t.height).toBeLessThanOrEqual(6);
    expect(t.range("2027-01-15", "2027-01-25").map((r) => r.key)).toEqual(["2027-01-20"]);
  });
  it("BFS and Dijkstra match the doc examples", () => {
    const g = new Graph();
    g.addEdge("M", "W1"); g.addEdge("M", "W2"); g.addEdge("W1", "R1"); g.addEdge("W1", "R2"); g.addEdge("W2", "R3");
    expect(bfs(g, "M").order).toEqual(["M", "W1", "W2", "R1", "R2", "R3"]);
    const d = new Graph();
    d.addEdge("M", "W1", 2); d.addEdge("M", "W2", 1); d.addEdge("W2", "W1", 0.5); d.addEdge("W1", "R1", 1); d.addEdge("W2", "R1", 3);
    const r = dijkstra(d, "M");
    expect(r.dist.R1).toBe(2.5);
    expect(r.pathTo("R1")).toEqual(["M", "W2", "W1", "R1"]);
  });
  it("knapsack beats greedy on the doc example", () => {
    const items = [
      { id: "R1", cost: 6, staff: 1, risk: 30 }, { id: "R2", cost: 5, staff: 1, risk: 24 },
      { id: "R3", cost: 5, staff: 2, risk: 22 }, { id: "R4", cost: 4, staff: 1, risk: 15 },
    ];
    expect(knapsack2D(items, 10, 3).result).toMatchObject({ risk: 46, chosen: ["R2", "R3"] });
    expect(greedyAllocate(items, 10, 3)).toMatchObject({ risk: 45, chosen: ["R1", "R4"] });
  });
  it("DFS walks the packaging tree", () => {
    const kids: Record<string, string[]> = { P: ["C1", "C2"], C1: ["a", "b"], C2: ["c"] };
    expect(dfsCollect("P", (x) => kids[x] ?? [])).toEqual(["P", "C1", "a", "b", "C2", "c"]);
  });
  it("haversine Hyderabad to Delhi is about 1,250 km", () => {
    const km = haversineKm({ lat: 17.39, lng: 78.49 }, { lat: 28.61, lng: 77.21 });
    expect(km).toBeGreaterThan(1230);
    expect(km).toBeLessThan(1270);
    expect(impliedSpeedKmh({ lat: 17.39, lng: 78.49, ts: 0 }, { lat: 28.61, lng: 77.21, ts: 40 * 60_000 })).toBeGreaterThan(1800);
  });
});

describe("gstin", () => {
  const gstin = (first14: string) => first14 + gstinCheckChar(first14);

  it("accepts a well-formed GSTIN and names its state", () => {
    expect(checkGstin(gstin("36AABCN1234K1Z"))).toEqual({ ok: true, state: "Telangana", pan: "AABCN1234K" });
    expect(checkGstin(" " + gstin("10AABCN1234K1Z").toLowerCase()).state).toBe("Bihar");
  });

  it("rejects a wrong check character", () => {
    const g = gstin("27AABCN1234K1Z");
    const wrong = g.slice(0, 14) + (g[14] === "0" ? "1" : "0");
    expect(checkGstin(wrong)).toMatchObject({ ok: false, reason: expect.stringContaining("check digit") });
  });

  it("rejects state codes no state uses", () => {
    for (const code of ["00", "45", "96"]) {
      expect(checkGstin(gstin(code + "AABCN1234K1Z"))).toMatchObject({ ok: false, reason: expect.stringContaining(code) });
    }
  });

  it("rejects malformed input", () => {
    expect(checkGstin("36AABCN1234K1Y5").ok).toBe(false); // 14th character must be Z
    expect(checkGstin("").ok).toBe(false);
  });
});

describe("dates", () => {
  it("uses the Indian calendar date, not the UTC one", () => {
    // 01:00 IST on 6 Nov is still 5 Nov in UTC: an item expiring on 5 Nov has expired in India.
    expect(isoDateIST(Date.parse("2026-11-05T19:30:00Z"))).toBe("2026-11-06");
    expect(isoDateIST(Date.parse("2026-11-05T18:29:59Z"))).toBe("2026-11-05");
  });

  it("formats server-side dates in IST, not the server's time zone", () => {
    const ts = Date.parse("2026-11-05T19:30:00Z"); // 01:00 on 6 Nov in India
    expect(fmtDateIST(ts)).toBe("6/11/2026");
    expect(fmtDateTimeIST(ts)).toMatch(/^6\/11\/2026, 1:00:00\s?am$/i);
  });
});

describe("query parameters", () => {
  it("clamps numbers and falls back to the default for junk", () => {
    expect(intParam("7", 10, 1, 60)).toBe(7);
    expect(intParam("7.9", 10, 1, 60)).toBe(7);
    expect(intParam("100000000", 10, 1, 60)).toBe(60);
    expect(intParam("-5", 10, 1, 60)).toBe(1);
    for (const junk of [undefined, null, "", "  ", "abc", "NaN", "Infinity"]) expect(intParam(junk, 10, 1, 60)).toBe(10);
  });

  it("keeps the public recall planner's knapsack table small", () => {
    expect(recallParams("1e9", "1000")).toEqual({ budget: 60, staff: 10 });
    expect(recallParams(undefined, "abc")).toEqual({ budget: 10, staff: 3 });
    // So the largest table it can build stays tiny.
    const { budget, staff } = recallParams("1e9", "1e9");
    expect(knapsack2D([{ id: "a", cost: 1, staff: 1, risk: 1 }], budget, staff).cells).toBe(2 * 61 * 11);
  });
});

describe("base64url", () => {
  it("round-trips every tail length", () => {
    for (let n = 0; n <= 7; n++) {
      const b = Uint8Array.from({ length: n }, (_, i) => (i * 97 + 13) & 255);
      expect(fromB64url(toB64url(b))).toEqual(b);
    }
    expect(toB64url(Uint8Array.from([0xfb, 0xff]))).toBe("-_8");
    expect(fromB64url("-_8=")).toEqual(Uint8Array.from([0xfb, 0xff]));
  });

  it("rejects spellings toB64url never produces", () => {
    expect(() => fromB64url("A")).toThrow(); // 6 bits is not a byte
    expect(() => fromB64url("AB")).toThrow(); // last char carries bits past the byte
    expect(fromB64url("AA")).toEqual(Uint8Array.from([0]));
    expect(() => fromB64url("ab+c")).toThrow(); // standard base64, not url-safe
  });

  it("does not accept a second spelling of a signature", () => {
    const kp = generateKeyPair();
    const sig = signMessage("UG/test", { x: 1 }, kp.secretKey);
    expect(verifyMessage("UG/test", { x: 1 }, sig, kp.publicKey)).toBe(true);
    // 64 bytes -> 86 chars; the last char holds 4 spare bits. Setting one gives another spelling.
    const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const twin = sig.slice(0, -1) + ALPHABET[ALPHABET.indexOf(sig.at(-1)!) | 1];
    expect(twin).not.toBe(sig);
    expect(verifyMessage("UG/test", { x: 1 }, twin, kp.publicKey)).toBe(false);
  });
});

describe("canonical JSON", () => {
  const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

  it("sorts keys at every level", () => {
    expect(canonical({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" } })).toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("gives the same text before and after a JSON round trip", () => {
    const values: unknown[] = [
      { qty: 5, note: undefined, at: new Date(Date.UTC(2026, 10, 11, 9, 30)) },
      [1, undefined, () => 0, 2],
      { list: [new Date(0), null], n: NaN, inf: -Infinity },
      { nested: { when: new Date(86_400_000), drop: undefined } },
      "plain", 42, null, true,
    ];
    for (const v of values) expect(canonical(v)).toBe(canonical(roundTrip(v)));
  });

  it("writes array holes as null and dates as ISO strings", () => {
    expect(canonical([1, undefined])).toBe("[1,null]");
    expect(canonical({ at: new Date(0) })).toBe('{"at":"1970-01-01T00:00:00.000Z"}');
    // Different dates must not sign the same.
    expect(canonical({ at: new Date(0) })).not.toBe(canonical({ at: new Date(1) }));
  });

  it("a body signed with a Date verifies on the receiving side", () => {
    const k = generateKeyPair();
    const body = { batch: "B-1", made: new Date(Date.UTC(2026, 9, 2)), lots: [1, undefined] };
    const sig = signMessage("UG/test", body, k.secretKey);
    expect(verifyMessage("UG/test", roundTrip(body), sig, k.publicKey)).toBe(true);
  });
});

describe("spot-check sampling", () => {
  it("picks every item equally often", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const counts = new Array(10).fill(0);
    const trials = 30000;
    for (let t = 0; t < trials; t++) counts[randomSample(items, 1)[0]]++;
    // Expected 3000 each; the old sort-based shuffle gave about 5900 for the first item and 1800 for the last.
    for (const c of counts) expect(Math.abs(c - trials / 10)).toBeLessThan(300);
  });
  it("takes k distinct items, never more than there are", () => {
    const s = randomSample(["a", "b", "c", "d", "e"], 3);
    expect(new Set(s).size).toBe(3);
    expect(randomSample(["a", "b"], 5).sort()).toEqual(["a", "b"]);
    expect(randomSample([], 1)).toEqual([]);
  });
  it("is a Fisher-Yates shuffle step by step", () => {
    const seq = [2, 0, 1];
    expect(randomSample([10, 11, 12, 13], 3, () => seq.shift()!)).toEqual([12, 11, 13]);
  });
  it("draws integers in range and refuses bad bounds", () => {
    for (let i = 0; i < 1000; i++) {
      const v = secureRandomInt(7);
      expect(v >= 0 && v < 7 && Number.isInteger(v)).toBe(true);
    }
    expect(() => secureRandomInt(0)).toThrow(RangeError);
  });
});

describe("structure limits", () => {
  it("hash map: has() sees a key stored with an undefined value, and bad sizes are refused", () => {
    const m = new HashMap<number | undefined>(2);
    m.set("a", undefined);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
    expect(m.delete("a")).toBe(true);
    expect(m.has("a")).toBe(false);
    expect(() => new HashMap(0)).toThrow(RangeError);
    expect(() => new HashMap(2.5)).toThrow(RangeError);
    expect(() => new HashMap(4, 0)).toThrow(RangeError);
  });

  it("AVL rotation log keeps only the newest entries", () => {
    const t = new AVLTree<number>();
    for (let i = 0; i < 500; i++) t.insert(`2026-${String(i).padStart(5, "0")}`, i); // ascending: rotates often
    expect(t.rotations.length).toBe(ROTATION_LOG_MAX);
    expect(t.range("2026-00000", "2026-99999").length).toBe(500);
    expect(t.height).toBeLessThanOrEqual(Math.ceil(1.45 * Math.log2(500 + 2)));
  });
});
