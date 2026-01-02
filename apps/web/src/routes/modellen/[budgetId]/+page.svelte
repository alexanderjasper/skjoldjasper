<script lang="ts">
    export let data: {
        budgetId: string;
        notFound?: boolean;
        details?: { budgetId: string; state: any };
        overview?: Array<{
            categoryId: string;
            categoryName: string;
            parentId: string | null;
            yearlyTarget?: number;
            actualSpent: number
        }>;
    };

    let catName = '';
    let parentId: string | null = null;
    let addCatError = '';

    let noteText: Record<string, string> = {};
    let noteError = '';

    let csvText = '';
    let importMsg = '';
    let importError = '';
    let duplicates: Array<{
        transactionId: string;
        date: string;
        description: string;
        amount: number
    }> = [];

    let editingTarget: string | null = null;
    let targetValue: Record<string, string> = {};
    let targetError = '';
    let savingTarget: string | null = null;

    let editingSplits: string | null = null;
    let splitRows: Array<{ categoryId: string; amount: string }> = [];
    let splitError = '';
    let savingSplits: string | null = null;

    let activeTab: 'overview' | 'categories' | 'transactions' | 'import' = 'overview';

    type Category = { id: string; name: string; parentId: string | null; yearlyTarget?: number };
    type CategoryTree = Category & { children: CategoryTree[] };
    type FlatCategory = Category & { depth: number };
    type Transaction = { id: string; date: string; description: string; amount: number };

    function formatNumber(num: number | undefined | null): string {
        if (num === undefined || num === null) return '';
        return num.toLocaleString('da-DK');
    }

    function buildCategoryTree(categories: Record<string, Category>): CategoryTree[] {
        const categoryArray = Object.values(categories);
        const categoryMap = new Map<string, CategoryTree>();

        categoryArray.forEach(cat => {
            categoryMap.set(cat.id, {...cat, children: []});
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
            result.push({...node, depth});
            if (node.children.length > 0) {
                result.push(...flattenTree(node.children, depth + 1));
            }
        }
        return result;
    }

    $: categoryTree = data.details?.state?.categories ? buildCategoryTree(data.details.state.categories) : [];
    $: flatCategories = flattenTree(categoryTree);
    $: categories = Object.values(data.details?.state?.categories ?? {}) as Category[];
    $: transactions = Object.values(data.details?.state?.transactions ?? {}) as Transaction[];

    function computeDepth(item: { categoryId: string; parentId: string | null }, allItems: Array<{
        categoryId: string;
        parentId: string | null
    }>): number {
        let depth = 0;
        let currentParentId = item.parentId;
        while (currentParentId) {
            depth++;
            const parent = allItems.find(i => i.categoryId === currentParentId);
            currentParentId = parent?.parentId || null;
        }
        return depth;
    }

    function hasChildren(categoryId: string): boolean {
        const categories = data.details?.state?.categories ?? {};
        return (Object.values(categories) as Category[]).some((cat: Category) => cat.parentId === categoryId);
    }

    function calculateParentTarget(categoryId: string): number | undefined {
        const categories = data.details?.state?.categories ?? {};
        const children = (Object.values(categories) as Category[]).filter((cat: Category) => cat.parentId === categoryId);
        if (children.length === 0) return undefined;

        const sum = children.reduce((total: number, child: Category) => {
            // If child is also a parent, use its calculated target, otherwise use its yearlyTarget
            const childTarget = hasChildren(child.id)
                ? (calculateParentTarget(child.id) ?? 0)
                : (child.yearlyTarget ?? 0);
            return total + childTarget;
        }, 0);

        return sum > 0 ? sum : undefined;
    }

    function calculateParentActual(categoryId: string): number {
        const categories = data.details?.state?.categories ?? {};
        const overview = data.overview ?? [];
        const children = (Object.values(categories) as Category[]).filter((cat: Category) => cat.parentId === categoryId);
        if (children.length === 0) return 0;

        return children.reduce((total: number, child: Category) => {
            // If child is also a parent, use its calculated actual, otherwise use its actualSpent from overview
            const childActual = hasChildren(child.id)
                ? calculateParentActual(child.id)
                : (overview.find(item => item.categoryId === child.id)?.actualSpent ?? 0);
            return total + childActual;
        }, 0);
    }

    $: overviewWithDepth = (data.overview ?? []).map(item => {
        const isParent = hasChildren(item.categoryId);
        const calculatedTarget = isParent ? calculateParentTarget(item.categoryId) : undefined;
        const calculatedActual = isParent ? calculateParentActual(item.categoryId) : item.actualSpent;
        return {
            ...item,
            depth: computeDepth(item, data.overview ?? []),
            isParent,
            calculatedTarget,
            calculatedActual,
            displayTarget: isParent ? calculatedTarget : item.yearlyTarget
        };
    });

    $: {
        const transactions = data.details?.state?.transactions ?? {};
        const notes = data.details?.state?.notes ?? {};
        for (const txId of Object.keys(transactions)) {
            if (!(txId in noteText)) {
                noteText[txId] = notes[txId] ?? '';
            }
        }
    }

    async function addCategory() {
        addCatError = '';
        const name = catName.trim();
        if (!name) {
            addCatError = 'Navn er påkrævet';
            return;
        }
        const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/categories`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify({name, parentId})
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            addCatError = j?.error ?? 'Kunne ikke tilføje kategori';
            return;
        }
        location.reload();
    }

    async function saveNote(txId: string) {
        noteError = '';
        const note = (noteText[txId] ?? '').trim();
        const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/transactions/${encodeURIComponent(txId)}/note`, {
            method: 'POST',
            headers: {'content-type': 'application/json'},
            credentials: 'same-origin',
            body: JSON.stringify({note})
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            noteError = j?.error ?? 'Kunne ikke gemme note';
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
            headers: {'content-type': 'text/plain'},
            credentials: 'same-origin',
            body: csvText
        });
        if (res.status === 409) {
            const j = await res.json();
            duplicates = j.duplicates ?? [];
            importMsg = `Fundet ${duplicates.length} dubletter. ${j.newCount ?? 0} nye transaktioner.`;
            return;
        }
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            importError = j?.error ?? 'Import fejlede';
            return;
        }
        const j = await res.json();
        importMsg = `Importeret ${j.imported} transaktioner`;
        csvText = '';
        location.reload();
    }

    async function importConfirmed() {
        const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/import?confirm=1`, {
            method: 'POST',
            headers: {'content-type': 'text/plain'},
            credentials: 'same-origin',
            body: csvText
        });
        if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            importError = j?.error ?? 'Import fejlede';
            return;
        }
        const j = await res.json();
        importMsg = `Importeret ${j.imported} transaktioner (${j.duplicates} dubletter)`;
        csvText = '';
        duplicates = [];
        location.reload();
    }

    function startEditingTarget(categoryId: string, currentValue?: number) {
        editingTarget = categoryId;
        targetValue[categoryId] = currentValue?.toString() ?? '';
        targetError = '';
    }

    function cancelEditingTarget() {
        editingTarget = null;
        targetError = '';
    }

    async function saveTarget(categoryId: string) {
        targetError = '';
        savingTarget = categoryId;
        const rawValue = targetValue[categoryId];
        const value = rawValue != null ? String(rawValue).trim() : '';

        if (!value) {
            targetError = 'Mål kan ikke være tomt. Indtast 0 for at rydde.';
            savingTarget = null;
            return;
        }

        const numValue = parseFloat(value);

        if (isNaN(numValue) || !isFinite(numValue)) {
            targetError = 'Ugyldigt tal';
            savingTarget = null;
            return;
        }

        try {
            const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/categories`, {
                method: 'PATCH',
                headers: {'content-type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({categoryId, yearlyTarget: numValue})
            });

            const j = await res.json().catch(() => ({}));

            if (!res.ok) {
                targetError = j?.message ?? j?.error ?? 'Kunne ikke gemme mål';
                savingTarget = null;
                return;
            }

            editingTarget = null;
            savingTarget = null;
            location.reload();
        } catch (err) {
            targetError = 'Netværksfejl. Prøv igen.';
            savingTarget = null;
        }
    }

    function startEditingSplits(transactionId: string) {
        splitError = '';
        const existingSplits = data.details?.state?.splits?.[transactionId] ?? [];
        if (existingSplits.length > 0) {
            splitRows = existingSplits.map((s: { categoryId: string; amount: number }) => ({
                categoryId: s.categoryId,
                amount: s.amount.toString()
            }));
        } else {
            splitRows = [{categoryId: '', amount: ''}];
        }
        editingSplits = transactionId;
    }

    function cancelEditingSplits() {
        editingSplits = null;
        splitError = '';
        splitRows = [];
    }

    function addSplitRow(transactionId: string) {
        if (editingSplits !== transactionId) return;
        splitRows = [...splitRows, {categoryId: '', amount: ''}];
    }

    function removeSplitRow(transactionId: string, index: number) {
        if (editingSplits !== transactionId) return;
        splitRows = splitRows.filter((_, i) => i !== index);
    }

    function getRemainingAmount(transactionId: string, transactionAmount: number): number {
        if (editingSplits !== transactionId) return transactionAmount;
        if (!splitRows || splitRows.length === 0) return transactionAmount;
        const total = splitRows.reduce((sum, row) => {
            const amount = parseFloat(row.amount) || 0;
            return sum + amount;
        }, 0);
        return transactionAmount - total;
    }

    async function saveSplits(transactionId: string, transactionAmount: number) {
        splitError = '';
        savingSplits = transactionId;

        if (editingSplits !== transactionId) {
            splitError = 'Intern fejl: forkert transaktion under redigering';
            savingSplits = null;
            return;
        }

        const rows = splitRows || [];
        const splits = rows
            .filter(row => row.categoryId && row.amount)
            .map(row => ({
                categoryId: row.categoryId,
                amount: parseFloat(row.amount)
            }));

        if (splits.length === 0) {
            splitError = 'Mindst én opdeling er påkrævet';
            savingSplits = null;
            return;
        }

        const total = splits.reduce((sum, s) => sum + s.amount, 0);
        const epsilon = 0.01;
        if (Math.abs(total - transactionAmount) > epsilon) {
            splitError = `Opdelinger i alt ${total.toFixed(2)} matcher ikke transaktionsbeløb ${transactionAmount.toFixed(2)}`;
            savingSplits = null;
            return;
        }

        try {
            const res = await fetch(`/api/budgets/${encodeURIComponent(data.budgetId)}/transactions/${encodeURIComponent(transactionId)}/splits`, {
                method: 'POST',
                headers: {'content-type': 'application/json'},
                credentials: 'same-origin',
                body: JSON.stringify({splits})
            });

            const j = await res.json().catch(() => ({}));

            if (!res.ok) {
                splitError = j?.message ?? j?.error ?? 'Kunne ikke gemme opdelinger';
                savingSplits = null;
                return;
            }

            editingSplits = null;
            savingSplits = null;
            location.reload();
        } catch (err) {
            splitError = 'Netværksfejl. Prøv igen.';
            savingSplits = null;
        }
    }

