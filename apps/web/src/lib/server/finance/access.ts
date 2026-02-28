import type {Pool} from 'pg';

export async function hasBudgetAccess(pool: Pool, budgetId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
        `SELECT 1
         FROM budget_members
         WHERE budget_id = $1
           AND user_id = $2`,
        [budgetId, userId]
    );
    return result.rows.length > 0;
}

