import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

let poolSingleton: Pool | undefined;

export function getPool(): Pool {
  if (!poolSingleton) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not set");
    poolSingleton = new Pool({ connectionString: databaseUrl });
  }
  return poolSingleton;
}

export async function endPool(): Promise<void> {
  if (poolSingleton) {
    await poolSingleton.end();
    poolSingleton = undefined;
  }
}
