import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const errorDescription = url.searchParams.get('error_description');
  const authError = url.searchParams.get('error');

  if (authError) {
    console.error('Supabase OAuth callback error:', authError, errorDescription);
    throw redirect(303, '/?error=oauth');
  }

  const code = url.searchParams.get('code');

  if (!code) {
    throw redirect(303, '/');
  }

  const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Supabase session exchange failed:', error.message);
    throw redirect(303, '/?error=login');
  }

  throw redirect(303, '/');
};


