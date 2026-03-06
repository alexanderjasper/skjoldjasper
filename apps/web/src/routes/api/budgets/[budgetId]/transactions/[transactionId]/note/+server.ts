import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '$lib/server/db';
import {validateTransaction} from '$lib/server/finance/commands';
import {logAudit} from '$lib/server/finance/audit';
import {hasBudgetAccess} from '$lib/server/finance/access';

const UpdateNoteSchema = z.object({
    note: z.string().min(0)
});

export const PATCH: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const transactionId = params.transactionId as string;
    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const body = await request.json().catch(() => null);
    const parsed = UpdateNoteSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    // Validate transaction exists and belongs to budget
    try {
        await validateTransaction(pool, transactionId, budgetId);
    } catch (err: any) {
        return json({error: 'not_found'}, {status: 404});
    }

    // Get existing transaction
    const existingResult = await pool.query(
        `SELECT id, budget_id, date, description, amount, note FROM transactions WHERE id = $1`,
        [transactionId]
    );

    const beforeData = existingResult.rows[0];

    // Update note
    await pool.query(`UPDATE transactions SET note = $1 WHERE id = $2`, [parsed.data.note, transactionId]);

    // Log audit
    await logAudit(pool, {
        tableName: 'transactions',
        recordId: transactionId,
        operation: 'UPDATE',
        changedByUserId: userId,
        beforeData,
        afterData: {...beforeData, note: parsed.data.note}
    });

    return json({ok: true});
};
