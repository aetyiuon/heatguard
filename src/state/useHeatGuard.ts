import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking, Platform, Share } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  Buddy,
  DEFAULT_PROFILE,
  Language,
  OutdoorSession,
  Place,
  Profile,
  ReliefPin,
  ReliefTrail,
  MapScope,
  WeatherBundle,
  Workload,
} from '../domain/types';
import { evaluateRisk } from '../domain/risk';
import { sessionRemainingSeconds } from '../domain/session';
import { fetchWeather, fetchRelief, api } from '../services/api';
import {
  readLocal,
  writeLocal,
  readPrivate,
  writePrivate,
  clearPrivate,
  clearLocal,
} from '../services/storage';
import {
  cancelReminders,
  scheduleSessionReminders,
  setMonitoring,
  MonitorSettings,
} from '../services/monitoring';
import { nearestAc, directionsUrl, mergePins } from '../domain/relief';
import { DFW_PLACES, OTHER_PLACES } from '../domain/places';
export const PRESETS: Place[] = [...DFW_PLACES, ...OTHER_PLACES];
export type Tab = 'home' | 'relief' | 'plan' | 'community' | 'profile';
export type Sheet = 'location' | 'wardrobe' | 'symptoms' | 'method' | null;
export function useHeatGuard() {
  const [tab, setTab] = useState<Tab>('home'),
    [sheet, setSheet] = useState<Sheet>(null);
  const [lang, setLang] = useState<Language>('en'),
    [large, setLarge] = useState(false);
  const [place, setPlace] = useState<Place>(PRESETS[0]!);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE),
    [workload, setWorkload] = useState<Workload>('moderate');
  const [weather, setWeather] = useState<WeatherBundle | null>(null),
    [cached, setCached] = useState(false);
  const [pins, setPins] = useState<ReliefPin[]>([]),
    [localPins, setLocalPins] = useState<ReliefPin[]>([]);
  const [mapCached, setMapCached] = useState(false),
    [mapWarnings, setMapWarnings] = useState<string[]>([]);
  const [mapTrails, setMapTrails] = useState<ReliefTrail[]>([]);
  const [mapScope, setMapScope] = useState<MapScope>('tx30');
  const [loading, setLoading] = useState(false),
    [mapLoading, setMapLoading] = useState(false),
    [error, setError] = useState('');
  const [session, setSession] = useState<OutdoorSession | null>(null),
    [now, setNow] = useState(Date.now());
  const [buddies, setBuddies] = useState<Buddy[]>([]),
    [monitor, setMonitor] = useState<MonitorSettings | null>(null);
  const generation = useRef(0);
  const mapGeneration = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    void (async () => {
      const [savedPlace, savedLang, savedLarge, p, savedWork, local, savedSession, m, ids] =
        await Promise.all([
          readLocal('place', PRESETS[0]!),
          readLocal<Language>('lang', 'en'),
          readLocal('large', false),
          readPrivate('profile', DEFAULT_PROFILE),
          readLocal<Workload>('workload', 'moderate'),
          readLocal<ReliefPin[]>('pins', []),
          readLocal<OutdoorSession | null>('session', null),
          readLocal<MonitorSettings | null>('monitor', null),
          readPrivate<string[]>('buddy-index', []),
        ]);
      if (!active.current) return;
      setPlace(savedPlace);
      setLang(savedLang);
      setLarge(savedLarge);
      setProfile(p);
      setWorkload(savedWork);
      setLocalPins(local);
      setSession(savedSession);
      setMonitor(m);
      const contacts = await Promise.all(
        ids.map((id) => readPrivate<Buddy | null>(`buddy-${id}`, null)),
      );
      if (active.current) setBuddies(contacts.filter((c): c is Buddy => !!c));
      const old = await readLocal<WeatherBundle | null>(
        `weather.${savedPlace.latitude.toFixed(3)}.${savedPlace.longitude.toFixed(3)}`,
        null,
      );
      if (active.current && old) {
        setWeather(old);
        setCached(true);
      }
    })().catch((e) => setError(String(e)));
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), session ? 1000 : 30_000);
    const listener = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(id);
      listener.remove();
    };
  }, [!!session]);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = (data: Record<string, unknown>) => {
      setTab(data.screen === 'community' ? 'community' : 'home');
      void refresh();
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      show(r.notification.request.content.data ?? {}),
    );
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) show(r.notification.request.content.data ?? {});
    });
    const link = Linking.addEventListener('url', (e) => {
      if (e.url.includes('risk')) {
        setTab('home');
        void refresh();
      }
    });
    return () => {
      sub.remove();
      link.remove();
    };
  }, [place.latitude, place.longitude]);
  const risk = useMemo(
    () => (weather ? evaluateRisk(weather, profile, workload, now) : null),
    [weather, profile, workload, Math.floor(now / 60000)],
  );
  useEffect(() => {
    if (!session) return;
    const id = setInterval(
      () => {
        if (AppState.currentState === 'active') void refresh();
      },
      (risk?.reassessMinutes ?? 15) * 60000,
    );
    return () => clearInterval(id);
  }, [session?.id, place.latitude, place.longitude, risk?.reassessMinutes]);
  async function refresh(p = place) {
    const g = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const result = await fetchWeather(p);
      if (g === generation.current) {
        setWeather(result.data);
        setCached(result.cached);
      }
    } catch (e) {
      if (g === generation.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === generation.current) setLoading(false);
    }
  }
  async function changePlace(p: Place) {
    generation.current++;
    mapGeneration.current++;
    setPlace(p);
    setWeather(null);
    setPins([]);
    setMapTrails([]);
    setMapWarnings([]);
    setMapLoading(false);
    setMapCached(false);
    setSheet(null);
    await writeLocal('place', p);
    if (session) await endSession();
    if (monitor?.enabled) {
      await setMonitoring({ ...monitor, enabled: false });
      setMonitor({ ...monitor, enabled: false });
    }
    void refresh(p);
  }
  async function useGps() {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted)
        throw new Error('Location declined. Enter a city or coordinates to check manually.');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let name = 'GPS location',
        emergencyNumber = place.emergencyNumber;
      try {
        const [address] = await Location.reverseGeocodeAsync(p.coords);
        name = [address?.city, address?.region].filter(Boolean).join(', ') || name;
        const numbers: Record<string, string> = {
          US: '911',
          CA: '911',
          GB: '999',
          AU: '000',
          NZ: '111',
          JP: '119',
          IN: '112',
        };
        if (address?.isoCountryCode) emergencyNumber = numbers[address.isoCountryCode] ?? '112';
      } catch {}
      await changePlace({
        name,
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        emergencyNumber,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  async function saveProfile(p: Profile) {
    await writePrivate('profile', p);
    setProfile(p);
  }
  async function chooseWork(w: Workload) {
    setWorkload(w);
    await writeLocal('workload', w);
    if (session) await endSession();
  }
  async function loadMap() {
    const g = ++mapGeneration.current;
    setMapLoading(true);
    setError('');
    try {
      const result = await fetchRelief(place);
      if (g !== mapGeneration.current) return;
      setPins(result.pins);
      setMapTrails(result.trails ?? []);
      setMapCached(result.cached);
      setMapWarnings(result.warnings);
      try {
        const shared = await api<{ pins: ReliefPin[] }>(
          `/community?lat=${place.latitude}&lon=${place.longitude}`,
        );
        if (g === mapGeneration.current) setPins([...result.pins, ...shared.pins]);
      } catch {
        /* Optional shared backend does not block public map data. */
      }
    } catch (e) {
      if (g === mapGeneration.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (g === mapGeneration.current) setMapLoading(false);
    }
  }
  const allPins = useMemo(
    () =>
      mergePins(
        pins,
        localPins.filter(
          (p) =>
            Math.abs(p.latitude - place.latitude) < 0.1 &&
            Math.abs(p.longitude - place.longitude) < 0.1,
        ),
      ),
    [pins, localPins, place.latitude, place.longitude],
  );
  async function savePin(p: ReliefPin) {
    const next = [...localPins.filter((x) => x.id !== p.id), p].slice(-100);
    setLocalPins(next);
    await writeLocal('pins', next);
  }
  async function routeAc() {
    let available = allPins;
    if (!available.length) {
      try {
        const data = await fetchRelief(place);
        available = data.pins;
        setPins(data.pins);
      } catch (e) {
        setError(String(e));
        return;
      }
    }
    const pin = nearestAc(available, place);
    if (pin) await Linking.openURL(directionsUrl(pin));
    else {
      setTab('relief');
      setError(
        lang === 'es'
          ? 'No hay un lugar fresco confirmado. Llama al 211 en EE. UU. para consultar opciones locales.'
          : 'No nearby AC place was found. In the US, call 211 for local cooling resources.',
      );
    }
  }
  async function startSession() {
    if (!risk?.window) {
      setError(
        lang === 'es'
          ? 'Revisa las condiciones y las recomendaciones antes de iniciar.'
          : 'Check current conditions and recommendations before starting.',
      );
      return;
    }
    const seconds = risk.window[0] * 60;
    let ids: string[] = [];
    try {
      ids = await scheduleSessionReminders(seconds, risk.tier, lang === 'es');
    } catch (e) {
      setError(String(e));
    }
    const timestamp = Date.now();
    setNow(timestamp);
    const next: OutdoorSession = {
      id: String(timestamp),
      startedAt: timestamp,
      workStartedAt: timestamp,
      phase: 'active',
      breaks: 0,
      notificationIds: ids,
    };
    setSession(next);
    await writeLocal('session', next);
  }
  async function endSession() {
    if (session) await cancelReminders(session.notificationIds);
    setSession(null);
    await writeLocal('session', null);
  }
  async function takeBreak() {
    if (!session) return;
    await cancelReminders(session.notificationIds);
    setNow(Date.now());
    const next = {
      ...session,
      phase: 'break' as const,
      breakStartedAt: Date.now(),
      notificationIds: [],
    };
    setSession(next);
    await writeLocal('session', next);
  }
  async function finishBreak() {
    if (
      !session ||
      !risk?.window ||
      !session.breakStartedAt ||
      Date.now() - session.breakStartedAt < risk.breakMinutes * 60000
    )
      return;
    let ids: string[] = [];
    try {
      ids = await scheduleSessionReminders(risk.window[0] * 60, risk.tier, lang === 'es');
    } catch (e) {
      setError(String(e));
    }
    setNow(Date.now());
    const next = {
      ...session,
      phase: 'active' as const,
      workStartedAt: Date.now(),
      breakStartedAt: undefined,
      breaks: session.breaks + 1,
      notificationIds: ids,
    };
    setSession(next);
    await writeLocal('session', next);
  }
  const remainingSeconds = session && risk ? sessionRemainingSeconds(session, risk, now) : 0;
  // Reconcile pending notifications whenever weather/profile shortens the current recommendation.
  useEffect(() => {
    if (!session || session.phase !== 'active' || !risk) return;
    let disposed = false;
    const reconcile = async () => {
      await cancelReminders(session.notificationIds);
      const seconds = risk.window
        ? Math.max(1, (session.workStartedAt + risk.window[0] * 60000 - Date.now()) / 1000)
        : 1;
      try {
        const ids = await scheduleSessionReminders(seconds, risk.tier, lang === 'es', false);
        if (disposed) {
          await cancelReminders(ids);
          return;
        }
        const next = { ...session, notificationIds: ids };
        setSession(next);
        await writeLocal('session', next);
      } catch {
        /* In-app timer continues when notification permission is declined. */
      }
    };
    void reconcile();
    return () => {
      disposed = true;
    };
  }, [
    session?.id,
    session?.phase,
    session?.workStartedAt,
    risk?.window?.[0],
    risk?.stopReason,
    risk?.tier,
  ]);
  async function shareCard() {
    if (!risk) return;
    await Share.share({
      message:
        lang === 'es'
          ? `HeatGuard · ${place.name}\nIntervalo estimado hasta el descanso: ${risk.window ? risk.window.join('–') + ' min' : 'posponer actividad'}. Descanso: ${risk.breakMinutes} min. Estimación general, no predicción médica. Enfríate antes; ante síntomas busca ayuda. Datos: ${weather?.current.time}. https://www.cdc.gov/niosh/heat-stress/about/illnesses.html`
          : `HeatGuard · ${place.name}\nEstimated time to a cooling break: ${risk.window ? risk.window.join('–') + ' min' : 'postpone activity'}. Cooling break: ${risk.breakMinutes} min. General guidance, not a medical prediction. Cool down early; seek help for symptoms. Data time: ${weather?.current.time}. https://www.cdc.gov/niosh/heat-stress/about/illnesses.html`,
    });
  }
  async function saveBuddy(b: Buddy) {
    if (!buddies.some((x) => x.id === b.id) && buddies.length >= 5)
      throw new Error('This scaffold supports up to five trusted contacts.');
    const next = [...buddies.filter((x) => x.id !== b.id), b];
    await writePrivate(`buddy-${b.id}`, b);
    await writePrivate(
      'buddy-index',
      next.map((x) => x.id),
    );
    setBuddies(next);
  }
  async function removeBuddy(id: string) {
    await clearPrivate(`buddy-${id}`);
    const next = buddies.filter((b) => b.id !== id);
    await writePrivate(
      'buddy-index',
      next.map((b) => b.id),
    );
    setBuddies(next);
  }
  async function monitoring(enabled: boolean) {
    const next: MonitorSettings = { enabled, place, workload, threshold: 2, language: lang };
    await setMonitoring(next);
    setMonitor(next);
  }
  async function preferences(l: Language, big: boolean) {
    setLang(l);
    setLarge(big);
    await Promise.all([writeLocal('lang', l), writeLocal('large', big)]);
    if (monitor?.enabled) {
      const next = { ...monitor, language: l };
      await setMonitoring(next);
      setMonitor(next);
    }
  }
  async function erase() {
    await endSession();
    if (monitor?.enabled) await setMonitoring({ ...monitor, enabled: false });
    await clearPrivate('profile');
    for (const b of buddies) await clearPrivate(`buddy-${b.id}`);
    await clearPrivate('buddy-index');
    await clearLocal();
    setProfile(DEFAULT_PROFILE);
    setBuddies([]);
    setLocalPins([]);
    setWeather(null);
    setPins([]);
    setMapTrails([]);
    setMonitor(null);
  }
  return {
    tab,
    setTab,
    sheet,
    setSheet,
    lang,
    large,
    place,
    profile,
    workload,
    weather,
    cached,
    risk,
    pins: allPins,
    mapCached,
    mapWarnings,
    mapTrails,
    mapScope,
    setMapScope,
    localPins,
    loading,
    mapLoading,
    error,
    setError,
    session,
    now,
    remainingSeconds,
    buddies,
    monitor,
    refresh,
    changePlace,
    useGps,
    saveProfile,
    chooseWork,
    loadMap,
    savePin,
    routeAc,
    startSession,
    endSession,
    takeBreak,
    finishBreak,
    shareCard,
    saveBuddy,
    removeBuddy,
    monitoring,
    preferences,
    erase,
  };
}
export type HeatGuardState = ReturnType<typeof useHeatGuard>;
