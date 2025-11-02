import { Pool } from 'pg';

let poolSingleton: Pool | undefined;

export function getPool(): Pool {
  if (!poolSingleton) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is not set');
    poolSingleton = new Pool({ connectionString: databaseUrl });
  }
  return poolSingleton;
}


