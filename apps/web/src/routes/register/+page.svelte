<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<div class="mx-auto max-w-md">
	<h1 class="mb-8 text-3xl font-bold">Opret konto</h1>

	{#if form?.message}
		<div class="mb-4 rounded bg-red-900/40 p-3 text-sm text-red-200">
			{form.message}
		</div>
	{/if}

	<form method="POST" use:enhance class="space-y-4">
		<div>
			<label for="email" class="mb-1 block text-sm font-medium text-slate-300">Email</label>
			<input
				type="email"
				id="email"
				name="email"
				required
				class="w-full rounded bg-slate-800 px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
			/>
		</div>

		<div>
			<label for="password" class="mb-1 block text-sm font-medium text-slate-300">Password</label>
			<input
				type="password"
				id="password"
				name="password"
				required
				minlength="8"
				class="w-full rounded bg-slate-800 px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
			/>
			<p class="mt-1 text-xs text-slate-400">Minimum 8 tegn</p>
		</div>

		<button
			type="submit"
			class="w-full rounded bg-emerald-500 px-4 py-2 font-medium text-slate-900 transition hover:bg-emerald-400"
		>
			Opret konto
		</button>
	</form>

	<p class="mt-4 text-center text-sm text-slate-400">
		Har du allerede en konto? <a href="/login" class="text-emerald-400 hover:underline">Log ind</a>
	</p>
</div>

