import {
  AI_ACTIONS,
  AI_CITY_NAMES,
  AiCity,
  AiOutlookResult,
  parseAiRequest,
  parseAiText,
} from '../src/domain/ai';
import { Place, WeatherBundle } from '../src/domain/types';
import { weatherFreshness, currentWeatherSource } from '../src/domain/weather';
import { getWeather, WeatherEnv } from './weather';

export interface AiEnv extends WeatherEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}
const CENTERS: Record<AiCity, Place> = {
  arlington: {
    name: 'Arlington city center',
    latitude: 32.7357,
    longitude: -97.1081,
    emergencyNumber: '911',
  },
  dallas: {
    name: 'Dallas city center',
    latitude: 32.7767,
    longitude: -96.797,
    emergencyNumber: '911',
  },
  'fort-worth': {
    name: 'Fort Worth city center',
    latitude: 32.7555,
    longitude: -97.3308,
    emergencyNumber: '911',
  },
};
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
      description:
        'Two short qualitative sentences about supplied city weather only. No numbers, durations, medical or safety conclusions.',
    },
    actions: {
      type: 'array',
      minItems: 2,
      maxItems: 4,
      items: { type: 'string', enum: [...AI_ACTIONS] },
    },
  },
  required: ['summary', 'actions'],
};
const INSTRUCTION = `You explain public city weather for HeatGuard, an adults-only US heat-awareness app.
Use only supplied public data. Write the summary in the requested language. Describe weather qualitatively, without numbers, durations, exposure limits, personal health advice, diagnosis, safety assurances or risk ratings. Never say it is safe to stay outside or to skip cooling. Do not invent amenities, availability, forecasts, route geometry or official alerts. Do not mention personal data: none is supplied. Choose two to four distinct action IDs from the schema, in a useful order for this weather. Actions are an app checklist, not medical advice. Return only the schema JSON. Do not use tools or external sources.`;
const TTL = 10 * 60_000;
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
class AiFailure extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}
/** Isolated factory enables privacy/timeout tests without calling Google or personal weather. */
export function createAiHandler(
  deps: {
    fetch?: typeof fetch;
    weather?: (place: Place, env: WeatherEnv) => Promise<WeatherBundle>;
    now?: () => number;
  } = {},
) {
  const now = deps.now ?? Date.now;
  const cached = new Map<string, AiOutlookResult>();
  const pending = new Map<string, Promise<AiOutlookResult>>();
  const attempts = new Map<string, { count: number; until: number }>();
  let day = '',
    used = 0;
  return async (request: Request, env: AiEnv): Promise<Response> => {
    if (request.method !== 'POST') return json({ code: 'method', error: 'Use POST.' }, 405);
    // No query strings, free text, private identifiers, profiles or GPS accepted.
    if (new URL(request.url).search)
      return json({ code: 'input', error: 'Unsupported AI input.' }, 400);
    if (!request.headers.get('Content-Type')?.startsWith('application/json'))
      return json({ code: 'input', error: 'Use JSON.' }, 415);
    const reader = request.body?.getReader();
    let raw = '',
      bytes = 0;
    try {
      if (!reader) return json({ code: 'input', error: 'Missing AI input.' }, 400);
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        bytes += part.value.byteLength;
        if (bytes > 256) {
          await reader.cancel();
          return json({ code: 'input', error: 'AI request too large.' }, 413);
        }
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } catch {
      return json({ code: 'input', error: 'Invalid AI input.' }, 400);
    }
    let input;
    try {
      input = parseAiRequest(JSON.parse(raw));
    } catch {
      /* normalized below */
    }
    if (!input)
      return json(
        {
          code: 'input',
          error:
            'Choose a supported city and language, and confirm adult consent. No other fields are accepted.',
        },
        400,
      );
    if (!env.GEMINI_API_KEY?.trim())
      return json(
        { code: 'not-configured', error: 'Gemini has not been enabled by the app owner.' },
        503,
      );
    const model = env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    // Keep the free-tier integration on its reviewed text model; no paid fallback.
    if (model !== 'gemini-3.5-flash-lite')
      return json(
        { code: 'configuration', error: 'AI model configuration needs owner review.' },
        503,
      );
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
    for (const [key, value] of attempts) if (value.until <= now()) attempts.delete(key);
    const rate = attempts.get(ip);
    if (rate && rate.count >= 5)
      return json({ code: 'rate-limit', error: 'AI request limit reached. Try again later.' }, 429);
    if (!rate && attempts.size >= 2000)
      return json({ code: 'busy', error: 'AI is busy. Try again later.' }, 429);
    attempts.set(ip, { count: (rate?.count ?? 0) + 1, until: rate?.until ?? now() + 60_000 });
    const key = `${input.city}:${input.language}`;
    const old = cached.get(key);
    if (old && Date.parse(old.expiresAt) > now()) return json(old);
    const city = input.city,
      language = input.language;
    try {
      let work = pending.get(key);
      if (!work) {
        const today = new Date(now()).toISOString().slice(0, 10);
        if (today !== day) {
          day = today;
          used = 0;
        }
        // Best-effort per-process bound only. Google account quotas remain authoritative.
        if (used >= 30)
          return json(
            {
              code: 'quota',
              error: 'AI capacity reached for now. Weather and local guidance still work.',
            },
            429,
          );
        used++;
        work = (async () => {
          const weather = await (deps.weather ?? getWeather)(CENTERS[city], env);
          if (
            weatherFreshness(weather, now()) !== 'current' ||
            !Number.isFinite(weather.current.temperatureC) ||
            weather.current.temperatureC < -90 ||
            weather.current.temperatureC > 65 ||
            !Number.isFinite(weather.current.humidity) ||
            weather.current.humidity < 0 ||
            weather.current.humidity > 100
          )
            throw new AiFailure('weather-unavailable', 503);
          const publicData = {
            city: AI_CITY_NAMES[city],
            language,
            weather: {
              readingTime: weather.current.time,
              temperatureC: weather.current.temperatureC,
              humidityPercent: weather.current.humidity,
              windMetersPerSecond: Number.isFinite(weather.current.windMs)
                ? weather.current.windMs
                : null,
              uv: weather.current.uv ?? null,
              condition: weather.current.condition ?? null,
              sourceType: currentWeatherSource(weather),
            },
            catalogCaveat:
              'Relief Map contains incomplete published candidate records. Facility hours, access, water flow and shade are unverified. No individual route is supplied.',
          };
          const response = await (deps.fetch ?? fetch)(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': env.GEMINI_API_KEY!,
              },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: INSTRUCTION }] },
                contents: [{ role: 'user', parts: [{ text: JSON.stringify(publicData) }] }],
                generationConfig: {
                  maxOutputTokens: 1200,
                  responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } },
                },
              }),
              signal: AbortSignal.timeout(20_000),
            },
          );
          if (!response.ok) {
            await response.body?.cancel();
            throw new AiFailure(
              response.status === 429
                ? 'quota'
                : response.status === 403 || response.status === 401
                  ? 'access-denied'
                  : 'provider-unavailable',
              response.status === 429 ? 429 : 503,
            );
          }
          const result = await response.json();
          const candidate = result.candidates?.[0];
          if (candidate?.finishReason !== 'STOP') throw new AiFailure('invalid-response', 502);
          const prose = candidate.content?.parts
            ?.filter(
              (p: { text?: string; thought?: boolean }) => typeof p.text === 'string' && !p.thought,
            )
            .map((p: { text: string }) => p.text)
            .join('');
          if (!prose || prose.length > 2000) throw new AiFailure('invalid-response', 502);
          let parsed;
          try {
            parsed = parseAiText(JSON.parse(prose));
          } catch {
            /* rejected below */
          }
          if (!parsed) throw new AiFailure('invalid-response', 502);
          if (weatherFreshness(weather, now()) !== 'current')
            throw new AiFailure('weather-unavailable', 503);
          const generatedAt = now();
          const value: AiOutlookResult = {
            ...parsed,
            city,
            language,
            model,
            generatedAt: new Date(generatedAt).toISOString(),
            expiresAt: new Date(
              Math.min(
                generatedAt + TTL,
                Date.parse(weather.current.time) + 60 * 60_000,
                Date.parse(weather.fetchedAt) + 60 * 60_000,
              ),
            ).toISOString(),
            weatherTime: weather.current.time,
            temperatureC: weather.current.temperatureC,
            humidity: weather.current.humidity,
            sources: weather.sources
              .filter((s) => typeof s === 'string' && s.length <= 300)
              .slice(0, 8),
          };
          cached.set(key, value);
          return value;
        })();
        pending.set(key, work);
        void work
          .finally(() => {
            if (pending.get(key) === work) pending.delete(key);
          })
          .catch(() => {});
      }
      return json(await work);
    } catch (error) {
      const code = error instanceof AiFailure ? error.code : 'unavailable';
      return json(
        {
          code,
          error:
            'AI outlook unavailable. Current weather, local checks and journey tools remain available.',
        },
        error instanceof AiFailure ? error.status : 503,
      );
    }
  };
}
export const aiOutlook = createAiHandler();
