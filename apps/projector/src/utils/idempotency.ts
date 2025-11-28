import {Client} from 'pg';

export async function ensureAppliedEventsTable(client: Client): Promise<void> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS projector_applied_events
        (
            handler_name
            text
            NOT
            NULL,
            position
            bigint
            NOT
            NULL,
            created_at
            timestamp
            with
            time
            zone
            NOT
            NULL
            DEFAULT
            now
        (
        ),
            PRIMARY KEY
        (
            handler_name,
            position
        )
            );
    `);
}

export async function withIdempotentApply(
    client: Client,
    handlerName: string,
    position: number,
    reducer: () => Promise<void>
): Promise<void> {
    await client.query('BEGIN');
    try {
        const res = await client.query(
            `INSERT INTO projector_applied_events(handler_name, position)
             VALUES ($1, $2) ON CONFLICT DO NOTHING
       RETURNING 1`,
            [handlerName, position]
        );
        if (res.rows.length === 0) {
            await client.query('ROLLBACK');
            return; // already applied
        }

        await reducer();
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    }
}


