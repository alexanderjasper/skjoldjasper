import { createServerClient } from '@supabase/ssr';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import * as Sentry from '@sentry/sveltekit';
import { env as privateEnv } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  if (!Sentry.isInitialized()) {
    const dsn = privateEnv.SENTRY_DSN;
    if (dsn) {
      Sentry.init({ dsn, tracesSampleRate: 0.05 });
    }
  }
  
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' });
        });
      }
    }
  });

  event.locals.safeGetSession = async () => {
    const {
      data: { user },
      error
    } = await event.locals.supabase.auth.getUser();

    if (error || !user) {
      return { session: null, error };
    }

    // If user is verified, get the full session
    const {
      data: { session }
    } = await event.locals.supabase.auth.getSession();

    return { session, error: null };
  };

  const response = await resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range';
    }
  });

  return response;
};


