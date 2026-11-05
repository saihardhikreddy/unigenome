// Calendar dates as people in India read them. Expiry dates are plain YYYY-MM-DD in IST;
// comparing them with toISOString() (UTC) is a day behind from midnight to 05:30 IST.

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** The IST calendar date (YYYY-MM-DD) at time `ts` (ms since epoch). */
export const isoDateIST = (ts: number = Date.now()): string =>
  new Date(ts + IST_OFFSET_MS).toISOString().slice(0, 10);
