<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';

	let { children, data } = $props();

	const user = $derived(data.user);
	const userEmail = $derived(user?.email ?? null);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-100">
  <header class="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
    <div class="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
      <a href="/" class="text-lg font-semibold text-emerald-400">skjoldjasper</a>

			<div class="flex items-center gap-3 text-sm">
				{#if user && userEmail}
					<span class="hidden text-slate-300 sm:inline">Signed in as {userEmail}</span>
					<form method="POST" action="/logout">
						<button
							type="submit"
							class="rounded bg-slate-200 px-3 py-1 font-medium text-slate-900 transition hover:bg-white/80"
						>
							Sign out
						</button>
					</form>
				{:else}
					<a
						href="/login"
						class="rounded bg-emerald-500 px-3 py-1 font-medium text-slate-900 transition hover:bg-emerald-400"
					>
						Sign in
					</a>
				{/if}
			</div>
    </div>
  </header>

	<main class="mx-auto max-w-4xl px-4 py-10">
    {@render children()}
  </main>
</div>

<style src="../app.css"></style>
