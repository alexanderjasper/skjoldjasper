import {fail, redirect} from '@sveltejs/kit';
import type {Actions, PageServerLoad} from './$types';
import {lucia} from '$lib/server/auth';
import {hashPassword} from '$lib/server/password';
import {drizzle} from 'drizzle-orm/node-postgres';
import {eq} from 'drizzle-orm';
import {getPool} from '$lib/server/db';
import {user} from '@skjoldjasper/db';
import {generateIdFromEntropySize} from 'lucia';

export const load: PageServerLoad = async ({locals}) => {
    if (locals.user) {
        throw redirect(302, '/');
    }
    return {};
};

export const actions: Actions = {
    default: async ({request, cookies}) => {
        const formData = await request.formData();
        const email = formData.get('email');
        const password = formData.get('password');

        if (typeof email !== 'string' || !email || typeof password !== 'string' || !password) {
            return fail(400, {message: 'Ugyldig email eller adgangskode'});
        }

        if (password.length < 8) {
            return fail(400, {message: 'Adgangskode skal være mindst 8 tegn'});
        }

        const pool = getPool();
        const db = drizzle(pool);

        const existingUser = await db
            .select()
            .from(user)
            .where(eq(user.email, email.toLowerCase()))
            .limit(1);

        if (existingUser.length > 0) {
            return fail(400, {message: 'Email er allerede registreret'});
        }

        const userId = generateIdFromEntropySize(10);
        const passwordHash = await hashPassword(password);

        await db.insert(user).values({
            id: userId,
            email: email.toLowerCase(),
            hashedPassword: passwordHash
        });

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);
        cookies.set(sessionCookie.name, sessionCookie.value, {
            path: '.',
            ...sessionCookie.attributes
        });

        throw redirect(302, '/');
    }
};

