import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { getPool } from '$lib/server/db';
import { loadBudget } from '$lib/server/finance/repository';
import { assignSplits } from '$lib/server/finance/commands';
import { appendEvent } from '@skjoldjasper/shared';

const SplitsSchema = z.object({
  splits: z.array(z.object({ categoryId: z.string().min(1), amount: z.number().finite() })).min(1)
});

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const budgetId = params.budgetId as string;
  const transactionId = params.transactionId as string;
  const body = await request.json().catch(() => null);
  const parsed = SplitsSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_body' }, { status: 400 });

  const userId = locals.user?.id;
  
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  const pool = getPool();
  const state = await loadBudget(pool as any, budgetId);
  if (!state) return json({ error: 'not_found' }, { status: 404 });

  let eventPayload;
  try {
    eventPayload = assignSplits(state, transactionId, parsed.data.splits);
  } catch (err: any) {
    return json({ error: 'validation_failed', message: String(err?.message ?? err) }, { status: 400 });
  }

  await appendEvent(
    pool,
    {
      context: 'finance',
      streamCategory: 'budget',
      streamId: budgetId,
      type: 'TransactionSplitAssigned',
      version: state.version + 1,
      payload: eventPayload
    },
    { userId }
  );

  return json({ ok: true }, { status: 201 });
};
