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
export { lineClipper } from '../src/domain/paths';
