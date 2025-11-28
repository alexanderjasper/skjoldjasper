import type {Pool} from 'pg';
import type {BudgetState} from './types';
import {applyEvent, createEmptyState} from './state';

export async function loadBudget(pool: Pool, streamId: string): Promise<BudgetState | null> {
    const result = await pool.query(
        `SELECT type, payload, version
         FROM events
         WHERE stream_id = $1
         ORDER BY version ASC`,
        [streamId]
    );

    if (result.rows.length === 0) return null;

    const state = createEmptyState();

    for (const row of result.rows) {
        applyEvent(state, row.type, row.payload, row.version);
    }

    return state;
}
