import { heatIndexF, heatIndexTier, toF } from './risk';
import { Place, SkyCondition, WeatherBundle, WeatherPoint } from './types';

// Decorative sky model for the app background. It describes the selected place's sky; it is
// never an input to heat guidance and never fills in missing or stale weather readings.
const RAD = Math.PI / 180;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Open-Meteo WMO weather interpretation codes. */
export function conditionFromWmo(code: unknown): SkyCondition | undefined {
  if (typeof code !== 'number' || !Number.isInteger(code) || code < 0) return undefined;
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95 && code <= 99) return 'storm';
  return undefined;
}

/** NWS `shortForecast` wording such as "Chance Showers And Thunderstorms". */
export function conditionFromForecastText(text: unknown): SkyCondition | undefined {
  if (typeof text !== 'string' || !text.trim()) return undefined;
  const s = text.toLowerCase();
  let wet: SkyCondition | undefined;
  if (/thunder|t-storm/.test(s)) wet = 'storm';
  else if (/snow|sleet|flurr|blizzard|ice pellets|wintry/.test(s)) wet = 'snow';
  else if (/drizzle/.test(s)) wet = 'drizzle';
  else if (/rain|shower/.test(s)) wet = 'rain';
  if (wet) {
    // NWS words low probabilities as "Slight Chance"/"Isolated" and moderate ones as
    // "Chance"/"Scattered"; draw clouds rather than falling precipitation for those.
    if (/\blikely\b/.test(s)) return wet;
    if (/\bslight chance\b|\bisolated\b/.test(s)) return 'partly-cloudy';
    if (/\bchance\b|\bscattered\b/.test(s)) return 'cloudy';
    return wet;
  }
  if (/\bfog\b|\bmist\b/.test(s)) return 'fog';
  if (/partly/.test(s)) return 'partly-cloudy';
  if (/cloudy|overcast/.test(s)) return 'cloudy';
  if (/sunny|clear|fair/.test(s)) return 'clear';
  return undefined;
}

export function conditionFromCloudCover(cover: unknown): SkyCondition | undefined {
  if (typeof cover !== 'number' || !Number.isFinite(cover) || cover < 0 || cover > 100)
    return undefined;
  return cover >= 85 ? 'cloudy' : cover >= 35 ? 'partly-cloudy' : 'clear';
}

export interface SunState {
  /** Degrees above the horizon (negative below it). */
  elevation: number;
  /** 0 at sunrise to 1 at sunset; absent while the sun is down. */
  day?: number;
  /** 0 at sunset to 1 at the next sunrise; absent while the sun is up. */
  night?: number;
  /** Before local solar noon. */
  morning: boolean;
}

function wrap(value: number, span = 360) {
  return ((value % span) + span) % span;
}

/** Low-precision solar position (Astronomical Almanac), about 0.01° near the present day. */
export function sunAt(time: number, latitude: number, longitude: number): SunState {
  const d = time / DAY - 10957.5; // days since J2000.0
  const g = wrap(357.529 + 0.98560028 * d) * RAD;
  const q = wrap(280.459 + 0.98564736 * d);
  const lambda = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const obliquity = (23.439 - 0.00000036 * d) * RAD;
  const ra = wrap(Math.atan2(Math.cos(obliquity) * Math.sin(lambda), Math.cos(lambda)) / RAD);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambda));
  const equationOfTime = wrap(q - ra + 180) - 180;
  const hourAngle = wrap((wrap(time, DAY) / HOUR) * 15 + longitude + equationOfTime) - 180;
  const lat = latitude * RAD;
  const elevation =
    Math.asin(
      Math.sin(lat) * Math.sin(declination) +
        Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle * RAD),
    ) / RAD;
  // Sunrise/sunset hour angle with standard refraction and solar radius (-0.833°).
  const cosRise =
    (Math.sin(-0.833 * RAD) - Math.sin(lat) * Math.sin(declination)) /
    (Math.cos(lat) * Math.cos(declination));
  const rise = cosRise <= -1 ? 180 : cosRise >= 1 ? 0 : Math.acos(cosRise) / RAD;
  const morning = hourAngle < 0;
  if (rise >= 180) return { elevation, day: (hourAngle + 180) / 360, morning };
  if (rise > 0 && Math.abs(hourAngle) <= rise)
    return { elevation, day: (hourAngle + rise) / (2 * rise), morning };
  return { elevation, night: wrap(hourAngle - rise) / (360 - 2 * rise), morning };
}

