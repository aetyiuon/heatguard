import { CityDataset, MappedAreaId, PolygonCoordinates, MappedPark, ReliefTrail } from './types';

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
  if (city === 'all-dfw') {
    const all = await Promise.all(
      (['arlington', 'dallas', 'fort-worth', 'dallas-county', 'tx06', 'tx30'] as const).map(
        bundledCity,
      ),
    );
    const boundary = all.flatMap((d) => d.boundary);
    const unique = <T extends { id: string }>(records: T[]) => [
      ...new Map(
        records
          .slice()
          .reverse()
          .map((p) => [p.id, p]),
      ).values(),
    ];
    // City/county/district snapshots can hold different clipped pieces of one feature.
    // Preserve every published piece in the combined view instead of the last district fragment.
    const parkGroups = new Map<string, MappedPark>(),
      trailGroups = new Map<string, ReliefTrail>();
    for (const d of all) {
      for (const p of d.parks) {
        const old = parkGroups.get(p.id);
        parkGroups.set(
          p.id,
          old ? { ...old, polygons: [...old.polygons, ...p.polygons] } : { ...p },
        );
      }
      for (const p of d.trails) {
        const old = trailGroups.get(p.id);
        trailGroups.set(p.id, old ? { ...old, paths: [...old.paths, ...p.paths] } : { ...p });
      }
    }
    const parks = [...parkGroups.values()].map((p) => ({
      ...p,
      polygons: [...new Map(p.polygons.map((shape) => [JSON.stringify(shape), shape])).values()],
    }));
    const trails = [...trailGroups.values()].map((p) => ({
      ...p,
      paths: [...new Map(p.paths.map((path) => [JSON.stringify(path), path])).values()],
    }));
    return {
      city,
      name: 'All mapped entries',
      areaType: 'region',
      fetchedAt: all.map((d) => d.fetchedAt).sort()[0]!,
      bounds: polygonBounds(boundary),
      boundary,
      boundaryLabel: 'Combined source areas · city, county and district extents',
      boundarySource: all[0]!.boundarySource,
      pins: unique(all.flatMap((d) => d.pins)),
      parks,
      trails,
      sources: all.flatMap((d) => d.sources),
      warnings: [
        'Combined published entries from Dallas, Fort Worth, Arlington, Dallas County, TX-6 and TX-30. Source extents extend beyond the three cities. Amenity coverage is incomplete; hours, access, shade and water flow are unverified.',
      ],
    };
  }
  const data =
    city === 'fort-worth'
      ? (await import('../data/fort-worth.json')).default
      : city === 'dallas-county'
        ? (await import('../data/dallas-county.json')).default
        : city === 'tx30'
          ? (await import('../data/tx30.json')).default
          : city === 'tx06'
            ? (await import('../data/tx06.json')).default
            : city === 'arlington'
              ? (await import('../data/arlington.json')).default
              : (await import('../data/dallas.json')).default;
  const dataset = data as unknown as CityDataset;
  if (city === 'arlington' || city === 'dallas' || city === 'fort-worth') {
    const overlays = (await import('../data/city-districts.json')).default;
    return {
      ...dataset,
      areaType: 'city',
      regions: overlays[city] as unknown as CityDataset['regions'],
    };
  }
  return dataset;
}
