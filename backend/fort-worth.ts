import { ReliefPin } from '../src/domain/types';
export const FORT_WORTH_PARK_ASSETS =
  'https://gisasset.fortworthtexas.gov/ags/rest/services/Assets/Assets_Parks/MapServer';
/** Municipal layer identity supplies the amenity type; condition is not a live operating report. */
export function fortWorthPins(features: any[], layer: 10 | 25, at: string): ReliefPin[] {
  return features.flatMap((f) => {
    const a = f.attributes ?? f.properties,
      g = f.geometry;
    const longitude = g?.type === 'Point' ? g.coordinates[0] : g?.x,
      latitude = g?.type === 'Point' ? g.coordinates[1] : g?.y;
    if (
      !a ||
      !Number.isFinite(a.OBJECTID) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    )
      throw new Error('Invalid Fort Worth asset; retain the previous snapshot.');
    if (
      /\b(removed|retired|inactive|proposed|planned|abandoned|demolished)\b/i.test(
        `${a.CONDITION ?? ''} ${a.COMMENTS ?? ''}`,
      )
    )
      return [];
    return [
      {
        id: `municipal-fort-worth-${layer}-${a.OBJECTID}`,
        name: `${a.PARK || 'Fort Worth park'} · ${layer === 10 ? 'Drinking fountain' : 'Shade shelter'}${a.ASSETID ? ` #${a.ASSETID}` : ''}`,
        parkName: a.PARK || undefined,
        assetId: a.ASSETID ? String(a.ASSETID) : undefined,
        latitude,
        longitude,
        kind: layer === 10 ? 'water' : 'shade',
        feature: layer === 10 ? 'drinking-fountain' : 'shelter',
        source: `City of Fort Worth · mapped ${layer === 10 ? 'drinking fountain' : 'shelter'}; access and operation unverified`,
        sourceUrl: `${FORT_WORTH_PARK_ASSETS}/${layer}`,
        official: false,
        status: 'unknown',
        updatedAt: at,
        confirmations: 0,
        reports: 0,
        provenance: 'municipal',
      } satisfies ReliefPin,
    ];
  });
}
