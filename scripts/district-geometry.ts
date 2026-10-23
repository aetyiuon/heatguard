import { polygonClipping } from './geometry-vendor';
import { PolygonCoordinates } from '../src/domain/types';
import { insidePolygons, polygonBounds } from '../src/domain/cities';
type Point = [number, number];
export function intersectPolygons(
  a: PolygonCoordinates,
  b: PolygonCoordinates,
): PolygonCoordinates {
  return polygonClipping.intersection(a, b) as PolygonCoordinates;
}
export function geometryPolygons(g: any): PolygonCoordinates {
  return g?.type === 'Polygon' ? [g.coordinates] : g?.type === 'MultiPolygon' ? g.coordinates : [];
}
export function rectangle([w, s, e, n]: [number, number, number, number]): PolygonCoordinates {
  return [
    [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  ];
}
export function polygonArea(p: PolygonCoordinates) {
  const ringArea = (r: Point[]) =>
    Math.abs(
      r.reduce((sum, a, i) => {
        const b = r[(i + 1) % r.length]!;
        return sum + a[0] * b[1] - b[0] * a[1];
      }, 0) / 2,
    );
  return p.reduce(
    (s, [outer, ...holes]) =>
      s + (outer ? ringArea(outer) : 0) - holes.reduce((n, r) => n + ringArea(r), 0),
    0,
  );
}
export function districtSections(boundary: PolygonCoordinates, step = 0.4) {
  const [w, s, e, n] = polygonBounds(boundary),
    sections: { id: string; bounds: [number, number, number, number] }[] = [];
  for (let y = s; y < n; y += step)
    for (let x = w; x < e; x += step) {
      const b: [number, number, number, number] = [
        x,
        y,
        Math.min(e, x + step),
        Math.min(n, y + step),
      ];
      if (polygonArea(intersectPolygons(boundary, rectangle(b))) > 1e-12)
        sections.push({ id: `${x.toFixed(5)},${y.toFixed(5)}`, bounds: b });
    }
  return sections;
}
/** Split every crossing at the boundary, retaining segments whose midpoint lies in the district. */
export function lineClipper(boundary: PolygonCoordinates) {
  const cell = 0.04,
    index = new Map<string, { a: Point; b: Point }[]>();
  function keys(a: Point, b: Point) {
    const out = [];
    for (
      let x = Math.floor(Math.min(a[0], b[0]) / cell);
      x <= Math.floor(Math.max(a[0], b[0]) / cell);
      x++
    )
      for (
        let y = Math.floor(Math.min(a[1], b[1]) / cell);
        y <= Math.floor(Math.max(a[1], b[1]) / cell);
        y++
      )
        out.push(`${x},${y}`);
    return out;
  }
  for (const ring of boundary.flat())
    for (let i = 1; i < ring.length; i++) {
      const edge = { a: ring[i - 1]!, b: ring[i]! };
      for (const key of keys(edge.a, edge.b)) {
        const group = index.get(key) ?? [];
        group.push(edge);
        index.set(key, group);
      }
    }
  const cross = (a: Point, b: Point) => a[0] * b[1] - a[1] * b[0];
  return (paths: Point[][]): Point[][] => {
    const result: Point[][] = [];
    for (const path of paths) {
      let run: Point[] = [];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1]!,
          b = path[i]!,
          r: Point = [b[0] - a[0], b[1] - a[1]],
          values = [0, 1];
        for (const edge of new Set(keys(a, b).flatMap((k) => index.get(k) ?? []))) {
          const d: Point = [edge.b[0] - edge.a[0], edge.b[1] - edge.a[1]],
            v: Point = [edge.a[0] - a[0], edge.a[1] - a[1]],
            denom = cross(r, d);
          if (Math.abs(denom) < 1e-16) continue;
          const t = cross(v, d) / denom,
            u = cross(v, r) / denom;
          if (t > 0 && t < 1 && u >= 0 && u <= 1) values.push(t);
        }
        const sorted = [...new Set(values)].sort((x, y) => x - y);
        for (let j = 1; j < sorted.length; j++) {
          const t0 = sorted[j - 1]!,
            t1 = sorted[j]!,
            mid = (t0 + t1) / 2;
          const start: Point = [a[0] + r[0] * t0, a[1] + r[1] * t0],
            end: Point = [a[0] + r[0] * t1, a[1] + r[1] * t1];
          if (insidePolygons(a[0] + r[0] * mid, a[1] + r[1] * mid, boundary)) {
            if (!run.length) run.push(start);
            run.push(end);
          } else if (run.length) {
            if (run.length > 1) result.push(run);
            run = [];
          }
        }
      }
      if (run.length > 1) result.push(run);
    }
    return result;
  };
}
