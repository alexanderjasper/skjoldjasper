import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
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
    return json({ position: row.position, eventId: row.event_id }, { status: 201 });
  } catch (error: any) {
    if (error?.code === '23505') {
      return json({ error: 'version_conflict' }, { status: 409 });
    }
    return json({ error: 'internal_error' }, { status: 500 });
  }
};


