import { handleRequest, Env } from './app';

/** Same-origin Vercel adapter. Never forward client-supplied platform identity headers. */
export async function hostedRequest(
  request: Request,
  settings: Record<string, string | undefined> = process.env,
): Promise<Response> {
  const incoming = new URL(request.url);
  const route = incoming.searchParams.get('route') ?? incoming.pathname.replace(/^\/api\/?/, '');
  if (!/^(health|weather|relief|community(?:\/(?:pins|feel|vote))?)$/.test(route))
    return Response.json({ error: 'Route not found' }, { status: 404 });
  const url = new URL(request.url);
  url.pathname = `/${route}`;
  url.searchParams.delete('route');
  const headers = new Headers(request.headers);
  headers.set(
    'CF-Connecting-IP',
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown',
  );
  const env: Env = {
    ALLOWED_ORIGINS: incoming.origin,
    NWS_USER_AGENT: settings.NWS_USER_AGENT ?? 'HeatGuard (https://github.com/aetyiuon/heatguard)',
    AIRNOW_API_KEY: settings.AIRNOW_API_KEY,
    MUNICIPAL_GEOJSON_URL: settings.MUNICIPAL_GEOJSON_URL,
  };
  if (settings.SUPABASE_URL && settings.SUPABASE_PUBLISHABLE_KEY) {
    const endpoint = new URL('/functions/v1/heatguard-community', settings.SUPABASE_URL);
    if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.supabase.co'))
      return Response.json(
        { error: 'Community service configuration is invalid.' },
        { status: 503 },
      );
    env.COMMUNITY_HANDLER = async (communityRequest) => {
      const target = new URL(endpoint);
      target.search = new URL(communityRequest.url).search;
      target.searchParams.set('path', new URL(communityRequest.url).pathname);
      const forwarded = new Headers({ apikey: settings.SUPABASE_PUBLISHABLE_KEY! });
      const client = communityRequest.headers.get('X-Client-ID');
      if (client) forwarded.set('X-Client-ID', client);
      forwarded.set('X-HeatGuard-IP', headers.get('CF-Connecting-IP')!);
      if (communityRequest.method === 'POST') forwarded.set('Content-Type', 'application/json');
      const result = await fetch(target, {
        method: communityRequest.method,
        headers: forwarded,
        body: communityRequest.method === 'POST' ? await communityRequest.text() : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      return new Response(result.body, {
        status: result.status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    };
  }
  try {
    return await handleRequest(new Request(url, new Request(request, { headers })), env);
  } catch {
    // Do not log query strings, client identifiers, locations or submitted content.
    console.error('HeatGuard hosted request failed');
    return Response.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  }
}
