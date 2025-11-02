import { Client, Room } from "colyseus.js";
import { cli, Options } from "@colyseus/loadtest";

export async function main(options: Options) {
    const client = new Client(options.endpoint);
    const room: Room = await client.joinOrCreate(options.roomName, {});

    console.log("joined successfully!", room.sessionId);

    room.onStateChange((state: any) => {
        console.log("counter:", state.counter, "players:", state.players, "currentIndex:", state.currentIndex);
    });

    // try send increment every 1s; only takes effect on your turn
    const interval = setInterval(() => {
        room.send("increment");
    }, 1000);

    room.onLeave(() => {
        clearInterval(interval);
    });
}

cli(main);
