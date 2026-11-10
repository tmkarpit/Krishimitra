import type { LandUnit, LatLng } from '@/types/db';

const EARTH_RADIUS_M = 6378137;
const rad = (d: number) => (d * Math.PI) / 180;

/** Geodesic polygon area in m² (spherical excess; accurate to well under 1% for farm-sized plots). */
export function polygonAreaSqM(points: LatLng[]): number {
  if (points.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += rad(b.longitude - a.longitude) * (2 + Math.sin(rad(a.latitude)) + Math.sin(rad(b.latitude)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

export function centroid(points: LatLng[]): LatLng {
  const n = points.length;
  return {
    latitude: points.reduce((s, p) => s + p.latitude, 0) / n,
    longitude: points.reduce((s, p) => s + p.longitude, 0) / n,
  };
}

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export const LAND_UNITS: LandUnit[] = ['acre', 'hectare', 'bigha', 'guntha', 'kanal'];

// Bigha/guntha/kanal vary by state; these are the most common conversions.
export const SQ_M_PER_UNIT: Record<LandUnit, number> = {
  acre: 4046.86,
  hectare: 10000,
  bigha: 2529.29,
  guntha: 101.17,
  kanal: 505.86,
};

export function formatArea(areaSqM: number | null | undefined, unit: LandUnit): string {
  if (!areaSqM) return '—';
  const value = areaSqM / SQ_M_PER_UNIT[unit];
  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

/** "+919876543210" from "98765 43210", "+91 98765-43210", "098765…". Null when not a valid Indian mobile. */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '').replace(/^0+/, '');
  const local = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}

export function regionFor(points: LatLng[], fallback: LatLng) {
  if (!points.length) return { ...fallback, latitudeDelta: 0.005, longitudeDelta: 0.005 };
  const lats = points.map((p) => p.latitude);
  const lngs = points.map((p) => p.longitude);
  const pad = 0.0008;
  return {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
    latitudeDelta: Math.max(0.002, Math.max(...lats) - Math.min(...lats) + pad),
    longitudeDelta: Math.max(0.002, Math.max(...lngs) - Math.min(...lngs) + pad),
  };
}
