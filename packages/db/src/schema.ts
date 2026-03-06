import {
    bigserial,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    numeric,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

// User authentication tables (Lucia)
export const user = pgTable('user', {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    hashedPassword: text('hashed_password')
});

export const session = pgTable('session', {
    id: text('id').primaryKey(),
    userId: text('user_id')
        .notNull()
        .references(() => user.id),
    expiresAt: timestamp('expires_at', {withTimezone: true, mode: 'date'}).notNull()
});

// Finance domain: budgets (owned by creator, shared with members)
export const budgets = pgTable(
    'budgets',
    {
        id: text('id').primaryKey(),
        name: text('name').notNull(),
        currency: text('currency').notNull(), // ISO 4217, e.g., 'DKK'
        creatorUserId: text('creator_user_id')
            .notNull()
            .references(() => user.id),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            byCreator: index('budgets_creator_idx').on(t.creatorUserId)
        };
    }
);

// Budget membership (many-to-many: users ↔ budgets)
export const budgetMembers = pgTable(
    'budget_members',
    {
        budgetId: text('budget_id')
            .notNull()
            .references(() => budgets.id),
        userId: text('user_id')
            .notNull()
            .references(() => user.id),
        joinedAt: timestamp('joined_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            pk: primaryKey({columns: [t.budgetId, t.userId]}),
            byUser: index('budget_members_user_idx').on(t.userId)
        };
    }
);

// Categories within a budget (hierarchical: parent_id nullable for root categories)
export const categories = pgTable(
    'categories',
    {
        id: text('id').primaryKey(),
        budgetId: text('budget_id')
            .notNull()
            .references(() => budgets.id),
        name: text('name').notNull(),
        parentId: text('parent_id'), // nullable for root, self-referencing
        yearlyTarget: integer('yearly_target') // nullable, leaf categories only
    },
    (t) => {
        return {
            byBudget: index('categories_budget_idx').on(t.budgetId),
            parentRef: foreignKey({
                columns: [t.parentId],
                foreignColumns: [t.id]
            })
        };
    }
);

// Transactions (imported or manually added)
export const transactions = pgTable(
    'transactions',
    {
        id: text('id').primaryKey(), // SHA-256 hash of date|description|amount
        budgetId: text('budget_id')
            .notNull()
            .references(() => budgets.id),
        date: date('date', {mode: 'date'}).notNull(),
        description: text('description').notNull(),
        amount: numeric('amount', {precision: 15, scale: 2}).notNull(),
        note: text('note'),
        importedAt: timestamp('imported_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            byBudget: index('transactions_budget_idx').on(t.budgetId)
        };
    }
);

// Transaction splits (allocate transaction amount across multiple categories)
export const transactionSplits = pgTable(
    'transaction_splits',
    {
        transactionId: text('transaction_id')
            .notNull()
            .references(() => transactions.id),
        categoryId: text('category_id')
            .notNull()
            .references(() => categories.id),
        amount: numeric('amount', {precision: 15, scale: 2}).notNull()
    },
    (t) => {
        return {
            pk: primaryKey({columns: [t.transactionId, t.categoryId]})
        };
    }
);

// Append-only audit log for finance domain changes
export const financeAuditLog = pgTable(
    'finance_audit_log',
    {
        id: bigserial('id', {mode: 'number'}).primaryKey(),
        tableName: text('table_name').notNull(), // 'budgets', 'categories', 'transactions', 'transaction_splits'
        recordId: text('record_id').notNull(), // PK of affected row
        operation: text('operation').notNull(), // 'INSERT', 'UPDATE', 'DELETE'
        changedByUserId: text('changed_by_user_id'), // nullable for system operations
        beforeData: jsonb('before_data'), // null for INSERT
        afterData: jsonb('after_data').notNull(),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            byRecord: index('finance_audit_log_record_idx').on(t.tableName, t.recordId),
            byTimestamp: index('finance_audit_log_created_idx').on(t.createdAt)
        };
    }
);

// Game server: single current state per room
export const gameRoomStates = pgTable(
    'game_room_states',
    {
        roomId: text('room_id').primaryKey(),
        counter: integer('counter').notNull().default(0),
        updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow()
    }
);


