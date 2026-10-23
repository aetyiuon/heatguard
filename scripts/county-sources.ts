import { ReliefPin, ReliefTrail } from '../src/domain/types';
import { insidePolygons } from '../src/domain/cities';

// Layer 1 excludes funded/planned alignments, on-street lanes and rural shoulders.
export const NCTCOG_TRAILS =
  'https://geospatial.nctcog.org/map/rest/services/Transportation/BikewayNetwork/FeatureServer/1';
export const GARLAND_PAVILIONS =
  'https://maps.garlandtx.gov/arcgis/rest/services/dept_PARK/Parks_Facilities/MapServer/4';

export function garlandShelters(features: any[], fetchedAt: string): ReliefPin[] {
  return features.flatMap((feature) => {
    const a = feature.attributes;
    // The municipal pavilion layer uses facility type 26. Never infer shelter from a park.
    if (
      a?.FACILITY_TYPE !== 26 ||
      !Number.isFinite(a.OBJECTID) ||
      /\b(retired|removed|pad|proposed|planned|foundation)\b/i.test(a.FACILITY_NAME ?? '')
    )
      return [];
    const ring: [number, number][] | undefined = feature.geometry?.rings?.[0];
    if (
      !ring ||
      ring.length < 4 ||
      !ring.every(
        (p) =>
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1]) &&
          Math.abs(p[0]) <= 180 &&
          Math.abs(p[1]) <= 90,
      )
    )
      throw new Error('Invalid Garland pavilion footprint; previous snapshot retained.');
    const points = ring.slice(0, -1);
    const center: [number, number] = [
      points.reduce((s, p) => s + p[0], 0) / points.length,
      points.reduce((s, p) => s + p[1], 0) / points.length,
    ];
    // Keep even concave-footprint representatives on the published footprint.
    const [longitude, latitude] = insidePolygons(center[0], center[1], [[ring]])
      ? center
      : ring[0]!;
    const edited = Number(a.last_edited_date);
    return [
      {
        id: `municipal-garland-pavilion-${a.OBJECTID}`,
        name: a.FACILITY_NAME || `${a.PARK_ID || 'Garland park'} · Pavilion`,
        parkName: a.PARK_ID || undefined,
        latitude,
        longitude,
        kind: 'shade',
        feature: 'shelter',
        provenance: 'municipal',
        source: 'City of Garland · mapped pavilion footprint; shade and access unverified',
        sourceUrl: GARLAND_PAVILIONS,
        sourceUpdatedAt:
          Number.isFinite(edited) && edited > 0 && edited <= Date.parse(fetchedAt)
            ? new Date(edited).toISOString()
            : undefined,
        approximateLocation: true,
        official: false,
        status: 'unknown',
        updatedAt: fetchedAt,
        confirmations: 0,
        reports: 0,
      } satisfies ReliefPin,
    ];
  });
}

export function countyTrails(
  features: any[],
  clip: (paths: [number, number][][]) => [number, number][][],
): ReliefTrail[] {
  return features.flatMap((feature) => {
    const a = feature.attributes;
    if (a?.Status !== 'Existing' || a.OnOffStr !== 'Off-Street' || a.AlignPend === 'Yes') return [];
    const raw = feature.geometry?.paths;
    if (
      !Array.isArray(raw) ||
      !raw.every(
        (path: any) =>
          Array.isArray(path) &&
          path.every(
            (p: any) =>
              Array.isArray(p) &&
              p.length >= 2 &&
              Number.isFinite(p[0]) &&
              Number.isFinite(p[1]) &&
              Math.abs(p[0]) <= 180 &&
              Math.abs(p[1]) <= 90,
          ),
      )
    )
      throw new Error('Invalid NCTCOG trail geometry; previous snapshot retained.');
    const paths = clip(raw);
    if (!paths.length) return [];
    return [
      {
        id: `nctcog-trail-${a.OBJECTID}`,
        name: a.Name || 'Mapped off-street walking / cycling path',
        paths,
        source:
          'NCTCOG and member local governments · existing off-street path; shade, access and closures unverified',
        sourceUrl: NCTCOG_TRAILS,
      },
    ];
  });
}
