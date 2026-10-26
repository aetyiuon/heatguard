import React from 'react';
import Svg, { Circle, G, Line } from 'react-native-svg';
import { C } from './theme';

const RAYS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);

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
