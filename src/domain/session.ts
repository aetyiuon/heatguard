import { OutdoorSession, RiskEstimate } from './types';
/** Clamp to the planned duration when the UI's last clock tick precedes a user action. */
export function sessionRemainingSeconds(session: OutdoorSession, risk: RiskEstimate, now: number) {
  const minutes = session.phase === 'active' ? risk.window?.[0] : risk.breakMinutes;
  const start = session.phase === 'active' ? session.workStartedAt : session.breakStartedAt;
  if (minutes === undefined || start === undefined) return 0;
  return Math.max(0, Math.min(minutes * 60, Math.ceil((start + minutes * 60000 - now) / 1000)));
}

/** Native permission/scheduling can finish after End, a location change, or another transition.
 * Keep every asynchronous transition conditional on the latest session and risk snapshot. */
export function createSessionController(deps: {
  session: () => OutdoorSession | null;
  risk: () => RiskEstimate | null;
  commit: (next: OutdoorSession | null) => Promise<void>;
  schedule: (seconds: number, tier: number, askPermission: boolean) => Promise<string[]>;
  cancel: (ids: string[]) => Promise<void>;
  warning: (error: unknown) => void;
  alive?: () => boolean;
  clock?: () => number;
}) {
  let version = 0;
  const clock = deps.clock ?? Date.now;
  const valid = (key: number) => key === version && (deps.alive?.() ?? true);
  const cancel = async (ids: string[]) => {
    try {
      await deps.cancel(ids);
    } catch (error) {
      deps.warning(error);
    }
  };
  const schedule = async (seconds: number, tier: number, ask: boolean) => {
    try {
      return await deps.schedule(seconds, tier, ask);
    } catch (error) {
      deps.warning(error);
      return [];
    }
  };
  const matches = (session: OutdoorSession) => {
    const latest = deps.session();
    return (
      latest?.id === session.id &&
      latest.phase === session.phase &&
      latest.workStartedAt === session.workStartedAt &&
      latest.breakStartedAt === session.breakStartedAt
    );
  };
  return {
    invalidate() {
      version++;
    },
    async start() {
      if (deps.session() || !deps.risk()?.window) return;
      const key = ++version,
        risk = deps.risk()!;
      const ids = await schedule(risk.window![0] * 60, risk.tier, true);
      if (!valid(key) || deps.session() || !deps.risk()?.window) {
        await cancel(ids);
        return;
      }
      const at = clock();
      await deps.commit({
        id: String(at),
        startedAt: at,
        workStartedAt: at,
        phase: 'active',
        breaks: 0,
        notificationIds: ids,
      });
    },
    async end() {
      version++;
      const old = deps.session();
      // Clear synchronously in commit before waiting for platform cancellation/storage.
      const persisted = deps.commit(null);
      await cancel(old?.notificationIds ?? []);
      await persisted;
    },
    async takeBreak() {
      const old = deps.session();
      if (!old || old.phase !== 'active') return;
      version++;
      const persisted = deps.commit({
        ...old,
        phase: 'break',
        breakStartedAt: clock(),
        notificationIds: [],
      });
      await cancel(old.notificationIds);
      await persisted;
    },
    async finishBreak() {
      const old = deps.session(),
        risk = deps.risk();
      if (
        !old ||
        old.phase !== 'break' ||
        old.breakStartedAt === undefined ||
        !risk?.window ||
        clock() - old.breakStartedAt < risk.breakMinutes * 60_000
      )
        return;
      const key = ++version;
      const ids = await schedule(risk.window[0] * 60, risk.tier, true);
      const latestRisk = deps.risk();
      if (
        !valid(key) ||
        !matches(old) ||
        !latestRisk?.window ||
        clock() - old.breakStartedAt < latestRisk.breakMinutes * 60_000
      ) {
        await cancel(ids);
        return;
      }
      await deps.commit({
        ...old,
        phase: 'active',
        workStartedAt: clock(),
        breakStartedAt: undefined,
        breaks: old.breaks + 1,
        notificationIds: ids,
      });
    },
    async reconcile() {
      const old = deps.session();
      if (!old || old.phase !== 'active' || !deps.risk()) return;
      const key = ++version;
      await cancel(old.notificationIds);
      if (!valid(key) || !matches(old)) return;
      const risk = deps.risk();
      if (!risk) return;
      const seconds = risk.window
        ? Math.max(1, (old.workStartedAt + risk.window[0] * 60_000 - clock()) / 1000)
        : 1;
      const ids = await schedule(seconds, risk.tier, false);
      if (!valid(key) || !matches(old)) {
        await cancel(ids);
        return;
      }
      await deps.commit({ ...deps.session()!, notificationIds: ids });
    },
  };
}
