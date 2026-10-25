import React, { useEffect, useRef, useState } from 'react';
import { Linking, View } from 'react-native';
import {
  AI_CITIES,
  AI_CITY_NAMES,
  AiAction,
  AiCity,
  AiOutlookResult,
  parseAiResult,
} from '../domain/ai';
import { AiPersonalInput, projectAiPersonal, parseAiPersonal } from '../domain/aiPersonal';
import { API_BASE } from '../services/api';
import { Button, Card, Chip, Copy, Toggle, useLocale } from './components';
import { C, styles } from './theme';

const ACTION_COPY: Record<AiAction, [string, string]> = {
  'check-forecast': [
    'Check the hourly forecast before leaving and as conditions change.',
    'Revisa el pronóstico por hora antes de salir y cuando cambien las condiciones.',
  ],
  'review-relief': [
    'Use Relief Map to compare published water, shade and indoor cooling candidates.',
    'Usa Mapa de alivio para comparar posibles lugares con agua, sombra y aire acondicionado.',
  ],
  'verify-access': [
    'Verify opening hours, public access and working water before relying on a stop.',
    'Confirma horarios, acceso público y agua disponible antes de depender de una parada.',
  ],
  'bring-water': [
    'Bring drinking water; mapped fountains may be unavailable.',
    'Lleva agua potable; las fuentes del mapa pueden no estar disponibles.',
  ],
  'choose-shade': [
    'Look for shaded sections; mapped parks do not establish actual shade.',
    'Busca tramos con sombra; un parque en el mapa no garantiza sombra real.',
  ],
};
const ERRORS: Record<string, [string, string]> = {
  'personal-stop': [
    'Your current inputs require a pause. Review your local plan and update your check-in before requesting AI.',
    'Tus datos requieren una pausa. Revisa tu plan local y actualiza tu revisión antes de solicitar IA.',
  ],
  'not-configured': [
    'AI is not enabled yet. The app owner needs to configure its server key.',
    'La IA aún no está habilitada. Falta configurar la clave en el servidor.',
  ],
  region: [
    'AI outlook is currently available in the United States only.',
    'El resumen de IA solo está disponible en Estados Unidos.',
  ],
  quota: [
    'AI has no available quota right now. Weather, local checks and maps still work.',
    'La IA no tiene cuota disponible ahora. El tiempo, las revisiones locales y los mapas siguen funcionando.',
  ],
  'access-denied': [
    'AI provider access is unavailable. Weather, local checks and maps still work.',
    'El acceso al proveedor de IA no está disponible. El tiempo, las revisiones locales y los mapas siguen funcionando.',
  ],
  'rate-limit': [
    'Please wait before requesting another outlook.',
    'Espera antes de solicitar otro resumen.',
  ],
  'weather-unavailable': [
    'Fresh city weather is unavailable. Try again after conditions update.',
    'No hay datos recientes de la ciudad. Inténtalo después de actualizar.',
  ],
};
export function AiOutlook({
  blocked,
  age,
  now,
  onMap,
  onForecast,
  personalInput,
  onProfile,
  onCheckIn,
}: {
  blocked: boolean;
  age?: number;
  now: number;
  onMap: () => void;
  onForecast: () => void;
  personalInput: AiPersonalInput;
  onProfile: () => void;
  onCheckIn: () => void;
}) {
  const { t, lang } = useLocale();
  const [city, setCity] = useState<AiCity>('arlington');
  const [includePersonal, setIncludePersonal] = useState(false);
  const personal = projectAiPersonal(
    personalInput.profile,
    personalInput.checkIn,
    personalInput.workload,
  );
  const signature = includePersonal ? JSON.stringify(personal) : '';
  const validPersonal = !!parseAiPersonal(personal, now);
  const [consent, setConsent] = useState(false);
  const [consentSignature, setConsentSignature] = useState('');
  const requestSignature = `${city}:${lang}:${includePersonal}:${signature}`;
  const approvedConsent = consent && consentSignature === requestSignature;
  const [resultSignature, setResultSignature] = useState('');
  const [result, setResult] = useState<AiOutlookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const unavailable =
    blocked || (age !== undefined && age < 18) || (includePersonal && !validPersonal);
  useEffect(() => {
    setConsent(false);
  }, [includePersonal, signature, city, lang]);
  useEffect(() => {
    revision.current++;
    controller.current?.abort();
    controller.current = null;
    setResult(null);
    setError(null);
    setLoading(false);
    return () => {
      revision.current++;
      controller.current?.abort();
    };
  }, [city, lang, consent, unavailable, includePersonal, signature]);
  async function generate() {
    if (unavailable || !approvedConsent || controller.current) return;
    const current = ++revision.current;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 45_000);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch(`${API_BASE}/ai/outlook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // No state spreads. Personal data leaves the device only after preview and separate consent.
        body: JSON.stringify({
          city,
          language: lang,
          adult: true,
          consent: true,
          ...(includePersonal ? { personalConsent: true, personal } : {}),
        }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (revision.current !== current) return;
      if (!response.ok) {
        setError(data.code in ERRORS ? data.code : 'unavailable');
        return;
      }
      if (
        !parseAiResult(data, Date.now()) ||
        data.city !== city ||
        data.language !== lang ||
        data.scope !== (includePersonal ? 'personal' : 'city')
      )
        throw new Error('Invalid outlook');
      setResultSignature(requestSignature);
      setResult(data);
    } catch {
      if (revision.current === current) setError('unavailable');
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) controller.current = null;
      if (revision.current === current) setLoading(false);
    }
  }
  const active =
    result &&
    result.city === city &&
    result.language === lang &&
    Date.parse(result.expiresAt) > Math.max(now, Date.now()) &&
    approvedConsent &&
    resultSignature === requestSignature &&
    !unavailable
      ? result
      : null;
  return (
    <Card>
      <Copy kind="label">
        {includePersonal
          ? t('AI / MY PLANNING CONTEXT', 'IA / MI CONTEXTO PERSONAL')
          : t('AI / CITY OUTLOOK', 'IA / RESUMEN DE LA CIUDAD')}
      </Copy>
      <Copy kind="h2">
        {t('A little context before you go.', 'Un poco de contexto antes de salir.')}
      </Copy>
      <Copy>
        {t(
          'Get a Groq AI explanation of city weather and planning factors. Optionally include the personal inputs you review below. This uses the selected city center, not your actual heat-check location. AI cannot calculate or extend your outdoor minutes.',
          'Obtén una explicación del tiempo público y una lista para planear con IA de Groq. Usa el centro de la ciudad, no tu ubicación exacta ni tu estimación personal.',
        )}
      </Copy>
      <View style={styles.wrap}>
        {AI_CITIES.map((value) => (
          <Chip
            key={value}
            label={AI_CITY_NAMES[value]}
            selected={city === value}
            onPress={() => setCity(value)}
          />
        ))}
      </View>
      <Toggle
        label={t('Include my personal inputs', 'Incluir mis datos personales')}
        value={includePersonal}
        onChange={setIncludePersonal}
      />
      {includePersonal ? (
        <View style={{ gap: 12 }}>
          <Copy kind="h2">{t('Review what will be sent', 'Revisa lo que se enviará')}</Copy>
          <Copy>
            {t(
              'Your saved profile and latest check-in are shown below. Edit them before sharing. Missing measurements stay missing. This is optional wellness planning, not medical care; do not enter clinical records or anyone else’s information.',
              'Tu perfil guardado y última revisión aparecen abajo. Edítalos antes de compartir. Las lecturas faltantes siguen ausentes. Es planificación de bienestar opcional, no atención médica; no ingreses expedientes clínicos ni información de otras personas.',
            )}
          </Copy>
          <PersonalInputReview input={personal} />
          {!validPersonal ? (
            <Copy color={C.orange}>
              {t(
                'Update stale check-ins or invalid profile values before sharing.',
                'Actualiza las revisiones antiguas o los valores de perfil no válidos antes de compartir.',
              )}
            </Copy>
          ) : null}
          <View style={styles.wrap}>
            <Button
              variant="quiet"
              label={t('Edit my inputs', 'Editar mis datos')}
              onPress={onProfile}
            />
            <Button
              variant="quiet"
              label={t('Update my check-in', 'Actualizar mi revisión')}
              onPress={onCheckIn}
            />
          </View>
          <Copy>
            {t(
              'Sending these entries shares sensitive personal information with HeatGuard’s server and Groq. No names, contacts, GPS, routes, device history or account identifiers are included. Personal requests and answers are not cached, saved to Supabase or logged by this app. Groq may retain request content for up to 30 days for reliability or abuse monitoring, subject to its data controls.',
              'Enviar estos datos comparte información personal sensible con el servidor de HeatGuard y Groq. No incluye nombres, contactos, GPS, rutas, historial del reloj ni identificadores de cuenta. La aplicación no guarda, registra ni almacena en caché estas solicitudes o respuestas personales. Groq puede conservar contenido hasta 30 días para fiabilidad o abuso, según sus controles.',
            )}
          </Copy>
        </View>
      ) : null}
      <Copy>
        {t(
          includePersonal
            ? 'The chosen city, language, public weather and exactly the reviewed personal inputs will go to Groq for this request. Nothing is shared until you consent and press Generate.'
            : 'City-only mode sends public weather, city and language to Groq. It excludes health entries, biometrics and routes. Groq may temporarily retain content for troubleshooting or abuse review.',
          'Solo se envían a Groq la ciudad, el idioma y el tiempo público. No se envían datos de salud, biometría ni rutas. Groq puede guardar temporalmente las solicitudes para resolver problemas o investigar abusos, según sus controles de datos.',
        )}
      </Copy>
      <Button
        variant="quiet"
        label={t('Groq data policy', 'Política de datos de Groq')}
        onPress={() => void Linking.openURL('https://console.groq.com/docs/your-data')}
      />
      <Toggle
        label={t(
          includePersonal
            ? 'I agree to send the reviewed personal inputs to Groq for this request (18+)'
            : 'I agree to this optional Groq AI request (18+)',
          includePersonal
            ? 'Acepto enviar los datos personales revisados a Groq para esta solicitud (18+)'
            : 'Acepto esta solicitud opcional a la IA de Groq (18+)',
        )}
        value={approvedConsent}
        onChange={(next) => {
          setConsent(next);
          setConsentSignature(next ? requestSignature : '');
        }}
      />
      {unavailable ? (
        <Copy color={C.orange}>
          {t(
            'AI outlook is paused. Review the current weather and any stop warnings first. This feature is for adults 18+.',
            'El resumen de IA está en pausa. Revisa el tiempo actual y los avisos para detenerte. Esta función es para adultos mayores de 18 años.',
          )}
        </Copy>
      ) : null}
      <Button
        icon="sun"
        label={
          loading
            ? t('Generating outlook…', 'Generando resumen…')
            : includePersonal
              ? t('Explain my planning factors', 'Explicar mis factores personales')
              : t('Generate city outlook', 'Generar resumen de la ciudad')
        }
        disabled={!approvedConsent || unavailable || loading}
        onPress={() => void generate()}
      />
      <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
        {error ? (
          <Copy color={C.orange}>
            {t(
              ...(ERRORS[error] ?? [
                'AI could not return a usable outlook. Weather, local checks and journey tools still work.',
                'La IA no pudo generar un resumen válido. El tiempo, las revisiones locales y los recorridos siguen funcionando.',
              ]),
            )}
          </Copy>
        ) : null}
        {active ? (
          <>
            <Copy kind="label">
              {t(
                'AI GENERATED · CHECK AGAINST SOURCE DATA',
                'GENERADO POR IA · COMPARA CON LAS FUENTES',
              )}
            </Copy>
            <Copy>{active.summary}</Copy>
            <Copy>
              {t(
                `${AI_CITY_NAMES[city]} center · ${Math.round((active.temperatureC * 9) / 5 + 32)}°F · humidity ${Math.round(active.humidity)}%`,
                `Centro de ${AI_CITY_NAMES[city]} · ${Math.round(active.temperatureC)}°C · humedad ${Math.round(active.humidity)}%`,
              )}
            </Copy>
            <Copy>
              {t('Weather reading: ', 'Lectura del tiempo: ')}
              {new Date(active.weatherTime).toLocaleString(lang === 'es' ? 'es-US' : 'en-US')}
            </Copy>
            <Copy>
              {t('Sources: ', 'Fuentes: ')}
              {active.sources.join(' · ')}
            </Copy>
            {active.actions.map((action) => (
              <Copy key={action}>• {t(...ACTION_COPY[action])}</Copy>
            ))}
            <View style={styles.wrap}>
              <Button
                variant="secondary"
                label={t('Open Relief Map', 'Abrir mapa de alivio')}
                onPress={onMap}
              />
              <Button
                variant="quiet"
                label={t('Review forecast', 'Revisar pronóstico')}
                onPress={onForecast}
              />
            </View>
            <Copy>
              {t(
                `Generated ${new Date(active.generatedAt).toLocaleTimeString()} · ${active.provider} · ${active.model}`,
                `Generado ${new Date(active.generatedAt).toLocaleTimeString()} · ${active.provider} · ${active.model}`,
              )}
            </Copy>
          </>
        ) : result && !unavailable && approvedConsent ? (
          <Copy>
            {t(
              'This outlook expired. Generate a fresh one to use current city weather.',
              'Este resumen venció. Genera otro con datos recientes de la ciudad.',
            )}
          </Copy>
        ) : null}
      </View>
      <Copy color={C.muted}>
        {t(
          'AI can be wrong. It does not calculate outdoor minutes, diagnose illness or override your local stop warnings. City weather can differ from conditions along your journey.',
          'La IA puede equivocarse. No calcula minutos al aire libre, no diagnostica ni anula avisos locales. El tiempo de la ciudad puede diferir del tiempo a lo largo de tu recorrido.',
        )}
      </Copy>
    </Card>
  );
}

function PersonalInputReview({ input }: { input: AiPersonalInput }) {
  const { t, lang } = useLocale();
  const p = input.profile,
    c = input.checkIn;
  const missing = t('Not provided', 'Sin datos');
  const labels: Record<string, [string, string]> = {
    female: ['Female', 'Femenino'],
    male: ['Male', 'Masculino'],
    intersex: ['Intersex', 'Intersexual'],
    unknown: ['Unknown', 'Desconocido'],
    sedentary: ['Sedentary', 'Sedentario'],
    'lightly-active': ['Lightly active', 'Algo activo'],
    'very-active': ['Very active', 'Muy activo'],
    acclimatized: ['Heat acclimatized', 'Aclimatado al calor'],
    adequate: ['Feeling hydrated', 'Bien hidratado'],
    unsure: ['Uncertain', 'Incierta'],
    low: ['Need water', 'Necesito agua'],
    resting: ['Resting', 'Reposo'],
    light: ['Light activity', 'Actividad ligera'],
    moderate: ['Moderate activity', 'Actividad moderada'],
    heavy: ['Heavy / protective', 'Pesada / protectora'],
    well: ['Feeling well', 'Me siento bien'],
    unwell: ['Feeling unwell', 'Me siento mal'],
    emergency: ['Emergency symptoms reported', 'Síntomas de emergencia'],
    ordinary: ['Ordinary clothing', 'Ropa normal'],
    cardiovascular: ['Cardiovascular condition', 'Enfermedad cardiovascular'],
    diabetes: ['Diabetes', 'Diabetes'],
    respiratory: ['Respiratory condition', 'Enfermedad respiratoria'],
    kidney: ['Kidney condition', 'Enfermedad renal'],
    'prior-heat-illness': ['Prior heat illness', 'Enfermedad previa por calor'],
    diuretics: ['Diuretics', 'Diuréticos'],
    'beta-blockers': ['Beta-blockers', 'Betabloqueantes'],
    antihistamines: ['Antihistamines', 'Antihistamínicos'],
    antipsychotics: ['Antipsychotics', 'Antipsicóticos'],
    stimulants: ['Stimulants', 'Estimulantes'],
    oral: ['Oral', 'Oral'],
    ear: ['Ear', 'Oído'],
    forehead: ['Forehead', 'Frente'],
    wrist: ['Wrist / skin', 'Muñeca / piel'],
    active: ['During activity', 'Durante actividad'],
    rested: ['After quiet rest', 'Tras reposo tranquilo'],
  };
  const label = (v: string) => (labels[v] ? t(...labels[v]) : missing);
  const yn = (v: boolean) => (v ? t('Yes', 'Sí') : t('Not confirmed', 'Sin confirmar'));
  const date = (at: number) => new Date(at).toLocaleString(lang === 'es' ? 'es-US' : 'en-US');
  const rows: [string, string][] = [
    [t('Age', 'Edad'), p.age === undefined ? missing : String(p.age)],
    [
      t('Height / weight', 'Altura / peso'),
      `${p.heightCm === undefined ? missing : p.heightCm + ' cm'} / ${p.weightKg === undefined ? missing : p.weightKg + ' kg'}`,
    ],
    [t('Sex (optional context)', 'Sexo (contexto opcional)'), p.sex ? label(p.sex) : missing],
    [
      t('Activity / workload', 'Actividad / carga de trabajo'),
      input.workload === 'heavy' ? t('Heavy exertion', 'Esfuerzo intenso') : label(input.workload),
    ],
    [t('Fitness / acclimatization', 'Actividad / aclimatación'), label(p.fitness)],
    [
      t('Prior hydration / current hydration', 'Hidratación previa / actual'),
      `${label(p.hydration)} / ${c ? label(c.hydration) : missing}`,
    ],
    [
      t('Conditions selected', 'Condiciones seleccionadas'),
      p.conditions.length
        ? p.conditions.map(label).join(', ')
        : t('None selected / not supplied', 'Ninguna seleccionada / sin datos'),
    ],
    [
      t('Medication categories selected', 'Categorías de medicamentos'),
      p.medications.length
        ? p.medications.map(label).join(', ')
        : t('None selected / not supplied', 'Ninguna seleccionada / sin datos'),
    ],
    [t('Shade / drinking water', 'Sombra / agua potable'), `${yn(p.shade)} / ${yn(p.water)}`],
    [
      t('Feeling / clothing', 'Estado / ropa'),
      c ? `${label(c.feeling)} / ${label(c.clothing)}` : missing,
    ],
    [t('Check-in time', 'Fecha de revisión'), c ? date(c.at) : missing],
    [
      t('Pulse / context / reading time', 'Pulso / contexto / fecha'),
      c?.heartRate
        ? `${c.heartRate.bpm} bpm · ${label(c.heartRate.context)} · ${date(c.heartRate.at)}`
        : missing,
    ],
    [
      t('Temperature / method / reading time', 'Temperatura / método / fecha'),
      c?.temperature
        ? `${c.temperature.c}°C · ${label(c.temperature.method)} · ${date(c.temperature.at)}`
        : missing,
    ],
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map(([name, value]) => (
        <Copy key={name}>
          {name}: {value}
        </Copy>
      ))}
      <Copy>
        {t(
          'Metabolism is not measured. Activity is a workload proxy; body size, pulse and skin temperature cannot establish personal heat tolerance.',
          'No se mide el metabolismo. La actividad representa carga de trabajo; tamaño corporal, pulso y temperatura cutánea no determinan tolerancia personal al calor.',
        )}
      </Copy>
    </View>
  );
}
