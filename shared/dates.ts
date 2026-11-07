// Calendar dates as people in India read them. Expiry dates are plain YYYY-MM-DD in IST;
// comparing them with toISOString() (UTC) is a day behind from midnight to 05:30 IST.

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;

/** The IST calendar date (YYYY-MM-DD) at time `ts` (ms since epoch). */
export const isoDateIST = (ts: number = Date.now()): string =>
  new Date(ts + IST_OFFSET_MS).toISOString().slice(0, 10);

// Server-side messages (alerts, verdict reasons) are read in India, but the server may run
// in UTC; pin the time zone so "expected by ..." isn't 5 h 30 m off.
const IST = "Asia/Kolkata";

/** e.g. "6/11/2026" for a date shown to people in India, whatever the server's time zone. */
export const fmtDateIST = (ts: number): string => new Date(ts).toLocaleDateString("en-IN", { timeZone: IST });

/** e.g. "6/11/2026, 1:00:00 am" in IST, whatever the server's time zone. */
export const fmtDateTimeIST = (ts: number): string => new Date(ts).toLocaleString("en-IN", { timeZone: IST });
