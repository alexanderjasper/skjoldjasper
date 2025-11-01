import type { Session, AuthError } from '@supabase/supabase-js';
import type { createSupabaseServerClient } from '@supabase/auth-helpers-sveltekit';

type SupabaseServerClient = ReturnType<typeof createSupabaseServerClient>;

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseServerClient;
			safeGetSession: () => Promise<{
				session: Session | null;
				error: AuthError | null;
			}>;
		}
		interface PageData {
			session: Session | null;
			sessionError: string | null;
		}
	}
}

export {};
