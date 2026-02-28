import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {getPool} from '$lib/server/db';
import {logAudit} from '$lib/server/finance/audit';
import {validateParentCategory, validateLeafCategory} from '$lib/server/finance/commands';
import {hasBudgetAccess} from '$lib/server/finance/access';

const AddCategorySchema = z.object({
    name: z.string().min(1),
    parentId: z.string().min(1).nullable().optional(),
    confirmWipeParentGoal: z.boolean().optional()
});

const SetTargetSchema = z.object({
    categoryId: z.string().min(1),
    yearlyTarget: z.number()
});

const EditCategorySchema = z.object({
    categoryId: z.string().min(1),
    name: z.string().min(1),
    parentId: z.string().min(1).nullable(),
    confirmWipeParentGoal: z.boolean().optional()
});

const DeleteCategorySchema = z.object({
    categoryId: z.string().min(1),
    confirmDeleteWithChildren: z.boolean().optional(),
    confirmDeleteWithSplits: z.boolean().optional()
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

    let parentBeforeData: any = null;
    let wipeParentGoal = false;
    if (parsed.data.parentId) {
        const parentResult = await pool.query(
            `SELECT id, budget_id, name, parent_id, yearly_target FROM categories WHERE id = $1 AND budget_id = $2`,
            [parsed.data.parentId, budgetId]
        );
        if (parentResult.rows.length > 0) {
            parentBeforeData = parentResult.rows[0];
            const hasParentGoal =
                parentBeforeData.yearly_target !== null && parentBeforeData.yearly_target !== undefined;
            if (hasParentGoal && !parsed.data.confirmWipeParentGoal) {
                return json(
                    {
                        error: 'parent_goal_will_be_removed',
                        message: 'Forældrekategori har et mål, som vil blive fjernet',
                        parentCategoryId: parentBeforeData.id,
                        parentCategoryName: parentBeforeData.name
                    },
                    {status: 409}
                );
            }
            wipeParentGoal = hasParentGoal && !!parsed.data.confirmWipeParentGoal;
        }
    }

    if (wipeParentGoal && parentBeforeData) {
        await pool.query(`UPDATE categories SET yearly_target = NULL WHERE id = $1 AND budget_id = $2`, [
            parentBeforeData.id,
            budgetId
        ]);
        await logAudit(pool, {
            tableName: 'categories',
            recordId: parentBeforeData.id,
            operation: 'UPDATE',
            changedByUserId: userId,
            beforeData: parentBeforeData,
            afterData: {...parentBeforeData, yearly_target: null}
        });
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

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    if (body && typeof body === 'object' && 'yearlyTarget' in body) {
        const parsed = SetTargetSchema.safeParse(body);
        if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

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
    }

    const parsed = EditCategorySchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const catResult = await pool.query(
        `SELECT id, budget_id, name, parent_id, yearly_target FROM categories WHERE id = $1 AND budget_id = $2`,
        [parsed.data.categoryId, budgetId]
    );

    if (catResult.rows.length === 0) {
        return json({error: 'not_found'}, {status: 404});
    }
    const beforeData = catResult.rows[0];

    if (parsed.data.parentId === parsed.data.categoryId) {
        return json({error: 'validation_failed', message: 'Kategori kan ikke være sin egen forælder'}, {status: 400});
    }

    try {
        await validateParentCategory(pool, budgetId, parsed.data.parentId);
    } catch (err: any) {
        return json({error: 'validation_failed', message: String(err?.message ?? err)}, {status: 400});
    }

    if (parsed.data.parentId) {
        const descendantsResult = await pool.query(
            `WITH RECURSIVE descendants AS (
                SELECT id FROM categories WHERE parent_id = $1 AND budget_id = $2
                UNION ALL
                SELECT c.id
                FROM categories c
                INNER JOIN descendants d ON c.parent_id = d.id
                WHERE c.budget_id = $2
            )
            SELECT id FROM descendants`,
            [parsed.data.categoryId, budgetId]
        );
        const descendantIds = new Set(descendantsResult.rows.map((r) => r.id));
        if (descendantIds.has(parsed.data.parentId)) {
            return json(
                {error: 'validation_failed', message: 'Kategori kan ikke flyttes under en underkategori'},
                {status: 400}
            );
        }
    }

    let parentBeforeData: any = null;
    let wipeParentGoal = false;
    if (parsed.data.parentId) {
        const parentResult = await pool.query(
            `SELECT id, budget_id, name, parent_id, yearly_target FROM categories WHERE id = $1 AND budget_id = $2`,
            [parsed.data.parentId, budgetId]
        );
        if (parentResult.rows.length > 0) {
            parentBeforeData = parentResult.rows[0];
            const hasParentGoal =
                parentBeforeData.yearly_target !== null && parentBeforeData.yearly_target !== undefined;
            if (hasParentGoal && !parsed.data.confirmWipeParentGoal) {
                return json(
                    {
                        error: 'parent_goal_will_be_removed',
                        message: 'Forældrekategori har et mål, som vil blive fjernet',
                        parentCategoryId: parentBeforeData.id,
                        parentCategoryName: parentBeforeData.name
                    },
                    {status: 409}
                );
            }
            wipeParentGoal = hasParentGoal && !!parsed.data.confirmWipeParentGoal;
        }
    }

    if (wipeParentGoal && parentBeforeData) {
        await pool.query(`UPDATE categories SET yearly_target = NULL WHERE id = $1 AND budget_id = $2`, [
            parentBeforeData.id,
            budgetId
        ]);
        await logAudit(pool, {
            tableName: 'categories',
            recordId: parentBeforeData.id,
            operation: 'UPDATE',
            changedByUserId: userId,
            beforeData: parentBeforeData,
            afterData: {...parentBeforeData, yearly_target: null}
        });
    }

    await pool.query(`UPDATE categories SET name = $1, parent_id = $2 WHERE id = $3 AND budget_id = $4`, [
        parsed.data.name,
        parsed.data.parentId,
        parsed.data.categoryId,
        budgetId
    ]);

    await logAudit(pool, {
        tableName: 'categories',
        recordId: parsed.data.categoryId,
        operation: 'UPDATE',
        changedByUserId: userId,
        beforeData,
        afterData: {...beforeData, name: parsed.data.name, parent_id: parsed.data.parentId}
    });

    return json({ok: true});
};

export const DELETE: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const body = await request.json().catch(() => null);
    const parsed = DeleteCategorySchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;
    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool, budgetId, userId);
    if (!canAccess) return json({error: 'forbidden'}, {status: 403});

    const descendantsResult = await pool.query(
        `WITH RECURSIVE tree AS (
            SELECT id, name FROM categories WHERE id = $1 AND budget_id = $2
            UNION ALL
            SELECT c.id, c.name
            FROM categories c
            INNER JOIN tree t ON c.parent_id = t.id
            WHERE c.budget_id = $2
        )
        SELECT id, name FROM tree`,
        [parsed.data.categoryId, budgetId]
    );

    if (descendantsResult.rows.length === 0) {
        return json({error: 'not_found'}, {status: 404});
    }

    const categoryIds = descendantsResult.rows.map((r) => r.id);
    const descendantCount = Math.max(0, categoryIds.length - 1);

    const splitsResult = await pool.query(
        `SELECT transaction_id, category_id, amount
         FROM transaction_splits
         WHERE category_id = ANY($1)`,
        [categoryIds]
    );
    const splitCount = splitsResult.rows.length;

    if (descendantCount > 0 && !parsed.data.confirmDeleteWithChildren) {
        return json(
            {
                error: 'category_delete_requires_confirmation',
                message: 'Kategorien har underkategorier som også bliver slettet',
                descendantCount,
                splitCount
            },
            {status: 409}
        );
    }
    if (splitCount > 0 && !parsed.data.confirmDeleteWithSplits) {
        return json(
            {
                error: 'category_delete_requires_confirmation',
                message: 'Kategorien er brugt i opdelinger som bliver fjernet',
                descendantCount,
                splitCount
            },
            {status: 409}
        );
    }

    await pool.query(`DELETE FROM transaction_splits WHERE category_id = ANY($1)`, [categoryIds]);

    for (const split of splitsResult.rows) {
        await logAudit(pool, {
            tableName: 'transaction_splits',
            recordId: `${split.transaction_id}:${split.category_id}`,
            operation: 'DELETE',
            changedByUserId: userId,
            beforeData: split,
            afterData: split
        });
    }

    for (const cat of descendantsResult.rows) {
        await logAudit(pool, {
            tableName: 'categories',
            recordId: cat.id,
            operation: 'DELETE',
            changedByUserId: userId,
            beforeData: cat,
            afterData: cat
        });
    }

    await pool.query(`DELETE FROM categories WHERE id = ANY($1) AND budget_id = $2`, [categoryIds, budgetId]);

    return json({ok: true, deletedCategories: categoryIds.length, deletedSplits: splitCount});
};
