import type {Pool} from 'pg';

export interface AuditEntry {
    tableName: 'budgets' | 'categories' | 'transactions' | 'transaction_splits';
    recordId: string;
    operation: 'INSERT' | 'UPDATE' | 'DELETE';
    changedByUserId?: string;
    beforeData?: Record<string, unknown>;
    afterData: Record<string, unknown>;
}

/**
 * Append a row to the finance_audit_log table.
 * This is the single point of truth for auditability in the finance domain.
 * Rows are never updated or deleted.
 */
export async function logAudit(pool: Pool, entry: AuditEntry): Promise<void> {
    await pool.query(
        `INSERT INTO finance_audit_log
         (table_name, record_id, operation, changed_by_user_id, before_data, after_data)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
            entry.tableName,
            entry.recordId,
            entry.operation,
            entry.changedByUserId || null,
            entry.beforeData ? JSON.stringify(entry.beforeData) : null,
            JSON.stringify(entry.afterData)
        ]
    );
}
