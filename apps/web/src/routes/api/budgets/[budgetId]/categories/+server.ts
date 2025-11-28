import type {RequestHandler} from '@sveltejs/kit';
import {json} from '@sveltejs/kit';
import {z} from 'zod';
import {appendEvent} from '@skjoldjasper/shared';
import {getPool} from '$lib/server/db';
import {loadBudget} from '$lib/server/finance/repository';
import {addCategory, setCategoryTarget} from '$lib/server/finance/commands';

const AddCategorySchema = z.object({
    name: z.string().min(1),
    parentId: z.string().min(1).nullable().optional()
});

const SetTargetSchema = z.object({
    categoryId: z.string().min(1),
    yearlyTarget: z.number().finite()
});

export const POST: RequestHandler = async ({params, request, locals}) => {
    const budgetId = params.budgetId as string;
    const body = await request.json().catch(() => null);
    const parsed = AddCategorySchema.safeParse(body);
    if (!parsed.success) return json({error: 'invalid_body'}, {status: 400});

    const userId = locals.user?.id;

    if (!userId) return json({error: 'unauthorized'}, {status: 401});

    const pool = getPool();
    const state = await loadBudget(pool as any, budgetId);
    if (!state) return json({error: 'not_found'}, {status: 404});

    const categoryId = crypto.randomUUID();
    const eventPayload = addCategory(state, categoryId, parsed.data.name, parsed.data.parentId ?? null);

    await appendEvent(
        pool,
        {
            context: 'finance',
            streamCategory: 'budget',
            streamId: budgetId,
            type: 'CategoryAdded',
            version: state.version + 1,
            payload: eventPayload
        },
        {userId}
    );

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
    const state = await loadBudget(pool as any, budgetId);
    if (!state) return json({error: 'not_found'}, {status: 404});

    let eventPayload;
    try {
        eventPayload = setCategoryTarget(state, parsed.data.categoryId, parsed.data.yearlyTarget);
    } catch (err: any) {
        return json({
            error: 'validation_failed',
            message: String(err?.message ?? err)
        }, {status: 400});
    }

    await appendEvent(
        pool,
        {
            context: 'finance',
            streamCategory: 'budget',
            streamId: budgetId,
            type: 'CategoryTargetSet',
            version: state.version + 1,
            payload: eventPayload
        },
        {userId}
    );

    return json({ok: true});
};
