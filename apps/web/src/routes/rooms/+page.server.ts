import type { PageServerLoad, Actions } from './$types';
import { getPool } from '$lib/server/db';

export const load: PageServerLoad = async () => {
  const pool = getPool();
  const { rows } = await pool.query<{ stream_id: string; counter: number }>(
    'SELECT stream_id, counter FROM game_room_view ORDER BY counter DESC NULLS LAST LIMIT 50'
  );
  return { rooms: rows };
};

export const actions: Actions = {
  // no-op placeholder for future create actions (using join flow for now)
};


