import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewProps,
  ViewStyle,
} from 'react-native';
import { C } from './theme';
import GlassMaterial from './GlassMaterial';

const TransparencyContext = createContext(true);
export const useReducedTransparency = () => useContext(TransparencyContext);

/** One accessibility subscription for all surfaces. Start opaque until the preference is known. */
export function GlassProvider({ children }: { children: React.ReactNode }) {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const preference = window.matchMedia('(prefers-reduced-transparency: reduce)');
      const update = () => setReduced(preference.matches);
      update();
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    if (Platform.OS === 'ios') {
      let active = true;
      const subscription = AccessibilityInfo.addEventListener(
        'reduceTransparencyChanged',
        setReduced,
      );
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then((value) => {
          if (active) setReduced(value);
        })
        .catch(() => {
          /* Keep the readable opaque fallback if preference lookup fails. */
        });
      return () => {
        active = false;
        subscription.remove();
      };
    }
    setReduced(false);
  }, []);
  return <TransparencyContext.Provider value={reduced}>{children}</TransparencyContext.Provider>;
}

/** Shared, non-interactive material behind existing content; no layout or health-state changes. */
export function GlassSurface({
  children,
  style,
  ...props
}: ViewProps & { style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedTransparency();
  const resolved = StyleSheet.flatten(style) ?? {};
  const tint = typeof resolved.backgroundColor === 'string' ? resolved.backgroundColor : C.paper;
  const radius = typeof resolved.borderRadius === 'number' ? resolved.borderRadius : 0;
  return (
    <View
      {...props}
      style={[style, { backgroundColor: reduced ? tint : 'transparent', isolation: 'isolate' }]}
    >
      <GlassMaterial radius={radius} tint={tint} reduced={reduced} />
      {children}
    </View>
  );
}

// The light under the glass is the animated sky in SkyBackdrop.tsx.
