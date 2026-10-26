import React, { useState } from 'react';
import { Linking, View } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import { PersonalCheckIn } from '../domain/types';
import { toF } from '../domain/risk';
import {
  assessPersonal,
  CHECK_IN_MS,
  personalText,
  validCheckIn,
  VITAL_MS,
} from '../domain/personal';
import { Button, Card, Chip, Copy, Field, Toggle, useLocale } from '../ui/components';
import { C, styles } from '../ui/theme';

export function PersonalSummary({
  s,
  onEditProfile,
}: {
  s: HeatGuardState;
  onEditProfile?: () => void;
}) {
  const { t, lang } = useLocale();
  const heatExposure = Boolean(
    s.weather &&
    s.risk &&
    (s.risk.heatIndexF >= 80 ||
      toF(s.weather.current.temperatureC) >= 80 ||
      (s.weather.heatRisk ?? 0) >= 1 ||
      s.weather.alerts.length > 0),
  );
  const personal = assessPersonal(s.checkIn, s.profile, s.now, heatExposure);
  const c = s.checkIn;
  const date = (at: number) =>
    new Date(at).toLocaleTimeString(lang === 'es' ? 'es-US' : 'en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  return (
    <Card
      style={{
        backgroundColor: personal.stop && personal.stop !== 'update' ? C.redSoft : C.paper,
      }}
    >
      <Copy kind="label">{t('PERSONAL CHECK-IN', 'REVISIÓN PERSONAL')}</Copy>
      <Copy kind="h2">{t('How are you feeling right now?', '¿Cómo te sientes ahora?')}</Copy>
      <Copy>
        {personal.stop
          ? personalText(personal.stop, lang === 'es')
          : personal.status === 'current'
            ? t(
                'Your check-in is part of today’s cooling-break plan. Check again whenever you feel different.',
                'Tu revisión forma parte del plan de descansos de hoy. Revísala cuando te sientas diferente.',
              )
            : t(
                'Add a quick check-in for hydration, how you feel, clothing and optional readings. Without one, the plan uses weather and your saved profile.',
                'Añade una revisión de hidratación, síntomas, ropa y lecturas opcionales. Sin ella, el plan usa el tiempo y tu perfil guardado.',
              )}
      </Copy>
      {c ? (
        <>
          <Copy style={{ fontSize: 13 }}>
            {t('Check-in', 'Revisión')}: {date(c.at)} ·{' '}
            {personal.status === 'current'
              ? t('Current · update within 30 min', 'Actual · actualiza en 30 min')
              : t('Update needed', 'Necesita actualizarse')}
          </Copy>
          <View style={styles.wrap}>
            <Copy>
              {t('Hydration', 'Hidratación')}:{' '}
              {personal.hydration === 'adequate'
                ? t('Feeling hydrated', 'Bien hidratado')
                : personal.hydration === 'low'
                  ? t('Need water', 'Necesito agua')
                  : t('Uncertain', 'Incierta')}
            </Copy>
            <Copy>
              {t('Pulse', 'Pulso')}:{' '}
              {c.heartRate
                ? `${c.heartRate.bpm} ${t('bpm', 'lpm')} · ${c.heartRate.context === 'rested' ? t('after rest', 'tras reposo') : t('active', 'en actividad')} · ${date(c.heartRate.at)} · ${s.now - c.heartRate.at > VITAL_MS ? t('old reading', 'lectura antigua') : t('manual reading', 'lectura manual')}`
                : t('Not provided', 'Sin datos')}
            </Copy>
            <Copy>
              {t('Temperature', 'Temperatura')}:{' '}
              {c.temperature
                ? `${((c.temperature.c * 9) / 5 + 32).toFixed(1)}°F / ${c.temperature.c.toFixed(1)}°C · ${t({ oral: 'oral', ear: 'ear', forehead: 'forehead', wrist: 'wrist/skin' }[c.temperature.method], { oral: 'oral', ear: 'oído', forehead: 'frente', wrist: 'muñeca/piel' }[c.temperature.method])} · ${date(c.temperature.at)} · ${s.now - c.temperature.at > VITAL_MS ? t('old reading', 'lectura antigua') : t('manual reading', 'lectura manual')}`
                : t('Not provided', 'Sin datos')}
            </Copy>
          </View>
          {personal.messages
            .filter((key) => key !== personal.stop && key !== 'normal')
            .map((key) => (
              <Copy key={key} style={{ fontSize: 12 }}>
                {personalText(key, lang === 'es')}
              </Copy>
            ))}
        </>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {t(
          'Early break planning, not a guaranteed safe time outside. Normal readings never add extra minutes.',
          'Planifica descansos tempranos, no tiempo seguro garantizado. Las lecturas normales no añaden minutos.',
        )}
      </Copy>
      <View style={styles.wrap}>
        <Button
          label={
            c
              ? t('Update my check-in', 'Actualizar mi revisión')
              : t('Add my check-in', 'Añadir mi revisión')
          }
          icon="user"
          onPress={() => s.setSheet('checkin')}
        />
        <Button
          variant="quiet"
          label={t('Edit my health profile', 'Editar mi perfil de salud')}
          onPress={onEditProfile ?? (() => s.setTab('profile'))}
        />
      </View>
      {personal.stop === 'emergency' ? (
        <Button
          variant="danger"
          label={t(
            `Call ${s.place.emergencyNumber} now`,
            `Llama al ${s.place.emergencyNumber} ahora`,
          )}
          onPress={() => void Linking.openURL(`tel:${s.place.emergencyNumber}`)}
        />
      ) : null}
    </Card>
  );
}

export function PersonalCheckInSheet({ s }: { s: HeatGuardState }) {
  const { t, lang } = useLocale();
  const [consent, setConsent] = useState(false);
  // Deliberately do not prefill symptoms or vitals: saving must not re-date an old reading.
  const [feeling, setFeeling] = useState<PersonalCheckIn['feeling']>('unknown');
  const [hydration, setHydration] = useState<PersonalCheckIn['hydration']>('unsure');
  const [clothing, setClothing] = useState<PersonalCheckIn['clothing']>('unknown');
  const [pulse, setPulse] = useState('');
  const [pulseEnteredAt, setPulseEnteredAt] = useState(Date.now());
  const [temperature, setTemperature] = useState('');
  const [temperatureEnteredAt, setTemperatureEnteredAt] = useState(Date.now());
  const [unit, setUnit] = useState<'F' | 'C'>('F');
  const [context, setContext] = useState<'rested' | 'active'>('active');
  const [method, setMethod] = useState<'oral' | 'ear' | 'forehead' | 'wrist'>('oral');
  const [minutesAgo, setMinutesAgo] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!consent || saving) return;
    const at = Date.now();
    const rawTemp = temperature.trim() ? Number(temperature) : undefined;
    const next: PersonalCheckIn = {
      at,
      feeling,
      hydration,
      clothing,
      ...(pulse.trim()
        ? { heartRate: { bpm: Number(pulse), at: pulseEnteredAt - minutesAgo * 60_000, context } }
        : {}),
      ...(rawTemp !== undefined
        ? {
            temperature: {
              c: unit === 'F' ? ((rawTemp - 32) * 5) / 9 : rawTemp,
              at: temperatureEnteredAt - minutesAgo * 60_000,
              method,
            },
          }
        : {}),
    };
    if (!validCheckIn(next, at)) {
      setError(
        t(
          'Check the units and readings, or leave them blank. Readings must still be within 5 minutes when saving. Pulse: 20–300 bpm; temperature: 86–113°F / 30–45°C. These are entry bounds, not safe ranges.',
          'Revisa unidades y lecturas o déjalas vacías. Al guardar deben tener menos de 5 minutos. Pulso: 20–300 lpm; temperatura: 86–113°F / 30–45°C. Son límites de entrada, no rangos seguros.',
        ),
      );
      return;
    }
    setSaving(true);
    setError('');
    try {
      await s.saveCheckIn(next);
      s.setSheet(null);
    } catch {
      setError(
        t(
          'Could not save on this device. Please try again.',
          'No se pudo guardar en este dispositivo. Inténtalo otra vez.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <View style={{ gap: 18 }}>
      <Copy kind="title">
        {t('A quick check-in, just for you.', 'Una revisión rápida, para ti.')}
      </Copy>
      <Copy>
        {t(
          'Every reading is optional. You can make a plan without a watch or thermometer. Your phone cannot measure core temperature, hydration percentage or metabolic rate.',
          'Cada lectura es opcional. Puedes planificar sin reloj ni termómetro. El teléfono no mide temperatura central, porcentaje de hidratación ni metabolismo.',
        )}
      </Copy>
      <Card>
        <Copy>
          {t(
            'Health details use encrypted storage on iOS/Android and memory only in this browser. They are never sent to the weather service. Optional personal AI sharing requires a separate snapshot review and consent on Today.',
            'Los datos de salud usan almacenamiento cifrado en iOS/Android y solo memoria en este navegador. Nunca se envían al servicio del tiempo. Compartirlos con la IA personal requiere revisión y consentimiento separados en Hoy.',
          )}
        </Copy>
        <Toggle
          value={consent}
          onChange={setConsent}
          label={t('Use this optional private check-in', 'Usar esta revisión privada opcional')}
        />
      </Card>
      {consent ? (
        <>
          <Card>
            <Copy kind="h2">{t('How do you feel?', '¿Cómo te sientes?')}</Copy>
            <View style={styles.wrap}>
              {(
                [
                  ['well', 'Feeling well', 'Me siento bien'],
                  [
                    'unwell',
                    'Headache, dizziness, nausea or weakness',
                    'Dolor de cabeza, mareo, náuseas o debilidad',
                  ],
                  [
                    'emergency',
                    'Confusion, fainting, seizure or severe breathing trouble',
                    'Confusión, desmayo, convulsiones o dificultad grave para respirar',
                  ],
                  ['unknown', 'Not sure / skip', 'No sé / omitir'],
                ] as const
              ).map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en, es)}
                  selected={feeling === v}
                  onPress={() => setFeeling(v)}
                />
              ))}
            </View>
            {feeling === 'unwell' || feeling === 'emergency' ? (
              <>
                <Copy color={C.red}>
                  {personalText(feeling === 'emergency' ? 'emergency' : 'unwell', lang === 'es')}
                </Copy>
                <Button
                  variant="danger"
                  label={t(
                    `Call ${s.place.emergencyNumber}`,
                    `Llamar al ${s.place.emergencyNumber}`,
                  )}
                  onPress={() => void Linking.openURL(`tel:${s.place.emergencyNumber}`)}
                />
              </>
            ) : null}
          </Card>
          <Card>
            <Copy kind="h2">{t('Before heading out', 'Antes de salir')}</Copy>
            <Copy kind="label">
              {t('HYDRATION RIGHT NOW · SELF-REPORT', 'HIDRATACIÓN AHORA · AUTOEVALUACIÓN')}
            </Copy>
            <View style={styles.wrap}>
              {(
                [
                  ['adequate', 'Feeling hydrated', 'Bien hidratado'],
                  ['unsure', 'Not sure', 'No sé'],
                  ['low', 'Thirsty / need water', 'Sed / necesito agua'],
                ] as const
              ).map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en, es)}
                  selected={hydration === v}
                  onPress={() => setHydration(v)}
                />
              ))}
            </View>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'This is a check-in, not a measured hydration level. Follow any medical fluid restrictions; drinking water does not instantly prove recovery.',
                'Es una autoevaluación, no una medición de hidratación. Respeta restricciones médicas; beber agua no demuestra recuperación inmediata.',
              )}
            </Copy>
            <Copy kind="label">{t('CLOTHING TODAY', 'ROPA DE HOY')}</Copy>
            <View style={styles.wrap}>
              {(
                [
                  ['ordinary', 'Light, ordinary clothing', 'Ropa ligera normal'],
                  ['heavy', 'Heavy / protective gear', 'Ropa pesada / protectora'],
                  ['unknown', 'Not sure', 'No sé'],
                ] as const
              ).map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en, es)}
                  selected={clothing === v}
                  onPress={() => setClothing(v)}
                />
              ))}
            </View>
          </Card>
          <Card>
            <Copy kind="h2">{t('Have a recent reading?', '¿Tienes una lectura reciente?')}</Copy>
            <Copy>
              {t(
                'Enter an actual measurement taken within the last 5 minutes. Leave unknown values blank. These inputs never extend the break timer.',
                'Introduce una medición real de los últimos 5 minutos. Deja vacíos los datos desconocidos. Nunca amplían el temporizador.',
              )}
            </Copy>
            <Copy kind="label">{t('WHEN WERE THESE READINGS TAKEN?', '¿CUÁNDO SE TOMARON?')}</Copy>
            <View style={styles.wrap}>
              {[0, 1, 3].map((v) => (
                <Chip
                  key={v}
                  label={v === 0 ? t('Just now', 'Ahora') : t(`${v} min ago`, `Hace ${v} min`)}
                  selected={minutesAgo === v}
                  onPress={() => setMinutesAgo(v)}
                />
              ))}
            </View>
            <Field
              label={t('PULSE · BPM (OPTIONAL)', 'PULSO · LPM (OPCIONAL)')}
              numeric
              value={pulse}
              onChangeText={(value) => {
                setPulse(value);
                setPulseEnteredAt(Date.now());
              }}
              placeholder="72"
            />
            <View style={styles.wrap}>
              <Chip
                label={t('During activity / not rested', 'En actividad / sin reposo')}
                selected={context === 'active'}
                onPress={() => setContext('active')}
              />
              <Chip
                label={t('After 5 min sitting quietly', 'Tras 5 min sentado tranquilo')}
                selected={context === 'rested'}
                onPress={() => setContext('rested')}
              />
            </View>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Only an adult pulse above 100 after quiet rest triggers a caution. Age must be saved in My plan. Exercise pulse and readings in children are not scored; medication can change pulse. No reading rules out illness.',
                'Solo un pulso adulto mayor de 100 tras reposo activa precaución. Guarda la edad en Mi plan. No se puntúa pulso en ejercicio ni en niños; medicamentos pueden alterarlo. Ninguna lectura descarta enfermedad.',
              )}
            </Copy>
            <Field
              label={t(`THERMOMETER · °${unit} (OPTIONAL)`, `TERMÓMETRO · °${unit} (OPCIONAL)`)}
              numeric
              value={temperature}
              onChangeText={(value) => {
                setTemperature(value);
                setTemperatureEnteredAt(Date.now());
              }}
              placeholder={unit === 'F' ? '98.6' : '37.0'}
            />
            <View style={styles.wrap}>
              {(['F', 'C'] as const).map((v) => (
                <Chip
                  key={v}
                  label={`°${v}`}
                  selected={unit === v}
                  onPress={() => {
                    setUnit(v);
                    setTemperature('');
                  }}
                />
              ))}
            </View>
            <View style={styles.wrap}>
              {(
                [
                  ['oral', 'Oral', 'Oral'],
                  ['ear', 'Ear', 'Oído'],
                  ['forehead', 'Forehead', 'Frente'],
                  ['wrist', 'Wrist / skin', 'Muñeca / piel'],
                ] as const
              ).map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en, es)}
                  selected={method === v}
                  onPress={() => setMethod(v)}
                />
              ))}
            </View>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Thermometer sites are not interchangeable or core-temperature estimates. A reading ≥100.4°F / 38°C prompts a conservative pause. Wrist/skin readings are context only. Do not wait for a high temperature to act on symptoms.',
                'Los lugares de medición no son intercambiables ni estiman temperatura central. Una lectura ≥100.4°F / 38°C indica pausa conservadora. Muñeca/piel es solo contexto. No esperes temperatura alta para actuar ante síntomas.',
              )}
            </Copy>
          </Card>
          <Card>
            <Copy kind="h2">{t('Watch connection', 'Conexión con reloj')}</Copy>
            <Copy>
              {t(
                'Automatic health sync is not connected in this build. Enter pulse from your watch or count it manually. iPhone HealthKit / Android Health Connect need native adapters, explicit permission and device testing. Apple Watch sleeping wrist temperature is not live core temperature.',
                'La sincronización de salud no está conectada en esta versión. Introduce el pulso de tu reloj o cuéntalo. HealthKit / Health Connect requieren adaptadores nativos, permiso y pruebas. La temperatura nocturna de muñeca del Apple Watch no es temperatura central en vivo.',
              )}
            </Copy>
          </Card>
          {error ? (
            <View accessibilityLiveRegion="polite">
              <Copy color={C.red}>{error}</Copy>
            </View>
          ) : null}
          <Button
            icon="check"
            disabled={saving}
            label={saving ? t('Saving…', 'Guardando…') : t('Use my check-in', 'Usar mi revisión')}
            onPress={() => void save()}
          />
          <Copy style={{ fontSize: 12 }}>
            {t(
              `Update within ${CHECK_IN_MS / 60000} minutes or sooner if anything changes. Readings stop being current after 5 minutes. A prior caution stays until a new assessment; a break is not medical clearance.`,
              'Actualiza en 30 minutos o antes si algo cambia. Las lecturas dejan de ser actuales tras 5 minutos. Una precaución sigue hasta reevaluar; un descanso no es autorización médica.',
            )}
          </Copy>
        </>
      ) : null}
      {s.checkIn ? (
        <Button
          variant="quiet"
          label={t('Delete my check-in', 'Borrar mi revisión')}
          onPress={() =>
            void s
              .clearCheckIn()
              .then(() => s.setSheet(null))
              .catch(() =>
                setError(
                  t('Could not delete. Try again.', 'No se pudo borrar. Inténtalo otra vez.'),
                ),
              )
          }
        />
      ) : null}
    </View>
  );
}
