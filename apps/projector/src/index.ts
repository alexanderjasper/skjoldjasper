import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ now: string }>("SELECT now() as now");
    // eslint-disable-next-line no-console
    console.log("projector connected; now=", rows[0]?.now);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("projector failed:", err);
  process.exitCode = 1;
});
