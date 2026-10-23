import { Place } from './types';

/** Viewing centers, never invented fountain or shelter coordinates. */
export const DFW_PLACES: Place[] = [
  {
    name: 'Arlington · River Legacy Park',
    latitude: 32.7902,
    longitude: -97.116,
    emergencyNumber: '911',
  },
  {
    name: 'Fort Worth · Trinity Park',
    latitude: 32.7398,
    longitude: -97.3609,
    emergencyNumber: '911',
  },
  {
    name: 'Dallas · White Rock Lake',
    latitude: 32.8312,
    longitude: -96.7163,
    emergencyNumber: '911',
  },
  { name: 'Dallas · Katy Trail', latitude: 32.8056, longitude: -96.8085, emergencyNumber: '911' },
  {
    name: 'Arlington · Randol Mill Park',
    latitude: 32.7527,
    longitude: -97.1387,
    emergencyNumber: '911',
  },
];
export const OTHER_PLACES: Place[] = [
  { name: 'Austin, TX', latitude: 30.2672, longitude: -97.7431, emergencyNumber: '911' },
  { name: 'Phoenix, AZ', latitude: 33.4484, longitude: -112.074, emergencyNumber: '911' },
  { name: 'London, UK', latitude: 51.5074, longitude: -0.1278, emergencyNumber: '999' },
];
