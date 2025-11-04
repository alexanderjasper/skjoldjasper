import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { appendEvent } from '@skjoldjasper/shared';
import { getPool } from '$lib/server/db';

const CreateBudgetSchema = z.object({ name: z.string().min(1), currency: z.string().min(1) });

export const GET: RequestHandler = async ({ locals }) => {
  const { session } = (await locals.safeGetSession?.()) ?? { session: null };
  const userId = session?.user?.id;
  if (!userId) return json({ budgets: [] });

  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (stream_id) stream_id, payload, created_at
     FROM aggregate_snapshots
     WHERE context = 'finance' AND stream_category = 'budget'
     ORDER BY stream_id, version DESC`
  );

  const budgets = rows
    .map((r) => ({ id: r.stream_id as string, payload: r.payload as any, createdAt: r.created_at as string }))
    .filter((r) => Array.isArray(r.payload?.members) && r.payload.members.includes(userId))
    .map((r) => ({ id: r.id, name: r.payload.name as string, currency: r.payload.currency as string, createdAt: r.createdAt }));

  return json({ budgets });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json().catch(() => null);
  const parsed = CreateBudgetSchema.safeParse(body);
  if (!parsed.success) return json({ error: 'invalid_body' }, { status: 400 });

  const { session } = (await locals.safeGetSession?.()) ?? { session: null };
  const userId = session?.user?.id;
  if (!userId) return json({ error: 'unauthorized' }, { status: 401 });

  const pool = getPool();
  const budgetId = `budget-${crypto.randomUUID()}`;

  await appendEvent(
    pool,
    {
      context: 'finance',
      streamCategory: 'budget',
      streamId: budgetId,
      type: 'BudgetCreated',
      version: 0,
      payload: { name: parsed.data.name, currency: parsed.data.currency, creatorUserId: userId }
    },
    { userId }
  );

  return json({ id: budgetId }, { status: 201 });
};
