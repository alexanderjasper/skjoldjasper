<script lang="ts">
    let {data} = $props();

    const user = $derived(data.user);
    const userEmail = $derived(user?.email ?? null);
</script>

{#if !user}
    <section class="flex min-h-[60vh] items-center justify-center px-4">
        <div class="surface-panel max-w-md text-center">
            <div class="space-y-3">
                <h1 class="text-3xl font-bold text-slate-900">Velkommen til Skjold Jasper</h1>
                <p class="text-slate-600">Log ind for at fortsætte</p>
            </div>
            <div class="mt-8 flex flex-col gap-3">
                <a href="/login" class="primary-button w-full py-3">
                    Log ind
                </a>
                <a href="/register" class="secondary-button w-full py-3">
                    Opret konto
                </a>
            </div>
        </div>
    </section>
{:else}
    <section class="flex min-h-[60vh] items-center justify-center px-4">
        <div class="surface-panel--tight w-full max-w-md text-center">
            <h1 class="text-2xl font-semibold text-slate-900">Du er logget ind</h1>
            <p class="mt-2 text-slate-600">{userEmail}</p>
            <div class="mt-6 flex flex-col gap-3 sm:flex-row">
                <a href="/modellen" class="primary-button flex-1 justify-center">
                    Modellen
                </a>
            </div>
        </div>
    </section>
{/if}
