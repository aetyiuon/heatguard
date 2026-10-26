import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { HeatGuardState } from '../state/useHeatGuard';
import { Button, Card, Chip, Copy, Field, Toggle, useLocale } from '../ui/components';
import { C, styles } from '../ui/theme';
import { Profile as HealthProfile } from '../domain/types';
import { PersonalSummary } from './PersonalCheckIn';
import { WearableCard } from '../ui/WearableCard';
const CONDITIONS = [
  ['cardiovascular', 'Cardiovascular disease', 'Enfermedad cardiovascular'],
  ['diabetes', 'Diabetes', 'Diabetes'],
  ['respiratory', 'Respiratory condition', 'Enfermedad respiratoria'],
  ['kidney', 'Kidney disease', 'Enfermedad renal'],
  ['prior-heat-illness', 'Prior heat illness', 'Enfermedad previa por calor'],
];
const MEDICINES = [
  ['diuretics', 'Diuretics', 'Diuréticos'],
  ['beta-blockers', 'Beta-blockers', 'Betabloqueantes'],
  ['antihistamines', 'Antihistamines', 'Antihistamínicos'],
  ['antipsychotics', 'Antipsychotics', 'Antipsicóticos'],
  ['stimulants', 'Stimulants', 'Estimulantes'],
];
export function Profile({ s }: { s: HeatGuardState }) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(s.profile),
    [saved, setSaved] = useState(false),
    [eraseConfirm, setEraseConfirm] = useState(false);
  useEffect(() => {
    setDraft(s.profile);
  }, [s.profile]);
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  const patch = (p: Partial<HealthProfile>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...p }));
  };
  function numeric(value: string, key: 'age' | 'heightCm' | 'weightKg') {
    const n = value.trim() ? Number(value) : undefined;
    patch({ [key]: n });
  }
  async function save() {
    for (const [v, min, max] of [
      [draft.age, 18, 120],
      [draft.heightCm, 40, 250],
      [draft.weightKg, 5, 400],
    ])
      if (v !== undefined && (!Number.isFinite(v) || v < min! || v > max!))
        throw new Error(
          t(
            'Check the optional numbers or leave them blank. HeatGuard is for adults 18+.',
            'Revisa los números opcionales o déjalos vacíos. HeatGuard es para adultos mayores de 18 años.',
          ),
        );
    await s.saveProfile(draft);
    setSaved(true);
  }
  return (
    <View style={{ gap: 22 }}>
      <Copy kind="label">{t('PERSONAL, WITHOUT THE PRESSURE', 'PERSONAL, SIN PRESIÓN')}</Copy>
      <Copy kind="title">{t('A plan that considers you.', 'Un plan que te tiene en cuenta.')}</Copy>
      <PersonalSummary s={s} onEditProfile={() => setEditing(true)} />
      <Card style={{ backgroundColor: C.lime, borderColor: C.limeEdge }}>
        <Copy kind="h2">
          {t('Your health profile stays with you', 'Tu perfil de salud se queda contigo')}
        </Copy>
        <Copy color={C.ink}>
          {t(
            'Every field is optional. Profiles and contacts use encrypted storage on iOS/Android. Ordinary weather requests send your chosen location, not these details. Optional personal AI sharing requires separate review and consent; contacts are always excluded.',
            'Cada campo es opcional. El perfil y los contactos se cifran en iOS/Android. Las solicitudes normales del tiempo envían la ubicación, no estos datos. La IA personal requiere revisión y consentimiento separados; los contactos siempre se excluyen.',
          )}
        </Copy>
        <Copy style={{ fontSize: 12 }}>
          {t(
            'Saved profile fields continue to inform your local plan when this editor is closed. The browser preview keeps health and contact data in memory only; they disappear on reload. Weather and map caches stay on your device. Public map tiles contact the map provider. Community sharing is a separate opt-in.',
            'Los campos guardados siguen formando parte del plan local cuando cierras el editor. La vista del navegador guarda salud y contactos solo en memoria; se borran al recargar. Los datos del clima y mapa se guardan localmente. El mapa contacta al proveedor. Compartir en comunidad es una opción separada.',
          )}
        </Copy>
        <Toggle
          value={editing}
          onChange={setEditing}
          label={t('Show and edit my optional profile', 'Mostrar y editar mi perfil opcional')}
        />
        <Copy style={{ fontSize: 12 }}>
          {t(
            'Optional personal AI mode lets you review and share your saved profile and latest check-in with Groq, with separate per-request consent. City-only mode excludes them. Routes and wearable history are never sent.',
            'El modo personal de IA permite revisar y compartir tu perfil y última revisión con Groq, con consentimiento separado por solicitud. El modo de ciudad los excluye. Nunca se envían rutas ni historial del reloj.',
          )}
        </Copy>
      </Card>
      {editing ? (
        <>
          <Card>
            <Copy kind="h2">{t('A few things about you', 'Algunos datos sobre ti')}</Copy>
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              <Field
                label={t('AGE (OPTIONAL)', 'EDAD (OPCIONAL)')}
                numeric
                value={draft.age?.toString() ?? ''}
                onChangeText={(v) => numeric(v, 'age')}
              />
              <Field
                label={t('HEIGHT · CM', 'ALTURA · CM')}
                numeric
                value={draft.heightCm?.toString() ?? ''}
                onChangeText={(v) => numeric(v, 'heightCm')}
              />
              <Field
                label={t('WEIGHT · KG', 'PESO · KG')}
                numeric
                value={draft.weightKg?.toString() ?? ''}
                onChangeText={(v) => numeric(v, 'weightKg')}
              />
            </View>
            <Copy kind="label">
              {t('SEX ASSIGNED AT BIRTH (OPTIONAL)', 'SEXO ASIGNADO AL NACER (OPCIONAL)')}
            </Copy>
            <View style={styles.wrap}>
              {[
                ['female', t('Female', 'Femenino')],
                ['male', t('Male', 'Masculino')],
                ['intersex', t('Intersex', 'Intersexual')],
                ['', t('Prefer not to say', 'Prefiero no decir')],
              ].map(([v, label]) => (
                <Chip
                  key={v}
                  label={label!}
                  selected={(draft.sex ?? '') === v}
                  onPress={() => patch({ sex: v || undefined })}
                />
              ))}
            </View>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Age, height and weight add context. Adult BMI is only a caution flag when age is known; it never multiplies minutes. Sex is not used to change the estimate. We cannot calculate your individual metabolic rate or heat tolerance from body size.',
                'Edad, altura y peso aportan contexto. El IMC adulto solo indica precaución cuando se conoce la edad; nunca multiplica minutos. El sexo no cambia la estimación. El tamaño corporal no calcula metabolismo ni tolerancia individual al calor.',
              )}
            </Copy>
          </Card>
          <Card>
            <Copy kind="h2">
              {t('Factors that deserve extra care', 'Factores que requieren más cuidado')}
            </Copy>
            {CONDITIONS.map(([v, en, es]) => (
              <Toggle
                key={v}
                label={t(en!, es!)}
                value={draft.conditions.includes(v!)}
                onChange={(on) =>
                  patch({
                    conditions: on
                      ? [...draft.conditions, v!]
                      : draft.conditions.filter((x) => x !== v),
                  })
                }
              />
            ))}
            <View style={styles.divider} />
            <Copy kind="label">
              {t('MEDICATION CATEGORIES · OPTIONAL', 'CATEGORÍAS DE MEDICAMENTOS · OPCIONAL')}
            </Copy>
            {MEDICINES.map(([v, en, es]) => (
              <Toggle
                key={v}
                label={t(en!, es!)}
                value={draft.medications.includes(v!)}
                onChange={(on) =>
                  patch({
                    medications: on
                      ? [...draft.medications, v!]
                      : draft.medications.filter((x) => x !== v),
                  })
                }
              />
            ))}
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Never stop or change medication based on HeatGuard. Ask your clinician about your heat plan and any fluid restrictions.',
                'Nunca suspendas ni cambies medicamentos por HeatGuard. Consulta a tu médico sobre el calor y restricciones de líquidos.',
              )}
            </Copy>
          </Card>
          <Card>
            <Copy kind="h2">{t('Your preparation today', 'Tu preparación hoy')}</Copy>
            <Copy kind="label">
              {t('ACTIVITY & HEAT ACCLIMATIZATION', 'ACTIVIDAD Y ACLIMATACIÓN AL CALOR')}
            </Copy>
            <View style={styles.wrap}>
              {[
                ['sedentary', 'Sedentary', 'Sedentario'],
                ['lightly-active', 'Lightly active', 'Algo activo'],
                ['very-active', 'Very active', 'Muy activo'],
                ['acclimatized', 'Heat-acclimated worker', 'Aclimatado al calor'],
              ].map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en!, es!)}
                  selected={draft.fitness === v}
                  onPress={() => patch({ fitness: v as HealthProfile['fitness'] })}
                />
              ))}
            </View>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'Being fit is not the same as being heat-acclimated. NIOSH recommends gradual exposure over 7–14 days.',
                'Estar en forma no equivale a estar aclimatado. NIOSH recomienda exposición gradual durante 7–14 días.',
              )}
            </Copy>
            <Copy kind="label">{t('HYDRATION · SELF-REPORT', 'HIDRATACIÓN · AUTOEVALUACIÓN')}</Copy>
            <Copy style={{ fontSize: 12 }}>
              {t(
                'This saved answer is a fallback. A current check-in replaces it; update the check-in before each outing rather than treating yesterday’s hydration as current.',
                'Esta respuesta guardada es de respaldo. Una revisión actual la reemplaza; actualízala antes de cada salida y no trates la hidratación de ayer como actual.',
              )}
            </Copy>
            <View style={styles.wrap}>
              {[
                ['adequate', 'Feeling hydrated', 'Bien hidratado'],
                ['unsure', 'Not sure', 'No estoy seguro'],
                ['low', 'Need water', 'Necesito agua'],
              ].map(([v, en, es]) => (
                <Chip
                  key={v}
                  label={t(en!, es!)}
                  selected={draft.hydration === v}
                  onPress={() => patch({ hydration: v as HealthProfile['hydration'] })}
                />
              ))}
            </View>
            <Toggle
              label={t('Shade is available where I am active', 'Tengo sombra durante la actividad')}
              value={draft.shade}
              onChange={(v) => patch({ shade: v })}
            />
            <Toggle
              label={t('Drinking water is available', 'Tengo agua para beber')}
              value={draft.water}
              onChange={(v) => patch({ water: v })}
            />
            <Button
              icon="check"
              label={
                saved
                  ? t('Saved on this device', 'Guardado en este dispositivo')
                  : t('Save optional profile', 'Guardar perfil opcional')
              }
              onPress={() => run(save)}
            />
          </Card>
        </>
      ) : null}
      <Card>
        <Copy kind="h2">{t('Stay aware between checks', 'Mantente atento entre revisiones')}</Copy>
        <Copy>
          {t(
            'Opt-in background monitoring checks your saved location, not your movement. It uses network and battery, and the OS decides when checks run. It can be delayed or stop after force-quit; it is not an emergency monitoring service.',
            'El monitoreo opcional revisa tu ubicación guardada, sin rastrear tus movimientos. Usa red y batería; el sistema decide cuándo revisar. Puede retrasarse o detenerse al cerrar la app; no es un servicio de emergencia.',
          )}
        </Copy>
        <Copy style={{ fontSize: 12 }}>
          {t(
            'Android supports different vibration patterns by severity. iOS uses system notification sounds/haptics; Time Sensitive delivery can bypass Focus only when you allow it and does not override the Silent switch. No critical-alert entitlement is included.',
            'Android admite patrones de vibración según riesgo. iOS usa sonidos y vibración del sistema; las alertas urgentes pueden pasar el modo de concentración solo si lo permites y no anulan el interruptor de silencio. No incluye permiso de alertas críticas.',
          )}
        </Copy>
        <Toggle
          label={t(
            'Monitor this saved location in the background',
            'Monitorear esta ubicación guardada',
          )}
          value={s.monitor?.enabled ?? false}
          onChange={(v) => run(() => s.monitoring(v))}
        />
        <Copy style={{ fontSize: 12 }}>
          {Platform.OS === 'web'
            ? t(
                'Use a native development build on a physical phone for background notifications.',
                'Usa una compilación nativa en un teléfono físico para notificaciones.',
              )
            : t(
                'Background checks request a minimum 15-minute interval, not a guaranteed schedule.',
                'Se solicita un intervalo mínimo de 15 minutos, sin garantía de frecuencia.',
              )}
        </Copy>
      </Card>
      <Card>
        <Copy kind="h2">{t('Make it comfortable to use', 'Hazla cómoda de usar')}</Copy>
        <View style={styles.wrap}>
          <Chip
            label="English"
            selected={s.lang === 'en'}
            onPress={() => run(() => s.preferences('en', s.large))}
          />
          <Chip
            label="Español"
            selected={s.lang === 'es'}
            onPress={() => run(() => s.preferences('es', s.large))}
          />
        </View>
        <Toggle
          label={t('Larger text', 'Texto más grande')}
          value={s.large}
          onChange={(v) => run(() => s.preferences(s.lang, v))}
        />
        <Button
          variant="secondary"
          label={t(
            'Change location / emergency number',
            'Cambiar ubicación / número de emergencia',
          )}
          onPress={() => s.setSheet('location')}
        />
      </Card>
      <WearableCard s={s} />
      <Card>
        <Copy kind="h2">{t('You control your data', 'Tú controlas tus datos')}</Copy>
        <Copy>
          {t(
            'Delete the optional profile, contacts, local pins, cached weather and session. Public community submissions require a separate moderator removal request after deployment.',
            'Borra perfil, contactos, lugares locales, datos guardados y sesión. Las publicaciones públicas requieren una solicitud de eliminación al moderador tras el despliegue.',
          )}
        </Copy>
        {eraseConfirm ? (
          <View style={styles.wrap}>
            <Button
              variant="danger"
              label={t('Confirm delete local data', 'Confirmar borrado local')}
              onPress={() =>
                run(async () => {
                  await s.erase();
                  setEditing(false);
                  setEraseConfirm(false);
                })
              }
            />
            <Button
              variant="quiet"
              label={t('Cancel', 'Cancelar')}
              onPress={() => setEraseConfirm(false)}
            />
          </View>
        ) : (
          <Button
            variant="danger"
            label={t('Delete my local data', 'Borrar mis datos locales')}
            onPress={() => setEraseConfirm(true)}
          />
        )}
      </Card>
    </View>
  );
}
