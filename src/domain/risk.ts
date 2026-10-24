import {
  PersonalCheckIn,
  Profile,
  RiskEstimate,
  Tier,
  WeatherBundle,
  WeatherPoint,
  Workload,
} from './types';
import { assessPersonal, personalText } from './personal';
import { weatherFreshness } from './weather';
export const toF = (c: number) => (c * 9) / 5 + 32;
function bounded(n: number, min: number, max: number) {
  return Number.isFinite(n) && n >= min && n <= max;
}
/** NWS: preliminary Steadman estimate, Rothfusz regression, then humidity adjustments. */
export function heatIndexF(temperatureF: number, relativeHumidity: number): number {
  if (!bounded(temperatureF, -100, 160) || !bounded(relativeHumidity, 0, 100))
    throw new RangeError('Invalid temperature or humidity');
  const t = temperatureF,
    r = relativeHumidity;
  let hi = (0.5 * (t + 61 + (t - 68) * 1.2 + r * 0.094) + t) / 2;
  if (hi < 80) return hi;
  hi =
    -42.379 +
    2.04901523 * t +
    10.14333127 * r -
    0.22475541 * t * r -
    0.00683783 * t * t -
    0.05481717 * r * r +
    0.00122874 * t * t * r +
    0.00085282 * t * r * r -
    0.00000199 * t * t * r * r;
  if (r < 13 && t >= 80 && t <= 112) hi -= ((13 - r) / 4) * Math.sqrt((17 - Math.abs(t - 95)) / 17);
  else if (r > 85 && t >= 80 && t <= 87) hi += ((r - 85) / 10) * ((87 - t) / 5);
  return hi;
}
/** Screening approximation only. Stull psychrometric wet bulb is NOT natural wet bulb.
 * Globe: steady-state black-sphere balance, spherical solar absorption G/4,
 * emissivity=.95, convective coefficient 6.3*v^.6/.15^.4; longwave at air temp.
 * Does not implement Liljegren or account for radiant surroundings/pressure.
 * Never used to assign occupational work/rest minutes. */
