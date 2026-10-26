import { CityDataset, Place } from './types';

/** Explicit point focus takes precedence over the loaded area's bounds, including at 0°. */
export function reliefMapRegion(
  place: Pick<Place, 'latitude' | 'longitude'>,
  focus?: Pick<Place, 'latitude' | 'longitude'> & { bounds?: CityDataset['bounds'] },
  areaBounds?: CityDataset['bounds'],
) {
  const bounds = focus ? focus.bounds : areaBounds;
  if (bounds)
    return {
      latitude: (bounds[1] + bounds[3]) / 2,
      longitude: (bounds[0] + bounds[2]) / 2,
      latitudeDelta: Math.max(0.008, (bounds[3] - bounds[1]) * 1.3),
      longitudeDelta: Math.max(0.008, (bounds[2] - bounds[0]) * 1.3),
    };
  return {
    latitude: focus?.latitude ?? place.latitude,
    longitude: focus?.longitude ?? place.longitude,
    latitudeDelta: focus ? 0.015 : 0.055,
    longitudeDelta: focus ? 0.015 : 0.055,
  };
}
