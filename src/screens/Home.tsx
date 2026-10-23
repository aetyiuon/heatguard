import React from 'react';
import { View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeatGuardState } from '../state/useHeatGuard';
import { Button, Card, Chip, Copy, Disclaimer, Icon, Toggle, useLocale } from '../ui/components';
import { C, rounded, styles } from '../ui/theme';
import { SunBuddy } from '../ui/SunBuddy';
import { HEAT_RISK, TIERS } from '../domain/sources';
import { heatIndexTier, toF } from '../domain/risk';
import { Workload } from '../domain/types';
export function Home({ s }: { s: HeatGuardState }) {
  const { t, lang } = useLocale(),
    { width } = useWindowDimensions(),
    wide = width > 1200;
  const w = s.weather,
    r = s.risk;
  const level = w?.heatRisk === undefined ? undefined : HEAT_RISK[w.heatRisk];
  const severity = r ? TIERS[r.tier] : undefined;
  const fallback = r ? TIERS[heatIndexTier(r.heatIndexF)] : undefined;
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  const timer = s.session
    ? `${Math.floor(s.remainingSeconds / 60)
        .toString()
        .padStart(2, '0')}:${Math.floor(s.remainingSeconds % 60)
        .toString()
        .padStart(2, '0')}`
    : r?.window
      ? r.window.join('–')
      : '—';
  return (
    <View style={{ gap: 24 }}>
      <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
        <View style={{ flex: 1, gap: 8 }}>
          <Copy kind="label">
            {t('A LITTLE AWARENESS. A COOLER DAY.', 'MÁS CONCIENCIA. UN DÍA MÁS FRESCO.')}
          </Copy>
          <Copy kind="title">
            {t('A cooler day starts here.', 'Un día más fresco empieza aquí.')}
          </Copy>
          <Copy>
            {t(
              'Your conditions. Your pace. A plan to get out of the heat.',
              'Tus condiciones. Tu ritmo. Un plan para salir del calor.',
            )}
          </Copy>
        </View>
        {width < 600 ? (
          <SunBuddy size={74} concerned={Boolean(r && (r.tier >= 2 || r.stopReason))} />
        ) : null}
      </View>
      <View style={[wide ? styles.row : { gap: 20 }, { alignItems: wide ? 'stretch' : undefined }]}>
        <LinearGradient
          colors={['#FFF4D5', '#FFF0CF', '#FFE8B5']}
          style={{
            flex: wide ? 1.65 : undefined,
            borderRadius: 30,
            padding: wide ? 30 : 24,
            gap: 20,
            overflow: 'hidden',
            borderColor: C.peachEdge,
            borderWidth: 2,
            borderBottomWidth: 6,
          }}
        >
          <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <View style={[styles.row, { gap: 7 }]}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 10,
                  backgroundColor: s.cached ? '#D58B25' : w ? C.teal : C.muted,
                }}
              />
              <Copy kind="label">
                {s.cached
                  ? t('CACHED · CHECK DATA AGE', 'GUARDADO · REVISA LA FECHA')
                  : w
                    ? t('LATEST AVAILABLE CONDITIONS', 'ÚLTIMAS CONDICIONES DISPONIBLES')
                    : t('READY WHEN YOU ARE', 'LISTO CUANDO TÚ LO ESTÉS')}
              </Copy>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: '#F0D59C',
                backgroundColor: '#FFFFFFC9',
              }}
            >
              <Copy style={{ fontSize: 12, color: C.ink, fontWeight: '800' }}>
                {severity
                  ? lang === 'es'
                    ? severity.es
                    : severity.name
                  : t('Check first', 'Revisa primero')}
                {severity ? t(' personal concern', ': riesgo personal') : ''}
              </Copy>
            </View>
          </View>
          <View style={[styles.row, { justifyContent: 'space-between', gap: 5 }]}>
            <View style={{ flex: 1, gap: 10 }}>
              <Copy color={C.ink} style={{ fontSize: 14 }}>
                {s.session
                  ? s.session.phase === 'break'
                    ? t('Cooling break remaining', 'Descanso restante')
                    : t('Until your next cooling break', 'Hasta el próximo descanso')
                  : t('Estimated time to a cooling break', 'Tiempo estimado hasta un descanso')}
              </Copy>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Copy
                  color={r?.stopReason ? C.red : C.ink}
                  style={{
                    fontFamily: rounded,
                    fontWeight: '900',
                    fontSize: width < 400 ? 57 : 70,
                    lineHeight: 82,
                    letterSpacing: -2,
                  }}
                >
                  {r?.stopReason ? t('Pause', 'Pausa') : timer}
                </Copy>
                {!r?.stopReason ? (
                  <Copy color={C.ink}>{s.session ? t('mm:ss', 'mm:ss') : t('min', 'min')}</Copy>
                ) : null}
              </View>
              <Copy color={C.ink} style={{ fontSize: 13, lineHeight: 20, maxWidth: 360 }}>
                {r?.stopReason
                  ? lang === 'es'
                    ? t(
                        '',
                        'Pospón la actividad y enfríate. Revisa las condiciones y los factores personales.',
                      )
                    : r.stopReason
                  : r
                    ? t(
                        `For ${s.workload} activity. Take at least ${r.breakMinutes} min in shade or AC. Reassess every ${r.reassessMinutes} min.`,
                        `Para esta actividad. Descansa al menos ${r.breakMinutes} min en sombra o aire acondicionado. Reevalúa cada ${r.reassessMinutes} min.`,
                      )
                    : t(
                        'Tap Check now to get real weather and a break-planning estimate. No location permission required.',
                        'Pulsa Revisar ahora para obtener datos reales y una estimación. No necesitas permiso de ubicación.',
                      )}
              </Copy>
            </View>
            {width > 600 ? (
              <SunBuddy
                size={wide ? 174 : 150}
                concerned={Boolean(r && (r.tier >= 2 || r.stopReason))}
              />
            ) : null}
          </View>
          <View style={{ height: 2, backgroundColor: '#E9CB8A' }} />
          <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}>
            <Copy
              style={{
                fontSize: 11,
                maxWidth: 360,
                lineHeight: 17,
                color: '#655539',
                fontWeight: '700',
              }}
            >
              {t(
                'PUBLIC HEALTH GUIDANCE · ESTIMATE, NOT A GUARANTEE',
                'GUÍA DE SALUD PÚBLICA · ESTIMACIÓN, SIN GARANTÍA',
              )}
            </Copy>
            {s.session ? (
              <View style={styles.wrap}>
                <Button
                  label={
                    s.session.phase === 'active'
                      ? t('Take a break', 'Tomar un descanso')
                      : t('I have cooled down', 'Ya me refresqué')
                  }
                  disabled={s.session.phase === 'break' && (s.remainingSeconds > 0 || !r?.window)}
                  icon="snow"
                  onPress={() => run(s.session?.phase === 'active' ? s.takeBreak : s.finishBreak)}
                />
                <Button
                  variant="quiet"
                  label={t('End', 'Terminar')}
                  onPress={() => run(s.endSession)}
                />
              </View>
            ) : r ? (
              <Button
                icon="play"
                disabled={!r.window}
                label={t('Start outdoor session', 'Iniciar sesión al aire libre')}
                onPress={() => run(s.startSession)}
              />
            ) : (
              <Button
                icon="refresh"
                disabled={s.loading}
                label={t('Check my conditions', 'Revisar mis condiciones')}
                onPress={() => void s.refresh()}
              />
            )}
          </View>
          {s.session ? (
            <Copy style={{ fontSize: 12 }}>
              {t(
                `${s.session.breaks} cooling breaks logged. The timer is a reminder, not proof of recovery.`,
                `${s.session.breaks} descansos registrados. El temporizador no demuestra recuperación.`,
              )}
            </Copy>
          ) : null}
        </LinearGradient>
        <Card
          style={{
            flex: wide ? 1 : undefined,
            backgroundColor: '#116B8A',
            borderColor: '#0C536D',
            justifyContent: 'space-between',
          }}
        >
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Copy kind="label" color="#DBF4FF">
              {t('TODAY’S HEAT OUTLOOK', 'PANORAMA DEL CALOR')}
            </Copy>
            <Icon name="sun" color={C.lime} />
          </View>
          <View style={{ gap: 8 }}>
            <Copy
              color="white"
              style={{ fontFamily: rounded, fontWeight: '800', fontSize: 34, lineHeight: 42 }}
            >
              {level
                ? lang === 'es'
                  ? level.es
                  : level.name
                : fallback
                  ? t(`${fallback.name} concern`, `${fallback.es}: precaución`)
                  : t('Check the outlook', 'Revisa el panorama')}
            </Copy>
            <Copy color="#DBF4FF" style={{ fontSize: 14, lineHeight: 22 }}>
              {level
                ? t(
                    `NWS HeatRisk ${w!.heatRisk}/4 · daily forecast`,
                    `HeatRisk de NWS ${w!.heatRisk}/4 · pronóstico diario`,
                  )
                : r
                  ? t(
                      `Heat-index fallback · ${Math.round(r.heatIndexF)}°F in shade. Official daily HeatRisk is unavailable.`,
                      `Índice de calor alternativo · ${Math.round(r.heatIndexF)}°F en sombra. HeatRisk diario oficial no disponible.`,
                    )
                  : t(
                      'Check conditions for heat-index guidance. Official HeatRisk appears when available.',
                      'Revisa las condiciones. HeatRisk oficial aparece cuando está disponible.',
                    )}
            </Copy>
          </View>
          <View style={{ flexDirection: 'row', gap: 5 }}>
            {HEAT_RISK.map((v, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 13,
                  borderRadius: 7,
                  backgroundColor: v.color,
                  opacity: w?.heatRisk === undefined || w.heatRisk === i ? 1 : 0.35,
                }}
              />
            ))}
          </View>
          <Button
            variant="secondary"
            label={t('Understand my estimate', 'Entender mi estimación')}
            icon="arrow"
            onPress={() => s.setSheet('method')}
          />
        </Card>
      </View>
      <Disclaimer place={s.place} />
      <View style={{ gap: 12 }}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Copy kind="label">{t('PLAN FOR YOUR PACE', 'PLANIFICA TU RITMO')}</Copy>
          <Copy style={{ fontSize: 12 }}>
            {t('Changing activity ends the current session', 'Cambiar actividad termina la sesión')}
          </Copy>
        </View>
        <View style={styles.wrap}>
          {(['resting', 'light', 'moderate', 'heavy'] as Workload[]).map((v, i) => (
            <Chip
              key={v}
              label={t(
                ['Resting', 'Light activity', 'Moderate activity', 'Heavy exertion'][i]!,
                ['Reposo', 'Actividad ligera', 'Actividad moderada', 'Esfuerzo intenso'][i]!,
              )}
              selected={v === s.workload}
              onPress={() => run(() => s.chooseWork(v))}
            />
          ))}
        </View>
      </View>
      <Card>
        <Copy kind="label">
          {t(
            'YOUR SURROUNDINGS · OPTIONAL HEALTH PROFILE NOT REQUIRED',
            'TU ENTORNO · SIN NECESIDAD DE PERFIL DE SALUD',
          )}
        </Copy>
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: wide ? 30 : 5 }}>
          <View style={{ flex: 1 }}>
            <Toggle
              label={t('I have shade where I am active', 'Tengo sombra durante la actividad')}
              value={s.profile.shade}
              onChange={(v) => run(() => s.saveProfile({ ...s.profile, shade: v }))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Toggle
              label={t('I have drinking water available', 'Tengo agua disponible para beber')}
              value={s.profile.water}
              onChange={(v) => run(() => s.saveProfile({ ...s.profile, water: v }))}
            />
          </View>
        </View>
        <Copy style={{ fontSize: 12 }}>
          {t(
            'We do not assume shade or water. Confirm these for your plan. More personal factors are optional in My plan.',
            'No suponemos que tengas sombra o agua. Confirma estas condiciones. Los factores personales en Mi plan son opcionales.',
          )}
        </Copy>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        {[
          [
            'sun',
            t('Air temperature', 'Temperatura'),
            w ? `${Math.round(toF(w.current.temperatureC))}°F` : '—',
          ],
          ['water', t('Humidity', 'Humedad'), w ? `${w.current.humidity}%` : '—'],
          ['leaf', t('Wind', 'Viento'), w ? `${w.current.windMs.toFixed(1)} m/s` : '—'],
          [
            'shield',
            t('UV / AirNow AQI', 'UV / ICA AirNow'),
            w ? `${w.current.uv?.toFixed(1) ?? '—'} / ${w.aqi?.value ?? '—'}` : '—',
          ],
        ].map(([icon, label, value]) => (
          <Card
            key={label}
            style={{ flex: 1, minWidth: width < 400 ? 140 : 170, padding: 18, gap: 8 }}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Copy style={{ fontSize: 12 }}>{label}</Copy>
              <Icon name={icon as 'sun'} size={18} color={C.teal} />
            </View>
            <Copy
              color={C.ink}
              style={{ fontFamily: rounded, fontSize: 28, lineHeight: 35, fontWeight: '800' }}
            >
              {value}
            </Copy>
          </Card>
        ))}
      </View>
      <View style={[wide ? styles.row : { gap: 14 }, { alignItems: wide ? 'stretch' : undefined }]}>
        <Card style={{ flex: 1, backgroundColor: C.lime, borderColor: '#C8E7A3' }}>
          <View style={styles.row}>
            <View
              style={{
                padding: 12,
                backgroundColor: C.paper,
                borderRadius: 18,
                borderWidth: 2,
                borderColor: '#C8E7A3',
              }}
            >
              <Icon name="snow" size={25} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Copy kind="h2">{t('Find your cool place.', 'Encuentra un lugar fresco.')}</Copy>
              <Copy style={{ fontSize: 13 }}>
                {t(
                  'Water, shade and public spaces with AC.',
                  'Agua, sombra y espacios públicos con aire acondicionado.',
                )}
              </Copy>
            </View>
          </View>
          <View style={styles.wrap}>
            <Button
              label={t('Route to nearest AC', 'Ir al aire acondicionado')}
              icon="arrow"
              onPress={() => run(s.routeAc)}
            />
            <Button
              variant="quiet"
              label={t('Open Relief Map', 'Abrir mapa de alivio')}
              onPress={() => {
                s.setTab('relief');
                void s.loadMap();
              }}
            />
          </View>
        </Card>
        <Card style={{ flex: 1, backgroundColor: C.blueSoft, borderColor: C.blueEdge }}>
          <View style={styles.row}>
            <View style={{ padding: 10, borderRadius: 18, backgroundColor: C.paper }}>
              <Icon name="shirt" size={30} color={C.blue} />
            </View>
            <View style={{ gap: 4, flex: 1 }}>
              <Copy kind="h2">{t('Dress for the day.', 'Vístete para el día.')}</Copy>
              <Copy style={{ fontSize: 13 }}>
                {t(
                  'A thoughtful outfit. A few useful essentials.',
                  'Ropa adecuada y algunos elementos útiles.',
                )}
              </Copy>
            </View>
          </View>
          <Button
            variant="secondary"
            label={t('Build my heat kit', 'Preparar mi equipo')}
            icon="arrow"
            onPress={() => s.setSheet('wardrobe')}
          />
        </Card>
      </View>
      <View style={[styles.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}>
        <Button
          variant="quiet"
          icon="heart"
          label={t('Know the symptoms', 'Conocer los síntomas')}
          onPress={() => s.setSheet('symptoms')}
        />
        <Button
          variant="quiet"
          icon="share"
          disabled={!r}
          label={t('Share a safety card', 'Compartir tarjeta de seguridad')}
          onPress={() => run(s.shareCard)}
        />
        <Button
          icon="refresh"
          label={s.loading ? t('Checking…', 'Revisando…') : t('Check now', 'Revisar ahora')}
          disabled={s.loading}
          onPress={() => void s.refresh()}
        />
      </View>
      {w ? (
        <Copy style={{ fontSize: 11, lineHeight: 18 }}>
          {t('Data time: ', 'Hora de los datos: ')}
          {new Date(w.current.time).toLocaleString(lang === 'es' ? 'es-US' : 'en-US')}
          {' · '}
          {w.sources.join(' + ')}
          {s.cached
            ? t(' · cached copy; refresh to verify', ' · copia guardada; actualiza para verificar')
            : ''}
        </Copy>
      ) : null}
      {w?.alerts.map((a) => (
        <Card key={a.id} style={{ backgroundColor: '#FBE8DF' }}>
          <Copy kind="h2">{a.event}</Copy>
          <Copy>{a.headline}</Copy>
          <Copy style={{ fontSize: 12 }}>{a.description}</Copy>
        </Card>
      ))}
    </View>
  );
}
