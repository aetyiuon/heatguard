import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import { biometricFresh } from '../domain/biometrics';
import { Button, Card, Copy, useLocale } from './components';
import { C, styles } from './theme';
export function WearableCard({ s }: { s: HeatGuardState }) {
  const { t } = useLocale(),
    b = s.biometrics;
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!b.connected) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [b.connected]);
  const fresh = biometricFresh(b.sample, Math.max(clock, s.now));
  return (
    <Card>
      <Copy kind="label">{t('APPLE WATCH & APPLE HEALTH', 'APPLE WATCH Y APPLE HEALTH')}</Copy>
      <Copy kind="h2">{t('Your pulse, with context.', 'Tu pulso, con contexto.')}</Copy>
      <Copy kind="title" color={fresh ? C.green : C.muted}>
        {b.sample ? `${Math.round(b.sample.bpm)} bpm` : '— bpm'}
      </Copy>
      <Copy>
        {b.sample
          ? `${b.sample.source === 'apple-watch-live' ? t('Watch workout feed', 'Datos del entrenamiento del Watch') : t('Synced Apple Health reading', 'Lectura sincronizada de Apple Health')} · ${new Date(b.sample.at).toLocaleTimeString()} · ${fresh ? t('recent', 'reciente') : t('stale — waiting for a new reading', 'antigua — esperando una lectura')}`
          : t('No heart-rate reading.', 'Sin lectura de pulso.')}
      </Copy>
      <Copy>
        {t(
          'Live heart rate requires the installed HeatGuard Watch companion running an outdoor workout. Apple Health sync can be delayed. Pulse is context only: it does not measure hydration or core temperature and never adds outdoor minutes.',
          'El pulso en vivo requiere la app HeatGuard del Watch con un entrenamiento al aire libre. Apple Health puede tardar en sincronizar. El pulso no mide hidratación ni temperatura central y nunca añade minutos al aire libre.',
        )}
      </Copy>
      {!b.available ? (
        <Copy color={C.orange}>
          {t(
            'Available in a rebuilt iPhone app with HealthKit enabled. This browser cannot connect to Apple Watch.',
            'Disponible en una app de iPhone recompilada con HealthKit. Este navegador no puede conectar al Apple Watch.',
          )}
        </Copy>
      ) : null}
      <View style={styles.wrap}>
        {!b.connected ? (
          <Button
            icon="heart"
            label={
              b.busy
                ? t('Connecting…', 'Conectando…')
                : t('Connect Apple Health', 'Conectar Apple Health')
            }
            disabled={!b.available || b.busy}
            onPress={() => void b.connect()}
          />
        ) : (
          <>
            <Button
              label={t('Start live Watch workout', 'Iniciar entrenamiento del Watch')}
              disabled={!b.installed || b.busy}
              onPress={() => void b.startLive()}
            />
            <Button
              variant="quiet"
              label={t('Disconnect & clear reading', 'Desconectar y borrar lectura')}
              onPress={b.disconnect}
            />
          </>
        )}
      </View>
      {b.connected && !b.installed ? (
        <Copy>
          {t(
            'Install the companion app on the paired Watch to enable live workout readings. HealthKit read access is private; a completed permission dialog does not prove permission or available data.',
            'Instala la app complementaria en el Watch para activar lecturas de entrenamiento. Completar el permiso no confirma acceso de lectura ni datos disponibles.',
          )}
        </Copy>
      ) : null}
      {b.error ? (
        <Copy color={C.orange}>
          {t(
            'Connection or reading unavailable. Check permissions and the paired Watch. To stop a workout if the phone is disconnected, tap End on the Watch.',
            'Conexión o lectura no disponible. Revisa permisos y el Watch. Si el teléfono está desconectado, termina el entrenamiento desde el Watch.',
          )}
        </Copy>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {t(
          'Optional and local. HeatGuard keeps readings in memory and clears them on disconnect/reload. Apple Health manages its own saved records. Revoke access in Apple Health settings.',
          'Opcional y local. HeatGuard guarda lecturas en memoria y las borra al desconectar o reiniciar. Apple Health administra sus propios registros. Revoca acceso en Apple Health.',
        )}
      </Copy>
    </Card>
  );
}
