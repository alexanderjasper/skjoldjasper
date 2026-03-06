<script lang="ts">
    export let data: { rooms: Array<{ room_id: string; counter: number }> };

    let roomId = '';

    function openRoom() {
        const id = roomId.trim();
        if (!id) return;
        window.location.href = `/rooms/${encodeURIComponent(id)}`;
    }
</script>

<div class="max-w-2xl mx-auto p-4 space-y-6">
    <h1 class="text-2xl font-semibold">Rum</h1>

    <div class="flex gap-2">
        <input
                bind:value={roomId}
                class="flex-1 border rounded px-3 py-2"
                on:keydown={(e) => e.key === 'Enter' && openRoom()}
                placeholder="rum id (f.eks. demo)"
        />
        <button class="px-4 py-2 bg-blue-600 text-white rounded" on:click={openRoom}>
            Åbn rum
        </button>
    </div>

    <h2 class="text-xl font-medium">Top rum</h2>
    {#if data.rooms.length === 0}
        <p class="text-gray-500">Ingen rum endnu.</p>
    {:else}
        <ul class="divide-y border rounded">
            {#each data.rooms as r}
                <li class="p-3 flex items-center justify-between">
                    <div class="truncate">
                        <span class="font-mono">{r.room_id}</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-gray-600">{r.counter}</span>
                        <a class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
                           href={`/rooms/${encodeURIComponent(r.room_id)}`}>
                            Åbn
                        </a>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}
</div>


