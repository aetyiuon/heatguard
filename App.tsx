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
import { BrandMark } from './src/ui/SunBuddy';
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
    <View
      accessible
      accessibilityRole="header"
      accessibilityLabel="HeatGuard"
      style={[styles.row, { gap: 10 }]}
    >
      <BrandMark size={compact ? 34 : 40} />
      <Copy
        color={C.greenDeep}
        style={{
          fontFamily: rounded,
          fontSize: compact ? 22 : 26,
          lineHeight: compact ? 28 : 32,
          fontWeight: '900',
          letterSpacing: -0.8,
        }}
      >
        heatguard
      </Copy>
    </View>
  );
}
function CallButton({ number }: { number: string }) {
  return (
    <Button
      variant="danger"
      icon="phone"
      label={number}
      onPress={() => void Linking.openURL(`tel:${number}`)}
    />
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
        accessibilityRole="tablist"
        style={
          vertical
            ? { gap: 6 }
            : {
                flexDirection: 'row',
                justifyContent: 'space-around',
                paddingTop: 8,
                paddingBottom: 6,
                paddingHorizontal: 6,
                gap: 4,
                borderTopWidth: 2,
                borderColor: C.line,
                backgroundColor: C.paper,
              }
        }
      >
        {NAV.map((n) => {
          const on = s.tab === n.id;
          return (
            <RaisedPressable
              key={n.id}
              accessibilityRole="tab"
              accessibilityLabel={t(n.en, n.es)}
              accessibilityState={{ selected: on }}
              onPress={() => s.setTab(n.id)}
              style={vertical ? undefined : { flex: 1 }}
              face={on ? C.blueSoft : C.paper}
              edge={C.paper}
              rim={on ? C.blueEdge : C.paper}
              depth={0}
              radius={14}
              contentStyle={
                vertical
                  ? {
                      gap: 16,
                      justifyContent: 'flex-start',
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      minHeight: 52,
                    }
                  : {
                      flexDirection: 'column',
                      paddingHorizontal: 2,
                      paddingVertical: 6,
                      minHeight: 58,
                      gap: 3,
                    }
              }
            >
              <Icon name={n.icon} size={vertical ? 26 : 24} color={on ? C.blue : C.hare} />
              <Copy
                color={on ? C.blueInk : C.muted}
                style={{
                  fontFamily: rounded,
                  fontSize: vertical ? 15 : 10,
                  fontWeight: '800',
                  lineHeight: vertical ? 20 : 13,
                  letterSpacing: vertical ? 0.6 : 0,
                  textTransform: vertical ? 'uppercase' : 'none',
                  flexShrink: 1,
                  textAlign: vertical ? 'left' : 'center',
                }}
              >
                {t(n.en, n.es)}
              </Copy>
            </RaisedPressable>
          );
        })}
      </View>
    );
  }
  const locationButton = (
    <RaisedPressable
      accessibilityRole="button"
      accessibilityLabel={t(`Location: ${s.place.name}`, `Ubicación: ${s.place.name}`)}
      onPress={() => s.setSheet('location')}
      style={desktop ? undefined : { flex: 1 }}
      radius={14}
      contentStyle={{ gap: 7, paddingHorizontal: 12, justifyContent: 'flex-start' }}
    >
      <Icon name="pin" size={18} color={C.blue} />
      <Copy
        color={C.ink}
        lines={1}
        style={{ fontFamily: rounded, fontSize: 14, fontWeight: '800', flexShrink: 1 }}
      >
        {s.place.name}
      </Copy>
    </RaisedPressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {desktop ? (
          <View
            style={{
              width: 256,
              backgroundColor: C.paper,
              borderRightWidth: 2,
              borderColor: C.line,
              paddingHorizontal: 16,
              paddingVertical: 24,
              gap: 32,
            }}
          >
            <View style={{ paddingHorizontal: 8 }}>
              <Brand />
            </View>
            {nav(true)}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <View
            style={{
              paddingHorizontal: desktop ? 36 : 14,
              paddingVertical: desktop ? 16 : 10,
              borderBottomWidth: 2,
              borderColor: C.line,
              backgroundColor: C.paper,
              gap: 8,
            }}
          >
            <View style={[styles.row, { justifyContent: 'space-between', gap: 8 }]}>
              {desktop ? (
                <Copy kind="label">
                  {t('YOUR DAILY HEAT PLAN', 'TU PLAN DIARIO CONTRA EL CALOR')}
                </Copy>
              ) : (
                <BrandMark size={34} />
              )}
              <View style={[styles.row, { gap: 8, flexShrink: 1 }, desktop ? null : { flex: 1 }]}>
                {locationButton}
                <CallButton number={s.place.emergencyNumber} />
              </View>
            </View>
            {!desktop ? (
              <Copy style={{ fontSize: 11, lineHeight: 15, textAlign: 'center' }}>
                {t(
                  'An estimate, not a guarantee. Cool down early.',
                  'Una estimación, sin garantía. Refréscate pronto.',
                )}
              </Copy>
            ) : null}
          </View>
          <ScrollView
            key={s.tab}
            style={{ backgroundColor: C.bg }}
            contentContainerStyle={{
              padding: desktop ? 36 : 16,
              paddingTop: desktop ? 32 : 20,
              gap: 20,
              maxWidth: 1200,
              width: '100%',
              alignSelf: 'center',
            }}
            keyboardShouldPersistTaps="handled"
          >
            {s.error ? (
              <View
                accessibilityRole="alert"
                style={{
                  padding: 16,
                  borderRadius: 16,
                  borderWidth: 2,
                  borderColor: C.redEdge,
                  backgroundColor: C.redSoft,
                  gap: 10,
                }}
              >
                <Copy color={C.red} style={{ fontWeight: '700' }}>
                  {s.error}
                </Copy>
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
            <View
              style={[
                styles.row,
                { justifyContent: 'space-between', flexWrap: 'wrap', paddingTop: 4 },
              ]}
            >
              <Copy style={{ fontSize: 12 }}>
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
            backgroundColor: '#0000007A',
            alignItems: 'center',
            justifyContent: desktop ? 'center' : 'flex-end',
            padding: desktop ? 30 : 0,
          }}
        >
          <View
            style={{
              maxWidth: 760,
              width: '100%',
              maxHeight: desktop ? '95%' : '92%',
              backgroundColor: C.bg,
              borderRadius: 24,
              borderBottomLeftRadius: desktop ? 24 : 0,
              borderBottomRightRadius: desktop ? 24 : 0,
              overflow: 'hidden',
            }}
          >
            {!desktop ? (
              <View
                style={{
                  alignSelf: 'center',
                  width: 40,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: C.line,
                  marginTop: 8,
                }}
              />
            ) : null}
            <View
              style={[
                styles.row,
                {
                  justifyContent: 'space-between',
                  paddingHorizontal: 18,
                  paddingVertical: 12,
                  borderBottomWidth: 2,
                  borderColor: C.line,
                },
              ]}
            >
              {desktop ? <Brand compact /> : <CallButton number={s.place.emergencyNumber} />}
              <View style={[styles.row, { gap: 8 }]}>
                {desktop ? <CallButton number={s.place.emergencyNumber} /> : null}
                <Button
                  variant="quiet"
                  icon="close"
                  label={t('Close', 'Cerrar')}
                  onPress={() => s.setSheet(null)}
                />
              </View>
            </View>
            <ScrollView
              contentContainerStyle={{ padding: desktop ? 24 : 18, gap: 20 }}
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
