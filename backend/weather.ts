import {
  DayForecast,
  HeatRiskLevel,
  Place,
  WeatherBundle,
  WeatherPoint,
} from '../src/domain/types';
import { conditionFromForecastText, conditionFromWmo } from '../src/domain/sky';
import { upstream } from './upstream';
export interface WeatherEnv {
  NWS_USER_AGENT?: string;
  AIRNOW_API_KEY?: string;
}
export const HEATRISK_SERVICE =
  'https://mapservices.weather.noaa.gov/experimental/rest/services/NWS_HeatRisk/ImageServer';
export function parseHeatRisk(value: unknown): HeatRiskLevel | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  if (String(value).trim() === '') return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 4 ? (n as HeatRiskLevel) : undefined;
}
export async function heatRiskForecast(
  place: Place,
): Promise<{ level: HeatRiskLevel; validTime: string; date: string }[]> {
  const query = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: 'objectid,idp_validtime,idp_filedate',
    returnGeometry: 'false',
    orderByFields: 'idp_validtime,idp_filedate DESC',
  });
  const catalog = await upstream(`${HEATRISK_SERVICE}/query?${query}`, 3600);
  if (catalog.error) throw new Error('HeatRisk catalog unavailable');
  const seen = new Set<number>();
  const rasters = (catalog.features ?? [])
    .map((f: any) => f.attributes)
    .filter((a: any) => {
      if (seen.has(a.idp_validtime)) return false;
      seen.add(a.idp_validtime);
      return true;
    })
    .slice(0, 7);
  const results = await Promise.allSettled(
    rasters.map(async (a: any) => {
      const params = new URLSearchParams({
        f: 'json',
        geometry: JSON.stringify({
          x: place.longitude,
          y: place.latitude,
          spatialReference: { wkid: 4326 },
        }),
        geometryType: 'esriGeometryPoint',
        returnCatalogItems: 'false',
        renderingRule: JSON.stringify({ rasterFunction: 'None' }),
        mosaicRule: JSON.stringify({
          mosaicMethod: 'esriMosaicLockRaster',
          lockRasterIds: [a.objectid],
        }),
      });
      const data = await upstream(`${HEATRISK_SERVICE}/identify?${params}`, 3600);
      const level = parseHeatRisk(data.value);
      if (level === undefined) throw new Error('No HeatRisk pixel for location');
      const validTime = new Date(a.idp_validtime).toISOString();
      return { level, validTime, date: validTime.slice(0, 10) };
    }),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
}
function finite(n: unknown) {
  return typeof n === 'number' && Number.isFinite(n);
}
export function nwsHourly(periods: any[]): WeatherPoint[] {
  return periods
    .filter((p: any) => finite(p.relativeHumidity?.value))
    .map((p: any) => {
      const condition = conditionFromForecastText(p.shortForecast);
      return {
        time: p.startTime,
        temperatureC: p.temperatureUnit === 'F' ? ((p.temperature - 32) * 5) / 9 : p.temperature,
        humidity: p.relativeHumidity.value,
        windMs: Math.max(...(p.windSpeed.match(/[\d.]+/g) ?? ['0']).map(Number)) * 0.44704,
        isDay: p.isDaytime,
        // Omitted rather than undefined so a merge keeps a matched Open-Meteo sky description.
        ...(condition ? { condition } : {}),
      };
    });
}
export function normalizeMeteo(m: any, place: Place): WeatherBundle {
  if (
    !m.current ||
    !finite(m.current.temperature_2m) ||
    !finite(m.current.relative_humidity_2m) ||
    !finite(m.current.wind_speed_10m)
  )
    throw new Error('Missing weather values');
  const point = (i: number): WeatherPoint => ({
    time: new Date(m.hourly.time[i] * 1000).toISOString(),
    temperatureC: m.hourly.temperature_2m[i],
    humidity: m.hourly.relative_humidity_2m[i],
    windMs: m.hourly.wind_speed_10m[i],
    solarWm2: m.hourly.shortwave_radiation?.[i] ?? undefined,
    uv: m.hourly.uv_index?.[i] ?? undefined,
    cloudCover: m.hourly.cloud_cover?.[i] ?? undefined,
    isDay: (m.hourly.is_day?.[i] ?? 0) === 1,
    condition: conditionFromWmo(m.hourly.weather_code?.[i]),
  });
  const idx = Math.max(
    0,
    m.hourly.time.findLastIndex((t: number) => t <= m.current.time),
  );
  const hour = point(idx);
  const current: WeatherPoint = {
    ...hour,
    time: new Date(m.current.time * 1000).toISOString(),
    temperatureC: m.current.temperature_2m,
    humidity: m.current.relative_humidity_2m,
    windMs: m.current.wind_speed_10m,
    cloudCover: m.current.cloud_cover,
    isDay: m.current.is_day === 1,
    condition: conditionFromWmo(m.current.weather_code) ?? hour.condition,
  };
  const dateFormat = new Intl.DateTimeFormat('en-CA', {
    timeZone: m.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const daily: DayForecast[] = m.daily.time.map((t: number, i: number) => ({
    date: dateFormat.format(new Date(t * 1000)),
    highC: m.daily.temperature_2m_max[i],
    lowC: m.daily.temperature_2m_min[i],
    uv: m.daily.uv_index_max?.[i] ?? undefined,
  }));
  return {
    fetchedAt: new Date().toISOString(),
    currentSource: 'modeled',
    location: place,
    timezone: typeof m.timezone === 'string' ? m.timezone : undefined,
    current,
    hourly: m.hourly.time
      .map((_: unknown, i: number) => point(i))
      .filter((p: WeatherPoint) => Date.parse(p.time) >= m.current.time * 1000),
    daily,
    alerts: [],
    sources: ['Open-Meteo (modeled current conditions)'],
    warnings: [],
  };
}
export async function getWeather(place: Place, env: WeatherEnv): Promise<WeatherBundle> {
  const base = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,is_day,weather_code',
    hourly:
      'temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,uv_index,cloud_cover,is_day,weather_code',
    daily: 'temperature_2m_max,temperature_2m_min,uv_index_max',
    wind_speed_unit: 'ms',
    timezone: 'auto',
    timeformat: 'unixtime',
    forecast_days: '7',
  });
  const nwsHeaders = {
    'User-Agent':
      env.NWS_USER_AGENT ??
      'HeatGuard/0.1 (development; https://www.weather.gov/documentation/services-web-api)',
    Accept: 'application/geo+json',
  };
  const usCandidate =
    place.latitude >= 18 &&
    place.latitude <= 72 &&
    place.longitude >= -180 &&
    place.longitude <= -60;
  const nws = async () => {
    if (!usCandidate) return undefined;
    const points = await upstream(
      `https://api.weather.gov/points/${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`,
      86400,
      nwsHeaders,
    );
    const [hourly, forecast, alerts] = await Promise.allSettled([
      upstream(points.properties.forecastHourly, 300, nwsHeaders),
      upstream(points.properties.forecast, 600, nwsHeaders),
      upstream(
        `https://api.weather.gov/alerts/active?point=${place.latitude.toFixed(4)},${place.longitude.toFixed(4)}`,
        180,
        nwsHeaders,
      ),
    ]);
    const timeZone: unknown = points.properties.timeZone;
    return { hourly, forecast, alerts, timeZone };
  };
  const [meteo, nwsResult, heatRisk, airnow] = await Promise.allSettled([
    upstream(`https://api.open-meteo.com/v1/forecast?${base}`, 300),
    nws(),
    usCandidate ? heatRiskForecast(place) : Promise.resolve([]),
    env.AIRNOW_API_KEY && usCandidate
      ? upstream(
          `https://www.airnowapi.org/aq/observation/latLong/current/?format=application/json&latitude=${place.latitude}&longitude=${place.longitude}&distance=25&API_KEY=${encodeURIComponent(env.AIRNOW_API_KEY)}`,
          3600,
        )
      : Promise.resolve(undefined),
  ]);
  let bundle: WeatherBundle;
  if (meteo.status === 'fulfilled') bundle = normalizeMeteo(meteo.value, place);
  else if (nwsResult.status === 'fulfilled' && nwsResult.value?.hourly.status === 'fulfilled') {
    const hourly = nwsHourly(nwsResult.value.hourly.value.properties.periods);
    if (!hourly.length) throw new Error('No usable current conditions');
    bundle = {
      fetchedAt: new Date().toISOString(),
      currentSource: 'forecast',
      location: place,
      current: hourly[0]!,
      hourly,
      daily: [],
      alerts: [],
      sources: ['NWS hourly forecast (not an observation)'],
      warnings: ['Open-Meteo unavailable; UV and solar inputs unavailable.'],
    };
  } else
    throw new Error('Weather providers unavailable. Offline symptom guidance is still available.');
  if (nwsResult.status === 'fulfilled' && nwsResult.value) {
    const n = nwsResult.value;
    if (!bundle.timezone && typeof n.timeZone === 'string') bundle.timezone = n.timeZone;
    if (n.hourly.status === 'fulfilled') {
      const hourly = nwsHourly(n.hourly.value.properties.periods);
      // Keep matched radiation/UV supplemental fields without claiming they are NWS measurements.
      bundle.hourly = hourly.map((p: WeatherPoint) => ({
        ...bundle.hourly.find((h) => Math.abs(Date.parse(h.time) - Date.parse(p.time)) < 1800000),
        ...p,
      }));
      bundle.sources.push('NWS point + hourly + daily forecast');
    }
    if (n.alerts.status === 'fulfilled')
      bundle.alerts = (n.alerts.value.features ?? [])
        .filter(
          (f: any) =>
            /heat/i.test(f.properties.event) &&
            (!f.properties.expires || Date.parse(f.properties.expires) > Date.now()),
        )
        .map((f: any) => ({
          id: f.id,
          event: f.properties.event,
          headline: f.properties.headline,
          description: f.properties.description,
          expires: f.properties.expires,
        }));
    else bundle.warnings.push('Official NWS alerts could not be checked.');
    if (!bundle.daily.length && n.forecast.status === 'fulfilled') {
      const groups = new Map<string, any[]>();
      for (const p of n.forecast.value.properties.periods) {
        const d = p.startTime.slice(0, 10);
        groups.set(d, [...(groups.get(d) ?? []), p]);
      }
      bundle.daily = [...groups].map(([date, ps]) => {
        const cs = ps.map((p) =>
          p.temperatureUnit === 'F' ? ((p.temperature - 32) * 5) / 9 : p.temperature,
        );
        return { date, highC: Math.max(...cs), lowC: Math.min(...cs) };
      });
    }
  } else
    bundle.warnings.push(
      usCandidate
        ? 'NWS coverage or service unavailable; using Open-Meteo. Official alerts were not checked.'
        : 'Outside NWS coverage. Using Open-Meteo; check local official warnings.',
    );
  if (heatRisk.status === 'fulfilled' && heatRisk.value.length) {
    for (const d of bundle.daily) {
      const v = heatRisk.value.find((h) => h.date === d.date);
      if (v) {
        d.heatRisk = v.level;
        d.heatRiskValidTime = v.validTime;
      }
    }
    // Today is the local date from the provider timezone, not the device date at another location.
    const localDate =
      meteo.status === 'fulfilled'
        ? new Intl.DateTimeFormat('en-CA', {
            timeZone: meteo.value.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date())
        : new Date().toISOString().slice(0, 10);
    const today = heatRisk.value.find((h) => h.date === localDate);
    if (today) {
      bundle.heatRisk = today.level;
      bundle.heatRiskValidTime = today.validTime;
      bundle.sources.push('NOAA/NWS experimental HeatRisk');
    }
  }
  if (bundle.heatRisk === undefined)
    bundle.warnings.push(
      'Official HeatRisk unavailable for today; heat-index guidance is a separate fallback, not a synthesized HeatRisk score.',
    );
  if (airnow.status === 'fulfilled' && Array.isArray(airnow.value) && airnow.value.length) {
    const a = airnow.value.reduce((best: any, item: any) => (item.AQI > best.AQI ? item : best));
    if (finite(a.AQI) && a.AQI >= 0) {
      bundle.aqi = {
        value: a.AQI,
        category: a.Category.Name,
        observedAt: `${a.DateObserved.trim()} ${a.HourObserved}:00 ${a.LocalTimeZone}`,
      };
      bundle.sources.push('EPA AirNow');
    }
  }
  if (!bundle.aqi)
    bundle.warnings.push('AirNow AQI unavailable; no air-quality safety conclusion can be made.');
  return bundle;
}
