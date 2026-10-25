export type Workload = 'resting' | 'light' | 'moderate' | 'heavy';
export type Tier = 0 | 1 | 2 | 3;
export type HeatRiskLevel = 0 | 1 | 2 | 3 | 4;
export type Language = 'en' | 'es';
export interface Place {
  latitude: number;
  longitude: number;
  name: string;
  emergencyNumber: string;
}
export interface Profile {
  age?: number;
  heightCm?: number;
  weightKg?: number;
  sex?: string;
  conditions: string[];
  medications: string[];
  fitness: 'unknown' | 'sedentary' | 'lightly-active' | 'very-active' | 'acclimatized';
  hydration: 'adequate' | 'unsure' | 'low';
  shade: boolean;
  water: boolean;
}
export const DEFAULT_PROFILE: Profile = {
  conditions: [],
  medications: [],
  fitness: 'unknown',
  hydration: 'unsure',
  shade: false,
  water: false,
};
/** Optional, private snapshot. Measurements retain their own acquisition times. */
export interface PersonalCheckIn {
  at: number;
  feeling: 'unknown' | 'well' | 'unwell' | 'emergency';
  hydration: Profile['hydration'];
  clothing: 'ordinary' | 'heavy' | 'unknown';
  heartRate?: { bpm: number; at: number; context: 'rested' | 'active' };
  temperature?: {
    c: number;
    at: number;
    method: 'oral' | 'ear' | 'forehead' | 'wrist';
  };
}
/** Provider sky description normalized for the decorative backdrop; absent when not reported. */
export type SkyCondition =
  'clear' | 'partly-cloudy' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export interface WeatherPoint {
  time: string;
  temperatureC: number;
  humidity: number;
  windMs: number;
  solarWm2?: number;
  cloudCover?: number;
  isDay?: boolean;
  uv?: number;
  condition?: SkyCondition;
}
export interface DayForecast {
  date: string;
  highC: number;
  lowC: number;
  uv?: number;
  heatRisk?: HeatRiskLevel;
  heatRiskValidTime?: string;
}
export interface WeatherBundle {
  fetchedAt: string;
  currentSource?: 'modeled' | 'forecast' | 'observation';
  location: Place;
  /** IANA zone of the checked place, when the provider reports one. */
  timezone?: string;
  current: WeatherPoint;
  hourly: WeatherPoint[];
  daily: DayForecast[];
  heatRisk?: HeatRiskLevel;
  heatRiskValidTime?: string;
  alerts: { id: string; event: string; headline: string; description: string; expires: string }[];
  aqi?: { value: number; category: string; observedAt: string };
  sources: string[];
  warnings: string[];
}
export interface RiskEstimate {
  heatIndexF: number;
  wbgtC?: number;
  adjustedTemperatureF: number;
  tier: Tier;
  window: [number, number] | null;
  breakMinutes: number;
  reassessMinutes: number;
  reasons: string[];
  stopReason?: string;
  sourceSchedule: { workMinutes: number | null; restMinutes: number | null };
  modelVersion: string;
}
export type PinKind = 'water' | 'shade' | 'ac' | 'cooling-center';
export interface ReliefPin {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  kind: PinKind;
  source: string;
  sourceUrl?: string;
  official: boolean;
  status: 'unknown' | 'working' | 'not-working';
  updatedAt: string;
  openingHours?: string;
  confirmations: number;
  reports: number;
  provenance?: 'municipal' | 'osm' | 'community';
  feature?: 'drinking-fountain' | 'shelter' | 'wooded-area';
  parkName?: string;
  assetId?: string;
  sourceUpdatedAt?: string;
  approximateLocation?: boolean;
  regionName?: string;
  localityName?: string;
}
export interface ReliefTrail {
  id: string;
  name: string;
  parkName?: string;
  paths: [number, number][][];
  source: string;
  sourceUrl: string;
  regionName?: string;
  localityName?: string;
}
export type CityId = 'arlington' | 'dallas' | 'fort-worth';
export type DistrictId = 'tx06' | 'tx30';
export type CountyId = 'dallas-county';
export type MappedAreaId = CityId | DistrictId | CountyId | 'all-dfw';
export type MapScope = MappedAreaId | 'nearby';
export type PolygonCoordinates = [number, number][][][];
export interface MappedPark {
  id: string;
  name: string;
  address?: string;
  polygons: PolygonCoordinates;
  sourceUrl: string;
  regionName?: string;
  localityName?: string;
}
export interface CoverageRegion {
  id: string;
  name: string;
  bounds: [number, number, number, number];
  polygons: PolygonCoordinates;
  partial: boolean;
  pinCount: number;
  parkCount: number;
  trailCount: number;
}
export interface CityDataset {
  city: MappedAreaId;
  areaType?: 'city' | 'congressional-district' | 'county' | 'region';
  boundaryLabel?: string;
  boundaryVersion?: string;
  regions?: CoverageRegion[];
  localities?: {
    id: string;
    name: string;
    bounds: [number, number, number, number];
    pinCount: number;
  }[];
  coverage?: {
    status?: 'complete' | 'baseline';
    completedSections: number;
    totalSections: number;
    emptySections: number;
    boundaryCoverage: number;
  };
  name: string;
  fetchedAt: string;
  bounds: [number, number, number, number]; // west, south, east, north
  boundary: PolygonCoordinates;
  boundarySource: string;
  pins: ReliefPin[];
  parks: MappedPark[];
  trails: ReliefTrail[];
  sources: { name: string; url: string; records: number }[];
  warnings: string[];
}
export interface Buddy {
  id: string;
  name: string;
  phone: string;
  place?: Place;
  neighbor: boolean;
  checkInMinutes: number;
  lastCheckIn?: number;
}
export interface OutdoorSession {
  id: string;
  startedAt: number;
  phase: 'active' | 'break';
  breakStartedAt?: number;
  workStartedAt: number;
  breaks: number;
  notificationIds: string[];
}
