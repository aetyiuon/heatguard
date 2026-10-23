import { Platform } from 'react-native';
import { Place, ReliefPin, ReliefTrail, WeatherBundle } from '../domain/types';
import { readLocal, writeLocal } from './storage';
export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { ...options, signal: AbortSignal.timeout(45_000) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? 'Could not reach the HeatGuard proxy.');
  return data;
}
function areaKey(p: Place) {
  return `${p.latitude.toFixed(3)}.${p.longitude.toFixed(3)}`;
}
export async function fetchWeather(
  place: Place,
  allowCache = true,
): Promise<{ data: WeatherBundle; cached: boolean }> {
  const key = `weather.${areaKey(place)}`;
  try {
    const data = await api<WeatherBundle>(`/weather?lat=${place.latitude}&lon=${place.longitude}`);
    data.location = place;
    await writeLocal(key, data);
    return { data, cached: false };
  } catch (e) {
    const data = allowCache ? await readLocal<WeatherBundle | null>(key, null) : null;
    if (data) return { data: { ...data, location: place }, cached: true };
    throw e;
  }
}
export async function fetchRelief(place: Place) {
  const key = `relief.v2.${areaKey(place)}`;
  try {
    const data = await api<{
      pins: ReliefPin[];
      trails?: ReliefTrail[];
      warnings: string[];
      fetchedAt: string;
    }>(`/relief?lat=${place.latitude}&lon=${place.longitude}`);
    await writeLocal(key, data);
    return { ...data, cached: false };
  } catch (e) {
    const data = await readLocal<{
      pins: ReliefPin[];
      trails?: ReliefTrail[];
      warnings: string[];
      fetchedAt: string;
    } | null>(key, null);
    if (data) return { ...data, cached: true };
    throw e;
  }
}
export async function anonymousId() {
  let id = await readLocal<string | null>('anonymousId', null);
  if (!id) {
    id = `hg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    await writeLocal('anonymousId', id);
  }
  return id;
}
export async function communityWrite(path: string, body: Record<string, unknown>) {
  return api(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Client-ID': await anonymousId() },
    body: JSON.stringify({ ...body, consent: true }),
  });
}
export const nativeAvailable = Platform.OS !== 'web';
