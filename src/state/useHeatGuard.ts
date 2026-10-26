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
import { skyScene } from '../domain/sky';
import { validCheckIn } from '../domain/personal';
import {
  createWeatherRefresher,
  WEATHER_FOCUS_REFRESH_MS,
  WEATHER_REFRESH_MS,
} from '../domain/weather';
import { createPrivateMutationQueue, createMonitoringController } from '../domain/mutations';
import { createSessionController, sessionRemainingSeconds } from '../domain/session';
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
import { mutateBuddyCollection } from '../domain/buddy';
import { resolveEmergencyNumber } from '../domain/emergency';
import { hashForTab, tabFromHash, titleForTab } from './tabRoutes';
import { useJourney } from './useJourney';
import { useBiometrics } from './useBiometrics';
export const PRESETS: Place[] = [...DFW_PLACES, ...OTHER_PLACES];
export type Tab = 'home' | 'relief' | 'journey' | 'plan' | 'community' | 'profile';
export type Sheet = 'location' | 'wardrobe' | 'symptoms' | 'method' | 'checkin' | null;
export function useHeatGuard() {
  const journey = useJourney();
  const biometrics = useBiometrics();
  const [tab, setTab] = useState<Tab>(
      () => (Platform.OS === 'web' ? tabFromHash(window.location.hash) : undefined) ?? 'home',
    ),
    [sheet, setSheet] = useState<Sheet>(null);
  // On the web each tab has its own link, and Back/Forward move between tabs.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    document.title = titleForTab(tab);
    if (tabFromHash(window.location.hash) === tab) return;
    if (tab === 'home' && !window.location.hash) return;
    window.history.pushState(null, '', hashForTab(tab));
  }, [tab]);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const follow = () => setTab(tabFromHash(window.location.hash) ?? 'home');
    window.addEventListener('popstate', follow);
    window.addEventListener('hashchange', follow);
    return () => {
      window.removeEventListener('popstate', follow);
      window.removeEventListener('hashchange', follow);
    };
  }, []);
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
  const buddiesRef = useRef<Buddy[]>([]);
  const generation = useRef(0);
  const restoreEpoch = useRef(0);
  const gpsGeneration = useRef(0);
  const mapGeneration = useRef(0);
  const coolingGeneration = useRef(0);
  const active = useRef(true);
  const [privateMutations] = useState(createPrivateMutationQueue);
  const monitorRef = useRef(monitor);
  monitorRef.current = monitor;
  const [monitorController] = useState(() =>
    createMonitoringController<MonitorSettings>({
      apply: setMonitoring,
      current: () => monitorRef.current,
      commit: (next) => {
        monitorRef.current = next;
        if (active.current) setMonitor(next);
      },
    }),
  );
  useEffect(() => {
    active.current = true;
    const restoreGeneration = generation.current,
      restoreVersion = restoreEpoch.current;
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
      if (!active.current || restoreVersion !== restoreEpoch.current) return;
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
      if (active.current && restoreVersion === restoreEpoch.current) {
        buddiesRef.current = contacts.filter((c): c is Buddy => !!c);
        setBuddies(buddiesRef.current);
      }
      const old = await readLocal<WeatherBundle | null>(
        `weather.${savedPlace.latitude.toFixed(3)}.${savedPlace.longitude.toFixed(3)}`,
        null,
      );
      if (
        active.current &&
        restoreVersion === restoreEpoch.current &&
        old &&
        restoreGeneration === generation.current
      ) {
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
  const checkedInitialNotification = useRef(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const show = (data: Record<string, unknown>) => {
      setTab(data.screen === 'community' ? 'community' : 'home');
      // Cold-start notification callbacks must not replace the saved place before hydration.
      if (weatherReady) void refresh();
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) =>
      show(r.notification.request.content.data ?? {}),
    );
    if (!checkedInitialNotification.current) {
      checkedInitialNotification.current = true;
      void Notifications.getLastNotificationResponseAsync().then((r) => {
        if (active.current && r) show(r.notification.request.content.data ?? {});
      });
    }
    const link = Linking.addEventListener('url', (e) => {
      if (e.url.includes('risk')) {
        setTab('home');
        if (weatherReady) void refresh();
      }
    });
    return () => {
      sub.remove();
      link.remove();
    };
  }, [place.latitude, place.longitude, weatherReady]);
  const risk = useMemo(
    () => (weather ? evaluateRisk(weather, profile, workload, now, checkIn) : null),
    [weather, profile, workload, now, checkIn],
  );
  const sessionRef = useRef(session),
    riskInputs = useRef({ weather, profile, workload, checkIn }),
    languageRef = useRef(lang);
  sessionRef.current = session;
  riskInputs.current = { weather, profile, workload, checkIn };
  languageRef.current = lang;
  const sessionWrites = useRef(Promise.resolve());
  const [sessionController] = useState(() =>
    createSessionController({
      session: () => sessionRef.current,
      risk: () => {
        const input = riskInputs.current;
        return input.weather
          ? evaluateRisk(input.weather, input.profile, input.workload, Date.now(), input.checkIn)
          : null;
      },
      alive: () => active.current,
      commit: (next) => {
        sessionRef.current = next;
        setSession(next);
        setNow(Date.now());
        sessionWrites.current = sessionWrites.current
          .catch(() => {})
          .then(() => writeLocal('session', next));
        return sessionWrites.current;
      },
      schedule: (seconds, tier, ask) =>
        scheduleSessionReminders(seconds, tier, languageRef.current === 'es', ask),
      cancel: cancelReminders,
      warning: (error) => setError(String(error)),
    }),
  );
  useEffect(() => () => sessionController.invalidate(), [sessionController]);
  // Decorative backdrop for the checked place; recomputed at most once a minute.
  const sky = useMemo(
    () => skyScene(place, weather, now),
    [place.latitude, place.longitude, weather, Math.floor(now / 60000)],
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
    gpsGeneration.current++;
    const stopped = endSession();
    const stoppedMonitoring = monitorController.set({
      enabled: false,
      place: p,
      workload,
      threshold: 2,
      language: lang,
    });
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
    await stopped;
    await stoppedMonitoring;
    void refresh(p);
  }
  useEffect(() => {
    if (sheet !== 'location') gpsGeneration.current++;
  }, [sheet]);
  async function useGps() {
    const version = ++gpsGeneration.current;
    const current = () => active.current && version === gpsGeneration.current;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (!permission.granted)
        throw new Error('Location declined. Enter a city or coordinates to check manually.');
      const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!current()) return;
      let name = 'GPS location',
        country: string | null | undefined;
      try {
        const [address] = await Location.reverseGeocodeAsync(p.coords);
        name = [address?.city, address?.region].filter(Boolean).join(', ') || name;
        country = address?.isoCountryCode;
      } catch {}
      if (!current()) return;
      // Reverse geocoding is unavailable in the browser; fall back to the coordinates.
      const emergencyNumber = resolveEmergencyNumber(
        p.coords.latitude,
        p.coords.longitude,
        country,
      );
      await changePlace({
        name,
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
        emergencyNumber,
      });
    } catch (e) {
      if (current()) setError(e instanceof Error ? e.message : String(e));
    }
  }
  function canceledSave() {
    return new Error(
      lang === 'es'
        ? 'Se canceló el guardado porque cambiaron los datos locales.'
        : 'The save was canceled because local data changed.',
    );
  }
  async function saveProfile(p: Profile) {
    if (!(await privateMutations.run(() => writePrivate('profile', p)))) throw canceledSave();
    if (active.current) setProfile(p);
  }
  async function saveCheckIn(next: PersonalCheckIn) {
    const timestamp = Date.now();
    if (!validCheckIn(next, timestamp))
      throw new Error('Check the personal readings and timestamps.');
    if (!(await privateMutations.run(() => writePrivate('check-in', next)))) throw canceledSave();
    if (active.current) {
      setCheckIn(next);
      setNow(timestamp);
    }
  }
  async function clearCheckIn() {
    if (!(await privateMutations.run(() => clearPrivate('check-in')))) throw canceledSave();
    if (active.current) {
      setCheckIn(null);
      setNow(Date.now());
    }
  }
  async function chooseWork(w: Workload) {
    const stopped = endSession();
    setWorkload(w);
    await writeLocal('workload', w);
    await stopped;
    await monitorController.update({ workload: w });
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
    await sessionController.start();
  }
  const endSession = () => sessionController.end();
  const takeBreak = () => sessionController.takeBreak();
  const finishBreak = () => sessionController.finishBreak();
  const remainingSeconds = session && risk ? sessionRemainingSeconds(session, risk, now) : 0;
  useEffect(() => {
    void sessionController.reconcile().catch((error) => setError(String(error)));
  }, [
    session?.id,
    session?.phase,
    session?.workStartedAt,
    risk?.window?.[0],
    risk?.stopReason,
    risk?.tier,
    lang,
  ]);
  async function shareCard() {
    if (!risk) return;
    await Share.share({
      message:
        lang === 'es'
          ? `HeatGuard · ${place.name}\n${risk.lowHeat ? 'Por debajo de los umbrales de calor: no hacen falta descansos programados.' : `Intervalo estimado hasta el descanso: ${risk.window ? risk.window.join('–') + ' min' : 'posponer actividad'}. Descanso: ${risk.breakMinutes} min.`} Estimación general, no predicción médica. Enfríate antes; ante síntomas busca ayuda. Datos: ${weather?.current.time}. https://www.cdc.gov/niosh/heat-stress/about/illnesses.html`
          : `HeatGuard · ${place.name}\n${risk.lowHeat ? 'Below heat thresholds: timed cooling breaks are not needed.' : `Estimated time to a cooling break: ${risk.window ? risk.window.join('–') + ' min' : 'postpone activity'}. Cooling break: ${risk.breakMinutes} min.`} General guidance, not a medical prediction. Cool down early; seek help for symptoms. Data time: ${weather?.current.time}. https://www.cdc.gov/niosh/heat-stress/about/illnesses.html`,
    });
  }
  async function changeBuddy(change: Parameters<typeof mutateBuddyCollection>[0]) {
    await privateMutations.run(async (isCurrent) =>
      mutateBuddyCollection(change, {
        current: () => buddiesRef.current,
        put: (buddy) => writePrivate(`buddy-${buddy.id}`, buddy),
        remove: (id) => clearPrivate(`buddy-${id}`),
        index: (ids) => writePrivate('buddy-index', ids),
        isCurrent: () => isCurrent() && active.current,
        commit: (next) => {
          buddiesRef.current = next;
          setBuddies(next);
        },
      }),
    );
  }
  const saveBuddy = (buddy: Buddy) => changeBuddy({ kind: 'save', buddy });
  const removeBuddy = (id: string) => changeBuddy({ kind: 'remove', id });
  async function monitoring(enabled: boolean) {
    const next: MonitorSettings = { enabled, place, workload, threshold: 2, language: lang };
    if (privateMutations.clearing)
      throw new Error('Local-data deletion is in progress. Try again afterward.');
    await monitorController.set(next);
  }
  async function preferences(l: Language, big: boolean) {
    setLang(l);
    setLarge(big);
    await Promise.all([writeLocal('lang', l), writeLocal('large', big)]);
    await monitorController.update({ language: l });
  }
  async function erase() {
    if (privateMutations.clearing) return;
    const pendingSaves = privateMutations.beginClear();
    try {
      restoreEpoch.current++;
      mapGeneration.current++;
      gpsGeneration.current++;
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
      await monitorController.set({
        enabled: false,
        place: PRESETS[0]!,
        workload: 'moderate',
        threshold: 2,
        language: 'en',
      });
      await pendingSaves;
      await clearPrivate('profile');
      await clearPrivate('check-in');
      const savedBuddyIds = await readPrivate<string[]>('buddy-index', []);
      for (const id of new Set([...savedBuddyIds, ...buddiesRef.current.map((b) => b.id)]))
        await clearPrivate(`buddy-${id}`);
      await clearPrivate('buddy-index');
      await clearLocal();
      setProfile(DEFAULT_PROFILE);
      setCheckIn(null);
      buddiesRef.current = [];
      setBuddies([]);
      setLocalPins([]);
      setWeather(null);
      setPins([]);
      setMapTrails([]);
      setMonitor(null);
      setMapLoading(false);
      setMapCached(false);
      setMapWarnings([]);
      setMapScope('arlington');
      setPlace(PRESETS[0]!);
      setWorkload('moderate');
      setLang('en');
      setLarge(false);
      void refresh(PRESETS[0]!);
    } finally {
      privateMutations.endClear();
    }
  }
  return {
    initializing: !weatherReady,
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
    sky,
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
