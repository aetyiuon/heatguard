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
  'not-configured': [
    'Gemini is not enabled yet. The app owner needs to configure its server key.',
    'Gemini aún no está habilitado. Falta configurar la clave en el servidor.',
  ],
  region: [
    'Gemini outlook is currently available in the United States only.',
    'El resumen de Gemini solo está disponible en Estados Unidos.',
  ],
  quota: [
    'Gemini capacity is temporarily used up. Try again later.',
    'La capacidad de Gemini está agotada temporalmente. Inténtalo más tarde.',
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
}: {
  blocked: boolean;
  age?: number;
  now: number;
  onMap: () => void;
  onForecast: () => void;
}) {
  const { t, lang } = useLocale();
  const [city, setCity] = useState<AiCity>('arlington');
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<AiOutlookResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const revision = useRef(0);
  const unavailable = blocked || (age !== undefined && age < 18);
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
  }, [city, lang, consent, unavailable]);
  async function generate() {
    if (unavailable || !consent || controller.current) return;
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
        // Explicit projection: never spread app state, health checks or route objects.
        body: JSON.stringify({ city, language: lang, adult: true, consent: true }),
        signal: abort.signal,
      });
      const data = await response.json();
      if (revision.current !== current) return;
      if (!response.ok) {
        setError(data.code in ERRORS ? data.code : 'unavailable');
        return;
      }
      if (!parseAiResult(data, Date.now()) || data.city !== city || data.language !== lang)
        throw new Error('Invalid outlook');
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
    consent &&
    !unavailable
      ? result
      : null;
  return (
    <Card>
      <Copy kind="label">{t('GEMINI / CITY OUTLOOK', 'GEMINI / RESUMEN DE LA CIUDAD')}</Copy>
      <Copy kind="h2">
        {t('A little context before you go.', 'Un poco de contexto antes de salir.')}
      </Copy>
      <Copy>
        {t(
          'Ask Gemini to explain public city weather and prioritize a planning checklist. This uses city-center conditions, not your exact location or personal heat estimate.',
          'Pide a Gemini que explique el tiempo público y priorice una lista para planear. Usa el centro de la ciudad, no tu ubicación exacta ni tu estimación personal.',
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
      <Copy>
        {t(
          'Only the chosen city, language and public weather go to Google. Your health entries, biometrics and routes stay out of AI requests. Google may use free-tier prompts and responses to improve its products, including human review.',
          'Solo se envían a Google la ciudad, el idioma y el tiempo público. No se envían datos de salud, biometría ni rutas. Google puede usar solicitudes y respuestas gratuitas para mejorar sus productos, con revisión humana.',
        )}
      </Copy>
      <Button
        variant="quiet"
        label={t('Google AI data terms', 'Condiciones de datos de Google AI')}
        onPress={() => void Linking.openURL('https://ai.google.dev/gemini-api/terms')}
      />
      <Toggle
        label={t(
          'I agree to this optional Google AI request (18+)',
          'Acepto esta solicitud opcional a Google AI (18+)',
        )}
        value={consent}
        onChange={setConsent}
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
            ? t('Asking Gemini…', 'Consultando Gemini…')
            : t('Generate city outlook', 'Generar resumen de la ciudad')
        }
        disabled={!consent || unavailable || loading}
        onPress={() => void generate()}
      />
      <View accessibilityLiveRegion="polite" style={{ gap: 12 }}>
        {error ? (
          <Copy color={C.orange}>
            {t(
              ...(ERRORS[error] ?? [
                'Gemini could not return a usable outlook. Weather, local checks and journey tools still work.',
                'Gemini no pudo generar un resumen válido. El tiempo, las revisiones locales y los recorridos siguen funcionando.',
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
                `Generated ${new Date(active.generatedAt).toLocaleTimeString()} · ${active.model}`,
                `Generado ${new Date(active.generatedAt).toLocaleTimeString()} · ${active.model}`,
              )}
            </Copy>
          </>
        ) : result && !unavailable && consent ? (
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
