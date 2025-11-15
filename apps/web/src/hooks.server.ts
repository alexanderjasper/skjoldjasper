import * as Sentry from '@sentry/sveltekit';
import { env as privateEnv } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { lucia } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (!Sentry.isInitialized()) {
		const dsn = privateEnv.SENTRY_DSN;
		if (dsn) {
			Sentry.init({ dsn, tracesSampleRate: 0.05 });
		}
	}

	const sessionId = event.cookies.get(lucia.sessionCookieName);
	if (!sessionId) {
		event.locals.user = null;
		event.locals.session = null;
		return resolve(event);
	}

	const { session, user } = await lucia.validateSession(sessionId);
	if (session && session.fresh) {
		const sessionCookie = lucia.createSessionCookie(session.id);
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	if (!session) {
		const sessionCookie = lucia.createBlankSessionCookie();
		event.cookies.set(sessionCookie.name, sessionCookie.value, {
			path: '.',
			...sessionCookie.attributes
		});
	}
	event.locals.user = user;
	event.locals.session = session;

	return resolve(event);
};


