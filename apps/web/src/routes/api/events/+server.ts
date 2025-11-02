import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { eventAppendSchema, appendEvent, VersionConflictError } from '@skjoldjasper/shared';
import { createTokenBucket, getServerConfig, buildCorsHeaders, buildPreflightHeaders } from '@skjoldjasper/shared';
import { getPool } from '$lib/server/db';

const EventAppendSchema = eventAppendSchema;

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
  const origin = request.headers.get('origin') ?? '';
  const cfg = getServerConfig();
  const corsHeaders = buildCorsHeaders(origin, cfg.allowedOrigins);

  const ip = getClientAddress();
  if (!eventsLimiter.consume(ip)) {
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
    const { position, eventId } = await appendEvent(pool, body, mergedMetadata);
    return new Response(JSON.stringify({ position, eventId }), { status: 201, headers: { 'content-type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    if (error instanceof VersionConflictError) {
      return new Response(JSON.stringify({ error: 'version_conflict' }), { status: 409, headers: { 'content-type': 'application/json', ...corsHeaders } });
    }
    return new Response(JSON.stringify({ error: 'internal_error' }), { status: 500, headers: { 'content-type': 'application/json', ...corsHeaders } });
  }
};

export const OPTIONS: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin') ?? '';
  const cfg = getServerConfig();
  const headers = buildPreflightHeaders(origin, cfg.allowedOrigins, ['POST', 'OPTIONS']);
  return new Response(null, { status: 204, headers });
};

// Shared in-memory token bucket per IP
const eventsLimiter = (() => {
  const cfg = getServerConfig();
  return createTokenBucket(cfg.rateLimit.eventsApi);
})();


