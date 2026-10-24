import { Place, ReliefPin, RiskEstimate } from './types';
import { distanceMeters, pickedCoordinates, usablePin } from './relief';

export type RoutePoint = Pick<Place, 'latitude' | 'longitude'>;
export interface TrackPoint extends RoutePoint {
  at: number;
  accuracy: number;
}
export interface JourneyRoute {
  name: string;
  paths: RoutePoint[][];
  kind: 'sketch' | 'trail' | 'recorded';
}
export function routeDistance(paths: RoutePoint[][]) {
  return paths.reduce(
    (total, path) =>
      total + path.slice(1).reduce((sum, p, i) => sum + distanceMeters(path[i]!, p), 0),
    0,
  );
}
/** Choose a connected walking section of a published trail network, never join remote pieces. */
export function mappedTrailSection(paths: [number, number][][]): RoutePoint[] {
  const edges = paths
    .filter((p) => p.length > 1)
    .map((path) => path.map(([longitude, latitude]) => ({ latitude, longitude })));
  const node = (p: RoutePoint) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
  const graph = new Map<string, { to: string; path: RoutePoint[]; meters: number }[]>();
  for (const path of edges) {
    const a = node(path[0]!),
      b = node(path.at(-1)!),
      meters = routeDistance([path]);
    graph.set(a, [...(graph.get(a) ?? []), { to: b, path, meters }]);
    graph.set(b, [...(graph.get(b) ?? []), { to: a, path: path.slice().reverse(), meters }]);
  }
  let best = edges.reduce<RoutePoint[]>(
    (a, b) => (routeDistance([a]) >= routeDistance([b]) ? a : b),
    [],
  );
  const visited = new Set<string>();
  function farthest(start: string) {
    const distance = new Map([[start, 0]]),
      previous = new Map<string, { from: string; path: RoutePoint[] }>(),
      done = new Set<string>();
    while (true) {
      let at: string | undefined,
        value = Infinity;
      for (const [key, d] of distance)
        if (!done.has(key) && d < value) {
          at = key;
          value = d;
        }
      if (!at) break;
      done.add(at);
      visited.add(at);
      for (const edge of graph.get(at) ?? [])
        if (value + edge.meters < (distance.get(edge.to) ?? Infinity)) {
          distance.set(edge.to, value + edge.meters);
          previous.set(edge.to, { from: at, path: edge.path });
        }
    }
    const end = [...distance].reduce((a, b) => (a[1] >= b[1] ? a : b))[0];
    return { end, previous };
  }
  for (const start of graph.keys())
    if (!visited.has(start)) {
      const first = farthest(start),
        second = farthest(first.end);
      let end = second.end;
      const pieces: RoutePoint[][] = [];
      while (second.previous.has(end)) {
        const edge = second.previous.get(end)!;
        pieces.unshift(edge.path);
        end = edge.from;
      }
      const joined = pieces.flatMap((path, i) => (i ? path.slice(1) : path));
      if (routeDistance([joined]) > routeDistance([best])) best = joined;
    }
  return best;
}
/** Sampling includes endpoints and bounds interval size; long routes are refused, never silently truncated. */
export function sampleRoute(paths: RoutePoint[][], spacing = 200) {
  if (!Number.isFinite(spacing) || spacing < 25) throw new Error('Invalid route sampling interval');
  const samples: (RoutePoint & { meters: number })[] = [];
  let meters = 0;
  for (const path of paths) {
    if (!path.length) continue;
    if (!path.every((p) => pickedCoordinates(p))) throw new Error('Invalid route coordinates');
    samples.push({ ...path[0]!, meters });
    let next = meters + spacing;
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1]!,
        b = path[i]!,
        length = distanceMeters(a, b);
      while (length > 0 && next <= meters + length) {
        if (samples.length >= 5000)
          throw new Error('This route is too long. Plan a shorter section.');
        const fraction = (next - meters) / length;
        samples.push({
          latitude: a.latitude + (b.latitude - a.latitude) * fraction,
          longitude: a.longitude + (b.longitude - a.longitude) * fraction,
          meters: next,
        });
        next += spacing;
      }
      meters += length;
    }
    if (samples.at(-1)?.meters !== meters) samples.push({ ...path.at(-1)!, meters });
  }
  return samples;
}
export interface JourneyAssessment {
  meters: number;
  movingMinutes: number;
  breakEvery: number | null;
  breakCount: number | null;
  totalMinutes: number | null;
  worstReliefMeters: number | null;
  reliefWalkMinutes: number | null;
  reliefBeyondBreak: boolean;
  uncoveredSamples: number;
  sampleCount: number;
  stops: { pin: ReliefPin; routeMeters: number; offsetMeters: number }[];
  status: 'unavailable' | 'postpone' | 'relief-gaps' | 'review';
}
/** Coverage is straight-line proximity to mapped candidates, never proof of a traversable detour. */
export function assessJourney(
  route: JourneyRoute,
  pins: ReliefPin[],
  paceMinutesPerKm: number,
  risk: RiskEstimate | null,
): JourneyAssessment {
  if (!Number.isFinite(paceMinutesPerKm) || paceMinutesPerKm < 3 || paceMinutesPerKm > 30)
    throw new Error('Choose a pace between 3 and 30 min/km.');
  const samples = sampleRoute(route.paths),
    meters = routeDistance(route.paths),
    movingMinutes = (meters / 1000) * paceMinutesPerKm;
  const cooling = pins.filter(
    (p) =>
      usablePin(p) && p.kind !== 'water' && p.feature !== 'wooded-area' && pickedCoordinates(p),
  );
  let worst = 0,
    uncovered = 0;
  const selected = new Map<string, JourneyAssessment['stops'][number]>();
  for (const point of samples) {
    let nearest: ReliefPin | undefined,
      offset = Infinity;
    for (const pin of cooling) {
      const d = distanceMeters(point, pin);
      if (d < offset) {
        nearest = pin;
        offset = d;
      }
    }
    if (!nearest || offset > 500) uncovered++;
    if (nearest) {
      worst = Math.max(worst, offset);
      if (offset <= 500) {
        const old = selected.get(nearest.id);
        if (!old || offset < old.offsetMeters)
          selected.set(nearest.id, {
            pin: nearest,
            routeMeters: point.meters,
            offsetMeters: offset,
          });
      }
    }
  }
  const breakEvery = risk?.window?.[0] ?? null;
  const reliefWalkMinutes = cooling.length && samples.length ? Math.ceil(worst / 60) : null;
  const reliefBeyondBreak =
    breakEvery !== null && (reliefWalkMinutes === null || reliefWalkMinutes >= breakEvery);
  const breakCount =
    breakEvery === null ? null : Math.max(0, Math.ceil(movingMinutes / breakEvery) - 1);
  return {
    meters,
    movingMinutes,
    breakEvery,
    breakCount,
    totalMinutes:
      breakCount === null ? null : movingMinutes + breakCount * (risk?.breakMinutes ?? 0),
    worstReliefMeters: cooling.length && samples.length ? worst : null,
    reliefWalkMinutes,
    reliefBeyondBreak,
    uncoveredSamples: uncovered,
    sampleCount: samples.length,
    stops: [...selected.values()].sort((a, b) => a.routeMeters - b.routeMeters),
    status: !risk
      ? 'unavailable'
      : !risk.window
        ? 'postpone'
        : uncovered || reliefBeyondBreak
          ? 'relief-gaps'
          : 'review',
  };
}
/** No interpolation across GPS outages, pause/resume, implausible jumps or low-accuracy fixes. */
export function appendTrack(
  paths: TrackPoint[][],
  point: TrackPoint,
  now: number,
): { paths: TrackPoint[][]; accepted: boolean; reason?: string } {
  if (
    !pickedCoordinates(point) ||
    !Number.isFinite(point.at) ||
    point.at > now + 5000 ||
    point.at < now - 30000 ||
    !Number.isFinite(point.accuracy) ||
    point.accuracy < 0 ||
    point.accuracy > 50
  )
    return { paths, accepted: false, reason: 'quality' };
  const last = paths.at(-1)?.at(-1);
  if (last && point.at <= last.at) return { paths, accepted: false, reason: 'time' };
  const gap = last ? (point.at - last.at) / 1000 : 0,
    meters = last ? distanceMeters(last, point) : 0;
  if (last && gap <= 60 && meters / gap > 12) return { paths, accepted: false, reason: 'jump' };
  if (last && gap <= 60 && meters < 3) return { paths, accepted: false, reason: 'stationary' };
  if (paths.reduce((n, p) => n + p.length, 0) >= 20000)
    return { paths, accepted: false, reason: 'limit' };
  if (!paths.length || !paths.at(-1)?.length || gap > 60)
    return { paths: [...paths.filter((p) => p.length), [point]], accepted: true };
  return { paths: [...paths.slice(0, -1), [...paths.at(-1)!, point]], accepted: true };
}
