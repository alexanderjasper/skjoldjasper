import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '@skjoldjasper/db';
import {logAudit} from '$lib/server/finance/audit';
import {validateParentCategory, validateLeafCategory} from '$lib/server/finance/commands';
import {hasBudgetAccess} from '$lib/server/finance/access';

const AddCategorySchema = z.object({
    name: z.string().min(1),
    parentId: z.string().min(1).nullable().optional()
});

const SetTargetSchema = z.object({
    categoryId: z.string().min(1),
    yearlyTarget: z.number()
});

export const POST: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const body = await request.json().catch(() => null);
    const parsed = AddCategorySchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    // Validate parent category exists (if provided)
    try {
        await validateParentCategory(pool, budgetId, parsed.data.parentId ?? null);
    } catch (err: any) {
        return json({error: 'validation_failed', message: String(err?.message ?? err)}, {status: 400});
    }

    const categoryId = crypto.randomUUID();

    // Insert category
    await pool.query(
        `INSERT INTO categories (id, budget_id, name, parent_id) VALUES ($1, $2, $3, $4)`,
        [categoryId, budgetId, parsed.data.name, parsed.data.parentId ?? null]
    );

    // Log audit
    await logAudit(pool, {
        tableName: 'categories',
        recordId: categoryId,
        operation: 'INSERT',
        changedByUserId: userId,
        afterData: {
            id: categoryId,
            budget_id: budgetId,
            name: parsed.data.name,
            parent_id: parsed.data.parentId ?? null
        }
    });

    return json({id: categoryId}, {status: 201});
};

export const PATCH: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const body = await request.json().catch(() => null);
    const parsed = SetTargetSchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    // Get existing category data
    const catResult = await pool.query(
        `SELECT id, budget_id, name, parent_id, yearly_target FROM categories WHERE id = $1 AND budget_id = $2`,
        [parsed.data.categoryId, budgetId]
    );

    if (catResult.rows.length === 0) {
        return json({error: 'not_found'}, {status: 404});
    }

    const beforeData = catResult.rows[0];

    // Validate leaf-only rule
    try {
        await validateLeafCategory(pool, parsed.data.categoryId);
    } catch (err: any) {
        return json({error: 'validation_failed', message: String(err?.message ?? err)}, {status: 400});
    }

    // Update yearly_target
    await pool.query(
        `UPDATE categories SET yearly_target = $1 WHERE id = $2`,
        [parsed.data.yearlyTarget, parsed.data.categoryId]
    );

    // Log audit
    await logAudit(pool, {
        tableName: 'categories',
        recordId: parsed.data.categoryId,
        operation: 'UPDATE',
        changedByUserId: userId,
        beforeData,
        afterData: {...beforeData, yearly_target: parsed.data.yearlyTarget}
    });

    return json({ok: true});
};
