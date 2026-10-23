import { RiskEstimate, WeatherBundle } from './types';
export type Activity = 'yard-work' | 'running' | 'dog-walk' | 'construction' | 'commuting';
export interface Gear {
  id: string;
  en: string;
  es: string;
  why: string;
  whyEs: string;
}
export function recommendGear(b: WeatherBundle, r: RiskEstimate, a: Activity): Gear[] {
  const gear: Gear[] = [
    {
      id: 'fabric',
      en: 'Loose, light-colored breathable clothing',
      es: 'Ropa holgada, clara y transpirable',
      why: 'Allows air circulation and limits absorbed sunlight.',
      whyEs: 'Permite circular el aire y reduce el calor del sol.',
    },
    {
      id: 'water',
      en: 'Water bottle + a refill plan',
      es: 'Botella de agua y plan de recarga',
      why: 'For moderate work under 2 hours: about 1 cup every 15–20 minutes. Follow any clinician fluid restrictions.',
      whyEs:
        'Para trabajo moderado de menos de 2 horas: cerca de una taza cada 15–20 minutos. Respeta las restricciones médicas.',
    },
  ];
  if ((b.current.uv ?? 0) >= 3)
    gear.push({
      id: 'sun',
      en: 'UPF shirt, wide-brim hat, sunglasses + sunscreen',
      es: 'Camisa UPF, sombrero, gafas y protector solar',
      why: `UV ${b.current.uv}: protect exposed skin even when it feels cool.`,
      whyEs: `UV ${b.current.uv}: protege la piel aunque esté fresco.`,
    });
  if (r.heatIndexF >= 80)
    gear.push({
      id: 'cooling',
      en: 'Cooling towel or neck wrap',
      es: 'Toalla refrescante o paño para el cuello',
      why: 'Use with shade and cooling breaks; gear does not make dangerous heat safe.',
      whyEs: 'Úsalo con sombra y descansos; no elimina el riesgo del calor.',
    });
  if (b.current.humidity >= 60 || a === 'running')
    gear.push({
      id: 'wicking',
      en: 'Lightweight moisture-wicking layer',
      es: 'Prenda ligera que absorba la humedad',
      why: 'Humidity slows sweat evaporation. Avoid heavy layers.',
      whyEs: 'La humedad dificulta evaporar el sudor. Evita prendas pesadas.',
    });
  if (a === 'construction')
    gear.push({
      id: 'ppe',
      en: 'Keep required PPE; ask for a site-specific heat plan',
      es: 'Usa el EPP requerido y pide un plan para el calor',
      why: 'Protective equipment can increase heat load; this sample schedule assumes normal clothing.',
      whyEs: 'El EPP puede aumentar el calor; el horario de ejemplo supone ropa normal.',
    });
  gear.push({
    id: 'electrolytes',
    en: 'Electrolytes for several hours of sweating',
    es: 'Electrolitos si sudas durante varias horas',
    why: 'NIOSH recommends balanced electrolytes for prolonged sweating, not for every short outing.',
    whyEs: 'NIOSH recomienda electrolitos para sudor prolongado, no para cada salida corta.',
  });
  return gear;
}
