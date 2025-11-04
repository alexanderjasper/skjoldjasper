import { Client } from 'pg';
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

async function getLastPosition(client: Client, name: string): Promise<number> {
  const { rows } = await client.query<{ last_position: string }>(
    `SELECT last_position FROM projector_checkpoints WHERE name=$1`,
    [name]
  );
  if (rows.length === 0) return 0;
  return Number(rows[0].last_position ?? 0);
}

async function setLastPosition(client: Client, name: string, position: number): Promise<void> {
  await client.query(
    `INSERT INTO projector_checkpoints(name, last_position, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT(name) DO UPDATE SET last_position=EXCLUDED.last_position, updated_at=now()`,
    [name, position]
  );
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

  let lastPos = await getLastPosition(client, h.handlerName);
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
    await setLastPosition(client, h.handlerName, lastPos);
    // eslint-disable-next-line no-console
    console.log(`[projector:${h.handlerName}] advanced to position:`, lastPos);
  }

  // eslint-disable-next-line no-console
  console.log(`[projector:${h.handlerName}] done. last position:`, lastPos);
}


