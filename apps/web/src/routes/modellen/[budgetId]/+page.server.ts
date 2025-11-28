import type {PageServerLoad} from './$types';
import {getPool} from '$lib/server/db';
import {getBudgetDetails, getBudgetVsActual} from '$lib/server/finance/queries';

export const load: PageServerLoad = async ({params}) => {
    const pool = getPool();
    const details = await getBudgetDetails(pool as any, params.budgetId as string);
    if (!details) return {budgetId: params.budgetId, notFound: true};
    const overview = await getBudgetVsActual(pool as any, params.budgetId as string);
    return {
        budgetId: params.budgetId,
        details: {
            budgetId: params.budgetId,
            state: details.state,
            createdAt: details.createdAt
        },
        overview
    };
};
