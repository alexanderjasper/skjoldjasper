import { Client } from 'pg';
import type { EventRow, ProjectorHandler } from '../../runner';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';
import { gameRoomView } from '../../db/schema';

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
  if (ev.type !== 'Incremented') return;

  const db = drizzle(client);
  const delta = Number((ev.payload as any)?.delta ?? 1);

  await db
    .insert(gameRoomView)
    .values({ streamId: ev.stream_id, counter: delta, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: gameRoomView.streamId,
      set: {
        counter: sql`${gameRoomView.counter} + ${delta}`,
        updatedAt: new Date()
      }
    });
}

export const gameRoomViewHandler: ProjectorHandler = {
  handlerName,
  context: 'game',
  streamCategory: 'room',
  ensureSchema,
  apply
};


