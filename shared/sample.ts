// Unbiased random choices for spot checks.

/** A uniform integer in [0, n), from the platform's cryptographic random source. */
export function secureRandomInt(n: number): number {
  if (!Number.isInteger(n) || n < 1 || n > 2 ** 32) throw new RangeError(`n must be an integer from 1 to 2^32, got ${n}`);
  const limit = 2 ** 32 - (2 ** 32 % n); // reject the top sliver so every value is equally likely
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/**
 * k items chosen uniformly at random without replacement (partial Fisher-Yates shuffle).
 *
 * `[...items].sort(() => Math.random() - 0.5)` is not a shuffle: the sort's comparisons are not
 * consistent, and with 10 items it picked the first item about twice as often as it should and the
 * last ones about 0.6 times as often. For a spot check that means a packer could tell where to put
 * the items least likely to be looked at.
 */
export function randomSample<T>(items: readonly T[], k: number, randInt: (n: number) => number = secureRandomInt): T[] {
  const a = [...items];
  const take = Math.max(0, Math.min(a.length, Math.floor(k)));
  for (let i = 0; i < take; i++) {
    const j = i + randInt(a.length - i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, take);
}
