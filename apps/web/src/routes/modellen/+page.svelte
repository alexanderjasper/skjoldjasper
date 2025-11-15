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
  <h1 class="text-2xl font-semibold">Modellen</h1>

  <section class="rounded border p-4 space-y-3">
    <h2 class="text-lg font-medium">Opret nyt budget</h2>
    {#if error}
      <p class="text-sm text-red-600">{error}</p>
    {/if}
    <div class="flex flex-col gap-3 sm:flex-row">
      <input
        class="flex-1 border rounded px-3 py-2"
        placeholder="Budgetnavn (f.eks. 2025)"
        bind:value={name}
        on:keydown={(e) => e.key === 'Enter' && createBudget()}
      />
      <select class="border rounded px-3 py-2 w-40" bind:value={currency}>
        <option value="DKK">DKK</option>
      </select>
      <button class="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading} on:click={createBudget}>
        {loading ? 'Opretter…' : 'Opret'}
      </button>
    </div>
  </section>

  <section class="rounded border">
    <div class="p-4 border-b">
      <h2 class="text-lg font-medium">Dine budgetter</h2>
    </div>
    {#if data.budgets.length === 0}
      <div class="p-4 text-gray-500">Ingen budgetter endnu.</div>
    {:else}
      <ul class="divide-y">
        {#each data.budgets as b}
          <li class="p-4 flex items-center justify-between">
            <div>
              <div class="font-medium">{b.name}</div>
              <div class="text-sm text-gray-500">{b.currency}</div>
            </div>
            <a class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200" href={`/modellen/${encodeURIComponent(b.streamId)}`}>Åbn</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>
</div>
