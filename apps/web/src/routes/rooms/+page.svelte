<script lang="ts">
  export let data: { rooms: Array<{ stream_id: string; counter: number }> };

  let roomId = '';

  function openRoom() {
    const id = roomId.trim();
    if (!id) return;
    window.location.href = `/rooms/${encodeURIComponent(id)}`;
  }
</script>

<div class="max-w-2xl mx-auto p-4 space-y-6">
  <h1 class="text-2xl font-semibold">Rooms</h1>

  <div class="flex gap-2">
    <input
      class="flex-1 border rounded px-3 py-2"
      placeholder="room id (e.g., demo)"
      bind:value={roomId}
      on:keydown={(e) => e.key === 'Enter' && openRoom()}
    />
    <button class="px-4 py-2 bg-blue-600 text-white rounded" on:click={openRoom}>
      Open room
    </button>
  </div>

  <h2 class="text-xl font-medium">Top rooms</h2>
  {#if data.rooms.length === 0}
    <p class="text-gray-500">No rooms yet.</p>
  {:else}
    <ul class="divide-y border rounded">
      {#each data.rooms as r}
        <li class="p-3 flex items-center justify-between">
          <div class="truncate">
            <span class="font-mono">{r.stream_id}</span>
          </div>
          <div class="flex items-center gap-4">
            <span class="text-gray-600">{r.counter}</span>
            <a class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200" href={`/rooms/${encodeURIComponent(r.stream_id)}`}>
              Open
            </a>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>


