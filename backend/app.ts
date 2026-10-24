import { getWeather, WeatherEnv } from './weather';
import { getRelief } from './relief';
import { bundledCity } from '../src/domain/cities';
import { Place, ReliefPin } from '../src/domain/types';
interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}
export interface Env extends WeatherEnv {
  ALLOWED_ORIGINS?: string;
  MUNICIPAL_GEOJSON_URL?: string;
  COMMUNITY_SALT?: string;
  DB?: { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
export function parsePlace(url: URL): Place {
  const a = url.searchParams.get('lat'),
    b = url.searchParams.get('lon');
  if (!a?.trim() || !b?.trim()) throw new Error('Provide latitude and longitude.');
  const lat = Number(a),
    lon = Number(b);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  )
    throw new Error('Coordinates are out of range.');
  return {
    latitude: Math.round(lat * 1000) / 1000,
    longitude: Math.round(lon * 1000) / 1000,
    name: `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
    emergencyNumber: '911',
  };
}
const localRate = new Map<string, { count: number; until: number }>();
async function rateLimit(request: Request, env: Env) {
  const key = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (env.RATE_LIMITER) return (await env.RATE_LIMITER.limit({ key })).success;
  if (localRate.size > 10000) localRate.clear();
  const r = localRate.get(key);
  if (!r || r.until < Date.now()) {
    localRate.set(key, { count: 1, until: Date.now() + 60_000 });
    return true;
  }
  return ++r.count <= 60;
}
function json(data: unknown, status = 200, cache = false) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cache ? 'public, max-age=180' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
async function actorFor(request: Request, env: Env) {
  const id = request.headers.get('X-Client-ID') ?? '';
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id))
    throw new Error('A valid anonymous client ID is required.');
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(env.COMMUNITY_SALT + id),
  );
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function community(request: Request, url: URL, env: Env) {
  if (!env.DB || !env.COMMUNITY_SALT)
    return json(
      {
        error:
          'Community sharing is not configured. Local pins, buddies and the SMS composer still work.',
      },
      503,
    );
  const db = env.DB;
  if (request.method === 'GET') {
    const p = parsePlace(url);
    const [pins, reports] = await Promise.all([
      db
        .prepare(
          "SELECT p.*, (SELECT COUNT(*) FROM votes v WHERE v.pin_id=p.id AND v.kind='confirm') AS confirmations, (SELECT COUNT(*) FROM votes v WHERE v.pin_id=p.id AND v.kind='report') AS reports FROM pins p WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? AND created_at > ? LIMIT 100",
        )
        .bind(
          p.latitude - 0.05,
          p.latitude + 0.05,
          p.longitude - 0.05,
          p.longitude + 0.05,
          Date.now() - 30 * 86400000,
        )
        .all(),
      db
        .prepare(
          'SELECT id,latitude,longitude,feeling,created_at FROM heat_reports WHERE latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ? AND created_at > ? LIMIT 100',
        )
        .bind(
          p.latitude - 0.05,
          p.latitude + 0.05,
          p.longitude - 0.05,
          p.longitude + 0.05,
          Date.now() - 6 * 3600000,
        )
        .all(),
    ]);
    return json({
      pins: pins.results.map((p: any): ReliefPin => ({
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        kind: p.kind,
        source: 'Community suggestion; not verified',
        official: false,
        status: p.reports >= 3 ? 'not-working' : 'unknown',
        updatedAt: new Date(p.created_at).toISOString(),
        confirmations: p.confirmations,
        reports: p.reports,
      })),
      reports: reports.results,
    });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const actor = await actorFor(request, env);
  const raw = await request.text();
  if (raw.length > 4096) return json({ error: 'Request too large' }, 413);
  const data = JSON.parse(raw);
  if (data.consent !== true) return json({ error: 'Explicit sharing consent is required' }, 400);
  const p = parsePlace(
    new URL(
      `https://local/?lat=${encodeURIComponent(data.latitude)}&lon=${encodeURIComponent(data.longitude)}`,
    ),
  );
  if (url.pathname === '/community/pins') {
    if (
      typeof data.name !== 'string' ||
      !data.name.trim() ||
      data.name.length > 80 ||
      !['water', 'shade', 'ac'].includes(data.kind)
    )
      return json({ error: 'Provide a name and supported place type.' }, 400);
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO pins(id,name,latitude,longitude,kind,actor,created_at) VALUES(?,?,?,?,?,?,?)',
      )
      .bind(id, data.name.trim(), p.latitude, p.longitude, data.kind, actor, Date.now())
      .run();
    return json({ id }, 201);
  }
  if (url.pathname === '/community/feel') {
    if (!['comfortable', 'hot', 'very-hot'].includes(data.feeling))
      return json({ error: 'Invalid feeling' }, 400);
    const id = crypto.randomUUID();
    await db
      .prepare(
        'INSERT INTO heat_reports(id,latitude,longitude,feeling,actor,created_at) VALUES(?,?,?,?,?,?)',
      )
      .bind(
        id,
        Math.round(p.latitude * 100) / 100,
        Math.round(p.longitude * 100) / 100,
        data.feeling,
        actor,
        Date.now(),
      )
      .run();
    return json({ id }, 201);
  }
  if (url.pathname === '/community/vote') {
    if (
      typeof data.pinId !== 'string' ||
      data.pinId.length > 100 ||
      !['confirm', 'report'].includes(data.kind)
    )
      return json({ error: 'Invalid vote' }, 400);
    if (!(await db.prepare('SELECT id FROM pins WHERE id=?').bind(data.pinId).all()).results.length)
      return json({ error: 'Pin not found' }, 404);
    await db
      .prepare(
        'INSERT INTO votes(pin_id,actor,kind,created_at) VALUES(?,?,?,?) ON CONFLICT(pin_id,actor) DO UPDATE SET kind=excluded.kind,created_at=excluded.created_at',
      )
      .bind(data.pinId, actor, data.kind, Date.now())
      .run();
    return json({ ok: true });
  }
  return json({ error: 'Unknown community route' }, 404);
}
export async function handleRequest(request: Request, env: Env = {}): Promise<Response> {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? 'http://localhost:8081,http://localhost:8082')
    .split(',')
    .map((s) => s.trim());
  if (origin && !allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403);
  let response: Response;
  try {
    if (request.method === 'OPTIONS') response = new Response(null, { status: 204 });
    else if (!(await rateLimit(request, env)))
      response = json({ error: 'Too many requests; try again shortly.' }, 429);
    else {
      const url = new URL(request.url);
      if (url.pathname === '/health')
        response = json({
          ok: true,
          version: '0.1.0',
          community: !!env.DB && !!env.COMMUNITY_SALT,
        });
      else if (url.pathname.startsWith('/community')) response = await community(request, url, env);
      else if (request.method !== 'GET') response = json({ error: 'Method not allowed' }, 405);
      else if (url.pathname === '/weather')
        response = json(await getWeather(parsePlace(url), env), 200, true);
      else if (url.pathname === '/relief') {
        const district = url.searchParams.get('district');
        const city = url.searchParams.get('city');
        const county = url.searchParams.get('county');
        const scopeCount = ['district', 'city', 'county'].reduce(
          (count, key) => count + url.searchParams.getAll(key).length,
          0,
        );
        if (scopeCount > 1)
          response = json({ error: 'Choose exactly one city, county, or district scope.' }, 400);
        else if (county === 'dallas')
          response = json(await bundledCity('dallas-county'), 200, true);
        else if (county !== null)
          response = json({ error: 'Provide a supported county: dallas.' }, 400);
        else if ((district === 'tx06' || district === 'tx30') && city === null)
          response = json(await bundledCity(district), 200, true);
        else if (district !== null)
          response = json(
            { error: 'Provide district=tx06 or district=tx30 without a city parameter.' },
            400,
          );
        else if (
          city === 'arlington' ||
          city === 'dallas' ||
          city === 'fort-worth' ||
          city === 'all-dfw'
        )
          response = json(await bundledCity(city), 200, true);
        else if (city !== null)
          response = json(
            { error: 'Provide a supported city: arlington, dallas, fort-worth or all-dfw.' },
            400,
          );
        else
          response = json(await getRelief(parsePlace(url), env.MUNICIPAL_GEOJSON_URL), 200, true);
      } else response = json({ error: 'Route not found' }, 404);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    const input = /coordinates|latitude|longitude|provide|valid anonymous|json/i.test(message);
    response = json(
      {
        error: input
          ? message
          : 'Data source unavailable. Try again later; cached safety guidance remains available.',
      },
      input ? 400 : 502,
    );
  }
  if (origin) response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Vary', 'Origin');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type,X-Client-ID');
  return response;
}
