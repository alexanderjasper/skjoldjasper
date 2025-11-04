import type { Pool } from 'pg';

export interface Budget {
  streamId: string;
  name: string;
  currency: string;
  createdAt: Date;
}

export interface CategoryWithTarget {
  id: string;
  budgetStreamId: string;
  name: string;
  parentId: string | null;
  yearlyTarget: string | null;
}

export interface TransactionWithDetails {
  id: string;
  budgetStreamId: string;
  date: string;
  description: string;
  amount: string;
  note: string | null;
}

export interface TransactionSplitRow {
  transactionId: string;
  categoryId: string;
  amount: string;
}

export interface CategoryActual {
  categoryId: string;
  categoryName: string;
  yearlyTarget: string | null;
  actualSpent: string;
}

export async function getBudgetsForUser(pool: Pool, userId: string): Promise<Budget[]> {
  const result = await pool.query(
    `SELECT b.stream_id, b.name, b.currency, b.created_at
     FROM budgets b
     JOIN budget_members bm ON b.stream_id = bm.budget_stream_id
     WHERE bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    streamId: row.stream_id,
    name: row.name,
    currency: row.currency,
    createdAt: row.created_at
  }));
}

export async function getBudgetDetails(pool: Pool, budgetId: string) {
  const budgetResult = await pool.query(
    `SELECT stream_id, name, currency, created_at
     FROM budgets
     WHERE stream_id = $1`,
    [budgetId]
  );

  if (budgetResult.rows.length === 0) return null;

  const categoriesResult = await pool.query(
    `SELECT id, budget_stream_id, name, parent_id, yearly_target
     FROM categories
     WHERE budget_stream_id = $1
     ORDER BY name`,
    [budgetId]
  );

  const transactionsResult = await pool.query(
    `SELECT id, budget_stream_id, date, description, amount, note
     FROM transactions
     WHERE budget_stream_id = $1
     ORDER BY date DESC`,
    [budgetId]
  );

  const splitsResult = await pool.query(
    `SELECT transaction_id, category_id, amount
     FROM transaction_splits
     WHERE transaction_id IN (SELECT id FROM transactions WHERE budget_stream_id = $1)`,
    [budgetId]
  );

  const budget: Budget = {
    streamId: budgetResult.rows[0].stream_id,
    name: budgetResult.rows[0].name,
    currency: budgetResult.rows[0].currency,
    createdAt: budgetResult.rows[0].created_at
  };

  const categories: CategoryWithTarget[] = categoriesResult.rows.map((row) => ({
    id: row.id,
    budgetStreamId: row.budget_stream_id,
    name: row.name,
    parentId: row.parent_id,
    yearlyTarget: row.yearly_target
  }));

  const transactions: TransactionWithDetails[] = transactionsResult.rows.map((row) => ({
    id: row.id,
    budgetStreamId: row.budget_stream_id,
    date: row.date,
    description: row.description,
    amount: row.amount,
    note: row.note
  }));

  const splits: TransactionSplitRow[] = splitsResult.rows.map((row) => ({
    transactionId: row.transaction_id,
    categoryId: row.category_id,
    amount: row.amount
  }));

  return { budget, categories, transactions, splits };
}

export async function getBudgetVsActual(pool: Pool, budgetId: string): Promise<CategoryActual[]> {
  const result = await pool.query(
    `SELECT 
       c.id as category_id,
       c.name as category_name,
       c.yearly_target,
       COALESCE(SUM(ts.amount), 0) as actual_spent
     FROM categories c
     LEFT JOIN transaction_splits ts ON c.id = ts.category_id
     LEFT JOIN transactions t ON ts.transaction_id = t.id
     WHERE c.budget_stream_id = $1
     GROUP BY c.id, c.name, c.yearly_target
     ORDER BY c.name`,
    [budgetId]
  );

  return result.rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    yearlyTarget: row.yearly_target,
    actualSpent: row.actual_spent
  }));
}

