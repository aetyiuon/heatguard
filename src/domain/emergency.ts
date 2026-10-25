/** Emergency numbers by ISO 3166-1 alpha-2 country code. 112 reaches emergency services from
 * mobile phones across the EU and many other networks, so it is the fallback for unlisted
 * countries. Users can still correct the number in the location sheet. */
const COUNTRY_NUMBERS: Record<string, string> = {
  US: '911',
  CA: '911',
  MX: '911',
  PR: '911',
  GB: '999',
  IE: '112',
  AU: '000',
  NZ: '111',
  JP: '119',
  KR: '119',
  CN: '120',
  IN: '112',
  BR: '192',
  ZA: '10111',
};
export const FALLBACK_EMERGENCY_NUMBER = '112';
export function emergencyNumberForCountry(code: string | null | undefined): string {
  return (code && COUNTRY_NUMBERS[code.toUpperCase()]) || FALLBACK_EMERGENCY_NUMBER;
}
type Box = [south: number, north: number, west: number, east: number];
// Coarse boxes that stay inside 911 territory (US, Canada and northern Mexico all use 911).
// They are used only when no reverse-geocoded country is available, such as in the browser.
const NINE_ONE_ONE: Box[] = [
  [24.5, 72, -170, -64], // contiguous US, Alaska, Canada, northern Mexico
  [24.5, 60, -64, -52], // Atlantic Canada, stopping south of Greenland (112)
  [18.8, 22.4, -160.4, -154.7], // Hawaii
  [17.8, 18.6, -67.4, -65.2], // Puerto Rico
];
const BOXES: [string, Box[]][] = [
  ['911', NINE_ONE_ONE],
  ['999', [[49.9, 58.7, -8.2, 1.8]]], // Great Britain
  ['000', [[-43.7, -10.6, 113, 153.7]]], // Australia
  ['111', [[-47.4, -34.3, 166.3, 178.6]]], // New Zealand
];
/** Best-effort lookup from coordinates alone; undefined means the country is not known. */
export function emergencyNumberForCoordinates(
  latitude: number,
  longitude: number,
): string | undefined {
  for (const [number, boxes] of BOXES)
    if (
      boxes.some(
        ([s, n, w, e]) => latitude >= s && latitude <= n && longitude >= w && longitude <= e,
      )
    )
      return number;
  return undefined;
}
/** Prefer a reverse-geocoded country, then known coordinates, then the 112 fallback. */
export function resolveEmergencyNumber(
  latitude: number,
  longitude: number,
  countryCode?: string | null,
): string {
  if (countryCode) return emergencyNumberForCountry(countryCode);
  return emergencyNumberForCoordinates(latitude, longitude) ?? FALLBACK_EMERGENCY_NUMBER;
}
