import * as Location from 'expo-location';
import type { LatLng, State } from '@/types/db';

export async function currentPosition(): Promise<LatLng | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) return null;
  const last = await Location.getLastKnownPositionAsync();
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export interface Place {
  stateCode: string | null;
  district: string | null;
  village: string | null;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

/** Reverse-geocodes with the phone's geocoder (no API key) and maps the state to our state codes. */
export async function placeFor(point: LatLng, states: State[]): Promise<Place> {
  try {
    const [addr] = await Location.reverseGeocodeAsync(point);
    if (!addr) return { stateCode: null, district: null, village: null };
    const region = addr.region ? normalise(addr.region) : '';
    const state = states.find((s) => normalise(s.name) === region) ?? states.find((s) => region && normalise(s.name).includes(region));
    return {
      stateCode: state?.code ?? null,
      district: addr.subregion ?? addr.city ?? null,
      village: addr.district ?? addr.city ?? addr.name ?? null,
    };
  } catch {
    return { stateCode: null, district: null, village: null };
  }
}
