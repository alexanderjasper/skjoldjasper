<script lang="ts">
  import { supabase } from '$lib/supabaseClient';

  let loading = false;
  let error = '';

  async function signInWithGithub() {
    loading = true;
    error = '';

    try {
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (signInError) {
        error = signInError.message;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error signing in';
    } finally {
      loading = false;
    }
  }
</script>

<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
  <div class="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-6 text-center shadow-lg">
    <h1 class="text-xl font-semibold">Sign in to skjoldjasper</h1>
    <p class="mt-2 text-sm text-slate-400">OAuth via GitHub (Supabase Auth)</p>

    {#if error}
      <p class="mt-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-200">{error}</p>
    {/if}

    <button
      class="mt-6 flex w-full items-center justify-center gap-2 rounded bg-emerald-500 px-4 py-2 font-medium text-slate-900 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700/50"
      on:click|preventDefault={signInWithGithub}
      disabled={loading}
    >
      {#if loading}
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" aria-hidden="true"></span>
        Redirecting...
      {:else}
        <svg class="h-5 w-5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01
            1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95
            0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0
            1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15
            0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38C13.71
            14.53 16 11.54 16 8c0-4.42-3.58-8-8-8"
          ></path>
        </svg>
        Sign in with GitHub
      {/if}
    </button>
  </div>
</div>
