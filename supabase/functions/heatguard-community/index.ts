// The gateway JWT check is replaced with explicit publishable-key validation in handler.ts.
import { communityHandler } from './handler.ts';
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (r: Request) => Promise<Response>): void;
};
const secretKeys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
const publicKeys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
Deno.serve(
  communityHandler({
    url: Deno.env.get('SUPABASE_URL')!,
    secret: secretKeys.default ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    publishable: Object.values(publicKeys).filter((k): k is string => typeof k === 'string'),
  }),
);
