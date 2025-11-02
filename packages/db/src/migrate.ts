import * as dotenv from 'dotenv';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

// Load environment variables from a local .env in this package
dotenv.config({ path: '.env' });

async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Create packages/db/.env with a valid connection string.');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const db = drizzle(client, { logger: true });
    await migrate(db, { migrationsFolder: 'drizzle' });
    // eslint-disable-next-line no-console
    console.log('Drizzle migrations applied successfully.');
  } finally {
    await client.end();
  }
}

runMigrations().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', error);
  process.exitCode = 1;
});


