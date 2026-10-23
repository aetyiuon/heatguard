import { Place, ReliefPin, ReliefTrail } from '../src/domain/types';
import { distanceMeters } from '../src/domain/relief';
import { upstream } from './upstream';
import { getDfwRelief } from './dfw';
export function normalizeOsmPins(elements: any[], updatedAt: string): ReliefPin[] {
  return elements.flatMap((e) => {
    const latitude = e.lat ?? e.center?.lat,
      longitude = e.lon ?? e.center?.lon,
      t = e.tags ?? {};
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      ['private', 'no'].includes(t.access)
    )
      return [];
    const water =
      t.amenity === 'drinking_water' ||
      (['fountain', 'water_tap'].includes(t.amenity ?? t.man_made) && t.drinking_water === 'yes');
    const shelter =
      t.amenity === 'shelter' || (t.leisure === 'picnic_table' && t.covered === 'yes');
    const woods = t.natural === 'wood' || t.landuse === 'forest';
    const ac = t.amenity === 'library',
      center = t.social_facility === 'cooling_center';
    // A park name alone is not evidence of shade. Decorative fountains are not drinking water.
    if (!water && !shelter && !woods && !ac && !center) return [];
    const kind = water ? 'water' : shelter || woods ? 'shade' : ac ? 'ac' : 'cooling-center';
    const feature = water
      ? 'drinking-fountain'
      : shelter
        ? 'shelter'
        : woods
          ? 'wooded-area'
          : undefined;
    const noun = water
      ? 'Drinking fountain'
      : shelter
        ? 'Shade shelter'
        : woods
          ? 'Wooded area · potential shade'
          : ac
            ? 'Public library'
            : 'Cooling space';
    return [
      {
        id: `osm-${e.type}-${e.id}`,
        name: t.name ? `${t.name} · ${noun}` : noun,
        latitude,
        longitude,
        kind,
        feature,
        provenance: 'osm',
        source: woods
          ? 'OpenStreetMap woodland; shade and access unverified'
          : water
            ? 'OpenStreetMap drinking water; working status unverified'
            : shelter
              ? 'OpenStreetMap shelter; shade and access unverified'
              : 'OpenStreetMap; access/AC not verified',
        sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        official: false,
        status: 'unknown',
        updatedAt,
        openingHours: t.opening_hours,
        confirmations: 0,
        reports: 0,
        approximateLocation: !!e.center,
      } satisfies ReliefPin,
    ];
  });
}
export async function getRelief(
  place: Place,
  municipalUrl?: string,
): Promise<{ pins: ReliefPin[]; trails: ReliefTrail[]; warnings: string[]; fetchedAt: string }> {
  // Bounding-box index lookups avoid costly relation-distance expansion; trim point results below.
  const dy = 3000 / 111195,
    dx = dy / Math.max(0.05, Math.cos((place.latitude * Math.PI) / 180));
  const bbox = [
    Math.max(-90, place.latitude - dy),
    Math.max(-180, place.longitude - dx),
    Math.min(90, place.latitude + dy),
    Math.min(180, place.longitude + dx),
  ]
    .map((v) => v.toFixed(4))
    .join(',');
  const query = `[out:json][timeout:15];(nwr[amenity=drinking_water](${bbox});nwr[amenity=fountain][drinking_water=yes](${bbox});nwr[man_made=water_tap][drinking_water=yes](${bbox});nwr[amenity=shelter](${bbox});nwr[leisure=picnic_table][covered=yes](${bbox});way[natural=wood](${bbox});way[landuse=forest](${bbox});nwr[amenity=library](${bbox});nwr[social_facility=cooling_center](${bbox}););out center tags 300;`;
  const [osm, municipal, dfw] = await Promise.allSettled([
    upstream(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`,
      3600,
      {
        'User-Agent': 'HeatGuard/0.1 (local development heat-awareness app)',
        Accept: 'application/json',
      },
      25_000,
    ),
    municipalUrl ? upstream(municipalUrl, 900) : Promise.resolve(undefined),
    getDfwRelief(place),
  ]);
  let pins: ReliefPin[] = [];
  const trails: ReliefTrail[] = [],
    warnings: string[] = [];
  const updatedAt = new Date().toISOString();
  if (osm.status === 'fulfilled')
    pins.push(
      ...normalizeOsmPins(osm.value.elements ?? [], updatedAt).filter(
        (p) => distanceMeters(place, p) <= 3000,
      ),
    );
  else warnings.push('OpenStreetMap lookup unavailable. Cached or saved places may be available.');
  if (municipal.status === 'fulfilled' && municipal.value)
    for (const f of municipal.value.features ?? []) {
      const [longitude, latitude] = f.geometry?.coordinates ?? [];
      const p = f.properties ?? {};
      if (
        f.geometry?.type !== 'Point' ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        distanceMeters(place, { latitude, longitude }) > 10000 ||
        !['water', 'shade', 'ac', 'cooling-center'].includes(p.kind)
      )
        continue;
      // Require authoritative feed provenance and a currently valid verification date.
      const official =
        p.kind === 'cooling-center' &&
        p.official === true &&
        typeof p.sourceUrl === 'string' &&
        p.sourceUrl.startsWith('https://') &&
        Number.isFinite(Date.parse(p.verifiedAt)) &&
        Date.parse(p.verifiedAt) <= Date.now() &&
        Date.now() - Date.parse(p.verifiedAt) < 7 * 86400000 &&
        p.active === true;
      pins.push({
        id: `municipal-${String(f.id ?? p.id)}`,
        name: String(p.name ?? 'Municipal cooling place'),
        latitude,
        longitude,
        kind: p.kind,
        source: String(p.source ?? 'Municipal GeoJSON'),
        sourceUrl: p.sourceUrl,
        official,
        status:
          p.status === 'working'
            ? 'working'
            : p.status === 'not-working'
              ? 'not-working'
              : 'unknown',
        updatedAt: p.verifiedAt ?? updatedAt,
        openingHours: p.openingHours,
        confirmations: 0,
        reports: 0,
      });
    }
  if (municipalUrl && municipal.status === 'rejected') warnings.push('Municipal feed unavailable.');
  if (dfw.status === 'fulfilled') {
    const city = dfw.value.pins;
    pins = pins.filter(
      (p) =>
        p.provenance !== 'osm' || !city.some((c) => c.kind === p.kind && distanceMeters(p, c) < 15),
    );
    pins.push(...city);
    trails.push(...dfw.value.trails);
    warnings.push(...dfw.value.warnings);
  }
  warnings.push(
    'Hours, water availability, shade and AC can change. Confirm access. Walking estimates use straight-line distance, not a surveyed route.',
  );
  return { pins, trails, warnings, fetchedAt: updatedAt };
}
