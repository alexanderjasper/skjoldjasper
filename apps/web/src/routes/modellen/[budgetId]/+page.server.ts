import type {PageServerLoad} from './$types';
import {getPool} from '$lib/server/db';
import {getBudgetDetails, getBudgetVsActual} from '$lib/server/finance/queries';
import {hasBudgetAccess} from '$lib/server/finance/access';

export const load: PageServerLoad = async ({params, locals}) => {
    const userId = locals.user?.id;
    if (!userId) return {budgetId: params.budgetId, notFound: true};

    const pool = getPool();
    const canAccess = await hasBudgetAccess(pool as any, params.budgetId as string, userId);
    if (!canAccess) return {budgetId: params.budgetId, notFound: true};

    const details = await getBudgetDetails(pool as any, params.budgetId as string);
    if (!details) return {budgetId: params.budgetId, notFound: true};
    const overview = await getBudgetVsActual(pool as any, params.budgetId as string);
    const categories = Object.fromEntries(details.categories.map((c) => [c.id, c]));
    const transactions = Object.fromEntries(
        details.transactions.map((t) => [
            t.id,
            {
                id: t.id,
                date: t.date.toISOString().slice(0, 10),
                description: t.description,
                amount: t.amount
            }
        ])
    );
    const notes = Object.fromEntries(
        details.transactions.filter((t) => (t.note ?? '').trim().length > 0).map((t) => [t.id, t.note])
    );

    return {
        budgetId: params.budgetId,
        details: {
            budgetId: params.budgetId,
            state: {
                name: details.name,
                categories,
                transactions,
                notes,
                splits: details.splits
            },
            createdAt: details.createdAt
        },
        overview
    };
};
