<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { children, data } = $props();

	const user = $derived(data.user);
	const userEmail = $derived(user?.email ?? null);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen">
  <header class="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur">
    <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
      <a href="/" class="text-lg font-semibold tracking-tight text-emerald-400">Skjold Jasper</a>

			<div class="flex items-center gap-3 text-sm text-slate-300">
				{#if user && userEmail}
					<span class="hidden sm:inline">Logget ind som {userEmail}</span>
					<form method="POST" action="/logout">
						<button type="submit" class="secondary-button px-3 py-1">
							Log ud
						</button>
					</form>
				{:else}
					<a href="/login" class="primary-button px-3 py-1">
						Log ind
					</a>
				{/if}
			</div>
    </div>
  </header>

	<main class="mx-auto max-w-5xl px-4 py-12">
    {@render children()}
  </main>
</div>
