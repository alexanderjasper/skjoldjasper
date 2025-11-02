import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import { z } from 'zod';
import { getPool } from '$lib/server/db';

const EventAppendSchema = z.object({
  context: z.string().min(1),
  streamCategory: z.string().min(1),
  streamId: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().nonnegative(),
  payload: z.unknown(),
  metadata: z.record(z.any()).optional()
});

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigins = (privateEnv.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://app.spilspurt.dk').split(',').map((s) => s.trim());
  const corsHeaders: Record<string, string> = {
    'access-control-allow-origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'content-type'
  };

  const ip = getClientAddress();
  if (!consumeToken(ip)) {
    return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { 'content-type': 'application/json', ...corsHeaders } });
  }
  let body: z.infer<typeof EventAppendSchema>;
  try {
    body = EventAppendSchema.parse(await request.json());
  } catch (err) {
    return json({ error: 'invalid_body' }, { status: 400 });
  }

  const { session } = await locals.safeGetSession?.() ?? { session: null };
  const userId = session?.user?.id ?? null;

  const eventId = crypto.randomUUID();
  const ip = getClientAddress();
  const userAgent = request.headers.get('user-agent') ?? undefined;
  const mergedMetadata = {
    ...body.metadata,
    userId,
    ip,
    userAgent
  };

  const pool = getPool();
  try {
    const result = await pool.query(
      `INSERT INTO "events" (
         "event_id", "context", "stream_category", "stream_id", "version",
         "type", "payload", "metadata"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       RETURNING "position", "event_id"`,
      [
        eventId,
        body.context,
        body.streamCategory,
        body.streamId,
        body.version,
        body.type,
        JSON.stringify(body.payload),
        JSON.stringify(mergedMetadata)
      ]
    );

    const row = result.rows[0];
    return new Response(JSON.stringify({ position: row.position, eventId: row.event_id }), { status: 201, headers: { 'content-type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    if (error?.code === '23505') {
      return new Response(JSON.stringify({ error: 'version_conflict' }), { status: 409, headers: { 'content-type': 'application/json', ...corsHeaders } });
    }
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } });
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin') ?? '';
  const allowedOrigins = (privateEnv.ALLOWED_ORIGINS ?? 'http://localhost:5173,https://app.spilspurt.dk').split(',').map((s) => s.trim());
  const headers: Record<string, string> = {
    'access-control-allow-origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true'
  };
  return new Response(null, { status: 204, headers });
};

// simple token bucket per IP: 60 requests per minute
const ipBuckets = new Map<string, { tokens: number; last: number }>();
function consumeToken(ip: string): boolean {
  const now = Date.now();
  const capacity = 60;
  const refillMs = 60_000;
  let b = ipBuckets.get(ip);
  if (!b) {
    b = { tokens: capacity, last: now };
    ipBuckets.set(ip, b);
  }
  const elapsed = now - b.last;
  const refill = Math.floor((elapsed / refillMs) * capacity);
  if (refill > 0) {
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.last = now;
  }
  if (b.tokens <= 0) return false;
  b.tokens -= 1;
  return true;
}


