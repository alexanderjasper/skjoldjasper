import type {PageServerLoad} from './$types';
import {getPool} from '$lib/server/db';
import {getBudgetsForUser} from '$lib/server/finance/queries';

export const load: PageServerLoad = async ({locals}) => {
    const userId = locals.user?.id;
    if (!userId) return {budgets: []};

    const pool = getPool();
    const budgets = await getBudgetsForUser(pool as any, userId);
    return {budgets};
};
