import React, { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';
import * as SMS from 'expo-sms';
import { HeatGuardState, PRESETS } from '../state/useHeatGuard';
import { Button, Card, Chip, Copy, Field, Icon, Toggle, useLocale } from '../ui/components';
import { C, styles } from '../ui/theme';
import { Buddy } from '../domain/types';
import { api, communityWrite } from '../services/api';
import ReliefMap from '../ui/ReliefMap';
export function Community({ s }: { s: HeatGuardState }) {
  const { t } = useLocale();
  const [adding, setAdding] = useState(false),
    [name, setName] = useState(''),
    [phone, setPhone] = useState(''),
    [neighbor, setNeighbor] = useState(false),
    [minutes, setMinutes] = useState('30'),
    [area, setArea] = useState(PRESETS[0]!);
  const [sharing, setSharing] = useState(false),
    [sent, setSent] = useState(false),
    [reports, setReports] = useState<{ latitude: number; longitude: number; feeling: string }[]>(
      [],
    );
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  async function save() {
    if (
      !name.trim() ||
      !/^\+?[\d ()-]{7,24}$/.test(phone) ||
      !Number.isFinite(Number(minutes)) ||
      Number(minutes) < 15 ||
      Number(minutes) > 240
    )
      throw new Error(
        t(
          'Enter a name, phone and check-in interval of 15–240 minutes.',
          'Ingresa nombre, teléfono e intervalo de 15–240 minutos.',
        ),
      );
    await s.saveBuddy({
      id: String(Date.now()),
      name: name.trim(),
      phone,
      neighbor,
      checkInMinutes: Number(minutes),
      ...(neighbor ? { place: area } : {}),
    });
    setAdding(false);
    setName('');
    setPhone('');
  }
  async function message(b: Buddy, check = false) {
    const text = check
      ? t(
          `Hi ${b.name}, checking in during the heat. Do you have water and a cool place?`,
          `Hola ${b.name}, ¿tienes agua y un lugar fresco para este calor?`,
        )
      : t(
          `Hi ${b.name}, I'm checking in. I'm taking cooling breaks and will reassess conditions. Sent with HeatGuard.`,
          `Hola ${b.name}, estoy tomando descansos y revisando las condiciones. Enviado con HeatGuard.`,
        );
    if (Platform.OS !== 'web' && (await SMS.isAvailableAsync()))
      await SMS.sendSMSAsync([b.phone], text);
    else
      await Linking.openURL(
        `sms:${b.phone}${Platform.OS === 'ios' ? '&' : '?'}body=${encodeURIComponent(text)}`,
      );
  }
  async function loadReports() {
    const data = await api<{ reports: typeof reports }>(
      `/community?lat=${s.place.latitude}&lon=${s.place.longitude}`,
    );
    setReports(data.reports);
  }
  async function feel(feeling: string) {
    if (!sharing)
      throw new Error(
        t(
          'Opt in before sharing your coarse location.',
          'Acepta compartir tu ubicación aproximada antes de enviar.',
        ),
      );
    await communityWrite('/community/feel', {
      latitude: s.place.latitude,
      longitude: s.place.longitude,
      feeling,
    });
    setSent(true);
    await loadReports();
  }
  return (
    <View style={{ gap: 22 }}>
      <Copy kind="label">{t('A SMALL CHECK-IN CAN MATTER', 'UN MENSAJE PUEDE IMPORTAR')}</Copy>
      <Copy kind="title">{t('Look out for each other.', 'Cuidémonos entre todos.')}</Copy>
      <Copy>
        {t(
          'A trusted buddy. A neighbor. One more person who knows to check in.',
          'Un contacto de confianza. Un vecino. Otra persona pendiente de ti.',
        )}
      </Copy>
      <Card style={{ backgroundColor: C.blueSoft, borderColor: C.blueEdge }}>
        <View style={styles.row}>
          <Icon name="people" />
          <Copy kind="h2">{t('Your heat-safety circle', 'Tu círculo de cuidado')}</Copy>
        </View>
        <Copy>
          {t(
            'Contacts are optional and stored privately on your device. Messages open your SMS app for you to review and send. HeatGuard does not silently message anyone.',
            'Los contactos son opcionales y privados. Los mensajes se abren en tu app SMS para revisar y enviar. HeatGuard no envía mensajes sin tu intervención.',
          )}
        </Copy>
        <Button
          label={t('Add a trusted contact', 'Agregar contacto de confianza')}
          icon="people"
          onPress={() => setAdding(!adding)}
        />
      </Card>
      {adding ? (
        <Card>
          <Field label={t('NAME', 'NOMBRE')} value={name} onChangeText={setName} />
          <Field label={t('PHONE', 'TELÉFONO')} value={phone} onChangeText={setPhone} />
          <Field
            label={t('CHECK-IN INTERVAL · MIN', 'INTERVALO · MIN')}
            numeric
            value={minutes}
            onChangeText={setMinutes}
          />
          <Toggle
            value={neighbor}
            onChange={setNeighbor}
            label={t(
              'Remind me to check on this neighbor or relative',
              'Recordarme revisar a este vecino o familiar',
            )}
          />
          {neighbor ? (
            <>
              <Copy>
                {t(
                  'Notify me when official HeatRisk reaches Orange or above in this selected area. Unknown HeatRisk does not count as safe.',
                  'Avísame cuando HeatRisk sea naranja o superior en esta zona. Un valor desconocido no indica seguridad.',
                )}
              </Copy>
              <View style={styles.wrap}>
                {PRESETS.map((p) => (
                  <Chip
                    key={p.name}
                    label={p.name}
                    selected={area.name === p.name}
                    onPress={() => setArea(p)}
                  />
                ))}
              </View>
              <Button
                variant="secondary"
                label={t('Use my currently selected location', 'Usar mi ubicación seleccionada')}
                onPress={() => setArea(s.place)}
              />
            </>
          ) : null}
          <Button
            label={t('Save contact locally', 'Guardar contacto localmente')}
            onPress={() => run(save)}
          />
        </Card>
      ) : null}
      {s.buddies.map((b) => (
        <Card key={b.id}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Copy kind="h2">{b.name}</Copy>
            <Icon name={b.neighbor ? 'home' : 'people'} />
          </View>
          <Copy>
            {b.neighbor ? `${b.place?.name} · ` : ''}
            {t(
              `Check in every ${b.checkInMinutes} min during flagged heat.`,
              `Revisar cada ${b.checkInMinutes} min durante calor peligroso.`,
            )}
          </Copy>
          <Copy style={{ fontSize: 12 }}>
            {b.lastCheckIn
              ? t(
                  `Last self-confirmed safe: ${new Date(b.lastCheckIn).toLocaleString()}`,
                  `Última confirmación propia: ${new Date(b.lastCheckIn).toLocaleString()}`,
                )
              : t('No check-in logged yet.', 'Aún no hay una revisión registrada.')}
          </Copy>
          <View style={styles.wrap}>
            <Button
              label={
                b.neighbor
                  ? t('Ask how they are', 'Preguntar cómo está')
                  : t('Let them know I’m safe', 'Avisar que estoy bien')
              }
              onPress={() => run(() => message(b, b.neighbor))}
            />
            <Button
              variant="secondary"
              label={t('Log my check-in', 'Registrar mi revisión')}
              onPress={() => run(() => s.saveBuddy({ ...b, lastCheckIn: Date.now() }))}
            />
            <Button
              variant="quiet"
              label={t('Remove', 'Eliminar')}
              onPress={() => run(() => s.removeBuddy(b.id))}
            />
          </View>
        </Card>
      ))}
      <Card>
        <Copy kind="h2">{t('Check-in reminders', 'Recordatorios')}</Copy>
        <Copy>
          {t(
            'Enable background monitoring in My plan for local prompts during dangerous heat. Unanswered check-ins prompt you on this phone. A contact cannot receive an automatic missed-check-in alert until a consent-based messaging service is deployed and configured.',
            'Activa el monitoreo en Mi plan para recibir recordatorios locales. Si no respondes, se avisa en este teléfono. Avisar automáticamente al contacto requiere configurar un servicio de mensajes con consentimiento.',
          )}
        </Copy>
        <Button
          variant="secondary"
          label={t('Notification settings', 'Ajustes de notificaciones')}
          onPress={() => s.setTab('profile')}
        />
      </Card>
      <Card>
        <Copy kind="h2">{t('How does it feel on your block?', '¿Cómo se siente en tu zona?')}</Copy>
        <Copy>
          {t(
            'Community reports describe local experience, not measured temperature or medical risk. Sharing sends only your chosen feeling, a location rounded to about 1 km, time, and an anonymous installation ID. Reports expire from the map after six hours.',
            'Los reportes describen experiencias, no temperaturas medidas ni riesgo médico. Se comparte sensación, ubicación aproximada de 1 km, hora e identificador anónimo. Desaparecen del mapa después de seis horas.',
          )}
        </Copy>
        <Toggle
          value={sharing}
          onChange={setSharing}
          label={t(
            'I agree to share a coarse location publicly',
            'Acepto compartir públicamente mi ubicación aproximada',
          )}
        />
        <View style={styles.wrap}>
          {[
            ['comfortable', 'Comfortable', 'Cómodo'],
            ['hot', 'Hot', 'Caliente'],
            ['very-hot', 'Very hot', 'Mucho calor'],
          ].map(([v, en, es]) => (
            <Button
              key={v}
              variant="secondary"
              disabled={!sharing}
              label={t(en!, es!)}
              onPress={() => run(() => feel(v!))}
            />
          ))}
        </View>
        {sent ? (
          <Copy color={C.teal}>{t('Your report was shared.', 'Tu reporte fue compartido.')}</Copy>
        ) : null}
        <Button
          variant="quiet"
          label={t('Load nearby reports', 'Cargar reportes cercanos')}
          onPress={() => run(loadReports)}
        />
      </Card>
      <View
        style={{
          borderRadius: 26,
          overflow: 'hidden',
          borderWidth: 2,
          borderBottomWidth: 5,
          borderColor: C.line,
        }}
      >
        <ReliefMap
          place={s.place}
          pins={[]}
          onSelect={() => {}}
          {...{
            reports,
            heatLayer: !!s.weather?.heatRiskValidTime,
            heatRiskValidTime: s.weather?.heatRiskValidTime,
          }}
        />
      </View>
      <Copy style={{ fontSize: 12 }}>
        {reports.length}{' '}
        {t(
          'nearby reports. An empty map means no reports, not low risk. Official HeatRisk overlay is experimental and independent of reports.',
          'reportes cercanos. Un mapa vacío no significa riesgo bajo. La capa oficial de HeatRisk es experimental e independiente.',
        )}
      </Copy>
    </View>
  );
}