</script>

{#if data.notFound}
    <div class="max-w-3xl mx-auto p-4 text-slate-900">Budget ikke fundet.</div>
{:else}
    <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-4 md:space-y-6">
        <div class="flex items-center justify-between">
            <h1 class="text-xl md:text-2xl font-semibold text-slate-900">{data.details?.state?.name}</h1>
            <a class="text-emerald-600 hover:text-emerald-700 transition font-medium text-sm md:text-base"
               href="/modellen">Tilbage</a>
        </div>

        <!-- Tabs -->
        <div class="md:surface-panel md:p-0 md:overflow-hidden -mx-4 md:mx-0">
            <div class="flex border-b border-slate-200 overflow-x-auto px-4 md:px-0">
                <button
                        class="px-6 py-3 text-sm font-medium transition whitespace-nowrap {activeTab === 'overview' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-slate-900'}"
                        on:click={() => activeTab = 'overview'}
                >
                    Oversigt
                </button>
                <button
                        class="px-6 py-3 text-sm font-medium transition whitespace-nowrap {activeTab === 'categories' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-slate-900'}"
                        on:click={() => activeTab = 'categories'}
                >
                    Kategorier
                </button>
                <button
                        class="px-6 py-3 text-sm font-medium transition whitespace-nowrap {activeTab === 'transactions' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-slate-900'}"
                        on:click={() => activeTab = 'transactions'}
                >
                    Transaktioner
                </button>
                <button
                        class="px-6 py-3 text-sm font-medium transition whitespace-nowrap {activeTab === 'import' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-600 hover:text-slate-900'}"
                        on:click={() => activeTab = 'import'}
                >
                    Importer CSV
                </button>
            </div>
        </div>

        {#if activeTab === 'overview'}
            <section class="md:surface-panel md:p-0 md:overflow-hidden space-y-3 md:space-y-0">
                <h2 class="text-lg font-medium text-slate-900 md:p-4 md:border-b md:border-slate-200">
                    Oversigt</h2>
                <div class="md:p-4 space-y-3 md:space-y-4">
                    {#if targetError}
                        <p class="text-sm text-red-600 mb-2">{targetError}</p>
                    {/if}
                    <div class="space-y-1">
                        {#each overviewWithDepth as row}
                            <div class="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                                 style="margin-left: {row.depth * 0.75}rem">
                                <div class="p-2 md:p-3 flex flex-col gap-2">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                {#if row.depth > 0}
                                                    <span class="text-slate-600 text-xs">└</span>
                                                {/if}
                                                <span class="text-slate-900 {row.depth === 0 ? 'font-semibold' : 'font-medium'} truncate">
                        {row.categoryName}
                      </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-2 gap-3 text-sm">
                                        <div
                                                class="flex flex-col {editingTarget !== row.categoryId && !row.isParent ? 'cursor-pointer' : ''}"
                                                on:click={() => editingTarget !== row.categoryId && !row.isParent && startEditingTarget(row.categoryId, row.displayTarget)}
                                                role={editingTarget !== row.categoryId && !row.isParent ? "button" : undefined}
                                                tabindex={editingTarget !== row.categoryId && !row.isParent ? 0 : undefined}
                                                on:keydown={(e) => editingTarget !== row.categoryId && !row.isParent && e.key === 'Enter' && startEditingTarget(row.categoryId, row.displayTarget)}
                                        >
                                            <span class="text-xs text-slate-600 uppercase tracking-wide">Mål (mnd)</span>
                                            {#if editingTarget === row.categoryId}
                                                <div class="flex items-center gap-2 mt-1"
                                                     on:click={(e) => e.stopPropagation()}
                                                     role="presentation">
                                                    <input
                                                            type="number"
                                                            class="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                                            bind:value={targetValue[row.categoryId]}
                                                            on:keydown={(e) => e.key === 'Enter' && saveTarget(row.categoryId)}
                                                            on:keydown={(e) => e.key === 'Escape' && cancelEditingTarget()}
                                                            disabled={savingTarget === row.categoryId}
                                                    />
                                                    <button
                                                            class="primary-button px-2 py-1 text-xs disabled:opacity-50"
                                                            on:click={(e) => { e.stopPropagation(); saveTarget(row.categoryId); }}
                                                            disabled={savingTarget === row.categoryId}
                                                    >
                                                        {savingTarget === row.categoryId ? '...' : '✓'}
                                                    </button>
                                                </div>
                                            {:else}
                                                <div class="text-slate-900 font-medium">
                                                    {#if row.isParent}
                                                        {#if row.calculatedTarget !== undefined && row.calculatedTarget !== null}
                                                                        <span class="text-slate-600"
                                                                              title="Sum af underkategorier">{formatNumber(row.calculatedTarget)}</span>
                                                        {:else}
                                                            <span class="text-slate-400 italic text-xs">Ingen mål</span>
                                                        {/if}
                                                    {:else if row.displayTarget !== undefined && row.displayTarget !== null}
                                                        {formatNumber(row.displayTarget)}
                                                    {:else}
                                                        <span class="text-slate-400 italic text-xs">Klik for at angive</span>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>

                                        <div class="flex flex-col">
                                            <span class="text-xs text-slate-600 uppercase tracking-wide">Faktisk</span>
                                            <div class="text-slate-900 font-medium mt-1">
                                                {formatNumber(row.calculatedActual)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            </section>
        {/if}

        {#if activeTab === 'categories'}
            <section class="md:surface-panel md:p-0 md:overflow-hidden space-y-3 md:space-y-0">
                <h2 class="text-lg font-medium text-slate-900 md:p-4 md:border-b md:border-slate-200">
                    Kategorier</h2>
                <div class="md:p-4 space-y-3 md:space-y-4">
                    <div class="flex flex-col gap-3 sm:flex-row">
                        <input
                                class="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                placeholder="Kategorinavn"
                                bind:value={catName}
                        />
                        <select
                                class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full sm:w-64"
                                bind:value={parentId}
                        >
                            <option value={null}>Ingen forælder</option>
                            {#each categories as cat}
                                <option value={cat.id}>{cat.name}</option>
                            {/each}
                        </select>
                        <button class="primary-button px-4 py-2" on:click={addCategory}>Tilføj
                        </button>
                    </div>
                    {#if addCatError}
                        <p class="text-sm text-red-600">{addCatError}</p>
                    {/if}
                    <div class="space-y-1">
                        {#each flatCategories as cat}
                            <div class="flex items-center py-2 px-2 md:px-3 rounded-lg bg-slate-50/50"
                                 style="margin-left: {cat.depth * 0.75}rem">
                                {#if cat.depth > 0}
                                    <span class="text-slate-400 mr-2 text-xs">└</span>
                                {/if}
                                <span class="text-slate-900 {cat.depth === 0 ? 'font-semibold' : 'font-medium'}">{cat.name}</span>
                                {#if cat.yearlyTarget}
                                    <span class="ml-2 text-sm text-slate-600">(Mål: {formatNumber(cat.yearlyTarget)}
                                        )</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </section>
        {/if}

        {#if activeTab === 'transactions'}
            <section class="md:surface-panel md:p-0 md:overflow-hidden space-y-3 md:space-y-0">
                <h2 class="text-lg font-medium text-slate-900 md:p-4 md:border-b md:border-slate-200">
                    Transaktioner</h2>
                <div class="md:p-4 space-y-3 md:space-y-4">
                    {#if noteError}
                        <p class="text-sm text-red-600">{noteError}</p>
                    {/if}
                    {#if splitError}
                        <p class="text-sm text-red-600">{splitError}</p>
                    {/if}
                    <ul class="divide-y divide-slate-800">
                        {#each transactions as tx}
                            {@const splits = data.details?.state?.splits?.[tx.id] ?? []}
                            {@const note = data.details?.state?.notes?.[tx.id] ?? ''}
                            <li class="py-3 space-y-3">
                                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div class="min-w-0 flex-1">
                                        <div class="font-medium text-slate-900 truncate">{tx.description}</div>
                                        <div class="text-xs text-slate-600">{tx.date} · <span
                                                class="text-right inline-block min-w-[80px]">{formatNumber(tx.amount)}</span>
                                        </div>
                                        {#if splits.length > 0}
                                            <div class="mt-2 text-xs text-slate-700">
                                                <span class="font-medium">Opdelinger:</span>
                                                {#each splits as split}
                                                    {@const
                                                        cat = categories[split.categoryId]}
                                                    <span class="ml-2">
                          {cat?.name ?? split.categoryId}: <span
                                                            class="text-right inline-block min-w-[60px]">{formatNumber(split.amount)}</span>
                        </span>
                                                {/each}
                                            </div>
                                        {/if}
                                        {#if note}
                                            <div class="mt-1 text-xs text-slate-600 italic">
                                                Note: {note}</div>
                                        {/if}
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <input
                                                class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full sm:w-32"
                                                placeholder="Note"
                                                bind:value={noteText[tx.id]}
                                        />
                                        <button class="secondary-button px-3 py-1 text-sm"
                                                on:click={() => saveNote(tx.id)}>Gem Note
                                        </button>
                                        <button
                                                class="primary-button px-3 py-1 text-sm"
                                                on:click={() => startEditingSplits(tx.id)}
                                                disabled={editingSplits === tx.id}
                                        >
                                            {splits.length > 0 ? 'Rediger Opdelinger' : 'Tildel Opdelinger'}
                                        </button>
                                    </div>
                                </div>
                                {#if editingSplits === tx.id}
                                    <div class="ml-0 sm:ml-4 pl-0 sm:pl-4 border-l-2 border-emerald-500/30 space-y-2 mt-3">
                                        <div class="text-sm font-medium text-slate-900">Tildel
                                            opdelinger (I alt: {formatNumber(tx.amount)})
                                        </div>
                                        {#each splitRows as row, index}
                                            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                                <select
                                                        class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 flex-1"
                                                        bind:value={row.categoryId}
                                                >
                                                    <option value="">Vælg kategori</option>
                                                    {#each categories as category}
                                                        <option value={category.id}>{category.name}</option>
                                                    {/each}
                                                </select>
                                                <input
                                                        type="number"
                                                        step="0.01"
                                                        class="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full sm:w-24 text-right"
                                                        placeholder="Beløb"
                                                        bind:value={row.amount}
                                                />
                                                {#if splitRows.length > 1}
                                                    <button
                                                            class="px-2 py-1 bg-red-900/50 text-red-300 rounded-lg text-sm hover:bg-red-900/70 transition"
                                                            on:click={() => removeSplitRow(tx.id, index)}
                                                    >
                                                        Fjern
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                                            <button
                                                    class="secondary-button px-3 py-1 text-sm"
                                                    on:click={() => addSplitRow(tx.id)}
                                            >
                                                Tilføj Opdeling
                                            </button>
                                            <span class="text-sm {getRemainingAmount(tx.id, tx.amount) < 0 ? 'text-red-600' : getRemainingAmount(tx.id, tx.amount) > 0.01 ? 'text-orange-400' : 'text-emerald-600'}">
                      Resterende: <span class="text-right inline-block min-w-[80px]">{formatNumber(getRemainingAmount(tx.id, tx.amount))}</span>
                    </span>
                                        </div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <button
                                                    class="primary-button px-3 py-1 text-sm disabled:opacity-50"
                                                    on:click={() => saveSplits(tx.id, tx.amount)}
                                                    disabled={savingSplits === tx.id}
                                            >
                                                {savingSplits === tx.id ? 'Gemmer...' : 'Gem Opdelinger'}
                                            </button>
                                            <button
                                                    class="secondary-button px-3 py-1 text-sm"
                                                    on:click={cancelEditingSplits}
                                                    disabled={savingSplits === tx.id}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </li>
                        {/each}
                    </ul>
                </div>
            </section>
        {/if}

        {#if activeTab === 'import'}
            <section class="md:surface-panel md:p-0 md:overflow-hidden space-y-3 md:space-y-0">
                <h2 class="text-lg font-medium text-slate-900 md:p-4 md:border-b md:border-slate-200">
                    Importer CSV</h2>
                <div class="md:p-4 space-y-3">
                    {#if importError}
                        <p class="text-sm text-red-600">{importError}</p>
                    {/if}
                    {#if importMsg}
                        <p class="text-sm text-emerald-600">{importMsg}</p>
                    {/if}
                    <textarea
                            class="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            rows="8"
                            bind:value={csvText}
                            placeholder="Indsæt eksporteret CSV her..."
                    ></textarea>
                    <div class="flex flex-wrap gap-2">
                        <button class="secondary-button px-4 py-2" on:click={previewImport}>
                            Forhåndsvisning
                        </button>
                        {#if duplicates.length > 0}
                            <button class="primary-button px-4 py-2" on:click={importConfirmed}>
                                Importer alligevel
                            </button>
                        {/if}
                    </div>
                    {#if duplicates.length > 0}
                        <div class="rounded-lg border border-slate-300 bg-slate-50/50 p-3">
                            <p class="font-medium text-slate-900 mb-2">Dubletter</p>
                            <ul class="text-sm text-slate-700 list-disc pl-5">
                                {#each duplicates as d}
                                    <li>{d.date} · {d.description} · {d.amount}</li>
                                {/each}
                            </ul>
                        </div>
                    {/if}
                </div>
            </section>
        {/if}
    </div>
{/if}
