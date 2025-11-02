import { Client } from 'pg';
import type { EventRow, ProjectorHandler } from '../../runner';

export const handlerName = 'game_room_view';

async function ensureSchema(client: Client): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS game_room_view (
      stream_id text PRIMARY KEY,
      counter integer NOT NULL DEFAULT 0,
      updated_at timestamp with time zone NOT NULL DEFAULT now()
    );
  `);
}

async function apply(ev: EventRow, client: Client): Promise<void> {
  if (ev.type === 'Incremented') {
    const delta = Number((ev.payload as any)?.delta ?? 1);
    await client.query(
      `INSERT INTO game_room_view(stream_id, counter, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT(stream_id)
       DO UPDATE SET counter = game_room_view.counter + EXCLUDED.counter,
                     updated_at = now()`,
      [ev.stream_id, delta]
    );
  }
}

export const gameRoomViewHandler: ProjectorHandler = {
  handlerName,
  context: 'game',
  streamCategory: 'room',
  ensureSchema,
  apply
};


