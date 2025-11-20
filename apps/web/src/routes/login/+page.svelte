<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<section class="mx-auto max-w-md">
	<div class="surface-panel--tight space-y-6">
		<h1 class="text-3xl font-bold text-white">Log ind</h1>

		{#if form?.message}
			<div class="rounded-xl border border-red-600/60 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
					class="w-full rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
				/>
			</div>

			<div>
				<label for="password" class="mb-1 block text-sm font-medium text-slate-300">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					required
					class="w-full rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-2 text-slate-100 placeholder:text-slate-500 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
				/>
			</div>

			<button type="submit" class="primary-button w-full py-3">
				Log ind
			</button>
		</form>

		<p class="text-center text-sm text-slate-400">
			Har du ikke en konto? <a href="/register" class="text-brand-400 hover:text-brand-300">Registrer</a>
		</p>
	</div>
</section>

