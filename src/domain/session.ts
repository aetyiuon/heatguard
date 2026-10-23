import { OutdoorSession, RiskEstimate } from './types';
/** Clamp to the planned duration when the UI's last clock tick precedes a user action. */
export function sessionRemainingSeconds(session: OutdoorSession, risk: RiskEstimate, now: number) {
  const minutes = session.phase === 'active' ? risk.window?.[0] : risk.breakMinutes;
  const start = session.phase === 'active' ? session.workStartedAt : session.breakStartedAt;
  if (minutes === undefined || start === undefined) return 0;
  return Math.max(0, Math.min(minutes * 60, Math.ceil((start + minutes * 60000 - now) / 1000)));
}
