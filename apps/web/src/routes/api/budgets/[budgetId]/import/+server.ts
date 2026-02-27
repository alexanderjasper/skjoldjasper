import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {getPool} from '@skjoldjasper/db';
import {generateTransactionId, findDuplicateTransactions} from '$lib/server/finance/commands';
import {logAudit} from '$lib/server/finance/audit';
import {parseCSV} from '$lib/server/finance/csvParser';

export const POST: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();

    // Verify budget exists
    const budgetCheck = await pool.query('SELECT 1 FROM budgets WHERE id = $1', [budgetId]);
    if (budgetCheck.rows.length === 0) {
        return json({error: 'not_found'}, {status: 404});
    }

    const formData = await request.formData().catch(() => null);
    if (!formData) return json({error: 'invalid_body'}, {status: 400});

    const file = formData.get('file');
    if (!(file instanceof File)) {
        return json({error: 'invalid_file'}, {status: 400});
    }

    const text = await file.text();
    const transactions = parseCSV(text);

    // Add transaction IDs
    const txWithIds = transactions.map((t) => ({
        ...t,
        transactionId: generateTransactionId(t.date, t.description, t.amount)
    }));

    // Check for duplicates
    const duplicates = await findDuplicateTransactions(pool, budgetId, txWithIds);
    if (duplicates.length > 0) {
        return json({error: 'duplicates_found', count: duplicates.length}, {status: 409});
    }

    // Insert transactions and splits
    for (const tx of txWithIds) {
        await pool.query(
            `INSERT INTO transactions (id, budget_id, date, description, amount) VALUES ($1, $2, $3, $4, $5)`,
            [tx.transactionId, budgetId, tx.date, tx.description, tx.amount]
        );

        await logAudit(pool, {
            tableName: 'transactions',
            recordId: tx.transactionId,
            operation: 'INSERT',
            changedByUserId: userId,
            afterData: {id: tx.transactionId, budget_id: budgetId, date: tx.date, description: tx.description, amount: tx.amount}
        });
    }

    return json({imported: txWithIds.length}, {status: 201});
};
