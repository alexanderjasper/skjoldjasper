import type {Pool} from 'pg';

export interface BudgetSummary {
    id: string;
    name: string;
    currency: string;
    createdAt: Date;
}

export interface Category {
    id: string;
    name: string;
    parentId: string | null;
    yearlyTarget?: number;
}

export interface Transaction {
    id: string;
    date: Date;
    description: string;
    amount: number;
    note?: string;
}

export interface TransactionSplit {
    categoryId: string;
    amount: number;
}

export interface BudgetDetails {
    id: string;
    name: string;
    currency: string;
    creatorUserId: string;
    createdAt: Date;
    members: string[];
    categories: Category[];
    transactions: Transaction[];
    splits: Record<string, TransactionSplit[]>;
}

export interface CategoryActual {
    categoryId: string;
    categoryName: string;
    parentId: string | null;
    yearlyTarget?: number;
    actualSpent: number;
}

/**
 * Get all budgets accessible to a given user (via budget_members).
 */
export async function getBudgetsForUser(pool: Pool, userId: string): Promise<BudgetSummary[]> {
    const result = await pool.query(
        `SELECT b.id, b.name, b.currency, b.created_at
         FROM budgets b
         INNER JOIN budget_members bm ON b.id = bm.budget_id
         WHERE bm.user_id = $1
         ORDER BY b.created_at DESC`,
        [userId]
    );

    return result.rows.map((r) => ({
        id: r.id,
        name: r.name,
        currency: r.currency,
        createdAt: new Date(r.created_at)
    }));
}

/**
 * Get full budget details: budget metadata, categories, transactions, splits.
 */
export async function getBudgetDetails(
    pool: Pool,
    budgetId: string
): Promise<BudgetDetails | null> {
    // Load budget
    const budgetResult = await pool.query(
        `SELECT id, name, currency, creator_user_id, created_at FROM budgets WHERE id = $1`,
        [budgetId]
    );

    if (budgetResult.rows.length === 0) {
        return null;
    }

    const b = budgetResult.rows[0];

    // Load budget members
    const membersResult = await pool.query(`SELECT user_id FROM budget_members WHERE budget_id = $1`, [
        budgetId
    ]);
    const members = membersResult.rows.map((r) => r.user_id);

    // Load categories
    const categoriesResult = await pool.query(
        `SELECT id, name, parent_id, yearly_target FROM categories WHERE budget_id = $1`,
        [budgetId]
    );

    // Load transactions
    const transactionsResult = await pool.query(
        `SELECT id, date, description, amount, note FROM transactions WHERE budget_id = $1 ORDER BY date`,
        [budgetId]
    );

    // Load transaction splits
    const splitsResult = await pool.query(
        `SELECT transaction_id, category_id, amount FROM transaction_splits WHERE transaction_id = ANY
         (SELECT id FROM transactions WHERE budget_id = $1)`,
        [budgetId]
    );

    const splitsMap = new Map<string, TransactionSplit[]>();
    for (const s of splitsResult.rows) {
        if (!splitsMap.has(s.transaction_id)) {
            splitsMap.set(s.transaction_id, []);
        }
        splitsMap.get(s.transaction_id)!.push({
            categoryId: s.category_id,
            amount: parseFloat(s.amount)
        });
    }

    const splits = Object.fromEntries(splitsMap.entries());

    return {
        id: b.id,
        name: b.name,
        currency: b.currency,
        creatorUserId: b.creator_user_id,
        createdAt: new Date(b.created_at),
        members,
        categories: categoriesResult.rows.map((r) => ({
            id: r.id,
            name: r.name,
            parentId: r.parent_id,
            yearlyTarget: r.yearly_target
        })),
        transactions: transactionsResult.rows.map((r) => ({
            id: r.id,
            date: new Date(r.date),
            description: r.description,
            amount: parseFloat(r.amount),
            note: r.note
        })),
        splits
    };
}

/**
 * Calculate actual spending per category (from transaction_splits).
 * Returns a tree view with parent-child relationships.
 */
export async function getBudgetVsActual(pool: Pool, budgetId: string): Promise<CategoryActual[]> {
    // Load all categories
    const categoriesResult = await pool.query(
        `SELECT id, name, parent_id, yearly_target FROM categories WHERE budget_id = $1`,
        [budgetId]
    );

    // Load all transaction splits for this budget
    const splitsResult = await pool.query(
        `SELECT ts.category_id, ts.amount
         FROM transaction_splits ts
         INNER JOIN transactions t ON ts.transaction_id = t.id
         WHERE t.budget_id = $1`,
        [budgetId]
    );

    // Calculate actual per category
    const actualByCategory = new Map<string, number>();
    for (const s of splitsResult.rows) {
        actualByCategory.set(
            s.category_id,
            (actualByCategory.get(s.category_id) ?? 0) + parseFloat(s.amount)
        );
    }

    // Build result list
    const results: CategoryActual[] = categoriesResult.rows.map((r) => ({
        categoryId: r.id,
        categoryName: r.name,
        parentId: r.parent_id,
        yearlyTarget: r.yearly_target,
        actualSpent: actualByCategory.get(r.id) ?? 0
    }));

    return results;
}

