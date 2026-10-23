import { createRequire } from 'node:module';
import { PolygonCoordinates } from '../src/domain/types';
const require = createRequire(import.meta.url);
export const polygonClipping = require('./vendor/polygon-clipping.cjs') as {
  intersection: (subject: PolygonCoordinates, ...clips: PolygonCoordinates[]) => PolygonCoordinates;
  difference: (subject: PolygonCoordinates, ...clips: PolygonCoordinates[]) => PolygonCoordinates;
  union: (...polygons: PolygonCoordinates[]) => PolygonCoordinates;
};
export const osmToGeoJSON = require('./vendor/osmtogeojson.cjs') as (
  data: any,
  options?: any,
) => { features: any[] };
