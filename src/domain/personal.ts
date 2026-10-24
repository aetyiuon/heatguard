import { PersonalCheckIn, Profile } from './types';

// Freshness intervals are conservative app policy, not physiological recovery limits.
export const CHECK_IN_MS = 30 * 60_000;
export const VITAL_MS = 5 * 60_000;
export const PERSONAL_COPY = {
  emergency: [
    'Confusion, fainting, seizures or severe breathing difficulty: call emergency services now and begin cooling. Do not wait for a reading or timer.',
    'Confusión, desmayo, convulsiones o dificultad grave para respirar: llama a emergencias y empieza a enfriarte. No esperes una lectura ni el temporizador.',
  ],
  unwell: [
    'You reported feeling unwell. Stop activity, move to a cool place and seek medical help for possible heat illness. Do not use a timer to decide recovery.',
    'Indicaste malestar. Detén la actividad, ve a un lugar fresco y busca atención médica por posible enfermedad por calor. Un temporizador no determina la recuperación.',
  ],
  temperature: [
    'Your thermometer reading was 100.4°F / 38°C or higher. Pause outdoor activity, cool down and seek medical advice. This is a caution rule, not a diagnosis or core-temperature estimate.',
    'Tu termómetro indicó 100.4°F / 38°C o más. Pausa la actividad, enfríate y busca consejo médico. Es una regla de precaución, no un diagnóstico ni una estimación de temperatura central.',
  ],
  pulse: [
    'Your adult pulse was above 100 bpm after quiet rest. Pause, cool down and recheck; seek medical advice if it persists or is unusual for you. Symptoms take priority.',
    'Tu pulso de adulto superó 100 lpm tras reposo tranquilo. Pausa, enfríate y vuelve a medir; consulta si persiste o es inusual para ti. Los síntomas tienen prioridad.',
  ],
  update: [
    'Your personal check-in is old or invalid. Update how you feel and your preparation before continuing the countdown.',
    'Tu revisión personal es antigua o no válida. Actualiza cómo te sientes y tu preparación antes de continuar la cuenta.',
  ],
  hydration: [
    'You reported needing water before activity. Prepare in a cool place first; follow any clinician-directed fluid restrictions.',
    'Indicaste necesitar agua antes de la actividad. Prepárate primero en un lugar fresco y respeta las restricciones médicas de líquidos.',
  ],
  clothing: [
    'Heavy or protective clothing traps heat. The sample schedule does not cover this clothing; use a specific heat plan before exertion in heat.',
    'La ropa pesada o protectora retiene calor. El horario de ejemplo no cubre esta ropa; usa un plan específico antes de esforzarte con calor.',
  ],
  normal: [
    'A check-in or normal reading cannot establish safe exposure time. No extra minutes are awarded for pulse, temperature, fitness or body size.',
    'Una revisión o lectura normal no determina tiempo seguro al aire libre. El pulso, temperatura, forma física o tamaño corporal no conceden minutos extra.',
  ],
  wrist: [
    'Wrist/skin temperature is recorded for context only. It is not a core body temperature and is not used to change the timer.',
    'La temperatura de muñeca/piel se registra solo como contexto. No es temperatura corporal central ni cambia el temporizador.',
  ],
  oldVitals: [
    'Optional readings are over 5 minutes old and are not current monitoring. An earlier caution remains until you reassess; time passing does not prove recovery.',
    'Las lecturas opcionales tienen más de 5 minutos y no son monitoreo actual. Una precaución previa sigue hasta reevaluar; el tiempo no demuestra recuperación.',
  ],
  activePulse: [
    'Exercise pulse is shown for context only. A single pulse cannot measure metabolic rate or determine heat tolerance.',
    'El pulso durante actividad se muestra solo como contexto. Un pulso aislado no mide el metabolismo ni determina tolerancia al calor.',
  ],
} as const;
export type PersonalMessage = keyof typeof PERSONAL_COPY;
export function personalText(key: PersonalMessage, spanish = false): string {
  return PERSONAL_COPY[key][spanish ? 1 : 0];
}
export function translatePersonalReason(text: string): string | undefined {
  return Object.values(PERSONAL_COPY).find((copy) => copy[0] === text)?.[1];
}
function within(at: number, now: number, max: number) {
  return Number.isFinite(at) && Number.isFinite(now) && at <= now && now - at <= max;
}
/** Validate at ingestion and again on restore. Never clamp a bad reading into a plausible one. */
export function validCheckIn(c: PersonalCheckIn, now: number): boolean {
  if (!within(c.at, now, 7 * 86400_000)) return false;
  if (
    !['unknown', 'well', 'unwell', 'emergency'].includes(c.feeling) ||
    !['adequate', 'unsure', 'low'].includes(c.hydration) ||
    !['ordinary', 'heavy', 'unknown'].includes(c.clothing)
  )
    return false;
  if (
    c.heartRate &&
    (!Number.isFinite(c.heartRate.bpm) ||
      c.heartRate.bpm < 20 ||
      c.heartRate.bpm > 300 ||
      !within(c.heartRate.at, c.at, VITAL_MS) ||
      !['rested', 'active'].includes(c.heartRate.context))
  )
    return false;
  if (
    c.temperature &&
    (!Number.isFinite(c.temperature.c) ||
      c.temperature.c < 30 ||
      c.temperature.c > 45 ||
      !within(c.temperature.at, c.at, VITAL_MS) ||
      !['oral', 'ear', 'forehead', 'wrist'].includes(c.temperature.method))
  )
    return false;
  return true;
}
export function assessPersonal(
  c: PersonalCheckIn | null,
  p: Profile,
  now: number,
  heatExposure = false,
) {
  const messages: PersonalMessage[] = [];
  let stop: PersonalMessage | undefined;
  if (!c) return { status: 'missing' as const, messages, stop, hydration: p.hydration };
  // Symptom reports retain priority even if other fields are corrupt or the snapshot is old.
  if (c.feeling === 'emergency') stop = 'emergency';
  else if (c.feeling === 'unwell') stop = 'unwell';
  const valid = validCheckIn(c, now);
  const fresh = valid && within(c.at, now, CHECK_IN_MS);
  if (valid) {
    // These are conservative pause gates, never heat-injury predictions. A high reading
    // stays a caution after its monitoring window; aging it out must not start a timer.
    if (!stop && c.temperature && c.temperature.method !== 'wrist' && c.temperature.c >= 38)
      stop = 'temperature';
    if (
      !stop &&
      p.age !== undefined &&
      p.age >= 18 &&
      c.heartRate?.context === 'rested' &&
      c.heartRate.bpm > 100
    )
      stop = 'pulse';
    if (c.temperature?.method === 'wrist') messages.push('wrist');
    if (c.heartRate?.context === 'active') messages.push('activePulse');
    if (
      (c.temperature && !within(c.temperature.at, now, VITAL_MS)) ||
      (c.heartRate && !within(c.heartRate.at, now, VITAL_MS))
    )
      messages.push('oldVitals');
  }
  if (!stop && !fresh) stop = 'update';
  if (!stop && heatExposure && c.hydration === 'low') stop = 'hydration';
  if (!stop && heatExposure && c.clothing === 'heavy') stop = 'clothing';
  if (stop) messages.unshift(stop);
  messages.push('normal');
  return {
    status: fresh ? ('current' as const) : ('outdated' as const),
    messages,
    stop,
    hydration: fresh ? c.hydration : ('unsure' as const),
  };
}
