import type { Tab } from './useHeatGuard';
/** Web URL fragments for each tab. Hash routes need no server rewrite on static hosting. */
const SLUGS: Record<Tab, string> = {
  home: 'today',
  relief: 'relief-map',
  journey: 'journey',
  plan: 'forecast',
  community: 'community',
  profile: 'my-plan',
};
const TITLES: Record<Tab, string> = {
  home: 'Today',
  relief: 'Relief Map',
  journey: 'Journey',
  plan: 'Forecast',
  community: 'Community',
  profile: 'My plan',
};
export function hashForTab(tab: Tab): string {
  return `#/${SLUGS[tab]}`;
}
/** Unknown or empty fragments return undefined so the caller can keep its default tab. */
export function tabFromHash(hash: string): Tab | undefined {
  const slug = hash.replace(/^#\/?/, '').split(/[/?]/)[0]!.toLowerCase();
  return (Object.keys(SLUGS) as Tab[]).find((tab) => SLUGS[tab] === slug);
}
export function titleForTab(tab: Tab): string {
  return tab === 'home' ? 'HeatGuard' : `${TITLES[tab]} · HeatGuard`;
}
