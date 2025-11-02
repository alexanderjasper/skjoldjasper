import { Room, Client } from "colyseus";
import { MyRoomState } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;

  onCreate (options: any) {
    this.setState(new MyRoomState());

    this.onMessage("increment", (client) => {
      const { players, currentIndex } = this.state;
      if (players.length === 0) return;
      const currentPlayer = players[currentIndex];
      if (client.sessionId !== currentPlayer) return; // not your turn

      this.state.counter += 1;
      this.state.currentIndex = (currentIndex + 1) % players.length;
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

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
