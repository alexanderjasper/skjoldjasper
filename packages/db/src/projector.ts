import {bigint, pgTable, text, timestamp} from 'drizzle-orm/pg-core';

export const projectorCheckpoints = pgTable('projector_checkpoints', {
    name: text('name').primaryKey(),
    lastPosition: bigint('last_position', {mode: 'number'}).notNull().default(0),
    updatedAt: timestamp('updated_at', {withTimezone: true}).notNull().defaultNow()
});

export const projectorAppliedEvents = pgTable('projector_applied_events', {
    handlerName: text('handler_name').notNull(),
    position: bigint('position', {mode: 'number'}).notNull(),
    createdAt: timestamp('created_at', {withTimezone: true}).notNull().defaultNow()
}, (t) => ({
    pk: {
        name: 'projector_applied_events_pk',
        columns: [t.handlerName, t.position] as const
    }
}));


