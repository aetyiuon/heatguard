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
  PersonalCheckIn,
  ReliefPin,
  ReliefTrail,
  MapScope,
  WeatherBundle,
  Workload,
} from '../domain/types';
import { evaluateRisk } from '../domain/risk';
import { validCheckIn } from '../domain/personal';
import {
  createWeatherRefresher,
  WEATHER_FOCUS_REFRESH_MS,
  WEATHER_REFRESH_MS,
} from '../domain/weather';
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
import { CoolingSearchResult, findCoolingPlace, directionsUrl, mergePins } from '../domain/relief';
import { bundledCity } from '../domain/cities';
import { DFW_PLACES, OTHER_PLACES } from '../domain/places';
import { useJourney } from './useJourney';
import { useBiometrics } from './useBiometrics';
export const PRESETS: Place[] = [...DFW_PLACES, ...OTHER_PLACES];
export type Tab = 'home' | 'relief' | 'journey' | 'plan' | 'community' | 'profile';
export type Sheet = 'location' | 'wardrobe' | 'symptoms' | 'method' | 'checkin' | null;
export function useHeatGuard() {
  const journey = useJourney();
  const biometrics = useBiometrics();
  const [tab, setTab] = useState<Tab>('home'),
    [sheet, setSheet] = useState<Sheet>(null);
  const [lang, setLang] = useState<Language>('en'),
    [large, setLarge] = useState(false);
  const [place, setPlace] = useState<Place>(PRESETS[0]!);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE),
    [workload, setWorkload] = useState<Workload>('moderate');
  const [checkIn, setCheckIn] = useState<PersonalCheckIn | null>(null);
  const [weather, setWeather] = useState<WeatherBundle | null>(null),
    [cached, setCached] = useState(false);
  const [weatherReady, setWeatherReady] = useState(false);
  const [weatherFailed, setWeatherFailed] = useState(false);
  const [lastWeatherCheckAt, setLastWeatherCheckAt] = useState<number | null>(null);
  const [weatherRequests] = useState(() => createWeatherRefresher(fetchWeather));
  const [pins, setPins] = useState<ReliefPin[]>([]),
    [localPins, setLocalPins] = useState<ReliefPin[]>([]);
  const [mapCached, setMapCached] = useState(false),
    [mapWarnings, setMapWarnings] = useState<string[]>([]);
  const [mapTrails, setMapTrails] = useState<ReliefTrail[]>([]);
  const [mapScope, setMapScope] = useState<MapScope>('arlington');
  const [loading, setLoading] = useState(false),
    [mapLoading, setMapLoading] = useState(false),
    [error, setError] = useState('');
  const [coolingRoute, setCoolingRoute] = useState<
    | { status: 'idle' }
    | { status: 'loading'; place: Place }
    | (CoolingSearchResult & { place: Place })
  >({ status: 'idle' });
  const [session, setSession] = useState<OutdoorSession | null>(null),
    [now, setNow] = useState(Date.now());
  const [buddies, setBuddies] = useState<Buddy[]>([]),
    [monitor, setMonitor] = useState<MonitorSettings | null>(null);
  const generation = useRef(0);
  const mapGeneration = useRef(0);
  const coolingGeneration = useRef(0);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    const restoreGeneration = generation.current;
    void (async () => {
      const [
        savedPlace,
        savedLang,
        savedLarge,
        p,
        savedWork,
        local,
        savedSession,
        m,
        ids,
        savedCheckIn,
      ] = await Promise.all([
        readLocal('place', PRESETS[0]!),
        readLocal<Language>('lang', 'en'),
        readLocal('large', false),
        readPrivate('profile', DEFAULT_PROFILE),
        readLocal<Workload>('workload', 'moderate'),
        readLocal<ReliefPin[]>('pins', []),
        readLocal<OutdoorSession | null>('session', null),
        readLocal<MonitorSettings | null>('monitor', null),
        readPrivate<string[]>('buddy-index', []),
        readPrivate<PersonalCheckIn | null>('check-in', null),
      ]);
      if (!active.current) return;
      if (restoreGeneration === generation.current) setPlace(savedPlace);
      setLang(savedLang);
      setLarge(savedLarge);
      setProfile(p);
      setCheckIn(savedCheckIn);
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
      if (active.current && old && restoreGeneration === generation.current) {
        setWeather(old);
        setCached(true);
      }
    })()
      .catch((e) => setError(String(e)))
      .finally(() => {
        if (active.current) setWeatherReady(true);
      });
    return () => {
      active.current = false;
      weatherRequests.invalidate();
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
    () => (weather ? evaluateRisk(weather, profile, workload, now, checkIn) : null),
    [weather, profile, workload, now, checkIn],
  );
  useEffect(() => {
    if (!weatherReady) return;
    const foreground = () =>
      Platform.OS === 'web'
        ? typeof document !== 'undefined' && document.visibilityState !== 'hidden'
        : AppState.currentState === 'active';
    const onReturn = () => {
      if (foreground()) {
        setNow(Date.now());
        void refresh(place, WEATHER_FOCUS_REFRESH_MS);
      }
    };
    if (foreground()) void refresh(place);
    const timer = setInterval(() => {
      if (foreground()) void refresh(place, WEATHER_REFRESH_MS);
    }, 15_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') onReturn();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('focus', onReturn);
      document.addEventListener('visibilitychange', onReturn);
    }
    return () => {
      clearInterval(timer);
      listener.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('focus', onReturn);
        document.removeEventListener('visibilitychange', onReturn);
      }
    };
  }, [weatherReady, place.latitude, place.longitude, place.name]);
  function refresh(p = place, minimumInterval = 0) {
    return weatherRequests.refresh(
      p,
      {
        start: () => {
          generation.current++;
          setLoading(true);
        },
        success: (result) => {
          setWeather(result.data);
          setCached(result.cached);
          setWeatherFailed(result.cached);
          if (!result.cached) setLastWeatherCheckAt(Date.now());
          setNow(Date.now());
        },
        failure: () => setWeatherFailed(true),
        finish: () => setLoading(false),
      },
      minimumInterval,
    );
  }
  async function changePlace(p: Place) {
    generation.current++;
    weatherRequests.invalidate();
    mapGeneration.current++;
    coolingGeneration.current++;
    setCoolingRoute({ status: 'idle' });
    setPlace(p);
    setWeather(null);
    setCached(false);
    setWeatherFailed(false);
    setLastWeatherCheckAt(null);
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
  async function saveCheckIn(next: PersonalCheckIn) {
    const timestamp = Date.now();
    if (!validCheckIn(next, timestamp))
      throw new Error('Check the personal readings and timestamps.');
    await writePrivate('check-in', next);
    setCheckIn(next);
    setNow(timestamp);
  }
  async function clearCheckIn() {
    await clearPrivate('check-in');
    setCheckIn(null);
    setNow(Date.now());
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
    coolingGeneration.current++;
    setCoolingRoute({ status: 'idle' });
    const next = [...localPins.filter((x) => x.id !== p.id), p].slice(-100);
    setLocalPins(next);
    await writeLocal('pins', next);
  }
  async function routeAc() {
    const g = ++coolingGeneration.current;
    setCoolingRoute({ status: 'loading', place });
    const result = await findCoolingPlace({
      place,
      cachedPins: pins,
      localPins,
      loadDownloadedPins: async () => {
        const datasets = await Promise.allSettled(
          (['arlington', 'dallas-county', 'tx06', 'tx30'] as const).map(bundledCity),
        );
        return datasets.flatMap((d) => (d.status === 'fulfilled' ? d.value.pins : []));
      },
      loadNearbyPins: async () => (await fetchRelief(place)).pins,
    });
    if (active.current && g === coolingGeneration.current) setCoolingRoute({ ...result, place });
  }
  async function openCoolingDirections() {
    if (coolingRoute.status !== 'found') return;
    // The explicit second tap keeps opening Maps inside the browser's user gesture.
    await Linking.openURL(directionsUrl(coolingRoute.pin, coolingRoute.place));
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
    journey.clear();
    journey.setRoute({ name: 'My route', kind: 'sketch', paths: [[]] });
    biometrics.disconnect();
    generation.current++;
    weatherRequests.invalidate();
    setLoading(false);
    setWeatherFailed(false);
    setLastWeatherCheckAt(null);
    coolingGeneration.current++;
    setCoolingRoute({ status: 'idle' });
    await endSession();
    if (monitor?.enabled) await setMonitoring({ ...monitor, enabled: false });
    await clearPrivate('profile');
    await clearPrivate('check-in');
    for (const b of buddies) await clearPrivate(`buddy-${b.id}`);
    await clearPrivate('buddy-index');
    await clearLocal();
    setProfile(DEFAULT_PROFILE);
    setCheckIn(null);
    setBuddies([]);
    setLocalPins([]);
    setWeather(null);
    setPins([]);
    setMapTrails([]);
    setMonitor(null);
  }
  return {
    journey,
    biometrics,
    tab,
    setTab,
    sheet,
    setSheet,
    lang,
    large,
    place,
    profile,
    checkIn,
    workload,
    weather,
    cached,
    weatherFailed,
    lastWeatherCheckAt,
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
    coolingRoute,
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
    saveCheckIn,
    clearCheckIn,
    chooseWork,
    loadMap,
    savePin,
    routeAc,
    openCoolingDirections,
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
