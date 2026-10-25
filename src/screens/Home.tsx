import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import {
  Button,
  Card,
  Chip,
  Copy,
  Disclaimer,
  Icon,
  IconBadge,
  IconName,
  Toggle,
  useLocale,
} from '../ui/components';
import { C, rounded, styles } from '../ui/theme';
import { HEAT_RISK, TIERS } from '../domain/sources';
import { heatIndexTier, toF } from '../domain/risk';
import {
  currentWeatherSource,
  weatherAgeMinutes,
  weatherFreshness,
  WEATHER_REFRESH_MS,
} from '../domain/weather';
import { SkyCondition, Workload } from '../domain/types';
import { SkyScene } from '../domain/sky';
import { PersonalSummary } from './PersonalCheckIn';
import { translatePersonalReason } from '../domain/personal';
import { GlassSurface } from '../ui/glass';
import { AiOutlook } from '../ui/AiOutlook';
const SKY_LABELS: Record<SkyCondition, [string, string]> = {
  clear: ['Clear skies', 'Cielo despejado'],
  'partly-cloudy': ['Partly cloudy', 'Parcialmente nublado'],
  cloudy: ['Cloudy', 'Nublado'],
  fog: ['Fog', 'Niebla'],
  drizzle: ['Drizzle', 'Llovizna'],
  rain: ['Rain', 'Lluvia'],
  snow: ['Snow', 'Nieve'],
  storm: ['Thunderstorms', 'Tormentas eléctricas'],
};
function skyIcon(sky: SkyScene): IconName {
  return sky.condition === 'storm'
    ? 'storm'
    : sky.condition === 'rain' || sky.condition === 'drizzle'
      ? 'rain'
      : sky.condition === 'snow'
        ? 'snow'
        : sky.condition === 'cloudy' || sky.condition === 'fog'
          ? 'cloud'
          : sky.sun
            ? 'sun'
            : 'moon';
}
/** Greeting for the checked place's local time, plus the sky the backdrop is drawing. */
function SkyStatus({ sky }: { sky: SkyScene }) {
  const { t } = useLocale();
  const greeting =
    sky.period === 'morning'
      ? t('Good morning', 'Buenos días')
      : sky.period === 'afternoon'
        ? t('Good afternoon', 'Buenas tardes')
        : t('Good evening', 'Buenas noches');
  const label = sky.condition ? t(...SKY_LABELS[sky.condition]) : undefined;
  const icon = skyIcon(sky);
  return (
    <View
      accessible
      accessibilityLabel={label ? `${greeting}. ${label}.` : `${greeting}.`}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        marginBottom: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: C.line,
        backgroundColor: C.soft,
      }}
    >
      <Icon name={icon} size={16} color={icon === 'sun' ? C.orange : C.blueInk} />
      <Copy color={C.ink} style={{ fontFamily: rounded, fontSize: 13, lineHeight: 18 }}>
        {label ? `${greeting} · ${label}` : greeting}
      </Copy>
    </View>
  );
}
export function Home({ s }: { s: HeatGuardState }) {
  const [weatherDetails, setWeatherDetails] = useState(false);
  const { t, lang } = useLocale(),
    { width } = useWindowDimensions(),
    wide = width > 1200,
    narrow = width < 600;
  const w = s.weather,
    r = s.risk;
  const level = w?.heatRisk === undefined ? undefined : HEAT_RISK[w.heatRisk];
  const severity = r ? TIERS[r.tier] : undefined;
  const fallback = r ? TIERS[heatIndexTier(r.heatIndexF)] : undefined;
  const freshness = weatherFreshness(w, s.now);
  const readingAge = weatherAgeMinutes(w, s.now);
  const source = w ? currentWeatherSource(w) : 'unknown';
  const temperatureTone =
    w && freshness === 'current' && !s.cached && !s.weatherFailed && r
      ? [
          { backgroundColor: C.paper, borderColor: C.limeEdge },
          { backgroundColor: C.paper, borderColor: C.peachEdge },
          { backgroundColor: C.paper, borderColor: C.orange },
          { backgroundColor: C.redSoft, borderColor: C.redEdge },
        ][r.tier]
      : { backgroundColor: C.soft, borderColor: C.line };
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  // Without a session, a low-heat estimate replaces the countdown with plain guidance.
  const lowHeat = !s.session && !!r?.lowHeat;
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
    <View style={{ gap: 20 }}>
      <View style={[styles.row, { alignItems: 'center', gap: 8 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkyStatus sky={s.sky} />
          <Copy kind="label">{t('TODAY / OVERVIEW', 'HOY / RESUMEN')}</Copy>
          <Copy kind="title">{t('Your heat outlook.', 'Tu panorama del calor.')}</Copy>
          <Copy>
            {t(
              'Local conditions, your personal factors and a plan to cool down.',
              'Condiciones locales, factores personales y un plan para refrescarte.',
            )}
          </Copy>
        </View>
      </View>
      <Card style={[temperatureTone, { padding: narrow ? 20 : 24, gap: 12 }]}>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          <Copy kind="label">{t('CURRENT WEATHER', 'TIEMPO ACTUAL')}</Copy>
          <Copy
            style={{
              fontSize: 12,
              fontWeight: '500',
              color: freshness === 'stale' || freshness === 'invalid' ? C.red : C.ink,
            }}
          >
            {s.loading
              ? t('Updating…', 'Actualizando…')
              : !w
                ? t('Waiting for weather', 'Esperando el tiempo')
                : freshness !== 'current'
                  ? t('Outdated or invalid reading', 'Lectura antigua o no válida')
                  : s.cached
                    ? t('Saved reading', 'Lectura guardada')
                    : s.weatherFailed
                      ? t('Update unavailable', 'Actualización no disponible')
                      : t('Auto refresh on', 'Actualización automática activa')}
          </Copy>
        </View>
        <Copy style={{ fontSize: 14 }}>{s.place.name}</Copy>
        <View
          style={[
            styles.row,
            { justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' },
          ]}
        >
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {!narrow ? (
              <IconBadge
                name={skyIcon(s.sky)}
                color={skyIcon(s.sky) === 'sun' ? C.orange : C.blueInk}
                bg={C.soft}
                size={52}
              />
            ) : null}
            <View>
              <Copy
                style={{
                  fontFamily: rounded,
                  fontSize: narrow ? 52 : 72,
                  lineHeight: narrow ? 64 : 84,
                  fontWeight: '500',
                  letterSpacing: -3,
                }}
              >
                {w && Number.isFinite(w.current.temperatureC)
                  ? `${Math.round(toF(w.current.temperatureC))}°F`
                  : '—°F'}
              </Copy>
              <Copy style={{ fontSize: 13 }}>
                {t('Air temperature', 'Temperatura del aire')}
                {w && Number.isFinite(w.current.temperatureC)
                  ? ` · ${Math.round(w.current.temperatureC)}°C`
                  : ''}
              </Copy>
            </View>
          </View>
          <View style={{ gap: 5, flexShrink: 1 }}>
            <Copy style={{ fontSize: narrow ? 12 : 15, fontWeight: '500' }}>
              {t('Heat index (shade)', 'Índice (sombra)')}:{' '}
              {r ? `${Math.round(r.heatIndexF)}°F` : '—'}
            </Copy>
            <Copy style={{ fontSize: narrow ? 12 : 15 }}>
              {t('Humidity', 'Humedad')}: {w ? `${Math.round(w.current.humidity)}%` : '—'}
            </Copy>
            <Copy style={{ fontSize: narrow ? 12 : 15 }}>
              {t('Personal concern', 'Riesgo personal')}:{' '}
              {severity ? (lang === 'es' ? severity.es : severity.name) : '—'}
            </Copy>
          </View>
        </View>
        <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
          <Copy style={{ fontSize: 13 }}>
            {source === 'modeled'
              ? t(
                  'Open-Meteo · modeled current conditions',
                  'Open-Meteo · condiciones actuales modeladas',
                )
              : source === 'forecast'
                ? t(
                    'NWS · hourly forecast fallback, not an observation',
                    'NWS · pronóstico horario de respaldo, no una observación',
                  )
                : source === 'observation'
                  ? t('Weather observation', 'Observación meteorológica')
                  : t('Weather source unavailable', 'Fuente del tiempo no disponible')}
          </Copy>
          {w && readingAge !== null ? (
            <Copy style={{ fontSize: 13 }}>
              {t('Reading', 'Lectura')}:{' '}
              {new Date(w.current.time).toLocaleString(lang === 'es' ? 'es-US' : 'en-US')}
              {t(` · ${readingAge} min ago`, ` · hace ${readingAge} min`)}
            </Copy>
          ) : null}
          {w && freshness !== 'current' ? (
            <Copy color={C.red}>
              {t(
                'This reading is too old or invalid. Refresh before starting activity.',
                'Esta lectura es antigua o no válida. Actualiza antes de iniciar actividad.',
              )}
            </Copy>
          ) : s.cached || s.weatherFailed ? (
            <Copy>
              {t(
                'The latest check was unavailable. Previous readings may be out of date; retry below.',
                'La última consulta no estuvo disponible. Las lecturas anteriores pueden estar desactualizadas; vuelve a intentar abajo.',
              )}
            </Copy>
          ) : null}
        </View>
        <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
          {weatherDetails ? (
            <Copy style={{ fontSize: 12, flex: 1, minWidth: 170 }}>
              {t(
                `Checks every ${WEATHER_REFRESH_MS / 60000} min while open and when you return.`,
                `Consulta cada ${WEATHER_REFRESH_MS / 60000} min mientras está abierta y al volver.`,
              )}
              {s.lastWeatherCheckAt
                ? t(
                    ` Last checked ${new Date(s.lastWeatherCheckAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.`,
                    ` Última consulta: ${new Date(s.lastWeatherCheckAt).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })}.`,
                  )
                : ''}
              {source === 'modeled'
                ? t(
                    ' Modeled data uses 15-minute time steps, so repeated checks may show the same reading.',
                    ' Los datos modelados usan intervalos de 15 minutos; varias consultas pueden mostrar la misma lectura.',
                  )
                : ''}
            </Copy>
          ) : null}
        </View>
        <View style={styles.wrap}>
          <Button
            variant="quiet"
            label={
              s.loading
                ? narrow
                  ? t('Updating…', 'Actualizando…')
                  : t('Updating temperature…', 'Actualizando temperatura…')
                : narrow
                  ? t('Refresh', 'Actualizar')
                  : t('Refresh temperature', 'Actualizar temperatura')
            }
            disabled={s.loading}
            icon="refresh"
            onPress={() => void s.refresh()}
          />
          <Button
            variant="quiet"
            expanded={weatherDetails}
            label={
              weatherDetails
                ? t('Hide weather details', 'Ocultar detalles')
                : t('Weather details', 'Detalles del tiempo')
            }
            onPress={() => setWeatherDetails((value) => !value)}
          />
        </View>
      </Card>
      <View style={[wide ? styles.row : { gap: 16 }, { alignItems: wide ? 'stretch' : undefined }]}>
        <GlassSurface
          style={{
            flex: wide ? 1.65 : undefined,
            backgroundColor: C.paper,
            borderRadius: 24,
            padding: narrow ? 20 : 28,
            gap: 18,
            borderColor: C.line,
            borderWidth: 1,
          }}
        >
          <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
            <View style={[styles.row, { gap: 7 }]}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 10,
                  backgroundColor: s.cached ? C.orange : w ? C.green : C.hare,
                }}
              />
              <Copy kind="label">
                {w && freshness !== 'current'
                  ? t('OUTDATED · REFRESH NEEDED', 'DATOS ANTIGUOS · ACTUALIZA')
                  : s.cached
                    ? t('CACHED · CHECK DATA AGE', 'GUARDADO · REVISA LA FECHA')
                    : w
                      ? t('LATEST AVAILABLE CONDITIONS', 'ÚLTIMAS CONDICIONES DISPONIBLES')
                      : t('READY WHEN YOU ARE', 'LISTO CUANDO TÚ LO ESTÉS')}
              </Copy>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: r?.stopReason ? C.redEdge : C.limeEdge,
                backgroundColor: r?.stopReason ? C.redSoft : C.lime,
              }}
            >
              <Copy
                style={{
                  fontFamily: rounded,
                  fontSize: 12,
                  color: r?.stopReason ? C.red : C.green,
                  fontWeight: '500',
                }}
              >
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
              <Copy color={C.ink} style={{ fontFamily: rounded, fontSize: 15, fontWeight: '700' }}>
                {s.session
                  ? s.session.phase === 'break'
                    ? t('Cooling break remaining', 'Descanso restante')
                    : t('Until your next cooling break', 'Hasta el próximo descanso')
                  : lowHeat
                    ? t('Timed cooling breaks', 'Descansos programados')
                    : t('Estimated time to a cooling break', 'Tiempo estimado hasta un descanso')}
              </Copy>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                <Copy
                  color={r?.stopReason ? C.red : C.ink}
                  style={{
                    fontFamily: rounded,
                    fontWeight: '500',
                    fontSize: lowHeat ? 40 : width < 400 ? 56 : 68,
                    lineHeight: lowHeat ? 50 : width < 400 ? 66 : 78,
                    letterSpacing: lowHeat ? -1.5 : -3,
                  }}
                >
                  {r?.stopReason
                    ? t('Pause', 'Pausa')
                    : lowHeat
                      ? t('Not needed', 'No hacen falta')
                      : timer}
                </Copy>
                {!r?.stopReason && !lowHeat ? (
                  <Copy color={C.ink}>{s.session ? t('mm:ss', 'mm:ss') : t('min', 'min')}</Copy>
                ) : null}
              </View>
              <Copy color={C.ink} style={{ fontSize: 14, lineHeight: 21, maxWidth: 380 }}>
                {r?.stopReason
                  ? lang === 'es'
                    ? (translatePersonalReason(r.stopReason) ??
                      t(
                        '',
                        'Pospón la actividad y enfríate. Revisa las condiciones y los factores personales.',
                      ))
                    : r.stopReason
                  : lowHeat
                    ? t(
                        'Conditions are below heat thresholds right now. Rest and drink water as you normally would, and check again if it warms up.',
                        'Ahora las condiciones están por debajo de los umbrales de calor. Descansa y toma agua como de costumbre, y vuelve a revisar si sube la temperatura.',
                      )
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
            {!narrow ? <IconBadge name="clock" size={64} color={C.green} bg={C.lime} /> : null}
          </View>
          <View style={styles.divider} />
          <View
            style={[
              narrow ? { gap: 14 } : styles.row,
              { flexWrap: 'wrap', justifyContent: 'space-between' },
            ]}
          >
            <Copy
              kind="label"
              color={C.muted}
              style={{ fontSize: 11, maxWidth: 360, flexShrink: 1 }}
            >
              {t(
                'PUBLIC HEALTH GUIDANCE · ESTIMATE, NOT A GUARANTEE',
                'GUÍA DE SALUD PÚBLICA · ESTIMACIÓN, SIN GARANTÍA',
              )}
            </Copy>
            {s.session ? (
              <View style={styles.wrap}>
                <Button
                  style={narrow ? { flexGrow: 1 } : undefined}
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
            ) : lowHeat ? null : r ? (
              <Button
                style={narrow ? { alignSelf: 'stretch' } : undefined}
                icon="play"
                disabled={!r.window}
                label={t('Start outdoor session', 'Iniciar sesión al aire libre')}
                onPress={() => run(s.startSession)}
              />
            ) : (
              <Button
                style={narrow ? { alignSelf: 'stretch' } : undefined}
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
        </GlassSurface>
        <Card
          style={{
            flex: wide ? 1 : undefined,
            backgroundColor: C.paper,
            borderColor: C.line,
            justifyContent: 'space-between',
          }}
        >
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Copy kind="label" color={C.muted}>
              {t('TODAY’S HEAT OUTLOOK', 'PANORAMA DEL CALOR')}
            </Copy>
            <Icon name="sun" color={C.yellow} />
          </View>
          <View style={{ gap: 8 }}>
            <Copy
              color={C.ink}
              style={{ fontFamily: rounded, fontWeight: '500', fontSize: 30, lineHeight: 38 }}
            >
              {level
                ? lang === 'es'
                  ? level.es
                  : level.name
                : fallback
                  ? t(`${fallback.name} concern`, `${fallback.es}: precaución`)
                  : t('Check the outlook', 'Revisa el panorama')}
            </Copy>
            <Copy color={C.muted} style={{ fontSize: 14, lineHeight: 21 }}>
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
                  height: 5,
                  borderRadius: 3,
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
      <PersonalSummary s={s} />
      <AiOutlook
        blocked={!!r?.stopReason || freshness !== 'current' || s.cached || s.weatherFailed}
        personalInput={{ profile: s.profile, checkIn: s.checkIn, workload: s.workload }}
        onProfile={() => s.setTab('profile')}
        onCheckIn={() => s.setSheet('checkin')}
        age={s.profile.age}
        now={s.now}
        onMap={() => s.setTab('relief')}
        onForecast={() => s.setTab('plan')}
      />
      <Card>
        <Copy kind="label">{t('PLAN YOUR JOURNEY', 'PLANEA TU RECORRIDO')}</Copy>
        <Copy kind="h2">
          {t('Your route, with room to cool down.', 'Tu ruta, con espacio para refrescarte.')}
        </Copy>
        <Copy>
          {t(
            'Map a route or record your walk/run. Review nearby relief, distance, pace and cooling-break guidance.',
            'Planea una ruta o graba tu caminata/carrera. Revisa alivio cercano, distancia, ritmo y descansos.',
          )}
        </Copy>
        <Button
          icon="arrow"
          label={t('Plan or record a journey', 'Planear o grabar recorrido')}
          onPress={() => s.setTab('journey')}
        />
      </Card>
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
        <Copy style={{ fontSize: 12 }}>
          {t(
            'Activity is our proxy for metabolic heat: light = easy walking; moderate = brisk walking or gardening; heavy = running or strenuous labor. We do not infer metabolism from pulse or calculate heat tolerance from a calorie formula.',
            'La actividad representa calor metabólico: ligera = paseo suave; moderada = caminar rápido o jardinería; intensa = correr o trabajo exigente. No inferimos metabolismo del pulso ni tolerancia al calor de una fórmula de calorías.',
          )}
        </Copy>
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
        {(
          [
            [
              'sun',
              C.orange,
              C.peach,
              t('Air temperature', 'Temperatura'),
              w ? `${Math.round(toF(w.current.temperatureC))}°F` : '—',
            ],
            [
              'water',
              C.blue,
              C.blueSoft,
              t('Humidity', 'Humedad'),
              w ? `${w.current.humidity}%` : '—',
            ],
            [
              'leaf',
              C.greenDeep,
              C.lime,
              t('Wind', 'Viento'),
              w ? `${w.current.windMs.toFixed(1)} m/s` : '—',
            ],
            [
              'shield',
              C.purple,
              C.purpleSoft,
              t('UV / AirNow AQI', 'UV / ICA AirNow'),
              w ? `${w.current.uv?.toFixed(1) ?? '—'} / ${w.aqi?.value ?? '—'}` : '—',
            ],
          ] as [IconName, string, string, string, string][]
        ).map(([icon, tint, bg, label, value]) => (
          <Card
            key={label}
            style={[
              styles.row,
              { flex: 1, minWidth: width < 400 ? 150 : 200, padding: 14, gap: 12 },
            ]}
          >
            <IconBadge name={icon} color={tint} bg={bg} size={40} />
            <View style={{ flex: 1, gap: 2 }}>
              <Copy style={{ fontSize: 12, lineHeight: 16 }}>{label}</Copy>
              <Copy
                color={C.ink}
                style={{ fontFamily: rounded, fontSize: 22, lineHeight: 28, fontWeight: '800' }}
              >
                {value}
              </Copy>
            </View>
          </Card>
        ))}
      </View>
      <View style={[wide ? styles.row : { gap: 14 }, { alignItems: wide ? 'stretch' : undefined }]}>
        <Card style={{ flex: 1, backgroundColor: C.lime, borderColor: C.limeEdge }}>
          <View style={styles.row}>
            <IconBadge name="snow" color={C.greenDeep} bg={C.paper} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Copy kind="h2">{t('Find your cool place.', 'Encuentra un lugar fresco.')}</Copy>
              <Copy color={C.ink} style={{ fontSize: 14, lineHeight: 20 }}>
                {t(
                  'Water, shade and public spaces with AC.',
                  'Agua, sombra y espacios públicos con aire acondicionado.',
                )}
              </Copy>
            </View>
          </View>
          <View style={styles.wrap}>
            <Button
              label={
                s.coolingRoute.status === 'loading'
                  ? t('Finding cooling places…', 'Buscando lugares frescos…')
                  : t('Route to nearest AC', 'Ir al aire acondicionado')
              }
              icon="arrow"
              disabled={s.coolingRoute.status === 'loading'}
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
          <View accessibilityLiveRegion="polite" style={{ gap: 10 }}>
            {s.coolingRoute.status === 'found' ? (
              <>
                <Copy kind="label">
                  {t('CLOSEST MAPPED COOLING CANDIDATE', 'OPCIÓN FRESCA MÁS CERCANA EN EL MAPA')}
                </Copy>
                <Copy kind="h2">{s.coolingRoute.pin.name}</Copy>
                <Copy>
                  {t(
                    `About ${(s.coolingRoute.pin.distance / 1000).toFixed(1)} km in a straight line from ${s.coolingRoute.place.name}. The walking route may be longer.`,
                    `A unos ${(s.coolingRoute.pin.distance / 1000).toFixed(1)} km en línea recta de ${s.coolingRoute.place.name}. La ruta a pie puede ser más larga.`,
                  )}
                </Copy>
                <Copy>
                  {t(
                    'Opening hours, public access and working AC are not confirmed. Check before leaving; this is not a verified open cooling center.',
                    'No se han confirmado el horario, el acceso público ni el aire acondicionado. Revisa antes de salir; no es un centro de enfriamiento abierto verificado.',
                  )}
                </Copy>
                <Button
                  label={t('Open Google Maps directions', 'Abrir indicaciones en Google Maps')}
                  icon="arrow"
                  onPress={() => run(s.openCoolingDirections)}
                />
              </>
            ) : s.coolingRoute.status === 'loading' ? (
              <Copy>
                {t(
                  `Looking near ${s.coolingRoute.place.name}…`,
                  `Buscando cerca de ${s.coolingRoute.place.name}…`,
                )}
              </Copy>
            ) : s.coolingRoute.status === 'not-found' || s.coolingRoute.status === 'unavailable' ? (
              <Copy>
                {t(
                  `${s.coolingRoute.status === 'unavailable' ? 'The live lookup is unavailable. ' : ''}No cooling destination was found in available records within 10 km of ${s.coolingRoute.place.name}. Coverage is incomplete. Try again or open the Relief Map for other options.`,
                  `${s.coolingRoute.status === 'unavailable' ? 'La búsqueda en línea no está disponible. ' : ''}No se encontró un destino fresco en los registros disponibles a menos de 10 km de ${s.coolingRoute.place.name}. La cobertura está incompleta. Vuelve a intentar o abre el mapa para ver otras opciones.`,
                )}
              </Copy>
            ) : (
              <Copy style={{ fontSize: 13 }}>
                {t(
                  'Find a mapped indoor cooling candidate within 10 km of your heat-check location, then review it before opening directions.',
                  'Busca una opción interior fresca a menos de 10 km de tu ubicación seleccionada y revísala antes de abrir las indicaciones.',
                )}
              </Copy>
            )}
          </View>
        </Card>
        <Card style={{ flex: 1, backgroundColor: C.blueSoft, borderColor: C.blueEdge }}>
          <View style={styles.row}>
            <IconBadge name="shirt" color={C.blue} bg={C.paper} size={52} />
            <View style={{ gap: 4, flex: 1 }}>
              <Copy kind="h2">{t('Dress for the day.', 'Vístete para el día.')}</Copy>
              <Copy color={C.ink} style={{ fontSize: 14, lineHeight: 20 }}>
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
      <View style={[styles.wrap, { justifyContent: 'space-between' }]}>
        <Button
          style={narrow ? { flexGrow: 1 } : undefined}
          variant="quiet"
          icon="heart"
          label={t('Know the symptoms', 'Conocer los síntomas')}
          onPress={() => s.setSheet('symptoms')}
        />
        <Button
          style={narrow ? { flexGrow: 1 } : undefined}
          variant="quiet"
          icon="share"
          disabled={!r}
          label={t('Share a safety card', 'Compartir tarjeta de seguridad')}
          onPress={() => run(s.shareCard)}
        />
        <Button
          style={narrow ? { flexGrow: 1 } : undefined}
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
        <Card key={a.id} style={{ backgroundColor: C.redSoft, borderColor: C.redEdge }}>
          <Copy kind="h2">{a.event}</Copy>
          <Copy>{a.headline}</Copy>
          <Copy style={{ fontSize: 12 }}>{a.description}</Copy>
        </Card>
      ))}
    </View>
  );
}
