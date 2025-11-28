<script lang="ts">
    import {onMount} from 'svelte';
    import {env as publicEnv} from '$env/dynamic/public';
    import {Client} from 'colyseus.js';

    export let params: { id: string };

    let counter = 0;
    let players: string[] = [];
    let currentIndex = 0;
    let sessionId: string | null = null;
    let connected = false;
    let error: string | null = null;

    let room: any;

    onMount(() => {
        let disposed = false;
        (async () => {
            try {
                const WS_URL = publicEnv.PUBLIC_GAME_SERVER_WS ?? 'ws://localhost:2567';
                const client = new Client(WS_URL);
                const joined = await client.joinOrCreate('my_room', {streamId: params.id});
                if (disposed) {
                    try {
                        joined.leave();
                    } catch {
                    }
                    ;
                    return;
                }
                room = joined;
                sessionId = room.sessionId;
                connected = true;

                room.onStateChange((state: any) => {
                    counter = Number(state.counter ?? 0);
                    players = Array.from(state.players ?? []);
                    currentIndex = Number(state.currentIndex ?? 0);
                });
            } catch (e: any) {
                if (!disposed) {
                    error = String(e?.message ?? e);
                }
            }
        })();

        return () => {
            disposed = true;
            try {
                room?.leave();
            } catch {
            }
        };
    });

    function isMyTurn(): boolean {
        if (!sessionId) return false;
        if (!players || players.length === 0) return false;
        return players[currentIndex] === sessionId;
    }

    function increment() {
        room?.send('increment');
    }
</script>

<div class="max-w-xl mx-auto p-4 space-y-6">
    <div class="flex items-center justify-between">
        <h1 class="text-2xl font-semibold">Room: <span class="font-mono">{params.id}</span></h1>
        <a class="text-blue-600 hover:underline" href="/rooms">Back</a>
    </div>

    {#if error}
        <p class="text-red-600">{error}</p>
    {/if}

    <div class="space-y-2">
        <div>Connected: {connected ? 'yes' : 'no'}</div>
        <div>Session: {sessionId}</div>
        <div>Players: {players.length}</div>
        <div>Current turn: {players[currentIndex] ?? '-'}{isMyTurn() ? ' (you)' : ''}</div>
        <div class="text-3xl font-bold">Counter: {counter}</div>
    </div>

    <button
            class="px-4 py-2 rounded text-white disabled:opacity-50"
            class:bg-gray-500={!isMyTurn()}
            class:bg-green-600={isMyTurn()}
            disabled={!isMyTurn()}
            on:click={increment}
    >
        Increment
    </button>
</div>


