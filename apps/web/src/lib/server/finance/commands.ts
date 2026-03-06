import {createHash} from 'crypto';
import type {Pool} from 'pg';
import type {DuplicateWarning} from './types';

/**
 * Validate that a parent category exists and is accessible within the budget.
 * Throws if parent does not exist or is not in the same budget.
 */
export async function validateParentCategory(
    pool: Pool,
    budgetId: string,
    parentId: string | null
): Promise<void> {
    if (!parentId) {
        return; // null parent is valid (root category)
    }

    const result = await pool.query(
        'SELECT 1 FROM categories WHERE id = $1 AND budget_id = $2',
        [parentId, budgetId]
    );

    if (result.rows.length === 0) {
        throw new Error('Parent category does not exist');
    }
}

/**
 * Validate that a category has no children (leaf-only rule for yearly_target).
 * Throws if the category has any child categories.
 */
export async function validateLeafCategory(pool: Pool, categoryId: string): Promise<void> {
    const result = await pool.query('SELECT 1 FROM categories WHERE parent_id = $1', [categoryId]);

    if (result.rows.length > 0) {
        throw new Error('Cannot set target on parent category. Only leaf categories can have targets.');
    }
}

/**
 * Generate a transaction ID from date, description, and amount.
 * Uses SHA-256 hash (first 16 hex chars) to ensure deduplication across imports.
 */
export function generateTransactionId(date: string, description: string, amount: number): string {
    const hash = createHash('sha256');
    hash.update(`${date}|${description}|${amount}`);
    return hash.digest('hex').substring(0, 16);
}

/**
 * Check for duplicate transaction IDs in the database.
 * Returns list of transactions that already exist.
 */
export async function findDuplicateTransactions(
    pool: Pool,
    budgetId: string,
    transactions: Array<{ transactionId: string; date: string; description: string; amount: number }>
): Promise<DuplicateWarning[]> {
    if (transactions.length === 0) {
        return [];
    }

    const transactionIds = transactions.map((t) => t.transactionId);
    const result = await pool.query(
        `SELECT id, date, description, amount FROM transactions
         WHERE budget_id = $1 AND id = ANY($2)`,
        [budgetId, transactionIds]
    );

    const existingMap = new Map(result.rows.map((r) => [r.id, r]));
    return transactions.filter((t) => existingMap.has(t.transactionId));
}

/**
 * Validate that a transaction exists and belongs to the given budget.
 */
export async function validateTransaction(
    pool: Pool,
    transactionId: string,
    budgetId: string
): Promise<void> {
    const result = await pool.query(
        'SELECT amount FROM transactions WHERE id = $1 AND budget_id = $2',
        [transactionId, budgetId]
    );

    if (result.rows.length === 0) {
        throw new Error('Transaction does not exist');
    }
}

/**
 * Validate that all split categories exist in the budget and belong to it.
 */
export async function validateSplitCategories(
    pool: Pool,
    budgetId: string,
    categoryIds: string[]
): Promise<void> {
    if (categoryIds.length === 0) {
        return;
    }

    const result = await pool.query(
        `SELECT COUNT(*) FROM categories WHERE budget_id = $1 AND id = ANY($2)`,
        [budgetId, categoryIds]
    );

    const count = parseInt(result.rows[0].count, 10);
    if (count !== categoryIds.length) {
        throw new Error('One or more categories do not exist in this budget');
    }
}

/**
 * Validate that the sum of split amounts matches the transaction amount (±0.01 tolerance).
 */
export async function validateSplitTotal(
    pool: Pool,
    transactionId: string,
    totalSplitAmount: number
): Promise<void> {
    const result = await pool.query('SELECT amount FROM transactions WHERE id = $1', [
        transactionId
    ]);

    if (result.rows.length === 0) {
        throw new Error('Transaction does not exist');
    }

    const transactionAmount = parseFloat(result.rows[0].amount);
    const epsilon = 0.01;

    if (Math.abs(totalSplitAmount - transactionAmount) > epsilon) {
        throw new Error(
            `Splits total ${totalSplitAmount} does not match transaction amount ${transactionAmount}`
        );
    }
}

