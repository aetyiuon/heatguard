import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { wearable } from '../services/wearable';
import { biometricSample, BiometricSample } from '../domain/biometrics';
export function useBiometrics() {
  const [connected, setConnected] = useState(false),
    [sample, setSample] = useState<BiometricSample | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [installed, setInstalled] = useState(false);
  const generation = useRef(0),
    live = useRef(false);
  useEffect(() => {
    if (!connected) return;
    const version = generation.current;
    let active = true,
      pending = false;
    const receive = (raw: unknown) => {
      const value = biometricSample(raw, Date.now());
      if (active && version === generation.current && value) {
        if (value.source === 'apple-watch-live') live.current = true;
        setSample((old) => (!old || value.at >= old.at ? value : old));
      }
    };
    const poll = async () => {
      if (pending || AppState.currentState !== 'active') return;
      pending = true;
      try {
        const value = await wearable.latest();
        if (active && version === generation.current) {
          receive(value);
          setInstalled(wearable.watchInstalled());
        }
      } catch {
        if (active && version === generation.current) setError('read');
      } finally {
        pending = false;
      }
    };
    const unsubscribe = wearable.subscribe(receive),
      timer = setInterval(() => void poll(), 15000),
      listener = AppState.addEventListener('change', (s) => {
        if (s === 'active') void poll();
      });
    void poll();
    return () => {
      active = false;
      unsubscribe();
      clearInterval(timer);
      listener.remove();
    };
  }, [connected]);
  useEffect(
    () => () => {
      generation.current++;
      if (live.current) void wearable.stopWatch().catch(() => {});
    },
    [],
  );
  async function connect() {
    const key = ++generation.current;
    setBusy(true);
    setError('');
    try {
      await wearable.connect();
      if (key === generation.current) {
        setConnected(true);
        setInstalled(wearable.watchInstalled());
      }
    } catch {
      if (key === generation.current) setError('connect');
    } finally {
      if (key === generation.current) setBusy(false);
    }
  }
  async function startLive() {
    const version = generation.current;
    setBusy(true);
    setError('');
    try {
      await wearable.launchWatch();
      if (version !== generation.current) {
        await wearable.stopWatch();
        return;
      }
      live.current = true;
    } catch {
      if (version === generation.current) setError('watch');
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  function disconnect() {
    const stop = live.current;
    generation.current++;
    setConnected(false);
    setSample(null);
    setError('');
    setBusy(false);
    live.current = false;
    if (stop) void wearable.stopWatch().catch(() => setError('stop'));
  }
  return {
    available: wearable.available(),
    connected,
    sample,
    error,
    busy,
    installed,
    connect,
    startLive,
    disconnect,
  };
}
