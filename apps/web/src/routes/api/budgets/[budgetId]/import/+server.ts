import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {getPool} from '@skjoldjasper/db';
import {generateTransactionId, findDuplicateTransactions} from '$lib/server/finance/commands';
import {logAudit} from '$lib/server/finance/audit';
import {parseDanishBankCsv} from '$lib/server/finance/csvParser';
import {hasBudgetAccess} from '$lib/server/finance/access';

export const POST: RequestHandler = async ({params, request, locals, url}) => {
    const budgetId = params.budgetId as string;
    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();

    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    const formData = await request.formData().catch(() => null);
    if (!formData) return json({error: 'invalid_body'}, {status: 400});

    const file = formData.get('file');
    if (!(file instanceof File)) {
        return json({error: 'invalid_file'}, {status: 400});
    }

    const text = await file.text();
    let transactions;
    try {
        transactions = parseDanishBankCsv(text);
    } catch (err: any) {
        return json({error: 'invalid_csv', message: err?.message ?? 'Invalid CSV format'}, {status: 400});
    }

    // Add transaction IDs
    const txWithIds = transactions.map((t) => ({
        ...t,
        transactionId: generateTransactionId(t.date, t.description, t.amount)
    }));

    // Check for duplicates
    const duplicates = await findDuplicateTransactions(pool, budgetId, txWithIds);
    const confirm = url.searchParams.get('confirm') === '1';
    if (duplicates.length > 0 && !confirm) {
        return json(
            {
                error: 'duplicates_found',
                duplicates,
                newCount: txWithIds.length - duplicates.length
            },
            {status: 409}
        );
    }
    const duplicateIds = new Set(duplicates.map((d) => d.transactionId));
    const toInsert = txWithIds.filter((t) => !duplicateIds.has(t.transactionId));

    // Insert transactions and splits
    for (const tx of toInsert) {
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

    return json({imported: toInsert.length, duplicates: duplicates.length}, {status: 201});
};
