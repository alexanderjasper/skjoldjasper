import {Client, Room} from "colyseus.js";
import {cli, Options} from "@colyseus/loadtest";

export async function main(options: Options) {
    const client = new Client(options.endpoint);
    const room: Room = await client.joinOrCreate(options.roomName, {streamId: "demo"});

    console.log("joined successfully!", room.sessionId);

    // Throttle state logs to avoid console spam
    let lastLog = 0;
    room.onStateChange((state: any) => {
        const now = Date.now();
        if (now - lastLog > 500) {
            console.log("counter:", state.counter, "players:", state.players?.length, "currentIndex:", state.currentIndex);
            lastLog = now;
        }
    });

    // try send increment at 20Hz; only takes effect on your turn
    const interval = setInterval(() => {
        room.send("increment");
    }, 50);

    // Ensure test stops after duration (seconds)
    const durationMs = Math.max(1, Number((options as any).duration ?? 3)) * 1000;
    const stopper = setTimeout(async () => {
        clearInterval(interval);
        try {
            await room.leave();
        } catch {
        }
        try {
            client.close();
        } catch {
        }
        // Exit so CI/terminals don't hang
        process.exit(0);
    }, durationMs);

    room.onLeave(() => {
        clearInterval(interval);
        clearTimeout(stopper);
    });
}

cli(main);
