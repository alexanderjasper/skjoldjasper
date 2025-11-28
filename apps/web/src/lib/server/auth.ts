import {Lucia} from 'lucia';
import {DrizzlePostgreSQLAdapter} from '@lucia-auth/adapter-drizzle';
import {getPool} from './db';
import {drizzle} from 'drizzle-orm/node-postgres';
import {session, user} from '@skjoldjasper/db';
import {dev} from '$app/environment';

const pool = getPool();
const db = drizzle(pool);

const adapter = new DrizzlePostgreSQLAdapter(db, session, user);

export const lucia = new Lucia(adapter, {
    sessionCookie: {
        attributes: {
            secure: !dev
        }
    },
    getUserAttributes: (attributes) => {
        return {
            email: attributes.email
        };
    }
});

declare module 'lucia' {
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }
}

interface DatabaseUserAttributes {
    email: string;
}

