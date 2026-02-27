import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '@skjoldjasper/db';
import {getBudgetsForUser} from '$lib/server/finance/queries';
import {logAudit} from '$lib/server/finance/audit';

const CreateBudgetSchema = z.object({name: z.string().min(1), currency: z.string().min(1)});

export const GET: RequestHandler = async ({locals}) => {
    const userId = locals.user?.id;
    if (!userId) return json({budgets: []});

    const pool = getPool();
    const budgets = await getBudgetsForUser(pool, userId);

    return json({budgets});
};

export const POST: RequestHandler = async ({request, locals}) => {
    const body = await request.json().catch(() => null);
    const parsed = CreateBudgetSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const budgetId = `budget-${crypto.randomUUID()}`;

    // Insert budget
    await pool.query(
        `INSERT INTO budgets (id, name, currency, creator_user_id) VALUES ($1, $2, $3, $4)`,
        [budgetId, parsed.data.name, parsed.data.currency, userId]
    );

    // Add creator as a member
    await pool.query(`INSERT INTO budget_members (budget_id, user_id) VALUES ($1, $2)`, [
        budgetId,
        userId
    ]);

    // Log audit entry
    await logAudit(pool, {
        tableName: 'budgets',
        recordId: budgetId,
        operation: 'INSERT',
        changedByUserId: userId,
        afterData: {id: budgetId, name: parsed.data.name, currency: parsed.data.currency, creator_user_id: userId}
    });

    return json({id: budgetId}, {status: 201});
};
