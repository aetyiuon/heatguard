import { Platform, StyleSheet } from 'react-native';
// Navy surfaces with restrained semantic accents. Mint glass uses light labels;
// opaque mint controls use dark labels when Reduce Transparency is enabled.
// Official NWS HeatRisk colors live in domain/sources.ts and are deliberately unchanged.
export const C = {
  bg: '#0B1016',
  paper: '#121B24',
  ink: '#ECF2F7',
  muted: '#A3B1BE',
  hare: '#8293A3',
  line: '#2D3D4B',
  soft: '#192530',
  orange: '#F0B879',
  lime: '#142C2A',
  limeEdge: '#2A514A',
  red: '#FFA0AF',
  redSoft: '#301E29',
  redEdge: '#6A3847',
  teal: '#7ADCC3',
  green: '#7ADCC3',
  greenDeep: '#7ADCC3',
  greenEdge: '#438F7D',
  blue: '#96C5FC',
  blueInk: '#AFD2FC',
  blueDeep: '#14283B',
  blueSoft: '#182A3B',
  blueEdge: '#344E67',
  peach: '#29251F',
  peachEdge: '#534633',
  yellow: '#F0CB8B',
  gold: '#F0B879',
  purple: '#C4B4ED',
  purpleSoft: '#262338',
};
// Native system type on each platform; no remote font or rounded display fallback.
export const rounded = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  default: 'sans-serif',
});
export const bodyFont = Platform.select({
  web: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  ios: 'System',
  default: 'sans-serif',
});
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    backgroundColor: C.paper,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: C.line,
    gap: 14,
  },
  title: {
    fontSize: 32,
    lineHeight: 40,
    fontFamily: rounded,
    fontWeight: '600',
    color: C.ink,
    letterSpacing: -0.8,
  },
  h2: { fontSize: 20, lineHeight: 28, fontFamily: rounded, fontWeight: '600', color: C.ink },
  body: { fontSize: 15, lineHeight: 24, fontFamily: bodyFont, fontWeight: '400', color: C.muted },
  label: {
    fontSize: 12,
    lineHeight: 17,
    fontFamily: rounded,
    fontWeight: '600',
    letterSpacing: 1.1,
    color: C.muted,
  },
  divider: { height: 1, backgroundColor: C.line },
  input: {
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    fontFamily: bodyFont,
    fontWeight: '400',
    color: C.ink,
    minHeight: 54,
  },
});
