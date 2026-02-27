import {Client, Room} from "colyseus";
import {MyRoomState} from "./schema/MyRoomState";
import {getPool} from "../db";
import {createTokenBucket, getServerConfig} from "@skjoldjasper/shared";

export class MyRoom extends Room<MyRoomState> {
    maxClients = 4;

    private messageLimiter = createTokenBucket(getServerConfig().rateLimit.colyseusMessages);

    onCreate(options: any) {
        this.state = new MyRoomState();

        this.onMessage("increment", (client) => {
            // simple per-client rate limit: max 10 msgs/sec
            if (!this.messageLimiter.consume(client.sessionId)) {
                return;
            }
            const {players, currentIndex} = this.state;
            if (players.length === 0) return;
            const currentPlayer = players[currentIndex];
            if (client.sessionId !== currentPlayer) return; // not your turn

            this.state.counter += 1;
            this.state.currentIndex = (currentIndex + 1) % players.length;

            // persist to database (fire-and-forget)
            void this.persistRoomState(client);
        });
    }

    onJoin(client: Client, _options: any) {
        console.log(client.sessionId, "joined!");
        // add new player if not present
        if (!this.state.players.includes(client.sessionId)) {
            this.state.players.push(client.sessionId);
            // ensure currentIndex points to a valid player
            if (this.state.players.length === 1) {
                this.state.currentIndex = 0;
            }
        }
    }

    onLeave(client: Client, _consented: boolean) {
        console.log(client.sessionId, "left!");
        const idx = this.state.players.indexOf(client.sessionId);
        if (idx >= 0) {
            this.state.players.splice(idx, 1);
            // adjust currentIndex if needed
            if (this.state.players.length === 0) {
                this.state.currentIndex = 0;
            } else if (idx < this.state.currentIndex) {
                this.state.currentIndex -= 1;
            } else if (idx === this.state.currentIndex) {
                this.state.currentIndex = this.state.currentIndex % this.state.players.length;
            }
        }
    }

    override async onAuth(client: Client, options: any, _request?: any): Promise<boolean> {
        // Restore room state from database
        await this.restoreFromDatabase();
        return true;
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

    private async persistRoomState(client: Client): Promise<void> {
        const pool = getPool();
        await pool.query(
            `INSERT INTO game_room_states (room_id, counter, updated_at)
             VALUES ($1, $2, now())
             ON CONFLICT (room_id) DO UPDATE SET counter = $2, updated_at = now()`,
            [this.roomId, this.state.counter]
        );
    }

    private async restoreFromDatabase(): Promise<void> {
        const pool = getPool();
        const result = await pool.query(
            `SELECT counter FROM game_room_states WHERE room_id = $1`,
            [this.roomId]
        );

        if (result.rows.length > 0) {
            this.state.counter = result.rows[0].counter;
        }
    }
}
