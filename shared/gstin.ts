// GSTIN format and check-digit validation, used to screen company registrations.
// A GSTIN is 15 characters: 2-digit state code, 10-character PAN, entity number, "Z", check character.

const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** The check character for the first 14 characters (mod-36 weighted sum, weights 1, 2, 1, 2, ...). */
export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const p = CHARS.indexOf(first14[i]) * (i % 2 ? 2 : 1);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export function checkGstin(raw: string): { ok: boolean; reason?: string; state?: string; pan?: string } {
  const g = raw.trim().toUpperCase();
  if (!FORMAT.test(g)) return { ok: false, reason: "not in GSTIN format" };
  const state = STATES[g.slice(0, 2)];
  if (!state) return { ok: false, reason: `no state has GST code ${g.slice(0, 2)}` };
  if (gstinCheckChar(g.slice(0, 14)) !== g[14]) return { ok: false, reason: "check digit is wrong (typo or made up)" };
  return { ok: true, state, pan: g.slice(2, 12) };
}

// GST state and union territory codes (the first two digits of every GSTIN).
const STATES: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
  "25": "Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra",
  "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep", "32": "Kerala",
  "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands", "36": "Telangana",
  "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};
