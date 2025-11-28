import * as dotenv from "dotenv";
import {Client} from "pg";
import {runHandler} from "./runner";
import {gameRoomViewHandler} from "./handlers/game/room";
import {financeBudgetHandler} from "./handlers/finance/budget";

dotenv.config();

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is not set");

    const handlers = [gameRoomViewHandler, financeBudgetHandler];

    const runningHandlers = handlers.map(async (h) => {
        const client = new Client({connectionString: databaseUrl});
        await client.connect();
        try {
            await runHandler(client, h);
        } finally {
            await client.end();
        }
    });

    await Promise.all(runningHandlers);
}

main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("projector failed:", err);
    process.exitCode = 1;
});
