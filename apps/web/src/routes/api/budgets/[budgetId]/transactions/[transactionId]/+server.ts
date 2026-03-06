import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '$lib/server/db';
import {validateTransaction} from '$lib/server/finance/commands';
import {hasBudgetAccess} from '$lib/server/finance/access';
import {logAudit} from '$lib/server/finance/audit';

const UpdateTransactionSchema = z.object({
    date: z.string().min(1),
    description: z.string().min(1),
    amount: z.number(),
    confirmClearSplits: z.boolean().optional()
});

const DeleteTransactionSchema = z.object({
    confirmDeleteSplits: z.boolean().optional()
});

export const PATCH: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const transactionId = params.transactionId as string;
    const body = await request.json().catch(() => null);
    const parsed = UpdateTransactionSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    try {
        await validateTransaction(pool, transactionId, budgetId);
    } catch (err: any) {
        return json({error: 'not_found'}, {status: 404});
    }

    const existingResult = await pool.query(
        `SELECT id, budget_id, date, description, amount, note FROM transactions WHERE id = $1 AND budget_id = $2`,
        [transactionId, budgetId]
    );
    if (existingResult.rows.length === 0) return json({error: 'not_found'}, {status: 404});
    const beforeData = existingResult.rows[0];

    const splitsResult = await pool.query(
        `SELECT transaction_id, category_id, amount FROM transaction_splits WHERE transaction_id = $1`,
        [transactionId]
    );
    const splitRows = splitsResult.rows;
    const splitTotal = splitRows.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const epsilon = 0.01;
    const amountChanged = Math.abs(parseFloat(beforeData.amount) - parsed.data.amount) > epsilon;
    const splitsWouldMismatch = splitRows.length > 0 && Math.abs(splitTotal - parsed.data.amount) > epsilon;

    if (amountChanged && splitsWouldMismatch && !parsed.data.confirmClearSplits) {
        return json(
            {
                error: 'transaction_update_requires_confirmation',
                message: 'Beløbet matcher ikke eksisterende opdelinger, som bliver fjernet',
                splitCount: splitRows.length
            },
            {status: 409}
        );
    }

    if (amountChanged && splitsWouldMismatch) {
        await pool.query(`DELETE FROM transaction_splits WHERE transaction_id = $1`, [transactionId]);
        for (const split of splitRows) {
            await logAudit(pool, {
                tableName: 'transaction_splits',
                recordId: `${split.transaction_id}:${split.category_id}`,
                operation: 'DELETE',
                changedByUserId: userId,
                beforeData: split,
                afterData: split
            });
        }
    }

    await pool.query(
        `UPDATE transactions SET date = $1, description = $2, amount = $3 WHERE id = $4 AND budget_id = $5`,
        [parsed.data.date, parsed.data.description, parsed.data.amount, transactionId, budgetId]
    );

    const afterData = {
        ...beforeData,
        date: parsed.data.date,
        description: parsed.data.description,
        amount: parsed.data.amount
    };

    await logAudit(pool, {
        tableName: 'transactions',
        recordId: transactionId,
        operation: 'UPDATE',
        changedByUserId: userId,
        beforeData,
        afterData
    });

    return json({ok: true});
};

export const DELETE: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const transactionId = params.transactionId as string;
    const body = await request.json().catch(() => ({}));
    const parsed = DeleteTransactionSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    try {
        await validateTransaction(pool, transactionId, budgetId);
    } catch (err: any) {
        return json({error: 'not_found'}, {status: 404});
    }

    const txResult = await pool.query(
        `SELECT id, budget_id, date, description, amount, note FROM transactions WHERE id = $1 AND budget_id = $2`,
        [transactionId, budgetId]
    );
    if (txResult.rows.length === 0) return json({error: 'not_found'}, {status: 404});
    const txBeforeData = txResult.rows[0];

    const splitsResult = await pool.query(
        `SELECT transaction_id, category_id, amount FROM transaction_splits WHERE transaction_id = $1`,
        [transactionId]
    );
    const splitRows = splitsResult.rows;
    if (splitRows.length > 0 && !parsed.data.confirmDeleteSplits) {
        return json(
            {
                error: 'transaction_delete_requires_confirmation',
                message: 'Transaktionen har opdelinger som også bliver slettet',
                splitCount: splitRows.length
            },
            {status: 409}
        );
    }

    await pool.query(`DELETE FROM transaction_splits WHERE transaction_id = $1`, [transactionId]);
    for (const split of splitRows) {
        await logAudit(pool, {
            tableName: 'transaction_splits',
            recordId: `${split.transaction_id}:${split.category_id}`,
            operation: 'DELETE',
            changedByUserId: userId,
            beforeData: split,
            afterData: split
        });
    }

    await pool.query(`DELETE FROM transactions WHERE id = $1 AND budget_id = $2`, [transactionId, budgetId]);

    await logAudit(pool, {
        tableName: 'transactions',
        recordId: transactionId,
        operation: 'DELETE',
        changedByUserId: userId,
        beforeData: txBeforeData,
        afterData: txBeforeData
    });

    return json({ok: true});
};

