import { Place, ReliefPin } from './types';
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
export function directionsUrl(p: ReliefPin) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&travelmode=walking`;
}
