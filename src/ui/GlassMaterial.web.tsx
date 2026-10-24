import React from 'react';
import { GlassMaterialProps, glassTint } from './glassMaterial.types';
import { C } from './theme';

/** CSS backdrop blur is a preview treatment, not Apple's native refraction renderer. */
export default function GlassMaterial({ radius, tint, reduced }: GlassMaterialProps) {
  const supported =
    typeof CSS !== 'undefined' &&
    (CSS.supports('backdrop-filter', 'blur(1px)') ||
      CSS.supports('-webkit-backdrop-filter', 'blur(1px)'));
  const enabled = !reduced && supported;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: -1,
        borderRadius: radius,
        backgroundColor: enabled
          ? glassTint(tint, tint === C.green ? 0.25 : 0.42)
          : !reduced && tint === C.green
            ? C.lime
            : tint,
        backdropFilter: enabled ? 'blur(18px) saturate(145%)' : undefined,
        WebkitBackdropFilter: enabled ? 'blur(18px) saturate(145%)' : undefined,
        backgroundImage: !enabled
          ? undefined
          : 'linear-gradient(132deg, rgba(216,238,255,.08), rgba(216,238,255,.02) 42%, rgba(122,220,195,.035))',
        boxShadow: !enabled
          ? undefined
          : 'inset 0 1px 0 rgba(226,244,255,.38), inset 1px 0 0 rgba(226,244,255,.12), inset -1px 0 0 rgba(226,244,255,.08), inset 0 -1px 0 rgba(122,220,195,.07)',
      }}
    />
  );
}
