import { Place, ReliefPin, RiskEstimate } from './types';

export function reliefWalkNeedsWarning(
  risk: Pick<RiskEstimate, 'lowHeat' | 'window'> | null,
  walkMinutes: number,
  remainingSeconds?: number,
) {
  if (!risk) return false;
  if (!risk.window) return true;
  if (risk.lowHeat) return false;
  return (
    walkMinutes >
    Math.max(0, remainingSeconds === undefined ? risk.window[0] : remainingSeconds / 60) * 0.7
  );
}
export function pickedCoordinates(value: unknown): Pick<Place, 'latitude' | 'longitude'> | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.latitude !== 'number' ||
    typeof p.longitude !== 'number' ||
    !Number.isFinite(p.latitude) ||
    !Number.isFinite(p.longitude) ||
    Math.abs(p.latitude) > 90 ||
    Math.abs(p.longitude) > 180
  )
    return null;
  return { latitude: p.latitude, longitude: p.longitude };
}
export function suggestionCoordinates(latitude: string, longitude: string) {
  return latitude.trim() && longitude.trim()
    ? pickedCoordinates({ latitude: Number(latitude), longitude: Number(longitude) })
    : null;
}
export function distanceMeters(
  a: Pick<Place, 'latitude' | 'longitude'>,
  b: Pick<Place, 'latitude' | 'longitude'>,
) {
  const radians = (n: number) => (n * Math.PI) / 180,
    dLat = radians(b.latitude - a.latitude),
    dLon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function rankedRelief(pins: ReliefPin[], place: Place) {
  return pins
    .map((p) => ({
      ...p,
      distance: distanceMeters(place, p),
      walkMinutes: Math.ceil(distanceMeters(place, p) / 60),
    }))
    .sort((a, b) => a.distance - b.distance);
}
export function usablePin(p: ReliefPin) {
  return p.status !== 'not-working' && p.reports < 3;
}
export function mergePins(remote: ReliefPin[], local: ReliefPin[]) {
  return [...new Map([...remote, ...local].map((p) => [p.id, p])).values()];
}
export function nearestAc(pins: ReliefPin[], place: Place) {
  return rankedRelief(
    pins.filter((p) => (p.kind === 'ac' || p.kind === 'cooling-center') && usablePin(p)),
    place,
  )[0];
}
export const COOLING_SEARCH_METERS = 10000;
export type CoolingSearchResult =
  | { status: 'found'; pin: NonNullable<ReturnType<typeof nearestAc>> }
  | { status: 'not-found' | 'unavailable' };

/** A candidate in available records, never a claim that AC or today's access is verified. */
export async function findCoolingPlace({
  place,
  cachedPins,
  localPins,
  loadDownloadedPins,
  loadNearbyPins,
}: {
  place: Place;
  cachedPins: ReliefPin[];
  localPins: ReliefPin[];
  loadDownloadedPins: () => Promise<ReliefPin[]>;
  loadNearbyPins: () => Promise<ReliefPin[]>;
}): Promise<CoolingSearchResult> {
  let downloaded: ReliefPin[] = [];
  try {
    downloaded = await loadDownloadedPins();
  } catch {
    // A missing download must not block saved candidates or the live fallback.
  }
  const pick = (remote: ReliefPin[]) =>
    nearestAc(
      mergePins(remote, localPins).filter(
        (p) => pickedCoordinates(p) && distanceMeters(place, p) <= COOLING_SEARCH_METERS,
      ),
      place,
    );
  const saved = [...downloaded, ...cachedPins];
  const candidate = pick(saved);
  if (candidate) return { status: 'found', pin: candidate };
  try {
    const nearby = await loadNearbyPins();
    const pin = pick([...saved, ...nearby]);
    return pin ? { status: 'found', pin } : { status: 'not-found' };
  } catch {
    return { status: 'unavailable' };
  }
}

export function directionsUrl(p: ReliefPin, origin?: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=walking${origin ? `&origin=${origin.latitude},${origin.longitude}` : ''}`;
}
