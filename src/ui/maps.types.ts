import { CityDataset, Place, ReliefPin, ReliefTrail } from '../domain/types';
export interface MapProps {
  place: Place;
  pins: ReliefPin[];
  onSelect: (p: ReliefPin) => void;
  picking?: boolean;
  pickedPoint?: Pick<Place, 'latitude' | 'longitude'>;
  onPickLocation?: (point: Pick<Place, 'latitude' | 'longitude'>) => void;
  routePaths?: Pick<Place, 'latitude' | 'longitude'>[][];
  routeDashed?: boolean;
  trails?: ReliefTrail[];
  showLabels?: boolean;
  city?: CityDataset;
  showParks?: boolean;
  focus?: { latitude: number; longitude: number; name: string; bounds?: CityDataset['bounds'] };
  viewKey?: number;
  reports?: { latitude: number; longitude: number; feeling: string }[];
  heatLayer?: boolean;
  heatRiskValidTime?: string;
}
