const entries = new Map<string, { value: unknown; expires: number }>();
const inFlight = new Map<string, Promise<unknown>>();
/** Bounded upstream cache plus request coalescing, in addition to the Worker's edge cache. */
export async function upstream<T = any>(
  url: string,
  ttl = 300,
  headers: Record<string, string> = {},
  timeoutMs = 12_000,
): Promise<T> {
  const cached = entries.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  const pending = inFlight.get(url);
  if (pending) return pending as Promise<T>;
  const promise = (async () => {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
    const value = await response.json();
    if (entries.size >= 256) entries.delete(entries.keys().next().value!);
    entries.set(url, { value, expires: Date.now() + ttl * 1000 });
    return value;
  })();
  inFlight.set(url, promise);
  try {
    return (await promise) as T;
  } finally {
    inFlight.delete(url);
  }
}
