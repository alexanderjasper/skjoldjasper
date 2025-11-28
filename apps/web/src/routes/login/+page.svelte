<script lang="ts">
    import {enhance} from '$app/forms';
    import type {ActionData} from './$types';

    let {form}: { form: ActionData } = $props();
</script>

<section class="mx-auto max-w-md">
    <div class="surface-panel--tight space-y-6">
        <h1 class="text-3xl font-bold text-slate-900">Log ind</h1>

        {#if form?.message}
            <div class="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                {form.message}
            </div>
        {/if}

        <form class="space-y-4" method="POST" use:enhance>
            <div>
                <label class="mb-1 block text-sm font-medium text-slate-700"
                       for="email">Email</label>
                <input
                        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        id="email"
                        name="email"
                        required
                        type="email"
                />
            </div>

            <div>
                <label class="mb-1 block text-sm font-medium text-slate-700"
                       for="password">Password</label>
                <input
                        class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        id="password"
                        name="password"
                        required
                        type="password"
                />
            </div>

            <button class="primary-button w-full py-3" type="submit">
                Log ind
            </button>
        </form>

        <p class="text-center text-sm text-slate-600">
            Har du ikke en konto? <a class="text-emerald-600 hover:text-emerald-700 font-medium"
                                     href="/register">Registrer</a>
        </p>
    </div>
</section>

