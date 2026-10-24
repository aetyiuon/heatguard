import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import { appendTrack, JourneyRoute, TrackPoint } from '../domain/journey';

export function useJourney() {
  const [route, setRoute] = useState<JourneyRoute>({
    name: 'My route',
    kind: 'sketch',
    paths: [[]],
  });
  const [track, setTrack] = useState<TrackPoint[][]>([]),
    [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'finished'>('idle');
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [elapsedMs, setElapsedMs] = useState(0);
  const sub = useRef<Location.LocationSubscription | null>(null),
    epoch = useRef(0),
    started = useRef<number | null>(null),
    elapsed = useRef(0),
    state = useRef(status);
  const points = useRef<TrackPoint[][]>([]);
  state.current = status;
  function stop(next: 'paused' | 'finished') {
    epoch.current++;
    sub.current?.remove();
    sub.current = null;
    if (started.current !== null) {
      elapsed.current += Math.max(0, Date.now() - started.current);
      started.current = null;
      setElapsedMs(elapsed.current);
    }
    state.current = next;
    setStatus(next);
    setBusy(false);
  }
  useEffect(() => {
    const pause = () => {
      if (state.current === 'recording') {
        stop('paused');
        setMessage('background');
      } else {
        epoch.current++;
        setBusy(false);
      }
    };
    const listener = AppState.addEventListener('change', (s) => {
      if (s !== 'active') pause();
    });
    const visibility = () => {
      if (document.visibilityState === 'hidden') pause();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', visibility);
    const tick = setInterval(() => {
      if (started.current !== null)
        setElapsedMs(elapsed.current + Math.max(0, Date.now() - started.current));
    }, 1000);
    return () => {
      epoch.current++;
      sub.current?.remove();
      listener.remove();
      clearInterval(tick);
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  async function start() {
    if (busy || state.current === 'recording') return;
    const generation = ++epoch.current;
    setBusy(true);
    setMessage('');
    try {
      const p = await Location.requestForegroundPermissionsAsync();
      if (generation !== epoch.current) return;
      if (p.status !== 'granted') throw new Error('permission');
      if (state.current === 'idle' || state.current === 'finished') {
        points.current = [];
        setTrack([]);
        elapsed.current = 0;
        setElapsedMs(0);
      } else {
        points.current = [...points.current, []];
        setTrack(points.current);
      }
      const watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 3 },
        (fix) => {
          if (generation !== epoch.current) return;
          const result = appendTrack(
            points.current,
            {
              latitude: fix.coords.latitude,
              longitude: fix.coords.longitude,
              accuracy: fix.coords.accuracy ?? Infinity,
              at: fix.timestamp,
            },
            Date.now(),
          );
          if (result.reason && result.reason !== 'stationary') setMessage(result.reason);
          else if (result.accepted) setMessage('');
          if (result.accepted) {
            points.current = result.paths;
            setTrack(result.paths);
          }
          if (result.reason === 'limit') stop('paused');
        },
        () => {
          if (generation === epoch.current) {
            stop('paused');
            setMessage('gps');
          }
        },
      );
      if (generation !== epoch.current) {
        watcher.remove();
        return;
      }
      sub.current = watcher;
      started.current = Date.now();
      state.current = 'recording';
      setStatus('recording');
    } catch (e) {
      if (generation === epoch.current) {
        setMessage(String(e).includes('permission') ? 'permission' : 'gps');
      }
    } finally {
      if (generation === epoch.current) setBusy(false);
    }
  }
  function clear() {
    stop('finished');
    points.current = [];
    setTrack([]);
    elapsed.current = 0;
    setElapsedMs(0);
    state.current = 'idle';
    setStatus('idle');
    setMessage('');
  }
  return {
    route,
    setRoute,
    track,
    status,
    message,
    busy,
    elapsedMs,
    start,
    pause: () => stop('paused'),
    finish: () => stop('finished'),
    clear,
  };
}