export function approximateWbgtC(w: WeatherPoint): number | undefined {
  if (
    w.solarWm2 === undefined ||
    !bounded(w.solarWm2, 0, 1400) ||
    !bounded(w.windMs, 0, 60) ||
    !bounded(w.temperatureC, 0, 50) ||
    !bounded(w.humidity, 5, 99)
  )
    return undefined;
  const t = w.temperatureC,
    r = w.humidity;
  const wet =
    t * Math.atan(0.151977 * Math.sqrt(r + 8.313659)) +
    Math.atan(t + r) -
    Math.atan(r - 1.676331) +
    0.00391838 * r ** 1.5 * Math.atan(0.023101 * r) -
    4.686035;
  const h = (6.3 * Math.max(w.windMs, 0.2) ** 0.6) / 0.15 ** 0.4;
  const airK = t + 273.15;
  let lo = t,
    hi = t + 80;
  for (let i = 0; i < 45; i++) {
    const globe = (lo + hi) / 2;
    const balance =
      h * (globe - t) +
      0.95 * 5.670374419e-8 * ((globe + 273.15) ** 4 - airK ** 4) -
      (0.95 * w.solarWm2) / 4;
    if (balance > 0) hi = globe;
    else lo = globe;
  }
  return 0.7 * wet + 0.2 * ((lo + hi) / 2) + 0.1 * t;
}
/** Historical OSHA heat-index awareness tiers; guidance, not a legal compliance rule. */
export function heatIndexTier(hi: number): Tier {
  return hi < 91 ? 0 : hi <= 103 ? 1 : hi <= 115 ? 2 : 3;
}
// NIOSH 2017-127, each row is work minutes for light/moderate/heavy at integer adjusted °F.
// null is the publication's Caution cell. Normal is mapped to 60 for a planning ceiling.
const SCHEDULE: Record<number, [number | null, number | null, number | null]> = {
  95: [60, 60, 45],
  96: [60, 60, 45],
  97: [60, 60, 40],
  98: [60, 60, 35],
  99: [60, 60, 35],
  100: [60, 45, 30],
  101: [60, 40, 30],
  102: [60, 35, 25],
  103: [60, 30, 20],
  104: [60, 30, 20],
  105: [60, 25, 15],
  106: [45, 20, null],
  107: [40, 15, null],
  108: [35, null, null],
  109: [30, null, null],
  110: [15, null, null],
  111: [null, null, null],
  112: [null, null, null],
};
export function adjustedTemperatureF(w: WeatherPoint, shade: boolean): number {
  const sun =
    shade || w.isDay === false ? 0 : w.cloudCover === undefined || w.cloudCover < 20 ? 13 : 7;
  // Conservatively round humidity upward to the published 10% bins; no subtraction below 30%.
  const humidity = w.humidity > 50 ? 9 : w.humidity > 40 ? 6 : w.humidity > 30 ? 3 : 0;
  return toF(w.temperatureC) + sun + humidity;
}
export function nioshCycle(
  adjustedF: number,
  workload: Workload,
): { workMinutes: number | null; restMinutes: number | null } {
  const row = adjustedF < 95 ? [60, 60, 60] : SCHEDULE[Math.min(112, Math.ceil(adjustedF))]!;
  // Resting has no validated occupational schedule; use light only as a cautious app planning proxy.
  const work = row[workload === 'heavy' ? 2 : workload === 'moderate' ? 1 : 0] ?? null;
  return { workMinutes: work, restMinutes: work === null ? null : 60 - work };
}
export function evaluateRisk(
  b: WeatherBundle,
  p: Profile,
  workload: Workload,
  now = Date.now(),
  checkIn: PersonalCheckIn | null = null,
): RiskEstimate {
  const w = b.current;
  const heatIndex = heatIndexF(toF(w.temperatureC), w.humidity);
  const heatExposure =
    heatIndex >= 80 || toF(w.temperatureC) >= 80 || (b.heatRisk ?? 0) >= 1 || b.alerts.length > 0;
  const personal = assessPersonal(checkIn, p, now, heatExposure);
  const adjusted = adjustedTemperatureF(w, p.shade),
    cycle = nioshCycle(adjusted, workload);
  let tier = heatIndexTier(heatIndex);
  const reasons: string[] = [];
  if (!p.shade && w.isDay !== false)
    reasons.push('Sun exposure increases the NIOSH schedule temperature.');
  if (w.humidity > 30) reasons.push('Humidity reduces evaporative cooling.');
  if (workload === 'heavy') reasons.push('Heavy exertion adds metabolic heat.');
  if (b.heatRisk !== undefined && b.heatRisk >= 2) {
    tier = Math.max(tier, b.heatRisk - 1) as Tier;
    reasons.push('Official HeatRisk indicates elevated daily heat impacts.');
  }
  if (b.alerts.some((a) => /warning/i.test(a.event))) tier = Math.max(tier, 2) as Tier;
  else if (b.alerts.length) tier = Math.max(tier, 1) as Tier;
  let vulnerability = 0;
  if (p.age !== undefined && p.age >= 40) {
    vulnerability++;
    reasons.push('Age is outside the sample schedule’s under-40 assumptions.');
  }
  if (p.conditions.length || p.medications.length) {
    vulnerability++;
    reasons.push(
      'Reported conditions or medication categories call for extra caution. Never change medication without your clinician.',
    );
  }
  const bmi = p.heightCm && p.weightKg ? p.weightKg / (p.heightCm / 100) ** 2 : undefined;
  if (p.age !== undefined && p.age >= 18 && bmi !== undefined && bmi >= 30) {
    vulnerability++;
    reasons.push('Higher BMI is a caution flag, not a calculated heat-tolerance correction.');
  }
  if (p.fitness !== 'acclimatized') {
    vulnerability++;
    reasons.push('Full heat acclimatization is not confirmed. Build exposure gradually.');
  }
  if (personal.hydration !== 'adequate') {
    vulnerability++;
    reasons.push('Hydration is low or uncertain.');
  }
  if (!p.water) {
    vulnerability++;
    reasons.push('Water is not available.');
  }
  if (w.windMs < 0.5) {
    vulnerability++;
    reasons.push('Very little air movement; sample schedule assumptions may not hold.');
  }
  // Only move upward. Multiple factors are grouped, never assigned physiological minute penalties.
  if (vulnerability && heatExposure)
    tier = Math.min(3, tier + (vulnerability >= 3 ? 2 : 1)) as Tier;
  if (b.aqi && b.aqi.value >= 101 && p.conditions.includes('respiratory')) {
    tier = Math.min(3, tier + 1) as Tier;
    reasons.push(
      'AirNow AQI is unhealthy for sensitive groups, with a respiratory condition reported.',
    );
  }
  let stopReason: string | undefined;
  if (personal.stop) {
    stopReason = personalText(personal.stop);
    // An old check-in requests an update; it does not describe extreme weather.
    if (personal.stop !== 'update') tier = 3;
  } else if (weatherFreshness(b, now) !== 'current')
    stopReason = 'Conditions are stale or invalid. Refresh before starting an outdoor session.';
  else if (p.age !== undefined && p.age < 18 && heatExposure)
    stopReason =
      'The occupational sample schedule is not validated for children. Use a caregiver’s heat plan and avoid exertion in heat.';
  else if (!p.water && toF(w.temperatureC) >= 80)
    stopReason = 'Arrange water and a cool place before activity in this heat.';
  else if (cycle.workMinutes === null)
    stopReason =
      'NIOSH marks this workload and adjusted temperature as Caution. Postpone activity and cool down.';
  else if (tier === 3 || b.heatRisk === 4)
    stopReason = 'Very high concern. Postpone outdoor exertion and seek a cool place.';
  let window: [number, number] | null = null;
  let rest = Math.max(10, cycle.restMinutes ?? 30);
  if (!stopReason) {
    const ceiling = tier === 2 ? 15 : tier === 1 ? 30 : 60;
    const upper = Math.min(cycle.workMinutes!, ceiling);
    const lower = Math.max(5, upper - (upper >= 30 ? 15 : 5));
    window = [lower, upper];
    rest = Math.max(rest, 60 - upper);
  }
  reasons.push(
    'The displayed range and tier caps are conservative HeatGuard planning policy, not validated personal tolerance.',
  );
  reasons.push(...personal.messages.map((key) => personalText(key)));
  if (workload === 'resting')
    reasons.push(
      'Resting uses a cautious planning proxy; NIOSH work schedules were developed for workers.',
    );
  return {
    heatIndexF: heatIndex,
    wbgtC: approximateWbgtC(w),
    adjustedTemperatureF: adjusted,
    tier,
    window,
    breakMinutes: rest,
    reassessMinutes: tier >= 2 ? 10 : 15,
    reasons,
    stopReason,
    sourceSchedule: cycle,
    modelVersion: '0.2.0',
  };
}