const SYNODIC_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
/** Mean lunar phase: 0 new, 0.5 full. Within about a day of the true phase. */
export function moonPhase(time: number): number {
  return wrap((time - REFERENCE_NEW_MOON) / DAY, SYNODIC_DAYS) / SYNODIC_DAYS;
}

/**
 * The reading that describes the sky right now: a fresh current reading, or the forecast hour
 * containing now from a recent fetch. Stale bundles draw no weather rather than an old sky.
 */
export function skyWeather(
  b: WeatherBundle | null | undefined,
  now: number,
): WeatherPoint | undefined {
  if (!b) return undefined;
  const fetchAge = now - Date.parse(b.fetchedAt);
  if (!Number.isFinite(fetchAge) || fetchAge > 12 * HOUR || fetchAge < -10 * MINUTE)
    return undefined;
  const age = now - Date.parse(b.current.time);
  if (Number.isFinite(age) && age <= HOUR && age >= -10 * MINUTE) return b.current;
  return b.hourly.find((p) => {
    const start = Date.parse(p.time);
    return start <= now && now - start < HOUR;
  });
}

/** Clock hour at the place when its zone is known, otherwise on this device. */
export function localHour(now: number, timeZone?: string): number {
  if (timeZone)
    try {
      const hour = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' })
        .formatToParts(new Date(now))
        .find((p) => p.type === 'hour');
      const n = Number(hour?.value);
      if (Number.isInteger(n)) return n % 24;
    } catch {
      /* Unknown zone or limited Intl support: use the device clock. */
    }
  return new Date(now).getHours();
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night';
export function dayPeriod(hour: number): DayPeriod {
  return hour >= 5 && hour < 12
    ? 'morning'
    : hour >= 12 && hour < 17
      ? 'afternoon'
      : hour >= 17 && hour < 21
        ? 'evening'
        : 'night';
}

type Rgb = [number, number, number];
type Triple<T> = [T, T, T];
/** Gradient colors from the top of the sky to the horizon. */
export type SkyStops = Triple<string>;
function rgb(color: string): Rgb {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function mixColor(a: string, b: string, t: number): string {
  const x = rgb(a),
    y = rgb(b);
  return `#${x
    .map((v, i) =>
      Math.round(Math.min(255, Math.max(0, v + (y[i]! - v) * t)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase()}`;
}
function luminance(color: string) {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as Rgb;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2 contrast ratio between two #RRGGBB colors. */
export function contrast(a: string, b: string): number {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function mixStops(a: SkyStops, b: SkyStops, t: number | Triple<number>): SkyStops {
  return a.map((c, i) => mixColor(c, b[i]!, typeof t === 'number' ? t : t[i]!)) as SkyStops;
}
function interpolate(frames: [number, SkyStops][], elevation: number): SkyStops {
  const first = frames[0]!,
    last = frames[frames.length - 1]!;
  if (elevation <= first[0]) return first[1];
  for (let i = 1; i < frames.length; i++) {
    const [e1, s1] = frames[i]!;
    if (elevation <= e1) {
      const [e0, s0] = frames[i - 1]!;
      return mixStops(s0, s1, (elevation - e0) / (e1 - e0));
    }
  }
  return last[1];
}

// The backdrop sits behind translucent glass and directly behind page copy, so every broad
// layer stays inside the dark theme: its light text keeps 4.5:1 on each of them (tested).
// Elevation keyframes: top of the sky, middle, horizon.
const SKY: [number, SkyStops][] = [
  [-18, ['#05080F', '#070D1A', '#0B1424']],
  [-10, ['#060B16', '#0A1326', '#111C33']],
  [-5, ['#0A1230', '#16173B', '#26193A']],
  [-1, ['#101A40', '#241D45', '#3E2033']],
  [3, ['#102246', '#22284A', '#3E2A22']],
  [10, ['#0C2948', '#10304F', '#163752']],
  [35, ['#0B2846', '#0F3050', '#123553']],
];
const TONES: Partial<Record<SkyCondition, { day: SkyStops; night: SkyStops; mix: number }>> = {
  'partly-cloudy': {
    day: ['#112843', '#16304B', '#1B354E'],
    night: ['#0C1424', '#121B2E', '#1A2438'],
    mix: 0.2,
  },
  cloudy: {
    day: ['#18222D', '#1E2A37', '#243140'],
    night: ['#0D131C', '#131A25', '#1A222E'],
    mix: 0.75,
  },
  fog: {
    day: ['#20272F', '#252C34', '#2A3139'],
    night: ['#151A21', '#1B2129', '#232A33'],
    mix: 0.85,
  },
  drizzle: {
    day: ['#1A2430', '#202B37', '#26313E'],
    night: ['#0C121B', '#111923', '#18202B'],
    mix: 0.8,
  },
  rain: {
    day: ['#18222E', '#1E2935', '#25303C'],
    night: ['#090E15', '#0D131B', '#121922'],
    mix: 0.9,
  },
  storm: {
    day: ['#12171F', '#171D26', '#1E242E'],
    night: ['#06080D', '#0A0D13', '#0E1219'],
    mix: 0.95,
  },
  snow: {
    day: ['#1D2733', '#232D3A', '#283341'],
    night: ['#111824', '#18202E', '#202A39'],
    mix: 0.85,
  },
};
const HEAT: { day: SkyStops; night: SkyStops } = {
  day: ['#163049', '#2E2A22', '#4A3018'],
  night: ['#0A1224', '#22182A', '#3A1F26'],
};
const WET = new Set<SkyCondition>(['drizzle', 'rain', 'storm', 'snow']);
const CLOUDS: Record<SkyCondition, number> = {
  clear: 0,
  'partly-cloudy': 0.35,
  cloudy: 0.8,
  fog: 0.3,
  drizzle: 0.75,
  rain: 0.9,
  snow: 0.8,
  storm: 1,
};
/**
 * Colors and peak opacities of the drawn layers, shared by the renderer and contrast tests.
 * Fills stay faint; the sun and moon read through crisp line-art strokes like the brand mark.
 */
export const SKY_LAYERS = {
  sun: '#F0B879',
  sunGlow: { day: 0.06, heat: 0.07 },
  sunCore: 0.03,
  moon: '#DCE6F2',
  moonGlow: 0.04,
  moonFill: 0.06,
  horizon: { day: '#F0B879', night: '#C2607E', dayAlpha: 0.09, nightAlpha: 0.24 },
  haze: { color: '#F0B879', alpha: [0, 0.06, 0.09] as const },
  fog: { color: '#AFC0D0', alpha: 0.07 },
  flash: { color: '#DCE6F5', alpha: 0.08 },
  cloudLift: { color: '#8FA6BF', amount: 0.1 },
  particle: '#C9D8E8',
};

// Fractions of the backdrop: where the horizon sits and how high a sun overhead would climb.
export const SKY_HORIZON = 0.86;
const HORIZON = SKY_HORIZON;
const ZENITH = 0.1;
export interface SkyScene {
  period: DayPeriod;
  /** 0 at night through 1 in full daylight; blends day and night weather tones. */
  daylight: number;
  sun?: { x: number; y: number };
  moon?: { x: number; y: number; phase: number; south: boolean };
  glow?: { x: number; strength: number; color: string };
  /** Undefined when no fresh reading describes the sky. */
  condition?: SkyCondition;
  heat: 0 | 1 | 2;
  colors: SkyStops;
  cloud: string;
  clouds: number;
  stars: number;
  rain: number;
  snow: number;
  fog: number;
  lightning: boolean;
}

export function skyScene(
  place: Pick<Place, 'latitude' | 'longitude'>,
  weather: WeatherBundle | null | undefined,
  now: number,
): SkyScene {
  const sun = sunAt(now, place.latitude, place.longitude);
  const daylight = Math.min(1, Math.max(0, (sun.elevation + 6) / 10));
  const point = skyWeather(weather, now);
  const condition = point
    ? (point.condition ?? conditionFromCloudCover(point.cloudCover))
    : undefined;
  let heat: 0 | 1 | 2 = 0;
  if (point && !(condition && WET.has(condition)))
    try {
      const tier = heatIndexTier(heatIndexF(toF(point.temperatureC), point.humidity));
      heat = tier >= 2 ? 2 : tier === 1 ? 1 : 0;
    } catch {
      /* Out-of-range readings draw no heat haze. */
    }
  let colors = interpolate(SKY, sun.elevation);
  const tone = condition ? TONES[condition] : undefined;
  if (tone) colors = mixStops(colors, mixStops(tone.night, tone.day, daylight), tone.mix);
  if (heat) {
    const amount = heat === 2 ? 0.55 : 0.35;
    colors = mixStops(colors, mixStops(HEAT.night, HEAT.day, daylight), [
      amount * 0.4,
      amount * 0.7,
      amount,
    ]);
  }
  const coverClouds =
    condition === 'clear' || condition === 'partly-cloudy'
      ? Math.min(0.6, ((point?.cloudCover ?? 0) / 100) * 0.85)
      : 0;
  const clouds = condition ? Math.max(CLOUDS[condition], coverClouds) : 0;
  const sunUp = sun.day !== undefined;
  // `strength` is the glow's peak opacity at the horizon.
  const { horizon } = SKY_LAYERS;
  const glow =
    sunUp && sun.elevation < 10
      ? {
          x: 0.1 + 0.8 * sun.day!,
          strength: horizon.dayAlpha * (1 - Math.max(0, sun.elevation) / 10) * (1 - clouds * 0.7),
          color: horizon.day,
        }
      : !sunUp && sun.elevation > -8
        ? {
            x: sun.morning ? 0.1 : 0.9,
            strength: horizon.nightAlpha * ((sun.elevation + 8) / 8) * (1 - clouds * 0.7),
            color: horizon.night,
          }
        : undefined;
  return {
    period: dayPeriod(localHour(now, weather?.timezone)),
    daylight,
    sun: sunUp
      ? {
          x: 0.1 + 0.8 * sun.day!,
          y: HORIZON - (HORIZON - ZENITH) * Math.sin(Math.max(0, sun.elevation) * RAD),
        }
      : undefined,
    moon:
      sun.night !== undefined
        ? {
            x: 0.1 + 0.8 * sun.night,
            y: HORIZON - (HORIZON - 0.14) * Math.sin(Math.PI * sun.night),
            phase: moonPhase(now),
            south: place.latitude < 0,
          }
        : undefined,
    glow: glow && glow.strength > 0.005 ? glow : undefined,
    condition,
    heat,
    colors,
    cloud: mixColor(colors[1], SKY_LAYERS.cloudLift.color, SKY_LAYERS.cloudLift.amount),
    clouds,
    stars:
      condition === 'fog'
        ? 0
        : Math.min(1, Math.max(0, (-sun.elevation - 4) / 8)) * (1 - Math.min(1, clouds * 1.2)),
    rain:
      condition === 'storm' ? 1 : condition === 'rain' ? 0.7 : condition === 'drizzle' ? 0.3 : 0,
    snow: condition === 'snow' ? 0.75 : 0,
    fog: condition === 'fog' ? 1 : 0,
    lightning: condition === 'storm',
  };
}
