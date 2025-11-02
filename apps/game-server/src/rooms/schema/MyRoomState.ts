import { Schema, type, ArraySchema } from "@colyseus/schema";

export class MyRoomState extends Schema {
  @type("number") counter: number = 0;

  // Ordered list of player sessionIds
  @type(["string"]) players: ArraySchema<string> = new ArraySchema<string>();

  // Index into `players` for whose turn it is
  @type("number") currentIndex: number = 0;
}
