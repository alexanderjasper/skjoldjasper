<script lang="ts">
  export let data: { budgets: Array<{ streamId: string; name: string; currency: string; createdAt: Date | string }> };

  let name = '';
  let currency = 'DKK';
  let loading = false;
  let error = '';

  async function createBudget() {
    error = '';
    const trimmed = name.trim();
    if (!trimmed) {
      error = 'Navn er påkrævet';
      return;
    }
    loading = true;
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: trimmed, currency })
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? 'Kunne ikke oprette budget');
      }
      const { id } = await res.json();
      window.location.href = `/modellen/${encodeURIComponent(id)}`;
    } catch (e: any) {
      error = e?.message ?? 'Ukendt fejl';
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-3xl mx-auto p-4 space-y-6">
  <h1 class="text-2xl font-semibold text-white">Modellen</h1>

  <section class="surface-panel space-y-3">
    <h2 class="text-lg font-medium text-white">Opret nyt budget</h2>
    {#if error}
      <p class="text-sm text-red-400">{error}</p>
    {/if}
    <div class="flex flex-col gap-3 sm:flex-row">
      <input
        class="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
        placeholder="Budgetnavn (f.eks. 2025)"
        bind:value={name}
        on:keydown={(e) => e.key === 'Enter' && createBudget()}
      />
      <select class="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-40" bind:value={currency}>
        <option value="DKK">DKK</option>
      </select>
      <button class="primary-button px-4 py-2 disabled:opacity-50" disabled={loading} on:click={createBudget}>
        {loading ? 'Opretter…' : 'Opret'}
      </button>
    </div>
  </section>

  <section class="surface-panel p-0 overflow-hidden">
    <div class="p-4 border-b border-slate-800">
      <h2 class="text-lg font-medium text-white">Dine budgetter</h2>
    </div>
    {#if data.budgets.length === 0}
      <div class="p-4 text-slate-400">Ingen budgetter endnu.</div>
    {:else}
      <ul class="divide-y divide-slate-800">
        {#each data.budgets as b}
          <li class="p-4 flex items-center justify-between hover:bg-slate-800/50 transition">
            <div>
              <div class="font-medium text-white">{b.name}</div>
              <div class="text-sm text-slate-400">{b.currency}</div>
            </div>
            <a class="secondary-button px-3 py-1 text-sm" href={`/modellen/${encodeURIComponent(b.streamId)}`}>Åbn</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
