import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  const { session, error } = await locals.safeGetSession();

  return {
    session,
    sessionError: error ? error.message : null
  };
};


