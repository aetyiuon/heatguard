/** Drain in-flight saves before clearing; discard queued/late saves from the old privacy epoch. */
export function createPrivateMutationQueue() {
  let epoch = 0,
    clearing = false,
    pending = Promise.resolve();
  return {
    get clearing() {
      return clearing;
    },
    run(work: (isCurrent: () => boolean) => Promise<void>): Promise<boolean> {
      if (clearing)
        return Promise.reject(
          new Error('Local-data deletion is in progress. Try again afterward.'),
        );
      const version = epoch;
      const result = pending.then(async () => {
        if (clearing || version !== epoch) return false;
        await work(() => !clearing && version === epoch);
        return !clearing && version === epoch;
      });
      pending = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    async beginClear() {
      clearing = true;
      epoch++;
      await pending;
    },
    endClear() {
      clearing = false;
    },
  };
}

/** Cache writes belong to the request's start epoch, so a late fetch cannot undo deletion. */
export function createLocalWriteQueue() {
  let epoch = 0,
    clearing = false,
    pending = Promise.resolve();
  return {
    get version() {
      return epoch;
    },
    write(work: () => Promise<void>, version = epoch) {
      if (clearing || version !== epoch) return Promise.resolve();
      const result = pending.then(async () => {
        if (clearing || version !== epoch) return;
        await work();
      });
      pending = result.then(
        () => {},
        () => {},
      );
      return result;
    },
    async clear(remove: () => Promise<void>) {
      epoch++;
      clearing = true;
      try {
        await pending;
        await remove();
      } finally {
        clearing = false;
      }
    },
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  place: { latitude: number; longitude: number; name: string; emergencyNumber: string };
  workload: 'resting' | 'light' | 'moderate' | 'heavy';
  threshold: 1 | 2 | 3;
  language: 'en' | 'es';
}
/** Serialize platform registration so a stale enable cannot outlive a newer disable/context. */
export function createMonitoringController<T extends MonitoringConfig>(deps: {
  apply: (settings: T) => Promise<void>;
  commit: (settings: T) => void;
  current: () => T | null;
}) {
  let epoch = 0,
    pending = Promise.resolve(),
    desired: T | null = null;
  const set = (settings: T) => {
    desired = settings;
    const version = ++epoch;
    const task = pending.then(async () => {
      if (version !== epoch) return;
      try {
        await deps.apply(settings);
      } catch (error) {
        // An enable may have registered before storage failed. Disable that partial result.
        if (settings.enabled) {
          const disabled = { ...settings, enabled: false };
          await deps.apply(disabled);
          if (version === epoch) {
            desired = disabled;
            deps.commit(disabled);
          }
        }
        if (version === epoch) throw error;
        return;
      }
      if (version !== epoch) {
        if (settings.enabled) await deps.apply({ ...settings, enabled: false });
        return;
      }
      deps.commit(settings);
    });
    pending = task.then(
      () => {},
      () => {},
    );
    return task;
  };
  return {
    set,
    update(context: Partial<Pick<T, 'place' | 'workload' | 'language'>>) {
      const settings = desired ?? deps.current();
      return settings?.enabled ? set({ ...settings, ...context }) : Promise.resolve();
    },
  };
}
