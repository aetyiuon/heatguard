import React, { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { HeatGuardState, PRESETS } from '../state/useHeatGuard';
import { Button, Card, Chip, Copy, Field, Icon, useLocale } from '../ui/components';
import { C, styles } from '../ui/theme';
import { Activity, recommendGear } from '../domain/wardrobe';
import { SOURCES } from '../domain/sources';
import { translatePersonalReason } from '../domain/personal';
import { readLocal, writeLocal } from '../services/storage';
export function LocationSheet({ s }: { s: HeatGuardState }) {
  const { t } = useLocale();
  const [name, setName] = useState(s.place.name),
    [lat, setLat] = useState(String(s.place.latitude)),
    [lon, setLon] = useState(String(s.place.longitude)),
    [emergency, setEmergency] = useState(s.place.emergencyNumber);
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  async function save() {
    const latitude = Number(lat),
      longitude = Number(lon);
    if (
      !lat.trim() ||
      !lon.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180 ||
      !/^\d{2,6}$/.test(emergency)
    )
      throw new Error(
        t(
          'Enter valid coordinates and a local emergency number.',
          'Ingresa coordenadas y número de emergencia válidos.',
        ),
      );
    await s.changePlace({
      name: name.trim() || `${latitude}, ${longitude}`,
      latitude,
      longitude,
      emergencyNumber: emergency,
    });
  }
  return (
    <View style={{ gap: 18 }}>
      <Copy kind="title">{t('Where are you checking?', '¿Qué ubicación quieres revisar?')}</Copy>
      <Copy>
        {t(
          'Use a preset or coordinates without granting any permissions. GPS is optional. Changing location disables monitoring until you opt in again.',
          'Usa una ciudad o coordenadas sin otorgar permisos. El GPS es opcional. Cambiar la ubicación desactiva el monitoreo hasta volver a activarlo.',
        )}
      </Copy>
      <View style={styles.wrap}>
        {PRESETS.map((p) => (
          <Chip
            key={p.name}
            label={p.name}
            selected={s.place.name === p.name}
            onPress={() => run(() => s.changePlace(p))}
          />
        ))}
      </View>
      <Card>
        <Copy kind="h2">{t('Use my location', 'Usar mi ubicación')}</Copy>
        <Copy>
          {t(
            'HeatGuard uses GPS once to check heat and find nearby cooling places. Coordinates go to the weather proxy. We do not request background location tracking. If you decline, manual entry works.',
            'HeatGuard usa GPS una vez para revisar el calor y buscar lugares frescos. Las coordenadas se envían al servidor meteorológico. No rastreamos en segundo plano. Puedes ingresar datos manualmente.',
          )}
        </Copy>
        <Button
          icon="pin"
          label={t('Allow a GPS check', 'Permitir revisión por GPS')}
          onPress={() => run(s.useGps)}
        />
      </Card>
      <Field label={t('LOCATION LABEL', 'NOMBRE DEL LUGAR')} value={name} onChangeText={setName} />
      <View style={styles.row}>
        <Field label={t('LATITUDE', 'LATITUD')} value={lat} onChangeText={setLat} numeric />
        <Field label={t('LONGITUDE', 'LONGITUD')} value={lon} onChangeText={setLon} numeric />
      </View>
      <Field
        label={t(
          'LOCAL EMERGENCY NUMBER · VERIFY FOR YOUR COUNTRY',
          'NÚMERO LOCAL DE EMERGENCIA · VERIFICA TU PAÍS',
        )}
        value={emergency}
        onChangeText={setEmergency}
        numeric
      />
      <Button
        label={t('Check this location', 'Revisar esta ubicación')}
        onPress={() => run(save)}
      />
    </View>
  );
}
export function SymptomsSheet() {
  const { t } = useLocale();
  return (
    <View style={{ gap: 18 }}>
      <Copy kind="label">
        {t('SAVED IN THE APP · AVAILABLE OFFLINE', 'GUARDADO EN LA APP · SIN CONEXIÓN')}
      </Copy>
      <Copy kind="title">{t('Recognize it. Act early.', 'Reconócelo. Actúa pronto.')}</Copy>
      <Card style={{ backgroundColor: C.redSoft, borderColor: C.redEdge }}>
        <View style={styles.row}>
          <Icon name="heart" color={C.red} />
          <Copy kind="h2" color={C.red}>
            {t('Heat stroke · emergency', 'Golpe de calor · emergencia')}
          </Copy>
        </View>
        <Copy color={C.ink}>
          {t(
            'Confusion, slurred speech, seizures, collapse or loss of consciousness, very high body temperature. Skin can be hot and dry OR heavily sweating.',
            'Confusión, habla arrastrada, convulsiones, desmayo o pérdida de conciencia y temperatura corporal muy alta. La piel puede estar seca O muy sudorosa.',
          )}
        </Copy>
        <Copy color={C.ink}>
          {t(
            'Call emergency services immediately. Stay with the person, move them to a cool place and remove outer clothing. Begin rapid cooling with cold-water immersion if safe, or wet skin, cold wet cloths and moving air. Do not give fluids to someone confused, unconscious or unable to swallow safely.',
            'Llama a emergencias de inmediato. Quédate con la persona, llévala a un lugar fresco y quita ropa exterior. Enfríala rápidamente con inmersión en agua fría si es seguro, o moja la piel, usa paños fríos y ventilación. No des líquidos a alguien confundido, inconsciente o incapaz de tragar.',
          )}
        </Copy>
      </Card>
      <Card>
        <Copy kind="h2">
          {t('Heat exhaustion · stop activity', 'Agotamiento por calor · detén la actividad')}
        </Copy>
        <Copy>
          {t(
            'Headache, nausea, dizziness, weakness, thirst, heavy sweating, irritability or less urine. Move out of the heat, loosen unnecessary clothing, cool with wet cloths and sip cool water if fully alert and able to swallow.',
            'Dolor de cabeza, náuseas, mareo, debilidad, sed, sudor intenso, irritabilidad o menos orina. Sal del calor, afloja la ropa, usa paños húmedos y toma sorbos de agua si estás consciente y puedes tragar.',
          )}
        </Copy>
        <Copy color={C.ink}>
          {t(
            'Seek medical evaluation. Have someone stay with you. If care is unavailable, symptoms worsen, vomiting occurs, or you develop confusion or fainting, call emergency services. Do not wait for the app timer.',
            'Busca evaluación médica y pide que alguien se quede contigo. Si no hay atención disponible, empeoras, vomitas, te confundes o te desmayas, llama a emergencias. No esperes al temporizador.',
          )}
        </Copy>
      </Card>
      <Copy style={{ fontSize: 12 }}>
        {t(
          'Based on CDC/NIOSH Heat-related Illnesses. This guide does not diagnose illness.',
          'Basado en CDC/NIOSH sobre enfermedades por calor. Esta guía no diagnostica.',
        )}
      </Copy>
      <Button
        variant="secondary"
        label={t('Read CDC first-aid guidance ↗', 'Leer primeros auxilios de CDC ↗')}
        onPress={() => void Linking.openURL(SOURCES.symptoms)}
      />
    </View>
  );
}
export function MethodSheet({ s }: { s: HeatGuardState }) {
  const { t } = useLocale();
  const r = s.risk;
  return (
    <View style={{ gap: 18 }}>
      <Copy kind="title">{t('An estimate you can question.', 'Una estimación transparente.')}</Copy>
      <Copy>
        {t(
          'HeatGuard plans early cooling breaks. It cannot calculate your time to heat stroke or physiological collapse.',
          'HeatGuard planifica descansos tempranos. No calcula el tiempo hasta un golpe de calor o colapso.',
        )}
      </Copy>
      <Card>
        <Copy kind="h2">{t('What drives this estimate', 'Qué determina la estimación')}</Copy>
        {r ? (
          <>
            <Copy>
              {t(
                `NWS heat index: ${r.heatIndexF.toFixed(1)}°F (shade). NIOSH adjusted air temperature: ${r.adjustedTemperatureF.toFixed(1)}°F.`,
                `Índice de calor: ${r.heatIndexF.toFixed(1)}°F (sombra). Temperatura ajustada de NIOSH: ${r.adjustedTemperatureF.toFixed(1)}°F.`,
              )}
            </Copy>
            <Copy>
              {t(
                `Published sample cycle: ${r.sourceSchedule.workMinutes === null ? 'Caution' : r.sourceSchedule.workMinutes === 60 ? 'Normal' : r.sourceSchedule.workMinutes + ' min work / ' + r.sourceSchedule.restMinutes + ' min rest'}.`,
                `Ciclo publicado: ${r.sourceSchedule.workMinutes === null ? 'Precaución' : r.sourceSchedule.workMinutes === 60 ? 'Normal' : r.sourceSchedule.workMinutes + ' min actividad / ' + r.sourceSchedule.restMinutes + ' min descanso'}.`,
              )}
            </Copy>
            {r.reasons.map((v, i) => (
              <View key={i} style={[styles.row, { alignItems: 'flex-start' }]}>
                <Icon name="arrow" size={16} />
                <Copy style={{ flex: 1, fontSize: 13 }}>{t(v, spanishReason(v))}</Copy>
              </View>
            ))}
          </>
        ) : (
          <Copy>
            {t(
              'Check current conditions to see the specific reasoning.',
              'Revisa las condiciones para ver los factores específicos.',
            )}
          </Copy>
        )}
      </Card>
      <Card>
        <Copy kind="h2">
          {t('Published schedule, with clear limits', 'Horario publicado y sus límites')}
        </Copy>
        <Copy>
          {t(
            'NIOSH 2017-127 uses adjusted air temperature, not heat index. Its example assumes fit, rested, hydrated workers under 40, normal clothing, 30% humidity and perceptible air movement. HeatGuard rounds temperature and humidity conservatively upward. Full sun adds 13°F; partial cloud adds 7°F; shade/night adds none. Humidity adjustments are 3/6/9°F at 40/50/60% or above.',
            'NIOSH 2017-127 usa temperatura del aire ajustada, no índice de calor. Supone trabajadores en forma, descansados, hidratados, menores de 40 años, ropa normal, humedad del 30% y aire perceptible. HeatGuard redondea conservadoramente. Sol pleno suma 13°F, nubes parciales 7°F, sombra o noche cero. Humedad agrega 3/6/9°F al 40/50/60% o más.',
          )}
        </Copy>
        <Copy>
          {t(
            'The displayed range is HeatGuard policy: a normal schedule becomes a 45–60 min planning range; moderate concern caps at 15–30 min; high concern caps at 10–15 min. Cooling rest is at least 10 minutes or the remainder of the hour. Very high concern, a NIOSH Caution cell, stale data or no water in heat suppresses the timer. These adjustments are conservative design choices, not validated physiological limits.',
            'El intervalo es una política de HeatGuard: horario normal 45–60 min; riesgo moderado 15–30 min; alto 10–15 min. Descanso mínimo de 10 min o el resto de la hora. Riesgo muy alto, celda de precaución, datos antiguos o falta de agua suprimen el temporizador. Son decisiones conservadoras, no límites fisiológicos validados.',
          )}
        </Copy>
        <Copy>
          {t(
            'Personal factors only raise concern; fitness or sex never grants extra “safe” minutes. Workplace PPE, radiant heat or illness require a site-specific plan and professional advice.',
            'Los factores personales solo aumentan la precaución. La forma física o el sexo no conceden minutos extra. El EPP, calor radiante o enfermedad requieren un plan específico y asesoría.',
          )}
        </Copy>
      </Card>
      <Card>
        <Copy kind="h2">
          {t('WBGT: screening, with uncertainty', 'WBGT: orientativo y con incertidumbre')}
        </Copy>
        <Copy>
          {r?.wbgtC !== undefined
            ? t(
                `Approximate WBGT: ${r.wbgtC.toFixed(1)}°C.`,
                `WBGT aproximado: ${r.wbgtC.toFixed(1)}°C.`,
              )
            : t(
                'WBGT approximation is unavailable without suitable solar, wind and humidity inputs.',
                'WBGT aproximado no disponible sin datos adecuados de sol, viento y humedad.',
              )}
        </Copy>
        <Copy>
          {t(
            'This screening model combines Stull wet-bulb temperature and a simplified solar/wind globe heat balance. It is not measured natural wet bulb, not the validated Liljegren model, and is not used to select work/rest minutes. Use measured WBGT and an occupational heat plan for workplace decisions.',
            'Este modelo combina bulbo húmedo de Stull con un balance simplificado de sol y viento. No es bulbo húmedo natural medido ni el modelo validado de Liljegren. No determina minutos de actividad. Usa WBGT medido y un plan laboral.',
          )}
        </Copy>
      </Card>
      <Card>
        <Copy kind="h2">
          {t(
            'Personal readings: context, not clearance',
            'Lecturas personales: contexto, no autorización',
          )}
        </Copy>
        <Copy>
          {t(
            'Today’s check-in combines symptoms, self-reported hydration, clothing and optional manual readings with the saved profile and chosen activity. Activity represents metabolic heat; we do not estimate a personal metabolic rate, dehydration percentage, core temperature or time to injury.',
            'La revisión combina síntomas, hidratación declarada, ropa y lecturas manuales con el perfil y la actividad. La actividad representa calor metabólico; no estimamos metabolismo personal, porcentaje de deshidratación, temperatura central ni tiempo hasta lesión.',
          )}
        </Copy>
        <Copy>
          {t(
            'Symptoms override weather and timers. Adult resting pulse above 100 bpm and thermometer readings ≥38°C trigger conservative pause rules, not a heat-illness diagnosis. The pulse rule requires a known adult age and 5 minutes of quiet rest. Exercise pulse and wrist temperature are context only. A normal reading never lengthens the original recommendation.',
            'Los síntomas tienen prioridad sobre el clima y temporizadores. Pulso adulto en reposo mayor de 100 lpm y termómetro ≥38°C activan pausas conservadoras, no diagnóstico. El pulso requiere edad adulta conocida y 5 minutos de reposo. Pulso en ejercicio y temperatura de muñeca son solo contexto. Una lectura normal nunca amplía la recomendación original.',
          )}
        </Copy>
        <Copy>
          {t(
            'The 30-minute check-in and 5-minute reading freshness intervals are HeatGuard policy. An outdated check-in pauses the timer; a previous abnormal reading or symptom report stays a caution until reassessed. Saving a new check-in is not medical clearance. Measurements are optional, remain local and are never included in weather requests.',
            'Los intervalos de 30 minutos para revisión y 5 para lecturas son política de HeatGuard. Una revisión antigua pausa el temporizador; lecturas anormales o síntomas previos siguen como precaución hasta reevaluar. Guardar no es autorización médica. Las mediciones son opcionales, locales y no se envían con solicitudes del tiempo.',
          )}
        </Copy>
      </Card>
      <Card>
        <Copy kind="h2">{t('Read the source guidance', 'Consulta las fuentes')}</Copy>
        {[
          ['NIOSH work/rest schedule', SOURCES.schedules],
          ['NIOSH hydration and acclimatization', SOURCES.workplace],
          ['NWS heat-index equation', SOURCES.heatIndex],
          ['NWS HeatRisk categories', SOURCES.heatRisk],
          ['CDC heat and medications', SOURCES.medicines],
          ['Stull wet-bulb approximation', SOURCES.wetBulb],
          ['AHA resting pulse context', SOURCES.pulse],
          ['NHS adult thermometer context', SOURCES.temperature],
          ['Apple HealthKit authorization', SOURCES.healthKit],
          ['Apple Watch sleeping wrist temperature', SOURCES.wristTemperature],
        ].map(([name, url]) => (
          <Button
            key={url}
            variant="quiet"
            label={name! + ' ↗'}
            onPress={() => void Linking.openURL(url!)}
          />
        ))}
        <Copy style={{ fontSize: 12 }}>HeatGuard model v{r?.modelVersion ?? '0.2.0'}</Copy>
      </Card>
      {s.weather?.warnings.length ? (
        <Card>
          <Copy kind="h2">{t('What is missing today', 'Qué falta hoy')}</Copy>
          {s.weather.warnings.map((v, i) => (
            <Copy key={i} style={{ fontSize: 13 }}>
              {t(
                v,
                'Una fuente oficial o un dato adicional no está disponible. No interpretes datos ausentes como riesgo bajo. Consulta las alertas locales.',
              )}
            </Copy>
          ))}
        </Card>
      ) : null}
    </View>
  );
}
function spanishReason(v: string) {
  const phrases: Record<string, string> = {
    'Sun exposure increases the NIOSH schedule temperature.':
      'La exposición al sol aumenta la temperatura ajustada de NIOSH.',
    'Humidity reduces evaporative cooling.': 'La humedad reduce la evaporación del sudor.',
    'Heavy exertion adds metabolic heat.': 'El esfuerzo intenso agrega calor metabólico.',
    'Official HeatRisk indicates elevated daily heat impacts.':
      'HeatRisk oficial indica efectos elevados del calor durante el día.',
    'Age is outside the sample schedule’s under-40 assumptions.':
      'La edad está fuera del supuesto de menores de 40 años.',
    'Reported conditions or medication categories call for extra caution. Never change medication without your clinician.':
      'Las condiciones o medicamentos declarados requieren precaución. No cambies medicamentos sin tu médico.',
    'Higher BMI is a caution flag, not a calculated heat-tolerance correction.':
      'Un IMC mayor indica precaución, sin calcular tolerancia al calor.',
    'Full heat acclimatization is not confirmed. Build exposure gradually.':
      'No se ha confirmado aclimatación completa. Aumenta la exposición gradualmente.',
    'Hydration is low or uncertain.': 'La hidratación es baja o incierta.',
    'Water is not available.': 'No hay agua disponible.',
    'Very little air movement; sample schedule assumptions may not hold.':
      'Hay poco movimiento de aire; los supuestos del horario pueden no cumplirse.',
    'AirNow AQI is unhealthy for sensitive groups, with a respiratory condition reported.':
      'El ICA de AirNow es insalubre para grupos sensibles y declaraste una condición respiratoria.',
    'The displayed range and tier caps are conservative HeatGuard planning policy, not validated personal tolerance.':
      'El intervalo y los límites son una política conservadora de HeatGuard, no tolerancia personal validada.',
    'Resting uses a cautious planning proxy; NIOSH work schedules were developed for workers.':
      'El reposo usa una aproximación conservadora; los horarios NIOSH se crearon para trabajadores.',
  };
  return translatePersonalReason(v) ?? phrases[v] ?? 'Un factor requiere mayor precaución.';
}
export function WardrobeSheet({ s }: { s: HeatGuardState }) {
  const { t, lang } = useLocale();
  const [activity, setActivity] = useState<Activity>('yard-work'),
    [checked, setChecked] = useState<string[]>([]),
    [outfits, setOutfits] = useState<{ name: string; activity: Activity; items: string[] }[]>([]),
    [outfitName, setOutfitName] = useState(''),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    void readLocal<typeof outfits>('outfits', []).then(setOutfits);
  }, []);
  const gear = s.weather && s.risk ? recommendGear(s.weather, s.risk, activity) : [];
  async function save() {
    if (!outfitName.trim())
      throw new Error(t('Give your outfit a name.', 'Dale un nombre al conjunto.'));
    const next = [
      ...outfits.filter((o) => o.name !== outfitName),
      { name: outfitName.trim(), activity, items: checked },
    ].slice(-5);
    await writeLocal('outfits', next);
    setOutfits(next);
    setSaved(true);
  }
  const run = (f: () => Promise<unknown>) => void f().catch((e) => s.setError(String(e)));
  return (
    <View style={{ gap: 18 }}>
      <Copy kind="label">{t('YOUR HEAT KIT', 'TU EQUIPO PARA EL CALOR')}</Copy>
      <Copy kind="title">
        {t('A little preparation goes far.', 'Prepararte hace la diferencia.')}
      </Copy>
      <Copy>{t('What are you heading out to do?', '¿Qué actividad vas a hacer?')}</Copy>
      <View style={styles.wrap}>
        {[
          ['yard-work', 'Yard work', 'Jardinería'],
          ['running', 'Running', 'Correr'],
          ['dog-walk', 'Walking the dog', 'Pasear al perro'],
          ['construction', 'Construction', 'Construcción'],
          ['commuting', 'Commuting', 'Traslado'],
        ].map(([v, en, es]) => (
          <Chip
            key={v}
            label={t(en!, es!)}
            selected={activity === v}
            onPress={() => {
              setActivity(v as Activity);
              setChecked([]);
              setSaved(false);
            }}
          />
        ))}
      </View>
      {!gear.length ? (
        <Card>
          <Copy>
            {t(
              'Check conditions first for recommendations tied to today’s humidity, UV and heat index.',
              'Revisa las condiciones para recibir recomendaciones según humedad, UV e índice de calor.',
            )}
          </Copy>
          <Button label={t('Check now', 'Revisar ahora')} onPress={() => void s.refresh()} />
        </Card>
      ) : (
        <>
          <Card style={{ backgroundColor: C.peach, borderColor: C.peachEdge }}>
            <View style={styles.row}>
              <Icon name="shirt" size={58} color={C.orange} />
              <View style={{ flex: 1, gap: 6 }}>
                <Copy kind="h2">
                  {t('Light layers. Shade ready.', 'Ropa ligera. Listo para la sombra.')}
                </Copy>
                <Copy style={{ fontSize: 13 }}>
                  {t(
                    'Start with breathable clothing, then choose the essentials below.',
                    'Empieza con ropa transpirable y elige estos elementos.',
                  )}
                </Copy>
              </View>
            </View>
          </Card>
          {gear.map((g) => (
            <Card key={g.id}>
              <Chip
                label={(checked.includes(g.id) ? '✓ ' : '') + (lang === 'es' ? g.es : g.en)}
                selected={checked.includes(g.id)}
                onPress={() =>
                  setChecked((c) => (c.includes(g.id) ? c.filter((x) => x !== g.id) : [...c, g.id]))
                }
              />
              <Copy style={{ fontSize: 13 }}>{lang === 'es' ? g.whyEs : g.why}</Copy>
            </Card>
          ))}
          <Field
            label={t('SAVE A GO-TO OUTFIT · NAME', 'GUARDAR CONJUNTO · NOMBRE')}
            value={outfitName}
            onChangeText={setOutfitName}
          />
          <Button
            icon="check"
            label={
              saved
                ? t('Outfit saved', 'Conjunto guardado')
                : t('Save this outfit', 'Guardar este conjunto')
            }
            onPress={() => run(save)}
          />
        </>
      )}
      {outfits.length ? (
        <Card>
          <Copy kind="h2">{t('Your go-to outfits', 'Tus conjuntos guardados')}</Copy>
          {outfits.map((o) => (
            <View key={o.name} style={{ gap: 8 }}>
              <Copy color={C.ink}>{o.name}</Copy>
              <Copy style={{ fontSize: 12 }}>
                {o.activity} · {o.items.length} {t('items', 'elementos')}
              </Copy>
              <Button
                variant="secondary"
                label={t('Use this outfit', 'Usar este conjunto')}
                onPress={() => {
                  setActivity(o.activity);
                  setChecked(o.items);
                  setOutfitName(o.name);
                }}
              />
            </View>
          ))}
        </Card>
      ) : null}
      <Copy style={{ fontSize: 12 }}>
        {t(
          'For moderate activity under two hours, NIOSH suggests about 8 oz of water every 15–20 minutes, generally no more than 6 cups per hour. Individual fluid restrictions take priority. No outfit makes hazardous heat safe.',
          'Para actividad moderada de menos de dos horas, NIOSH sugiere 240 ml cada 15–20 minutos, generalmente no más de 6 tazas por hora. Las restricciones médicas tienen prioridad. Ningún conjunto elimina el riesgo.',
        )}
      </Copy>
    </View>
  );
}
