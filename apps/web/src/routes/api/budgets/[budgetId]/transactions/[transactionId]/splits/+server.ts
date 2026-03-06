import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '$lib/server/db';
import {validateTransaction, validateSplitCategories, validateSplitTotal} from '$lib/server/finance/commands';
import {logAudit} from '$lib/server/finance/audit';
import {hasBudgetAccess} from '$lib/server/finance/access';

const UpdateSplitsSchema = z.object({
    splits: z.array(z.object({
        categoryId: z.string().min(1),
        amount: z.number()
    }))
});

export const POST: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const transactionId = params.transactionId as string;
    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const body = await request.json().catch(() => null);
    const parsed = UpdateSplitsSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    // Validate transaction exists
    try {
        await validateTransaction(pool, transactionId, budgetId);
    } catch (err: any) {
        return json({error: 'not_found'}, {status: 404});
    }

    // Validate all categories exist
    const categoryIds = parsed.data.splits.map((s) => s.categoryId);
    try {
        await validateSplitCategories(pool, budgetId, categoryIds);
    } catch (err: any) {
        return json({error: 'validation_failed', message: String(err?.message ?? err)}, {status: 400});
    }

    // Validate total matches transaction amount
    const totalAmount = parsed.data.splits.reduce((sum, s) => sum + s.amount, 0);
    try {
        await validateSplitTotal(pool, transactionId, totalAmount);
    } catch (err: any) {
        return json({error: 'validation_failed', message: String(err?.message ?? err)}, {status: 400});
    }

    // Get existing splits for audit
    const existingResult = await pool.query(
        `SELECT category_id, amount FROM transaction_splits WHERE transaction_id = $1`,
        [transactionId]
    );

    const beforeData = existingResult.rows;

    // Delete existing splits
    await pool.query(`DELETE FROM transaction_splits WHERE transaction_id = $1`, [transactionId]);

    // Insert new splits
    for (const split of parsed.data.splits) {
        await pool.query(
            `INSERT INTO transaction_splits (transaction_id, category_id, amount) VALUES ($1, $2, $3)`,
            [transactionId, split.categoryId, split.amount]
        );
    }

    // Log audit (one per split)
    for (const split of parsed.data.splits) {
        await logAudit(pool, {
            tableName: 'transaction_splits',
            recordId: `${transactionId}:${split.categoryId}`,
            operation: 'INSERT',
            changedByUserId: userId,
            afterData: {transaction_id: transactionId, category_id: split.categoryId, amount: split.amount}
        });
    }

    return json({ok: true});
};
