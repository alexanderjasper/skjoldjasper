import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    // Insert one test event
    const eventId = randomUUID();
    const now = new Date().toISOString();

    await client.query('BEGIN');

    // Determine next version for the stream (simple demo)
    const streamId = 'entity-1';
    const { rows } = await client.query(
      'select coalesce(max(version), 0) as v from events where stream_id=$1',
      [streamId]
    );
    const nextVersion = Number(rows[0].v) + 1;

    await client.query(
      `insert into events (
        event_id, context, stream_category, stream_id, version, type, payload, metadata, created_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        eventId,
        'demo',
        'entity',
        streamId,
        nextVersion,
        'MovePlaced',
        JSON.stringify({ move: 'increment' }),
        JSON.stringify({ test: true }),
        now
      ]
    );

    await client.query('COMMIT');

    const { rows: out } = await client.query(
      'select context, stream_category, stream_id, version, type from events where event_id=$1',
      [eventId]
    );
    console.log('Inserted event:', out[0]);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


