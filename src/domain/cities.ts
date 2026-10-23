import { CityDataset, MappedAreaId, PolygonCoordinates } from './types';

function inRing(x: number, y: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}
function onRing(x: number, y: number, ring: [number, number][]) {
  return ring.some((a, i) => {
    const b = ring[(i + 1) % ring.length]!,
      dx = b[0] - a[0],
      dy = b[1] - a[1],
      length = Math.hypot(dx, dy);
    if (!length) return Math.hypot(x - a[0], y - a[1]) < 1e-9;
    return (
      Math.abs(dx * (y - a[1]) - dy * (x - a[0])) <= 1e-9 * length &&
      x >= Math.min(a[0], b[0]) - 1e-9 &&
      x <= Math.max(a[0], b[0]) + 1e-9 &&
      y >= Math.min(a[1], b[1]) - 1e-9 &&
      y <= Math.max(a[1], b[1]) + 1e-9
    );
  });
}
export function insidePolygons(longitude: number, latitude: number, polygons: PolygonCoordinates) {
  return polygons.some(
    ([outer, ...holes]) =>
      !!outer &&
      (onRing(longitude, latitude, outer) || inRing(longitude, latitude, outer)) &&
      !holes.some(
        (ring) => !onRing(longitude, latitude, ring) && inRing(longitude, latitude, ring),
      ),
  );
}
export function polygonBounds(polygons: PolygonCoordinates): CityDataset['bounds'] {
  const points = polygons.flat(2);
  if (!points.length) throw new Error('Missing city boundary');
  return points.reduce(
    ([w, s, e, n], [x, y]) => [Math.min(w, x), Math.min(s, y), Math.max(e, x), Math.max(n, y)],
    [180, 90, -180, -90] as CityDataset['bounds'],
  );
}
// Loaded only when the user opens an area map; no weather location is changed.
export async function bundledCity(city: MappedAreaId): Promise<CityDataset> {
  const data =
    city === 'tx30'
      ? (await import('../data/tx30.json')).default
      : city === 'tx06'
        ? (await import('../data/tx06.json')).default
        : city === 'arlington'
          ? (await import('../data/arlington.json')).default
          : (await import('../data/dallas.json')).default;
  return data as unknown as CityDataset;
}
