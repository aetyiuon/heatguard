import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassMaterialProps, glassTint } from './glassMaterial.types';
import { C } from './theme';

/** Readable tinted fallback for Android and older/unlinked iOS builds. */
export default function GlassFallback({ radius, tint, reduced }: GlassMaterialProps) {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[
        StyleSheet.absoluteFill,
        {
          borderRadius: radius,
          zIndex: -1,
          overflow: 'hidden',
          backgroundColor: reduced ? tint : glassTint(tint === C.green ? C.lime : tint, 0.94),
        },
      ]}
    >
      {!reduced ? (
        <LinearGradient
          colors={['rgba(209,232,255,0.07)', 'rgba(209,232,255,0)', 'rgba(122,220,195,0.025)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
