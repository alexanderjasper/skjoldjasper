<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';

  let { children, data } = $props();

  let session = $state(data.session ?? null);
  let sessionError = $state(data.sessionError ?? null);
  const userEmail = $derived(session?.user?.email ?? null);

  $effect(() => {
    session = data.session ?? null;
    sessionError = data.sessionError ?? null;
  });

  onMount(async () => {
    // Client-side fallback to ensure UI reflects current auth state
    const { data: s } = await supabase.auth.getSession();
    if (s.session) {
      session = s.session;
    }
    supabase.auth.onAuthStateChange((_event, newSession) => {
      session = newSession;
    });
  });

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <header class="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
    <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
      <a href="/" class="text-lg font-semibold text-emerald-400">skjoldjasper</a>

      <div class="flex items-center gap-3 text-sm">
        {#if session && userEmail}
          <span class="hidden text-slate-300 sm:inline">Signed in as {userEmail}</span>
          <button
            type="button"
            class="rounded bg-slate-200 px-3 py-1 font-medium text-slate-900 transition hover:bg-white/80"
            onclick={signOut}
          >
            Sign out
          </button>
        {:else}
          <a
            href="/"
            class="rounded bg-emerald-500 px-3 py-1 font-medium text-slate-900 transition hover:bg-emerald-400"
          >
            Sign in
          </a>
        {/if}
      </div>
    </div>
  </header>

  {#if sessionError}
    <div class="bg-red-900/40 px-4 py-2 text-center text-sm text-red-200">
      Session error: {sessionError}
    </div>
  {/if}

  <main class="mx-auto max-w-4xl px-4 py-10">
    {@render children()}
  </main>
</div>

<style src="../app.css"></style>
