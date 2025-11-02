import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";

const CHECKPOINT_NAME = "game_room_view";
const BATCH_SIZE = 5000;

async function ensureSchema(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_room_view (
      stream_id text PRIMARY KEY,
      counter integer NOT NULL DEFAULT 0,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS projector_checkpoints (
      name text PRIMARY KEY,
      last_position bigint NOT NULL DEFAULT 0,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
}

async function getLastPosition(client: Client): Promise<number> {
  const { rows } = await client.query<{ last_position: string }>(
    `SELECT last_position FROM projector_checkpoints WHERE name=$1`,
    [CHECKPOINT_NAME]
  );
  if (rows.length === 0) return 0;
  return Number(rows[0].last_position ?? 0);
}

async function setLastPosition(client: Client, position: number): Promise<void> {
  await client.query(
    `INSERT INTO projector_checkpoints(name, last_position, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT(name) DO UPDATE SET last_position=EXCLUDED.last_position, updated_at=now()`,
    [CHECKPOINT_NAME, position]
  );
}

async function processBatch(client: Client, fromExclusive: number): Promise<number> {
  const { rows } = await client.query<{
    position: string;
    stream_id: string;
    type: string;
    payload: any;
  }>(
    `SELECT position, stream_id, type, payload
     FROM events
     WHERE context='game' AND stream_category='room' AND position > $1
     ORDER BY position ASC
     LIMIT $2`,
    [fromExclusive, BATCH_SIZE]
  );

  let maxPos = fromExclusive;
  for (const ev of rows) {
    const position = Number(ev.position);
    if (ev.type === "Incremented") {
      const delta = Number((ev.payload as any)?.delta ?? 1);
      // upsert accumulating counter
      await client.query(
        `INSERT INTO game_room_view(stream_id, counter, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT(stream_id)
         DO UPDATE SET counter = game_room_view.counter + EXCLUDED.counter,
                       updated_at = now()`,
        [ev.stream_id, delta]
      );
    }
    if (position > maxPos) maxPos = position;
  }
  return rows.length > 0 ? maxPos : fromExclusive;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await ensureSchema(client);

    let lastPos = await getLastPosition(client);
    // eslint-disable-next-line no-console
    console.log("starting from position:", lastPos);

    // process in batches until no more events
    while (true) {
      const newPos = await processBatch(client, lastPos);
      if (newPos === lastPos) break;
      lastPos = newPos;
      await setLastPosition(client, lastPos);
      // eslint-disable-next-line no-console
      console.log("advanced to position:", lastPos);
    }

    // eslint-disable-next-line no-console
    console.log("projector done. last position:", lastPos);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("projector failed:", err);
  process.exitCode = 1;
});
