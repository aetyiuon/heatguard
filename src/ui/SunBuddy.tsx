import React from 'react';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { C } from './theme';

/** Decorative HeatGuard sun; never used as a substitute for the written risk level. */
export function SunBuddy({
  size = 160,
  concerned = false,
}: {
  size?: number;
  concerned?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" aria-hidden>
      <Ellipse cx="80" cy="145" rx="44" ry="7" fill="#E5BC712B" />
      <G stroke={C.orange} strokeWidth="10" strokeLinecap="round">
        <Line x1="80" y1="12" x2="80" y2="23" />
        <Line x1="80" y1="127" x2="80" y2="138" />
        <Line x1="17" y1="75" x2="28" y2="75" />
        <Line x1="132" y1="75" x2="143" y2="75" />
        <Line x1="35" y1="30" x2="43" y2="38" />
        <Line x1="117" y1="112" x2="125" y2="120" />
        <Line x1="35" y1="120" x2="43" y2="112" />
        <Line x1="117" y1="38" x2="125" y2="30" />
      </G>
      <Circle cx="80" cy="79" r="45" fill={C.orange} />
      <Circle cx="80" cy="73" r="45" fill={C.yellow} stroke="#E8A522" strokeWidth="3" />
      <Path
        d="M48 59c3-10 11-18 22-20"
        fill="none"
        stroke="#FFE89A"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <Ellipse cx="61" cy="70" rx="6" ry="9" fill={C.ink} />
      <Ellipse cx="99" cy="70" rx="6" ry="9" fill={C.ink} />
      <Circle cx="63" cy="67" r="2" fill="white" />
      <Circle cx="101" cy="67" r="2" fill="white" />
      <Ellipse cx="48" cy="84" rx="9" ry="5" fill="#F78D49" opacity=".65" />
      <Ellipse cx="112" cy="84" rx="9" ry="5" fill="#F78D49" opacity=".65" />
      <Path
        d={concerned ? 'M70 94q10-8 20 0' : 'M67 88q13 18 26 0'}
        fill="none"
        stroke={C.ink}
        strokeWidth="4"
        strokeLinecap="round"
      />
      {concerned ? (
        <Path
          d="m56 54 10 4m28 0 10-4"
          fill="none"
          stroke={C.ink}
          strokeWidth="3"
          strokeLinecap="round"
        />
      ) : null}
    </Svg>
  );
}
