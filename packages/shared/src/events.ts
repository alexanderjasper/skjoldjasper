import { z } from 'zod';

type PgLike = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

export const eventAppendSchema = z.object({
  context: z.string().min(1),
  streamCategory: z.string().min(1),
  streamId: z.string().min(1),
  type: z.string().min(1),
  version: z.number().int().nonnegative(),
  payload: z.unknown(),
  metadata: z.record(z.string(), z.any()).optional()
});

export type EventAppend = z.infer<typeof eventAppendSchema>;

export class VersionConflictError extends Error {
  constructor() {
    super('version_conflict');
    this.name = 'VersionConflictError';
  }
}

export async function appendEvent(
  pool: PgLike,
  dto: EventAppend,
  mergedMetadata: Record<string, unknown>
): Promise<{ position: number; eventId: string }> {
  const eventId = crypto.randomUUID();
  try {
    const result = await pool.query(
      `INSERT INTO "events" (
         "event_id", "context", "stream_category", "stream_id", "version",
         "type", "payload", "metadata"
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
       RETURNING "position", "event_id"`,
      [
        eventId,
        dto.context,
        dto.streamCategory,
        dto.streamId,
        dto.version,
        dto.type,
        JSON.stringify(dto.payload),
        JSON.stringify(mergedMetadata)
      ]
    );

    const row = result.rows[0] as { position: number; event_id: string };
    return { position: Number(row.position), eventId: String(row.event_id) };
  } catch (error: any) {
    if (error?.code === '23505') {
      throw new VersionConflictError();
    }
    throw error;
  }
}


