import * as dotenv from "dotenv";
dotenv.config();

import { Client } from "pg";
import { runHandler } from "./runner";
import { gameRoomViewHandler } from "./handlers/game/room";
import { financeBudgetHandler } from "./handlers/finance/budget";

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const handlers = [gameRoomViewHandler, financeBudgetHandler];
    for (const h of handlers) {
      await runHandler(client, h);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("projector failed:", err);
  process.exitCode = 1;
});
