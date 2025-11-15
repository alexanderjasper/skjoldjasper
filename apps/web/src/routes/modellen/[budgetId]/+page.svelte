<script lang="ts">
  export let data: {
    budgetId: string;
    notFound?: boolean;
    details?: { budgetId: string; state: any };
    overview?: Array<{ categoryId: string; categoryName: string; parentId: string | null; yearlyTarget?: number; actualSpent: number }>;
  };

  let catName = '';
  let parentId: string | null = null;
  let addCatError = '';

  let noteText: Record<string, string> = {};
  let noteError = '';

  let csvText = '';
  let importMsg = '';
  let importError = '';
  let duplicates: Array<{ transactionId: string; date: string; description: string; amount: number }> = [];

  type Category = { id: string; name: string; parentId: string | null; yearlyTarget?: number };
  type CategoryTree = Category & { children: CategoryTree[] };
  type FlatCategory = Category & { depth: number };

  function buildCategoryTree(categories: Record<string, Category>): CategoryTree[] {
    const categoryArray = Object.values(categories);
    const categoryMap = new Map<string, CategoryTree>();
    
    categoryArray.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });
    
    const roots: CategoryTree[] = [];
    categoryArray.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });
    
    return roots;
  }

  function flattenTree(tree: CategoryTree[], depth = 0): FlatCategory[] {
    const result: FlatCategory[] = [];
    for (const node of tree) {
      result.push({ ...node, depth });
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  $: categoryTree = data.details?.state?.categories ? buildCategoryTree(data.details.state.categories) : [];
  $: flatCategories = flattenTree(categoryTree);

  function computeDepth(item: { categoryId: string; parentId: string | null }, allItems: Array<{ categoryId: string; parentId: string | null }>): number {
    let depth = 0;
    let currentParentId = item.parentId;
    while (currentParentId) {
      depth++;
      const parent = allItems.find(i => i.categoryId === currentParentId);
      currentParentId = parent?.parentId || null;
    }
    return depth;
  }

  $: overviewWithDepth = (data.overview ?? []).map(item => ({
    ...item,
    depth: computeDepth(item, data.overview ?? [])
  }));

  async function addCategory() {
    addCatError = '';
    const name = catName.trim();
    if (!name) {
      addCatError = 'Name is required';
      return;
    }
    const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name, parentId })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      addCatError = j?.error ?? 'Failed to add category';
      return;
    }
    location.reload();
  }

  async function saveNote(txId: string) {
    noteError = '';
    const note = (noteText[txId] ?? '').trim();
    const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/transactions/${encodeURIComponent(txId)}/note`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ note })
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      noteError = j?.error ?? 'Failed to save note';
      return;
    }
    location.reload();
  }

  async function previewImport() {
    importError = '';
    importMsg = '';
    duplicates = [];
    const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/import`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      credentials: 'same-origin',
      body: csvText
    });
    if (res.status === 409) {
      const j = await res.json();
      duplicates = j.duplicates ?? [];
      importMsg = `Found ${duplicates.length} duplicates. ${j.newCount ?? 0} new transactions.`;
      return;
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      importError = j?.error ?? 'Import failed';
      return;
    }
    const j = await res.json();
    importMsg = `Imported ${j.imported} transactions`;
    csvText = '';
    location.reload();
  }

  async function importConfirmed() {
    const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/import?confirm=1`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      credentials: 'same-origin',
      body: csvText
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      importError = j?.error ?? 'Import failed';
      return;
    }
    const j = await res.json();
    importMsg = `Imported ${j.imported} transactions (${j.duplicates} duplicates)`;
    csvText = '';
    duplicates = [];
    location.reload();
  }
</script>

{#if data.notFound}
  <div class="max-w-3xl mx-auto p-4">Budget not found.</div>
{:else}
  <div class="max-w-5xl mx-auto p-4 space-y-8">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">{data.details?.state?.name}</h1>
      <a class="text-blue-600 hover:underline" href="/modellen">Back</a>
    </div>

    <section class="rounded border">
      <div class="p-4 border-b"><h2 class="text-lg font-medium">Overview</h2></div>
      <div class="p-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead><tr class="text-left"><th class="py-2 pr-4">Category</th><th class="py-2 pr-4">Target</th><th class="py-2">Actual</th></tr></thead>
          <tbody>
            {#each overviewWithDepth as row}
              <tr class="border-t">
                <td class="py-2 pr-4">
                  <span style="padding-left: {row.depth * 1.5}rem" class="inline-flex items-center">
                    {#if row.depth > 0}
                      <span class="text-gray-400 mr-2">└─</span>
                    {/if}
                    <span class:font-medium={row.depth === 0}>{row.categoryName}</span>
                  </span>
                </td>
                <td class="py-2 pr-4">{row.yearlyTarget ?? ''}</td>
                <td class="py-2">{row.actualSpent}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>

    <section class="rounded border">
      <div class="p-4 border-b"><h2 class="text-lg font-medium">Categories</h2></div>
      <div class="p-4 space-y-4">
        <div class="flex flex-col gap-3 sm:flex-row">
          <input class="flex-1 border rounded px-3 py-2" placeholder="Category name" bind:value={catName} />
          <select class="border rounded px-3 py-2 w-64" bind:value={parentId}>
            <option value={null}>No parent</option>
            {#each Object.values(data.details?.state?.categories ?? {}) as c}
              <option value={c.id}>{c.name}</option>
            {/each}
          </select>
          <button class="px-4 py-2 bg-blue-600 text-white rounded" on:click={addCategory}>Add</button>
        </div>
        {#if addCatError}
          <p class="text-sm text-red-600">{addCatError}</p>
        {/if}
        <div class="space-y-1">
          {#each flatCategories as cat}
            <div class="flex items-center py-1" style="padding-left: {cat.depth * 2}rem">
              {#if cat.depth > 0}
                <span class="text-gray-400 mr-2">└─</span>
              {/if}
              <span class:font-medium={cat.depth === 0}>{cat.name}</span>
              {#if cat.yearlyTarget}
                <span class="ml-2 text-sm text-gray-500">(Target: {cat.yearlyTarget})</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>

    <section class="rounded border">
      <div class="p-4 border-b"><h2 class="text-lg font-medium">Transactions</h2></div>
      <div class="p-4 space-y-4">
        {#if noteError}
          <p class="text-sm text-red-600">{noteError}</p>
        {/if}
        <ul class="divide-y">
          {#each Object.values(data.details?.state?.transactions ?? {}) as t}
            <li class="py-3 flex items-center justify-between gap-4">
              <div class="min-w-0">
                <div class="font-medium truncate">{t.description}</div>
                <div class="text-xs text-gray-500">{t.date} · {t.amount}</div>
              </div>
              <div class="flex items-center gap-2">
                <input class="border rounded px-2 py-1 text-sm" placeholder="Note" bind:value={noteText[t.id]} />
                <button class="px-3 py-1 bg-gray-100 rounded" on:click={() => saveNote(t.id)}>Save</button>
              </div>
            </li>
          {/each}
        </ul>
      </div>
    </section>

    <section class="rounded border">
      <div class="p-4 border-b"><h2 class="text-lg font-medium">Import CSV</h2></div>
      <div class="p-4 space-y-3">
        {#if importError}
          <p class="text-sm text-red-600">{importError}</p>
        {/if}
        {#if importMsg}
          <p class="text-sm text-green-700">{importMsg}</p>
        {/if}
        <textarea class="w-full border rounded p-2 font-mono text-sm" rows="8" bind:value={csvText} placeholder="Paste exported CSV here..."></textarea>
        <div class="flex gap-2">
          <button class="px-4 py-2 bg-gray-100 rounded" on:click={previewImport}>Preview</button>
          {#if duplicates.length > 0}
            <button class="px-4 py-2 bg-blue-600 text-white rounded" on:click={importConfirmed}>Import anyway</button>
          {/if}
        </div>
        {#if duplicates.length > 0}
          <div class="rounded border p-3">
            <p class="font-medium mb-2">Duplicates</p>
            <ul class="text-sm list-disc pl-5">
              {#each duplicates as d}
                <li>{d.date} · {d.description} · {d.amount}</li>
              {/each}
            </ul>
          </div>
        {/if}
      </div>
    </section>
  </div>
{/if}
