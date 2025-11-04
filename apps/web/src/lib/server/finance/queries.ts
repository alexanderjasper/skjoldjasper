import type { Pool } from 'pg';

export interface BudgetSummary {
  streamId: string;
  name: string;
  currency: string;
  createdAt: Date;
}

export interface BudgetSnapshotState {
  name: string;
  currency: string;
  creatorUserId: string;
  members: string[];
  categories: Record<string, { id: string; name: string; parentId: string | null; yearlyTarget?: number }>;
  transactions: Record<string, { id: string; date: string; description: string; amount: number }>;
  splits: Record<string, Array<{ categoryId: string; amount: number }>>;
  notes: Record<string, string>;
  version: number;
}

export interface CategoryActual {
  categoryId: string;
  categoryName: string;
  yearlyTarget?: number;
  actualSpent: number;
}

async function getLatestSnapshots(pool: Pool) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (stream_id)
       stream_id,
       payload,
       created_at
     FROM aggregate_snapshots
     WHERE context = 'finance' AND stream_category = 'budget'
     ORDER BY stream_id, version DESC`
  );
  return rows as Array<{ stream_id: string; payload: any; created_at: Date }>;
}

export async function getBudgetsForUser(pool: Pool, userId: string): Promise<BudgetSummary[]> {
  const rows = await getLatestSnapshots(pool);
  const results: BudgetSummary[] = [];
  for (const r of rows) {
    const state = r.payload as BudgetSnapshotState;
    if (Array.isArray(state.members) && state.members.includes(userId)) {
      results.push({
        streamId: r.stream_id,
        name: state.name,
        currency: state.currency,
        createdAt: r.created_at
      });
    }
  }
  return results;
}

export async function getBudgetDetails(pool: Pool, budgetId: string) {
  const { rows } = await pool.query(
    `SELECT payload, created_at
     FROM aggregate_snapshots
     WHERE context = 'finance' AND stream_category = 'budget' AND stream_id = $1
     ORDER BY version DESC
     LIMIT 1`,
    [budgetId]
  );
  if (rows.length === 0) return null;
  const state = rows[0].payload as BudgetSnapshotState;
  return { budgetId, state, createdAt: rows[0].created_at as Date };
}

export async function getBudgetVsActual(pool: Pool, budgetId: string): Promise<CategoryActual[]> {
  const details = await getBudgetDetails(pool, budgetId);
  if (!details) return [];
  const { state } = details;

  const actualByCategory = new Map<string, number>();
  for (const [txId, splits] of Object.entries(state.splits || {})) {
    for (const split of splits) {
      actualByCategory.set(split.categoryId, (actualByCategory.get(split.categoryId) ?? 0) + Number(split.amount));
    }
  }

  const results: CategoryActual[] = [];
  for (const [catId, cat] of Object.entries(state.categories || {})) {
    results.push({
      categoryId: catId,
      categoryName: cat.name,
      yearlyTarget: cat.yearlyTarget,
      actualSpent: actualByCategory.get(catId) ?? 0
    });
  }
  results.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  return results;
}

