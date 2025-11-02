import { Room, Client } from "colyseus";
import { MyRoomState } from "./schema/MyRoomState";
import { getPool } from "../db";
import { createTokenBucket, getServerConfig } from "@skjoldjasper/shared";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;

  private streamIdForEvents: string = "";
  private messageLimiter = createTokenBucket(getServerConfig().rateLimit.colyseusMessages);

  onCreate (options: any) {
    this.setState(new MyRoomState());

    // choose stable stream id if provided by join options; otherwise use roomId
    this.streamIdForEvents = String(options?.streamId ?? this.roomId);

    this.onMessage("increment", (client) => {
      // simple per-client rate limit: max 10 msgs/sec
      if (!this.messageLimiter.consume(client.sessionId)) {
        return;
      }
      const { players, currentIndex } = this.state;
      if (players.length === 0) return;
      const currentPlayer = players[currentIndex];
      if (client.sessionId !== currentPlayer) return; // not your turn

      this.state.counter += 1;
      this.state.currentIndex = (currentIndex + 1) % players.length;

      // persist event and optional snapshot (fire-and-forget)
      void this.appendIncrementEvent(client);
    });
  }

  onJoin (client: Client, options: any) {
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

  // rate limiting handled by shared token bucket

  onLeave (client: Client, consented: boolean) {
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

  private async appendIncrementEvent(client: Client): Promise<void> {
    const pool = getPool();
    const streamId = this.streamIdForEvents;
    const context = "game";
    const streamCategory = "room";
    const type = "Incremented";
    const payload = { delta: 1 };
    const metadata = { sessionId: client.sessionId };

    // compute next version atomically enough for single-writer per room
    const { rows: vrows } = await pool.query<{ max_v: number }>(
      'SELECT COALESCE(MAX(version), -1) AS max_v FROM events WHERE stream_id = $1',
      [streamId]
    );
    const nextVersion = (vrows[0]?.max_v ?? -1) + 1;

    await pool.query(
      `INSERT INTO events (event_id, context, stream_category, stream_id, version, type, payload, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)`,
      [
        crypto.randomUUID(),
        context,
        streamCategory,
        streamId,
        nextVersion,
        type,
        JSON.stringify(payload),
        JSON.stringify(metadata)
      ]
    );

    // snapshot every 25 events
    if ((nextVersion + 1) % 25 === 0) {
      const snapshotPayload = {
        counter: this.state.counter
      };
      await pool.query(
        `INSERT INTO aggregate_snapshots (context, stream_category, stream_id, version, payload)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT (context, stream_category, stream_id, version) DO NOTHING`,
        [
          context,
          streamCategory,
          streamId,
          nextVersion,
          JSON.stringify(snapshotPayload)
        ]
      );
    }
  }

  override async onAuth(client: Client, options: any, request?: any): Promise<boolean> {
    // on first auth per connection, attempt to restore from snapshot+tail
    // ensure stream id is determined here as well (for clients using join options)
    this.streamIdForEvents = String(options?.streamId ?? (this.streamIdForEvents || this.roomId));
    await this.restoreFromStorage();
    return true;
  }

  private async restoreFromStorage(): Promise<void> {
    const pool = getPool();
    const context = "game";
    const streamCategory = "room";
    const streamId = this.streamIdForEvents || this.roomId;

    // latest snapshot
    const snap = await pool.query<{ version: number; payload: any }>(
      `SELECT version, payload FROM aggregate_snapshots
       WHERE context=$1 AND stream_category=$2 AND stream_id=$3
       ORDER BY version DESC LIMIT 1`,
      [context, streamCategory, streamId]
    );
    let baseVersion = -1;
    if (snap.rowCount && snap.rows[0]) {
      const payload = snap.rows[0].payload as any;
      this.state.counter = Number(payload?.counter ?? 0);
      baseVersion = snap.rows[0].version;
    }

    // tail events
    const tail = await pool.query<{ type: string; payload: any }>(
      `SELECT type, payload FROM events
       WHERE stream_id=$1 AND version > $2
       ORDER BY version ASC`,
      [streamId, baseVersion]
    );
    for (const row of tail.rows) {
      if (row.type === 'Incremented') {
        this.state.counter += Number((row.payload as any)?.delta ?? 1);
      }
    }
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
