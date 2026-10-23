import React, { createContext, useContext } from 'react';
import {
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
  StyleProp,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { C, rounded, styles } from './theme';
import { RaisedPressable } from './RaisedPressable';
import { Language, Place } from '../domain/types';
import { SOURCES } from '../domain/sources';
export const LocaleContext = createContext<{ lang: Language; large: boolean }>({
  lang: 'en',
  large: false,
});
export const useLocale = () => {
  const { lang, large } = useContext(LocaleContext);
  return { lang, large, t: (en: string, es: string) => (lang === 'es' ? es : en) };
};
export function Copy({
  children,
  kind = 'body',
  color,
  style,
}: {
  children: React.ReactNode;
  kind?: 'body' | 'label' | 'h2' | 'title';
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const { large } = useLocale();
  const resolved = StyleSheet.flatten([styles[kind], style]);
  return (
    <Text
      accessibilityRole={kind === 'title' || kind === 'h2' ? 'header' : undefined}
      style={[
        styles[kind],
        style,
        large
          ? {
              fontSize: (resolved.fontSize ?? styles[kind].fontSize) * 1.2,
              lineHeight:
                (resolved.lineHeight ?? (resolved.fontSize ?? styles[kind].fontSize) * 1.5) * 1.2,
            }
          : null,
        color ? { color } : null,
      ]}
    >
      {children}
    </Text>
  );
}
export type IconName =
  | 'sun'
  | 'shield'
  | 'home'
  | 'map'
  | 'calendar'
  | 'people'
  | 'user'
  | 'arrow'
  | 'water'
  | 'leaf'
  | 'snow'
  | 'bell'
  | 'shirt'
  | 'heart'
  | 'share'
  | 'pin'
  | 'clock'
  | 'check'
  | 'refresh'
  | 'close'
  | 'play'
  | 'phone';
const paths: Partial<Record<IconName, string>> = {
  shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7z M8 12l3 3 5-6',
  home: 'M3 10 12 3l9 7v11h-6v-7H9v7H3z',
  map: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16 M15 5v16',
  calendar: 'M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4 M8 14h2 M14 14h2 M8 17h2',
  people:
    'M8 13c-4 0-6 2-6 6 M16 13c4 0 6 2 6 6 M6 21h12 M9 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8 M17 4a3 3 0 0 1 0 6',
  user: 'M4 21c0-5 3-8 8-8s8 3 8 8 M12 3a4 4 0 1 0 0 8a4 4 0 0 0 0-8',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  water: 'M12 3s-7 8-7 12a7 7 0 0 0 14 0c0-4-7-12-7-12z M9 15c0 2 1 3 3 3',
  leaf: 'M20 3C8 3 3 7 3 13c0 7 10 9 14 2 3-5 3-12 3-12z M5 19l9-9',
  snow: 'M12 2v20 M3 7l18 10 M3 17 21 7 M9 4l3 3 3-3 M9 20l3-3 3 3',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5z M10 21h4',
  shirt: 'm8 3 4 2 4-2 6 4-3 5-3-2v11H8V10l-3 2-3-5z',
  heart: 'M12 21 3 12C-2 3 8-1 12 6c4-7 14-3 9 6z',
  share: 'M12 15V3 M7 8l5-5 5 5 M4 13v8h16v-8',
  pin: 'M12 22s8-8 8-14A8 8 0 0 0 4 8c0 6 8 14 8 14z M12 5a3 3 0 1 0 0 6a3 3 0 0 0 0-6',
  clock: 'M12 8v5l4 2',
  check: 'M5 12l5 5L20 7',
  refresh: 'M20 8a8 8 0 1 0 0 9 M20 3v5h-5',
  close: 'M6 6l12 12 M6 18 18 6',
  play: 'm7 3 14 9-14 9z',
  phone: 'M6 3H3c-2 12 6 20 18 18v-3l-5-3-3 3-7-7 3-3z',
};
export function Icon({
  name,
  size = 22,
  color = C.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {name === 'sun' ? (
        <>
          <Circle cx="12" cy="12" r="4" />
          {Array.from({ length: 8 }, (_, i) => (
            <Line
              key={i}
              x1={12 + 7 * Math.cos((i * Math.PI) / 4)}
              y1={12 + 7 * Math.sin((i * Math.PI) / 4)}
              x2={12 + 10 * Math.cos((i * Math.PI) / 4)}
              y2={12 + 10 * Math.sin((i * Math.PI) / 4)}
            />
          ))}
        </>
      ) : (
        <>
          {name === 'clock' ? <Circle cx="12" cy="12" r="9" /> : null}
          <Path d={paths[name] ?? ''} />
        </>
      )}
    </Svg>
  );
}
export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = variant === 'danger' ? C.red : C.ink;
  const face =
    variant === 'primary'
      ? C.green
      : variant === 'danger'
        ? '#FFF0F2'
        : variant === 'secondary'
          ? C.blueSoft
          : C.paper;
  const edge =
    variant === 'primary'
      ? C.greenDeep
      : variant === 'danger'
        ? '#E5AFB8'
        : variant === 'secondary'
          ? C.blueEdge
          : C.line;
  return (
    <RaisedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      face={face}
      edge={edge}
      depth={variant === 'quiet' ? 3 : 5}
      style={style}
    >
      {icon ? <Icon name={icon} size={20} color={color} /> : null}
      <Copy
        color={color}
        style={{
          fontFamily: rounded,
          fontWeight: '800',
          fontSize: 15,
          lineHeight: 21,
          textAlign: 'center',
          flexShrink: 1,
        }}
      >
        {label}
      </Copy>
    </RaisedPressable>
  );
}
export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Chip({
  label,
  selected,
  onPress,
  color,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <RaisedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      face={selected ? (color && /^#[0-9a-f]{6}$/i.test(color) ? `${color}18` : C.lime) : C.paper}
      edge={selected ? (color ?? C.greenDeep) : C.line}
      depth={3}
      radius={16}
      contentStyle={{
        minHeight: 44,
        paddingHorizontal: 14,
        paddingVertical: 9,
        gap: 7,
      }}
    >
      <View style={{ width: 15, height: 15, opacity: selected ? 1 : 0 }}>
        <Icon name="check" size={15} color={C.ink} />
      </View>
      <Copy
        color={C.ink}
        style={{ fontSize: 13, lineHeight: 19, fontWeight: '800', flexShrink: 1 }}
      >
        {label}
      </Copy>
    </RaisedPressable>
  );
}
export function Field({
  label,
  value,
  onChangeText,
  numeric = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <View style={{ gap: 7, flexGrow: 1 }}>
      <Copy kind="label">{label}</Copy>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        maxLength={100}
      />
    </View>
  );
}
export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.row,
        {
          justifyContent: 'space-between',
          minHeight: 56,
          paddingVertical: 5,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Copy color={C.ink} style={{ flex: 1 }}>
        {label}
      </Copy>
      <View
        style={{
          width: 54,
          height: 34,
          borderWidth: 2,
          borderBottomWidth: 4,
          borderColor: value ? C.greenDeep : '#C4D1BC',
          backgroundColor: value ? C.green : C.line,
          borderRadius: 20,
          padding: 3,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            backgroundColor: 'white',
            width: 23,
            height: 23,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {value ? <Icon name="check" size={15} color={C.greenDeep} /> : null}
        </View>
      </View>
    </Pressable>
  );
}
export function Disclaimer({ place }: { place: Place }) {
  const { t } = useLocale();
  return (
    <View
      style={{
        backgroundColor: '#F0F7EB',
        borderRadius: 24,
        borderWidth: 2,
        borderColor: C.line,
        padding: 18,
        gap: 12,
      }}
    >
      <View style={[styles.row, { alignItems: 'flex-start' }]}>
        <Icon name="shield" size={20} />
        <View style={{ flex: 1, gap: 7 }}>
          <Copy kind="label">{t('YOUR BODY COMES FIRST', 'TU CUERPO ES LO PRIMERO')}</Copy>
          <Copy color={C.ink} style={{ fontSize: 12, lineHeight: 19 }}>
            {t(
              'This is a general estimate based on public heat-health guidance, not a medical prediction. If you feel dizzy, nauseated, confused, or stop sweating, get to shade/AC immediately and call 911.',
              'Esta es una estimación general basada en recomendaciones públicas sobre el calor, no una predicción médica. Si tienes mareo, náuseas, confusión o dejas de sudar, busca sombra o aire acondicionado de inmediato y llama al 911.',
            )}
          </Copy>
          <Copy style={{ fontSize: 12, lineHeight: 19 }}>
            {t(
              'Heat stroke can also occur with heavy sweating. Cool down before the estimated window ends. Outside the US, use your configured local emergency number.',
              'El golpe de calor también puede ocurrir con mucha sudoración. Enfríate antes de que termine el intervalo estimado. Fuera de EE. UU., usa el número local configurado.',
            )}
          </Copy>
        </View>
      </View>
      <View style={styles.wrap}>
        <Button
          variant="danger"
          icon="phone"
          label={t(`Call ${place.emergencyNumber}`, `Llamar al ${place.emergencyNumber}`)}
          onPress={() => void Linking.openURL(`tel:${place.emergencyNumber}`)}
        />
        <Button
          variant="quiet"
          label={t('CDC symptom guidance ↗', 'Guía de síntomas de CDC ↗')}
          onPress={() => void Linking.openURL(SOURCES.symptoms)}
        />
      </View>
    </View>
  );
}
