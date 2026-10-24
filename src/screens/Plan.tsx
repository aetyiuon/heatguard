import React from 'react';
import { View } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import { Button, Card, Copy, Icon, useLocale } from '../ui/components';
import { C, rounded, styles } from '../ui/theme';
import { HEAT_RISK } from '../domain/sources';
import { heatIndexF, heatIndexTier, toF } from '../domain/risk';
export function Plan({ s }: { s: HeatGuardState }) {
  const { t, lang } = useLocale();
  const w = s.weather;
  return (
    <View style={{ gap: 22 }}>
      <Copy kind="label">
        {t('LOOK AHEAD. GO A LITTLE EASIER.', 'PLANIFICA. TÓMALO CON CALMA.')}
      </Copy>
      <Copy kind="title">{t('Find a cooler window.', 'Busca un momento más fresco.')}</Copy>
      <Copy>
        {t(
          'Move strenuous tasks to cooler hours. Daily HeatRisk and hourly heat index describe different risks.',
          'Haz las tareas intensas en horas más frescas. HeatRisk diario e índice de calor horario describen riesgos diferentes.',
        )}
      </Copy>
      {!w ? (
        <Card>
          <Copy>
            {t(
              'Check current conditions to load the seven-day forecast.',
              'Revisa las condiciones para cargar el pronóstico de siete días.',
            )}
          </Copy>
          <Button label={t('Check now', 'Revisar ahora')} onPress={() => void s.refresh()} />
        </Card>
      ) : null}
      {w ? (
        <>
          <Card>
            <View style={styles.row}>
              <Icon name="calendar" />
              <Copy kind="h2">{t('The next seven days', 'Los próximos siete días')}</Copy>
            </View>
            {w.daily.map((d) => {
              const level = d.heatRisk === undefined ? undefined : HEAT_RISK[d.heatRisk];
              return (
                <View
                  key={d.date}
                  style={[
                    styles.row,
                    {
                      paddingVertical: 12,
                      borderTopWidth: 1,
                      borderColor: C.line,
                    },
                  ]}
                >
                  <View
                    style={{
                      width: 8,
                      alignSelf: 'stretch',
                      borderRadius: 4,
                      backgroundColor: level?.color ?? C.line,
                    }}
                  />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Copy
                      color={C.ink}
                      style={{ fontFamily: rounded, fontWeight: '500', fontSize: 16 }}
                    >
                      {new Date(d.date + 'T12:00:00Z').toLocaleDateString(
                        lang === 'es' ? 'es-US' : 'en-US',
                        { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' },
                      )}
                    </Copy>
                    <Copy style={{ fontSize: 12, lineHeight: 17 }}>
                      {level
                        ? `NWS HeatRisk ${d.heatRisk}/4 · ${lang === 'es' ? level.es : level.name}`
                        : t('Official HeatRisk unavailable', 'HeatRisk oficial no disponible')}
                      {` · UV ${d.uv?.toFixed(1) ?? '—'}`}
                    </Copy>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Copy
                      color={C.ink}
                      style={{
                        fontFamily: rounded,
                        fontSize: 24,
                        lineHeight: 30,
                        fontWeight: '500',
                      }}
                    >
                      {Math.round(toF(d.highC))}°
                    </Copy>
                    <Copy style={{ fontSize: 12, lineHeight: 16 }}>
                      {Math.round(toF(d.lowC))}° {t('low', 'mín.')}
                    </Copy>
                  </View>
                </View>
              );
            })}
          </Card>
          <Card>
            <Copy kind="h2">{t('Next 12 hours', 'Próximas 12 horas')}</Copy>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Heat index is for shade. Sun, workload and health can increase your concern.',
                'El índice de calor es para sombra. El sol, esfuerzo y salud pueden aumentar el riesgo.',
              )}
            </Copy>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {w.hourly.slice(0, 12).map((h) => {
                const hi = heatIndexF(toF(h.temperatureC), h.humidity);
                return (
                  <View
                    key={h.time}
                    style={{
                      minWidth: 86,
                      flex: 1,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: C.blueEdge,
                      backgroundColor: C.blueSoft,
                      padding: 14,
                      gap: 6,
                    }}
                  >
                    <Copy style={{ fontSize: 12 }}>
                      {new Date(h.time).toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', {
                        hour: 'numeric',
                      })}
                    </Copy>
                    <Copy
                      color={C.ink}
                      style={{
                        fontFamily: rounded,
                        fontSize: 22,
                        lineHeight: 28,
                        fontWeight: '500',
                      }}
                    >
                      {Math.round(hi)}°F
                    </Copy>
                    <View
                      style={{
                        height: 4,
                        borderRadius: 4,
                        backgroundColor: [C.green, C.yellow, C.orange, C.red][heatIndexTier(hi)],
                      }}
                    />
                  </View>
                );
              })}
            </View>
          </Card>
        </>
      ) : null}
      <Card>
        <Copy kind="h2">{t('Put today in context', 'Contexto del día')}</Copy>
        <Copy>
          {t(
            'Official HeatRisk already incorporates local seasonality and overnight relief. A numeric “degrees above normal” comparison needs a verified local climatology source; no climate-normal data is invented here.',
            'HeatRisk considera la época del año y el enfriamiento nocturno. Comparar grados sobre lo normal requiere una fuente climática local verificada; aquí no se inventan datos.',
          )}
        </Copy>
        <Button
          variant="secondary"
          label={t('How the estimates work', 'Cómo funcionan las estimaciones')}
          onPress={() => s.setSheet('method')}
        />
      </Card>
    </View>
  );
}
