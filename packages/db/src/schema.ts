import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  streamId: text('stream_id').notNull(),
  version: integer('version').notNull(),
  type: text('type').notNull(),
  payload: text('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow()
});


