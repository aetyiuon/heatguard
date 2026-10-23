import { Place, ReliefPin, ReliefTrail } from '../src/domain/types';
import { distanceMeters } from '../src/domain/relief';
import { upstream } from './upstream';

export const ARLINGTON_PARKS =
  'https://gis2.arlingtontx.gov/agsext2/rest/services/Parks/ParksAmenity/MapServer';
type Feature = {
  attributes: Record<string, any>;
  geometry?: { x?: number; y?: number; rings?: number[][][]; paths?: number[][][] };
};
const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const inactive = (a: Record<string, any>) =>
  [1, true, '1', 'Yes', 'true'].includes(a.Inactive) ||
  !!a.Retired ||
  /^retired\b/i.test(text(a.ID));
function validPair(p: number[]) {
  return (
    p.length >= 2 &&
    Number.isFinite(p[0]) &&
    Number.isFinite(p[1]) &&
    Math.abs(p[0]!) <= 180 &&
    Math.abs(p[1]!) <= 90
  );
}
function location(f: Feature): [number, number] | undefined {
  if (Number.isFinite(f.geometry?.x) && Number.isFinite(f.geometry?.y))
    return [f.geometry!.x!, f.geometry!.y!];
  // A pavilion footprint becomes an approximate map point, never a measured entrance.
  const ring = f.geometry?.rings?.[0]?.filter(validPair);
  if (!ring?.length) return;
  const points =
    ring.length > 1 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1]
      ? ring.slice(0, -1)
      : ring;
  return [
    points.reduce((sum, p) => sum + p[0]!, 0) / points.length,
    points.reduce((sum, p) => sum + p[1]!, 0) / points.length,
  ];
}
export function normalizeArlingtonPins(
  features: Feature[],
  layer: 1 | 16,
  place: Place,
  fetchedAt: string,
  entireCity = false,
): ReliefPin[] {
  return features.flatMap((f) => {
    const a = f.attributes,
      pair = location(f);
    if (inactive(a) || !pair || !validPair(pair) || a.OBJECTID === undefined) return [];
    const [longitude, latitude] = pair;
    if (!entireCity && distanceMeters(place, { latitude, longitude }) > 4500) return [];
    const parkName = text(a.ParkID) || text(a.Parks) || 'Arlington park';
    const assetId = text(a.ID);
    const label = layer === 1 ? 'Drinking fountain' : text(a.Name1) || 'Shade pavilion';
    const edited = Number(a.last_edited_date);
    return [
      {
        id: `municipal-arlington-${layer}-${a.OBJECTID}`,
        name: `${parkName} · ${label}${layer === 1 && assetId ? ` #${assetId}` : ''}`,
        latitude,
        longitude,
        kind: layer === 1 ? 'water' : 'shade',
        feature: layer === 1 ? 'drinking-fountain' : 'shelter',
        provenance: 'municipal',
        parkName,
        assetId,
        source: `City of Arlington · ${layer === 1 ? 'Drinking Fountain' : 'Pavilion'} GIS layer`,
        sourceUrl: `${ARLINGTON_PARKS}/${layer}`,
        sourceUpdatedAt:
          Number.isFinite(edited) && edited > 0 && edited <= Date.now()
            ? new Date(edited).toISOString()
            : undefined,
        approximateLocation: layer === 16,
        official: false,
        status: 'unknown',
        updatedAt: fetchedAt,
        confirmations: 0,
        reports: 0,
      } satisfies ReliefPin,
    ];
  });
}
export function normalizeArlingtonTrails(features: Feature[]): ReliefTrail[] {
  return features.flatMap((f) => {
    const a = f.attributes;
    if (inactive(a) || !['Hike/Bike', 'Mountain Bike'].includes(a.Type1)) return [];
    const paths = (f.geometry?.paths ?? [])
      .map((path) => path.filter(validPair).map((p) => [p[0]!, p[1]!] as [number, number]))
      .filter((path) => path.length > 1);
    if (!paths.length) return [];
    return [
      {
        id: `arlington-trail-${a.OBJECTID}`,
        name: text(a.Name1) || text(a.ID) || 'Arlington trail',
        parkName: text(a.ParkID),
        paths,
        source: 'City of Arlington · Trail GIS layer',
        sourceUrl: `${ARLINGTON_PARKS}/4`,
      },
    ];
  });
}
function queryUrl(layer: number, p: Place) {
  const dy = 4500 / 111195,
    dx = dy / Math.cos((p.latitude * Math.PI) / 180);
  const url = new URL(`${ARLINGTON_PARKS}/${layer}/query`);
  url.search = new URLSearchParams({
    where: '1=1',
    geometry: [p.longitude - dx, p.latitude - dy, p.longitude + dx, p.latitude + dy]
      .map((v) => v.toFixed(4))
      .join(','),
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields:
      layer === 1
        ? 'OBJECTID,ID,ParkID,Inactive,Retired,last_edited_date'
        : layer === 16
          ? 'OBJECTID,ID,Parks,Name1,Inactive,Retired,last_edited_date'
          : 'OBJECTID,ID,ParkID,Name1,Type1,Inactive,Retired',
    outSR: '4326',
    f: 'json',
    resultRecordCount: '200',
    geometryPrecision: '5',
    maxAllowableOffset: '0.00002',
  }).toString();
  return url.toString();
}
export async function getDfwRelief(p: Place) {
  const pins: ReliefPin[] = [],
    trails: ReliefTrail[] = [],
    warnings: string[] = [];
  // Query Arlington's jurisdiction only when the selected area is nearby.
  if (p.latitude < 32.58 || p.latitude > 32.86 || p.longitude < -97.25 || p.longitude > -97.01)
    return { pins, trails, warnings };
  const layers = [1, 16, 4] as const;
  const results = await Promise.allSettled(
    layers.map(async (layer) => {
      const d = await upstream<{
        features?: Feature[];
        error?: { message: string };
        exceededTransferLimit?: boolean;
      }>(queryUrl(layer, p), 3600, {}, 15000);
      if (d.error || !Array.isArray(d.features))
        throw new Error(d.error?.message ?? 'Missing GIS features');
      return d;
    }),
  );
  const fetchedAt = new Date().toISOString();
  results.forEach((r, i) => {
    const layer = layers[i]!;
    if (r.status === 'rejected') {
      warnings.push(
        `Arlington ${layer === 1 ? 'fountain' : layer === 16 ? 'pavilion' : 'trail'} data unavailable; other sources may still appear.`,
      );
      return;
    }
    if (r.value.exceededTransferLimit)
      warnings.push('Arlington GIS returned a partial area; move the map to a smaller area.');
    if (layer === 4) trails.push(...normalizeArlingtonTrails(r.value.features!));
    else pins.push(...normalizeArlingtonPins(r.value.features!, layer, p, fetchedAt));
  });
  return { pins, trails, warnings };
}
