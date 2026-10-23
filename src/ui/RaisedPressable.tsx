import React, { useState } from 'react';
import { Pressable, PressableProps, StyleProp, View, ViewStyle } from 'react-native';
import { C } from './theme';

type RaisedPressableProps = Omit<PressableProps, 'children' | 'style'> & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  face?: string;
  edge?: string;
  rim?: string;
  depth?: number;
  radius?: number;
};

/** The base reserves its height, so pressing never moves neighboring controls. */
export function RaisedPressable({
  children,
  style,
  contentStyle,
  face = C.paper,
  edge = C.line,
  rim = edge,
  depth = 5,
  radius = 18,
  disabled,
  onFocus,
  onBlur,
  ...props
}: RaisedPressableProps) {
  const [focused, setFocused] = useState(false);
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
          <View
            style={[
              {
                minHeight: 48,
                paddingHorizontal: 17,
                paddingVertical: 12,
                borderRadius: radius,
                borderWidth: 2,
                borderColor: focused ? '#075882' : rim,
                backgroundColor: face,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 9,
              },
              contentStyle,
              { transform: [{ translateY: pressed && !disabled ? depth : 0 }] },
            ]}
          >
            {children}
          </View>
        </>
      )}
    </Pressable>
  );
}
