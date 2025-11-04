import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { projectorCheckpoints } from '@skjoldjasper/db';
import { ensureAppliedEventsTable, withIdempotentApply } from './utils/idempotency';

export type EventRow = {
  position: string; // pg returns as string
  stream_id: string;
  type: string;
  payload: unknown;
};

export type ProjectorHandler = {
  handlerName: string;
  context: string;
  streamCategory: string;
  ensureSchema(client: Client): Promise<void>;
  apply(ev: EventRow, client: Client): Promise<void>;
};

const BATCH_SIZE = 5000;

async function ensureCheckpointTable(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS projector_checkpoints (
      name text PRIMARY KEY,
      last_position bigint NOT NULL DEFAULT 0,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
}

async function getLastPositionDb(db: ReturnType<typeof drizzle>, name: string): Promise<number> {
  const rows = await db
    .select({ lastPosition: projectorCheckpoints.lastPosition })
    .from(projectorCheckpoints)
    .where(eq(projectorCheckpoints.name, name))
    .limit(1);
  if (rows.length === 0) return 0;
  return Number(rows[0].lastPosition ?? 0);
}

async function setLastPositionDb(db: ReturnType<typeof drizzle>, name: string, position: number): Promise<void> {
  await db
    .insert(projectorCheckpoints)
    .values({ name, lastPosition: position, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: projectorCheckpoints.name,
      set: { lastPosition: position, updatedAt: new Date() }
    });
}

async function fetchBatch(client: Client, h: ProjectorHandler, fromExclusive: number): Promise<EventRow[]> {
  const { rows } = await client.query<EventRow>(
    `SELECT position, stream_id, type, payload
     FROM events
     WHERE context=$1 AND stream_category=$2 AND position > $3
     ORDER BY position ASC
     LIMIT $4`,
    [h.context, h.streamCategory, fromExclusive, BATCH_SIZE]
  );
  return rows;
}

export async function runHandler(client: Client, h: ProjectorHandler): Promise<void> {
  await h.ensureSchema(client);
  await ensureCheckpointTable(client);
  await ensureAppliedEventsTable(client);
  const db = drizzle(client);

  let lastPos = await getLastPositionDb(db, h.handlerName);
  // eslint-disable-next-line no-console
  console.log(`[projector:${h.handlerName}] starting from position:`, lastPos);

  while (true) {
    const rows = await fetchBatch(client, h, lastPos);
    if (rows.length === 0) break;

    let maxPos = lastPos;
    for (const ev of rows) {
      await withIdempotentApply(client, h.handlerName, Number(ev.position), async () => {
        await h.apply(ev, client);
      });
      const p = Number(ev.position);
      if (p > maxPos) maxPos = p;
    }
    lastPos = maxPos;
    await setLastPositionDb(db, h.handlerName, lastPos);
    // eslint-disable-next-line no-console
    console.log(`[projector:${h.handlerName}] advanced to position:`, lastPos);
  }

  // eslint-disable-next-line no-console
  console.log(`[projector:${h.handlerName}] done. last position:`, lastPos);
}


