import React from 'react';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { C } from './theme';

// Legacy decorative export, unused by the current app. The active BrandMark is below.
const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
function Sun({ concerned }: { concerned: boolean }) {
  const ink = { stroke: C.ink, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };
  return (
    <>
      <G stroke={C.orange} strokeWidth="9" strokeLinecap="round">
        {RAYS.map((a) => (
          <Line
            key={a}
            x1={60 + 46 * Math.cos(a)}
            y1={60 + 46 * Math.sin(a)}
            x2={60 + 54 * Math.cos(a)}
            y2={60 + 54 * Math.sin(a)}
          />
        ))}
      </G>
      <Circle cx="60" cy="64" r="36" fill={C.gold} />
      <Circle cx="60" cy="60" r="36" fill={C.yellow} />
      <Rect x="44" y="49" width="9" height="14" rx="4.5" fill={C.ink} />
      <Rect x="67" y="49" width="9" height="14" rx="4.5" fill={C.ink} />
      {concerned ? (
        <>
          <Path d="M42 45l11-4M78 45l-11-4" {...ink} strokeWidth={4} />
          <Path d="M52 77q8-5 16 0" {...ink} />
        </>
      ) : (
        <Path d="M51 72q9 8 18 0" {...ink} />
      )}
    </>
  );
}

/** Decorative HeatGuard sun; never used as a substitute for the written risk level. */
export function SunBuddy({
  size = 160,
  concerned = false,
}: {
  size?: number;
  concerned?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <Sun concerned={concerned} />
    </Svg>
  );
}

/** Simple sun mark. Keep the 48-grid geometry in scripts/make-icons.ps1 in sync. */
export function BrandMark({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <Circle cx="24" cy="24" r="8" fill="none" stroke={C.orange} strokeWidth="2.5" />
      <G stroke={C.orange} strokeWidth="2.5" strokeLinecap="round">
        {RAYS.map((a) => (
          <Line
            key={a}
            x1={24 + 13 * Math.cos(a)}
            y1={24 + 13 * Math.sin(a)}
            x2={24 + 18 * Math.cos(a)}
            y2={24 + 18 * Math.sin(a)}
          />
        ))}
      </G>
    </Svg>
  );
}
