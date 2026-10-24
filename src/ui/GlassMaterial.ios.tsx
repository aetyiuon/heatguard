import React from 'react';
import { StyleSheet, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { GlassMaterialProps, glassTint } from './glassMaterial.types';
import FallbackMaterial from './GlassFallback';

// A previous development binary may not include the new module. Never import the
// native view manager until the linked module and runtime APIs are confirmed.
const nativeModule = requireOptionalNativeModule<{
  isLiquidGlassAvailable: boolean;
  isGlassEffectAPIAvailable: boolean;
}>('ExpoGlassEffect');
const NativeGlass =
  nativeModule?.isLiquidGlassAvailable && nativeModule.isGlassEffectAPIAvailable
    ? (require('expo-glass-effect') as typeof import('expo-glass-effect')).GlassView
    : null;

export default function GlassMaterial(props: GlassMaterialProps) {
  if (props.reduced || !NativeGlass) return <FallbackMaterial {...props} />;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { borderRadius: props.radius, zIndex: -1 }]}
    >
      <NativeGlass
        glassEffectStyle="clear"
        colorScheme="dark"
        tintColor={glassTint(props.tint, 0.25)}
        style={[StyleSheet.absoluteFill, { borderRadius: props.radius }]}
      />
    </View>
  );
}
