import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getPool } from '$lib/server/db';
import { parseDanishBankCsv } from '$lib/server/finance/csvParser';
import { loadBudget } from '$lib/server/finance/repository';
import { importTransactions } from '$lib/server/finance/commands';

export const POST: RequestHandler = async ({ params, request, url, locals }) => {
  const budgetId = params.budgetId as string;
  const { session } = (await locals.safeGetSession?.()) ?? { session: null };
  const userId = session?.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  const text = await request.text();
  if (!text || text.trim().length === 0) return json({ error: 'empty_body' }, { status: 400 });

  const pool = getPool();
  const state = await loadBudget(pool as any, budgetId);
  if (!state) return json({ error: 'not_found' }, { status: 404 });

  let parsed;
  try {
    parsed = parseDanishBankCsv(text);
  } catch (err: any) {
    return json({ error: 'parse_error', message: String(err?.message ?? err) }, { status: 400 });
  }

  const { event, duplicates } = importTransactions(state, parsed);

  const confirm = url.searchParams.get('confirm') === '1';
  if (duplicates.length > 0 && !confirm) {
    return json(
      {
        duplicates,
        newCount: event.transactions.length,
        message: 'duplicates_found_confirm_to_proceed'
      },
      { status: 409 }
    );
  }

  if (event.transactions.length === 0) {
    return json({ imported: 0, duplicates: duplicates.length });
  }

  await (await import('@skjoldjasper/shared')).appendEvent(
    pool,
    {
      context: 'finance',
      streamCategory: 'budget',
      streamId: budgetId,
      type: 'TransactionsImported',
      version: state.version + 1,
      payload: event
    },
    { userId }
  );

  return json({ imported: event.transactions.length, duplicates: duplicates.length }, { status: 201 });
};
