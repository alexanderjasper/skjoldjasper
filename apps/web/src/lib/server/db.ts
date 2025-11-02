import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { env } from '$env/dynamic/private';

let poolSingleton: Pool | undefined;
let dbSingleton: NodePgDatabase | undefined;

export function getDb(): NodePgDatabase {
  if (!dbSingleton) {
    const databaseUrl = env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }
    poolSingleton = new Pool({ connectionString: databaseUrl });
    dbSingleton = drizzle(poolSingleton);
  }
  return dbSingleton;
}

export function getPool(): Pool {
  if (!poolSingleton) {
    void getDb();
  }
  return poolSingleton!;
}


