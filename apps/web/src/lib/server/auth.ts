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
    // noinspection JSUnusedGlobalSymbols -- Lucia uses this interface via module augmentation
    interface Register {
        Lucia: typeof lucia;
        DatabaseUserAttributes: DatabaseUserAttributes;
    }

    // noinspection JSUnusedGlobalSymbols -- helper alias so IDE sees Register as referenced
    type _LuciaRegister = Register;
}

interface DatabaseUserAttributes {
    email: string;
}

