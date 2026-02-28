import 'dotenv/config';
import {Client} from 'pg';
import {execSync} from 'node:child_process';

async function main(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set');
    }

    const client = new Client({connectionString: databaseUrl});
    await client.connect();
    try {
        await client.query('DROP SCHEMA IF EXISTS public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO CURRENT_USER');
    } finally {
        await client.end();
    }

    execSync('pnpm --dir packages/db migrate:push', {stdio: 'inherit'});
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

