import React from 'react';
import { Linking, Modal, ScrollView, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useHeatGuard, Tab } from './src/state/useHeatGuard';
import {
  Button,
  Copy,
  Disclaimer,
  Icon,
  IconName,
  LocaleContext,
  useLocale,
} from './src/ui/components';
import { C, rounded, styles } from './src/ui/theme';
import { RaisedPressable } from './src/ui/RaisedPressable';
import { SunBuddy } from './src/ui/SunBuddy';
import { Home } from './src/screens/Home';
import { Relief } from './src/screens/Relief';
import { Plan } from './src/screens/Plan';
import { Community } from './src/screens/Community';
import { Profile } from './src/screens/Profile';
import { LocationSheet, MethodSheet, SymptomsSheet, WardrobeSheet } from './src/screens/Sheets';
const NAV: { id: Tab; icon: IconName; en: string; es: string }[] = [
  { id: 'home', icon: 'sun', en: 'Today', es: 'Hoy' },
  { id: 'relief', icon: 'map', en: 'Relief Map', es: 'Mapa de alivio' },
  { id: 'plan', icon: 'calendar', en: 'Forecast', es: 'Pronóstico' },
  { id: 'community', icon: 'people', en: 'Community', es: 'Comunidad' },
  { id: 'profile', icon: 'user', en: 'My plan', es: 'Mi plan' },
];
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.row, { gap: 5 }]}>
      <SunBuddy size={compact ? 42 : 49} />
      <Copy
        color={C.ink}
        style={{
          fontFamily: rounded,
          fontSize: compact ? 22 : 26,
          fontWeight: '900',
          letterSpacing: -1,
        }}
      >
        HeatGuard<Copy color={C.greenDeep}>.</Copy>
      </Copy>
    </View>
  );
}
export default function App() {
  const s = useHeatGuard();
  return (
    <SafeAreaProvider>
      <LocaleContext.Provider value={{ lang: s.lang, large: s.large }}>
        <Shell s={s} />
      </LocaleContext.Provider>
    </SafeAreaProvider>
  );
}
function Shell({ s }: { s: ReturnType<typeof useHeatGuard> }) {
  const { t } = useLocale(),
    { width } = useWindowDimensions(),
    desktop = width >= 900;
  function nav(vertical: boolean) {
    return (
      <View
        style={
          vertical
            ? { gap: 12 }
            : {
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingTop: 10,
                paddingBottom: 8,
                paddingHorizontal: 8,
                gap: 5,
                borderTopWidth: 2,
                borderColor: C.line,
                backgroundColor: C.paper,
              }
        }
      >
        {NAV.map((n) => (
          <RaisedPressable
            key={n.id}
            accessibilityRole="tab"
            accessibilityLabel={t(n.en, n.es)}
            accessibilityState={{ selected: s.tab === n.id }}
            onPress={() => s.setTab(n.id)}
            style={vertical ? undefined : { flex: 1 }}
            face={s.tab === n.id ? C.blueSoft : C.paper}
            edge={s.tab === n.id ? C.blueEdge : C.line}
            rim={s.tab === n.id ? C.blueEdge : C.paper}
            depth={3}
            radius={18}
            contentStyle={
              vertical
                ? {
                    gap: 12,
                    justifyContent: 'flex-start',
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    minHeight: 62,
                  }
                : {
                    flexDirection: 'column',
                    paddingHorizontal: 2,
                    paddingVertical: 7,
                    minHeight: 69,
                    gap: 4,
                  }
            }
          >
            <View
              style={{
                width: vertical ? 34 : 28,
                height: vertical ? 34 : 28,
                borderRadius: 11,
                backgroundColor: s.tab === n.id ? C.paper : C.soft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={n.icon}
                size={vertical ? 23 : 22}
                color={s.tab === n.id ? C.blue : C.teal}
              />
            </View>
            <Copy
              color={s.tab === n.id ? '#075882' : C.muted}
              style={{
                fontSize: vertical ? 15 : 10,
                fontWeight: '800',
                lineHeight: vertical ? 22 : 14,
                flexShrink: 1,
                textAlign: vertical ? 'left' : 'center',
              }}
            >
              {t(n.en, n.es)}
            </Copy>
            {vertical && s.tab === n.id ? (
              <View
                style={{
                  marginLeft: 'auto',
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  backgroundColor: C.blue,
                }}
              />
            ) : null}
          </RaisedPressable>
        ))}
      </View>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {desktop ? (
          <View
            style={{
              width: 260,
              backgroundColor: C.paper,
              borderRightWidth: 2,
              borderColor: C.line,
              padding: 20,
              justifyContent: 'space-between',
            }}
          >
            <View style={{ gap: 36 }}>
              <Brand />
              {nav(true)}
            </View>
            <View style={{ gap: 20 }}>
              <View
                style={{
                  padding: 17,
                  borderRadius: 22,
                  borderWidth: 2,
                  borderBottomWidth: 5,
                  borderColor: '#C8E7A3',
                  backgroundColor: C.lime,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    backgroundColor: C.paper,
                    borderRadius: 15,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="leaf" color={C.teal} size={26} />
                </View>
                <Copy
                  color={C.ink}
                  style={{ fontSize: 16, fontFamily: rounded, fontWeight: '800' }}
                >
                  {t('Small breaks. Better days.', 'Pequeños descansos. Mejores días.')}
                </Copy>
                <Copy style={{ fontSize: 12, lineHeight: 18 }}>
                  {t(
                    'A little care before the heat catches up.',
                    'Un poco de cuidado antes de que el calor te alcance.',
                  )}
                </Copy>
              </View>
              <Copy kind="label" style={{ fontSize: 9 }}>
                HEAT AWARENESS, HUMAN FIRST
              </Copy>
            </View>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: desktop ? 36 : 18,
              paddingVertical: desktop ? 20 : 12,
              borderBottomWidth: 2,
              borderColor: C.line,
              backgroundColor: C.paper,
              gap: 10,
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              {desktop ? (
                <View style={styles.row}>
                  <Copy kind="label">
                    {t('YOUR DAILY HEAT PLAN', 'TU PLAN DIARIO CONTRA EL CALOR')}
                  </Copy>
                </View>
              ) : (
                <Brand compact />
              )}
              <View style={[styles.row, { gap: 4, flexWrap: 'wrap' }]}>
                <Button
                  variant="quiet"
                  icon="pin"
                  label={s.place.name}
                  onPress={() => s.setSheet('location')}
                />
                <Button
                  variant="danger"
                  icon="phone"
                  label={`${s.place.emergencyNumber}`}
                  onPress={() => void Linking.openURL(`tel:${s.place.emergencyNumber}`)}
                />
              </View>
            </View>
            {!desktop ? (
              <Copy kind="label" style={{ fontSize: 9 }}>
                {t(
                  'ESTIMATE, NOT A GUARANTEE · COOL DOWN EARLY',
                  'ESTIMACIÓN, SIN GARANTÍA · REFRÉSCATE PRONTO',
                )}
              </Copy>
            ) : null}
          </View>
          <ScrollView
            key={s.tab}
            contentContainerStyle={{
              padding: desktop ? 36 : 18,
              paddingTop: desktop ? 30 : 24,
              gap: 22,
              maxWidth: 1440,
              width: '100%',
              alignSelf: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            {s.error ? (
              <View
                accessibilityRole="alert"
                style={{ padding: 16, borderRadius: 12, backgroundColor: '#FCE8E4', gap: 8 }}
              >
                <Copy color={C.red}>{s.error}</Copy>
                <Button
                  variant="quiet"
                  label={t('Dismiss', 'Cerrar')}
                  onPress={() => s.setError('')}
                />
              </View>
            ) : null}
            {s.tab === 'home' ? (
              <Home s={s} />
            ) : s.tab === 'relief' ? (
              <Relief s={s} />
            ) : s.tab === 'plan' ? (
              <Plan s={s} />
            ) : s.tab === 'community' ? (
              <Community s={s} />
            ) : (
              <Profile s={s} />
            )}
            {s.tab !== 'home' ? <Disclaimer place={s.place} /> : null}
            <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              <Copy style={{ fontSize: 11 }}>
                {t('HeatGuard · take care out there.', 'HeatGuard · cuídate ahí fuera.')}
              </Copy>
              <Button
                variant="quiet"
                label={s.lang === 'en' ? 'Español' : 'English'}
                onPress={() => void s.preferences(s.lang === 'en' ? 'es' : 'en', s.large)}
              />
            </View>
          </ScrollView>
          {!desktop ? nav(false) : null}
        </View>
      </View>
      <Modal
        visible={s.sheet !== null}
        animationType="slide"
        transparent
        onRequestClose={() => s.setSheet(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#172C2780',
            alignItems: 'center',
            justifyContent: 'center',
            padding: desktop ? 30 : 0,
          }}
        >
          <View
            style={{
              maxWidth: 760,
              width: '100%',
              maxHeight: '95%',
              backgroundColor: C.bg,
              borderRadius: 28,
              borderWidth: 2,
              borderColor: C.line,
              overflow: 'hidden',
            }}
          >
            <View
              style={[
                styles.row,
                {
                  justifyContent: 'space-between',
                  padding: 18,
                  borderBottomWidth: 2,
                  borderColor: C.line,
                  flexWrap: 'wrap',
                },
              ]}
            >
              <Brand compact />
              <View style={styles.row}>
                <Button
                  variant="danger"
                  icon="phone"
                  label={s.place.emergencyNumber}
                  onPress={() => void Linking.openURL(`tel:${s.place.emergencyNumber}`)}
                />
                <Button
                  variant="quiet"
                  icon="close"
                  label={t('Close', 'Cerrar')}
                  onPress={() => s.setSheet(null)}
                />
              </View>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: 24, gap: 22 }}
              keyboardShouldPersistTaps="handled"
            >
              {s.error ? <Copy color={C.red}>{s.error}</Copy> : null}
              {s.sheet === 'location' ? (
                <LocationSheet s={s} />
              ) : s.sheet === 'symptoms' ? (
                <SymptomsSheet />
              ) : s.sheet === 'wardrobe' ? (
                <WardrobeSheet s={s} />
              ) : s.sheet === 'method' ? (
                <MethodSheet s={s} />
              ) : null}
              <Disclaimer place={s.place} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
