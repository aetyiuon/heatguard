import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { C } from './theme';
import { useReducedTransparency } from './glass';
import GlassMaterial from './GlassMaterial';

type RaisedPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  face?: string;
  edge?: string;
  rim?: string;
  depth?: number;
  radius?: number;
  glass?: boolean;
};

/** The base reserves its height, so pressing never moves neighboring controls. */
export function RaisedPressable({
  children,
  style,
  contentStyle,
  face = C.paper,
  edge = C.line,
  rim = edge,
  depth = 2,
  radius = 16,
  glass = true,
  disabled,
  onFocus,
  onBlur,
  ...props
}: RaisedPressableProps) {
  const [focused, setFocused] = useState(false);
  const reduced = useReducedTransparency();
  const translucent = glass && !reduced && face !== 'transparent';
  return (
    <Pressable
      {...props}
      disabled={disabled}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={[
        {
          paddingBottom: depth,
          borderRadius: radius,
          minWidth: 0,
          maxWidth: '100%',
          opacity: disabled ? 0.48 : 1,
        },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {depth > 0 && !translucent ? (
            <View
              style={{
                pointerEvents: 'none',
                position: 'absolute',
                top: depth,
                bottom: 0,
                left: 0,
                right: 0,
                borderRadius: radius,
                backgroundColor: edge,
              }}
            />
          ) : null}
          <View
            style={[
              {
                minHeight: 48,
                paddingHorizontal: 17,
                paddingVertical: 12,
                borderRadius: radius,
                borderWidth: 1,
                borderColor: focused ? C.blue : rim,
                backgroundColor: translucent ? 'transparent' : face,
                isolation: 'isolate',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              },
              contentStyle,
              { transform: [{ translateY: pressed && !disabled ? depth : 0 }] },
            ]}
          >
            {translucent ? <GlassMaterial radius={radius} tint={face} reduced={false} /> : null}
            {children}
          </View>
        </>
      )}
    </Pressable>
  );
}
