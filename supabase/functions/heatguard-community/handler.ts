export interface CommunitySettings {
  url: string;
  secret: string;
  publishable: string[];
}
const DAY = 86400000;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function coordinate(value: unknown, max: number) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '')
    throw new Error('Provide valid coordinates.');
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > max) throw new Error('Provide valid coordinates.');
  return Math.round(n * 1000) / 1000;
}
export function communityHandler(settings: CommunitySettings, transport: typeof fetch = fetch) {
  async function db(path: string, method = 'GET', body?: unknown, prefer?: string) {
    const headers: Record<string, string> = {
      apikey: settings.secret,
      'Content-Type': 'application/json',
    };
    if (settings.secret.startsWith('eyJ')) headers.Authorization = `Bearer ${settings.secret}`;
    if (prefer) headers.Prefer = prefer;
    const response = await transport(`${settings.url}/rest/v1/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Database unavailable');
    const text = await response.text();
    return text ? JSON.parse(text) : undefined;
  }
  return async function (request: Request): Promise<Response> {
    if (!settings.secret || !settings.publishable.includes(request.headers.get('apikey') ?? ''))
      return json({ error: 'Unauthorized' }, 401);
    if (!['GET', 'POST'].includes(request.method))
      return json({ error: 'Method not allowed' }, 405);
    try {
      const url = new URL(request.url);
      const path = url.searchParams.get('path') ?? '/community';
      if (!['/community', '/community/pins', '/community/feel', '/community/vote'].includes(path))
        return json({ error: 'Unknown community route' }, 404);
      const client = request.headers.get('X-Client-ID') ?? '';
      const ip =
        request.headers.get('X-HeatGuard-IP') ??
        request.headers.get('x-forwarded-for') ??
        'unknown';
      const rateKey = await hash(`${settings.secret}:rate:${ip}`);
      if (!(await db('rpc/heatguard_allow_request', 'POST', { p_key: rateKey, p_limit: 60 })))
        return json({ error: 'Too many requests; try again shortly.' }, 429);
      const now = Date.now();
      if (request.method === 'GET') {
        if (path !== '/community') return json({ error: 'Unknown community route' }, 404);
        const lat = coordinate(url.searchParams.get('lat'), 90),
          lon = coordinate(url.searchParams.get('lon'), 180);
        const area = `latitude=gte.${lat - 0.05}&latitude=lte.${lat + 0.05}&longitude=gte.${lon - 0.05}&longitude=lte.${lon + 0.05}`;
        // Expired rows are physically removed on reads as well as hidden by time filters.
        await Promise.all([
          db(`heatguard_pins?created_at=lt.${now - 30 * DAY}`, 'DELETE'),
          db(`heatguard_reports?created_at=lt.${now - 6 * 3600000}`, 'DELETE'),
        ]);
        const [pins, reports] = await Promise.all([
          db(
            `heatguard_pins?${area}&created_at=gt.${now - 30 * DAY}&select=id,name,latitude,longitude,kind,created_at&order=created_at.desc&limit=100`,
          ),
          db(
            `heatguard_reports?${area}&created_at=gt.${now - 6 * 3600000}&select=id,latitude,longitude,feeling,created_at&order=created_at.desc&limit=100`,
          ),
        ]);
        const votes = pins.length
          ? await db(
              `heatguard_votes?pin_id=in.(${pins.map((p: any) => p.id).join(',')})&select=pin_id,kind&limit=10000`,
            )
          : [];
        return json({
          pins: pins.map((p: any) => {
            const confirmations = votes.filter(
              (v: any) => v.pin_id === p.id && v.kind === 'confirm',
            ).length;
            const reports = votes.filter(
              (v: any) => v.pin_id === p.id && v.kind === 'report',
            ).length;
            return {
              id: p.id,
              name: p.name,
              latitude: p.latitude,
              longitude: p.longitude,
              kind: p.kind,
              source: 'Community suggestion; not verified',
              official: false,
              status: reports >= 3 ? 'not-working' : 'unknown',
              updatedAt: new Date(p.created_at).toISOString(),
              confirmations,
              reports,
            };
          }),
          reports,
        });
      }
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(client))
        return json({ error: 'A valid anonymous client ID is required.' }, 400);
      if (Number(request.headers.get('Content-Length') ?? 0) > 4096)
        return json({ error: 'Request too large' }, 413);
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > 4096)
        return json({ error: 'Request too large' }, 413);
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(raw);
      } catch {
        return json({ error: 'Provide valid JSON' }, 400);
      }
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return json({ error: 'Provide valid JSON' }, 400);
      if (data.consent !== true)
        return json({ error: 'Explicit sharing consent is required' }, 400);
      const lat = coordinate(data.latitude, 90),
        lon = coordinate(data.longitude, 180);
      const actor = await hash(`${settings.secret}:actor:${client}`);
      const writeKey = await hash(`${settings.secret}:write:${client}`);
      if (!(await db('rpc/heatguard_allow_request', 'POST', { p_key: writeKey, p_limit: 10 })))
        return json({ error: 'Too many submissions; try again shortly.' }, 429);
      if (path === '/community/pins') {
        if (
          typeof data.name !== 'string' ||
          !data.name.trim() ||
          data.name.length > 80 ||
          !['water', 'shade', 'ac'].includes(String(data.kind))
        )
          return json({ error: 'Provide a name and supported place type.' }, 400);
        const id = crypto.randomUUID();
        await db(
          'heatguard_pins',
          'POST',
          {
            id,
            name: data.name.trim(),
            latitude: lat,
            longitude: lon,
            kind: data.kind,
            actor,
            created_at: now,
          },
          'return=minimal',
        );
        return json({ id }, 201);
      }
      if (path === '/community/feel') {
        if (!['comfortable', 'hot', 'very-hot'].includes(String(data.feeling)))
          return json({ error: 'Invalid feeling' }, 400);
        const id = crypto.randomUUID();
        await db(
          'heatguard_reports',
          'POST',
          {
            id,
            latitude: Math.round(lat * 100) / 100,
            longitude: Math.round(lon * 100) / 100,
            feeling: data.feeling,
            actor,
            created_at: now,
          },
          'return=minimal',
        );
        return json({ id }, 201);
      }
      if (path === '/community/vote') {
        if (
          typeof data.pinId !== 'string' ||
          !/^[0-9a-f-]{36}$/i.test(data.pinId) ||
          !['confirm', 'report'].includes(String(data.kind))
        )
          return json({ error: 'Invalid vote' }, 400);
        const pins = await db(
          `heatguard_pins?id=eq.${data.pinId}&created_at=gt.${now - 30 * DAY}&select=id&limit=1`,
        );
        if (!pins.length) return json({ error: 'Pin not found' }, 404);
        await db(
          'heatguard_votes?on_conflict=pin_id,actor',
          'POST',
          { pin_id: data.pinId, actor, kind: data.kind, created_at: now },
          'resolution=merge-duplicates,return=minimal',
        );
        return json({ ok: true });
      }
      return json({ error: 'Unknown community route' }, 404);
    } catch (error) {
      if (error instanceof Error && error.message === 'Provide valid coordinates.')
        return json({ error: error.message }, 400);
      return json({ error: 'Community service temporarily unavailable.' }, 503);
    }
  };
}
