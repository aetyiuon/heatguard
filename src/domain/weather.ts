import { Place, WeatherBundle } from './types';

export const WEATHER_REFRESH_MS = 5 * 60_000;
export const WEATHER_FOCUS_REFRESH_MS = 60_000;
const MAX_WEATHER_AGE_MS = 60 * 60_000;
const FUTURE_TOLERANCE_MS = 10 * 60_000;

export function weatherFreshness(weather: WeatherBundle | null, now: number) {
  if (!weather) return 'unavailable';
  const readingAge = now - Date.parse(weather.current.time);
  const fetchedAge = now - Date.parse(weather.fetchedAt);
  if (
    !Number.isFinite(readingAge) ||
    !Number.isFinite(fetchedAge) ||
    readingAge < -FUTURE_TOLERANCE_MS ||
    fetchedAge < -FUTURE_TOLERANCE_MS
  )
    return 'invalid';
  return readingAge > MAX_WEATHER_AGE_MS || fetchedAge > MAX_WEATHER_AGE_MS ? 'stale' : 'current';
}

export function weatherAgeMinutes(weather: WeatherBundle | null, now: number) {
  if (!weather || !Number.isFinite(Date.parse(weather.current.time))) return null;
  return Math.max(0, Math.floor((now - Date.parse(weather.current.time)) / 60_000));
}

export function currentWeatherSource(weather: WeatherBundle) {
  if (weather.currentSource) return weather.currentSource;
  // Older saved bundles predate explicit current-condition provenance.
  if (weather.sources.some((s) => s.includes('Open-Meteo'))) return 'modeled';
  if (weather.sources.some((s) => s.includes('NWS hourly forecast'))) return 'forecast';
  return 'unknown';
}

export interface WeatherLoadResult {
  data: WeatherBundle;
  cached: boolean;
}
interface WeatherCallbacks {
  start: () => void;
  success: (result: WeatherLoadResult) => void;
  failure: (error: unknown) => void;
  finish: () => void;
}

/** Coalesce checks, throttle focus events, and discard superseded location responses. */
export function createWeatherRefresher(
  load: (place: Place) => Promise<WeatherLoadResult>,
  clock: () => number = Date.now,
) {
  let version = 0;
  let lastKey = '';
  let lastAttempt = -Infinity;
  let pending: { key: string; version: number; promise: Promise<void> } | undefined;
  return {
    refresh(place: Place, callbacks: WeatherCallbacks, minimumInterval = 0): Promise<void> {
      const key = `${place.latitude},${place.longitude}`;
      if (pending?.key === key) return pending.promise;
      if (key === lastKey && clock() - lastAttempt < minimumInterval) return Promise.resolve();
      const requestVersion = ++version;
      lastKey = key;
      lastAttempt = clock();
      callbacks.start();
      const promise = Promise.resolve()
        .then(() => load(place))
        .then((result) => {
          if (version === requestVersion) callbacks.success(result);
        })
        .catch((error: unknown) => {
          if (version === requestVersion) callbacks.failure(error);
        })
        .finally(() => {
          if (pending?.version === requestVersion) pending = undefined;
          if (version === requestVersion) callbacks.finish();
        });
      pending = { key, version: requestVersion, promise };
      return promise;
    },
    invalidate() {
      version++;
      pending = undefined;
      lastKey = '';
      lastAttempt = -Infinity;
    },
  };
}
