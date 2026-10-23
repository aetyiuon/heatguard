import { Env, handleRequest } from './app';
interface WorkerContext {
  waitUntil(p: Promise<unknown>): void;
}
export default {
  async fetch(request: Request, env: Env, context: WorkerContext) {
    const url = new URL(request.url);
    const cacheable = request.method === 'GET' && ['/weather', '/relief'].includes(url.pathname);
    const origin = request.headers.get('Origin');
    if (
      origin &&
      !(env.ALLOWED_ORIGINS ?? '')
        .split(',')
        .map((s) => s.trim())
        .includes(origin)
    )
      return handleRequest(request, env);
    // Canonicalize coordinates to ~100m cache cells. Health profile never reaches this API.
    if (cacheable) {
      for (const key of ['lat', 'lon']) {
        const value = url.searchParams.get(key);
        if (value?.trim() && Number.isFinite(Number(value)))
          url.searchParams.set(key, (Math.round(Number(value) * 1000) / 1000).toFixed(3));
      }
    }
    const cacheUrl = new URL(url);
    cacheUrl.searchParams.set('_cacheOrigin', origin ?? 'native');
    const key = new Request(cacheUrl.toString());
    const cache = (caches as CacheStorage & { default: Cache }).default;
    if (cacheable) {
      const hit = await cache.match(key);
      if (hit) return hit;
    }
    const response = await handleRequest(request, env);
    if (cacheable && response.ok) context.waitUntil(cache.put(key, response.clone()));
    return response;
  },
};
