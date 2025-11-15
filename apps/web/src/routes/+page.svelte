<script lang="ts">
	let { data } = $props();

	const user = $derived(data.user);
	const userEmail = $derived(user?.email ?? null);
</script>

{#if !user}
	<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
		<div class="mx-auto max-w-md rounded-lg bg-slate-900 p-8 text-center shadow-xl">
			<h1 class="mb-4 text-2xl font-bold">Velkommen til skjoldjasper</h1>
			<p class="mb-8 text-slate-300">Log ind for at fortsætte</p>

			<div class="flex flex-col gap-3">
				<a
					href="/login"
					class="w-full rounded bg-emerald-500 px-6 py-3 font-medium text-slate-900 transition hover:bg-emerald-400"
				>
					Log ind
				</a>
				<a
					href="/register"
					class="w-full rounded bg-slate-700 px-6 py-3 font-medium text-slate-100 transition hover:bg-slate-600"
				>
					Opret konto
				</a>
			</div>
		</div>
	</div>
{:else}
	<div class="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-100">
		<div class="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center shadow-lg">
			<h1 class="text-xl font-semibold">Du er logget ind</h1>
			<p class="mt-2 text-slate-400">{userEmail}</p>
			<div class="mt-6 flex gap-3">
				<a
					href="/modellen"
					class="flex-1 rounded bg-emerald-500 px-4 py-2 font-medium text-slate-900 transition hover:bg-emerald-400"
				>
					Budgetter
				</a>
				<a
					href="/rooms"
					class="flex-1 rounded bg-slate-700 px-4 py-2 font-medium text-slate-100 transition hover:bg-slate-600"
				>
					Rum
				</a>
			</div>
		</div>
	</div>
{/if}
