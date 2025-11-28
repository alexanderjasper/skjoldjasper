import {
    bigserial,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
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

// Append-only global event log supporting multiple bounded contexts.
export const events = pgTable(
    'events',
    {
        // Global ordering across all contexts
        position: bigserial('position', {mode: 'number'}).primaryKey(),

        // Idempotency key per event
        eventId: uuid('event_id').notNull(),

        // Logical partitioning (bounded context and stream category)
        context: text('context').notNull(), // e.g., 'demo', 'billing'
        streamCategory: text('stream_category').notNull(), // e.g., 'entity', 'user'

        // Aggregate stream identity + version for optimistic concurrency
        streamId: text('stream_id').notNull(),
        version: integer('version').notNull(),

        // Event payload
        type: text('type').notNull(),
        payload: jsonb('payload').notNull(),
        metadata: jsonb('metadata').notNull().default({}),

        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            // Ensure single writer per version
            streamVersionUnique: uniqueIndex('events_stream_version_uidx').on(t.streamId, t.version),
            // Idempotency unique
            eventIdUnique: uniqueIndex('events_event_id_uidx').on(t.eventId),
            // Common filters
            byContextCategoryCreated: index('events_ctx_cat_created_idx').on(t.context, t.streamCategory, t.createdAt),
            byStreamId: index('events_stream_id_idx').on(t.streamId),
            byType: index('events_type_idx').on(t.type)
        };
    }
);

// Periodic snapshots per stream accelerate rebuilds.
export const aggregateSnapshots = pgTable(
    'aggregate_snapshots',
    {
        context: text('context').notNull(),
        streamCategory: text('stream_category').notNull(),
        streamId: text('stream_id').notNull(),
        version: integer('version').notNull(),
        payload: jsonb('payload').notNull(),
        createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
    },
    (t) => {
        return {
            // One snapshot per stream version
            snapshotUnique: uniqueIndex('aggregate_snapshots_stream_version_uidx').on(t.context, t.streamCategory, t.streamId, t.version),
            byStream: index('aggregate_snapshots_stream_idx').on(t.context, t.streamCategory, t.streamId)
        };
    }
);


