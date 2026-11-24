// Haversine distance and the travel-speed check (DSA topic 13).

export interface GeoPoint {
  lat: number;
  lng: number;
}

const R_KM = 6371;

/**
 * A location from untrusted JSON (the buyer's phone), or null when it isn't a real one.
 * Numbers sent as strings ("17.38") are accepted; anything non-numeric, missing or outside
 * the globe (lat beyond ±90, lng beyond ±180) is null, i.e. "no location".
 */
export function toGeoPoint(lat: unknown, lng: unknown): GeoPoint | null {
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const la = num(lat);
  const ln = num(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
  return { lat: la, lng: ln };
}
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Implied speed in km/h between two timed points; Infinity when the time gap is zero but the places differ. */
export function impliedSpeedKmh(a: GeoPoint & { ts: number }, b: GeoPoint & { ts: number }): number {
  const km = haversineKm(a, b);
  const hours = Math.abs(b.ts - a.ts) / 3_600_000;
  if (hours === 0) return km < 1 ? 0 : Infinity;
  return km / hours;
}

/** Round a location to about 1 km (2 decimal places) for buyer privacy. */
export const roundForPrivacy = (p: GeoPoint): GeoPoint => ({
  lat: Math.round(p.lat * 100) / 100,
  lng: Math.round(p.lng * 100) / 100,
});
