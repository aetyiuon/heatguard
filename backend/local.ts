import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { handleRequest, Env } from './app';
// Small .dev.vars loader; these server secrets are never bundled in the Expo client.
const env: Env = {
  NWS_USER_AGENT: process.env.NWS_USER_AGENT,
  AIRNOW_API_KEY: process.env.AIRNOW_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  MUNICIPAL_GEOJSON_URL: process.env.MUNICIPAL_GEOJSON_URL,
};
if (existsSync('.dev.vars'))
  for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) (env as Record<string, unknown>)[m[1]!] = m[2]!.trim().replace(/^['"]|['"]$/g, '');
  }
createServer(async (req, res) => {
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 4096) {
        res.writeHead(413);
        res.end('Request too large');
        return;
      }
      chunks.push(chunk);
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(`http://localhost:8787${req.url}`, {
      method: req.method,
      headers,
      ...(req.method === 'POST' ? { body: Buffer.concat(chunks).toString() } : {}),
    });
    const result = await handleRequest(request, env);
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(await result.text());
  } catch {
    res.writeHead(500);
    res.end('Proxy error');
  }
}).listen(8787, '0.0.0.0', () => console.log('HeatGuard proxy ready at http://localhost:8787'));
