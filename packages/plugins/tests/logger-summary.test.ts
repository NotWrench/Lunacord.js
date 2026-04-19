import { describe, expect, it } from "bun:test";
import { summarizePluginObserveEvent } from "../src/builtins/logger";

describe("summarizePluginObserveEvent", () => {
  it("replaces Node with a small summary", () => {
    const node = {
      id: "main",
      sessionId: "abc",
      connected: true,
      rest: { baseUrl: "http://localhost" },
      socket: { ws: true },
      players: new Map([["g1", {}]]),
    };
    const summary = summarizePluginObserveEvent({
      type: "nodeStats",
      op: "stats",
      players: 0,
      node: node as never,
    } as never) as Record<string, unknown>;

    expect(summary.type).toBe("nodeStats");
    expect(summary.op).toBe("stats");
    expect(summary.players).toBe(0);
    const n = summary.node as Record<string, unknown>;
    expect(n._type).toBe("Node");
    expect(n.id).toBe("main");
    expect(n.sessionId).toBe("abc");
    expect(n.playerCount).toBe(1);
    expect("rest" in n).toBe(false);
  });

  it("replaces Player and Track", () => {
    const player = { guildId: "g1", queue: {}, history: {} };
    const track = {
      encoded: "QAA",
      title: "Song",
      author: "A",
      duration: 1000,
      sourceName: "youtube",
    };
    const summary = summarizePluginObserveEvent({
      type: "playerPlay",
      guildId: "g1",
      source: "queue",
      player: player as never,
      track: track as never,
      node: {
        id: "n",
        sessionId: null,
        connected: true,
        rest: {},
        socket: {},
        players: new Map(),
      } as never,
    } as never) as Record<string, unknown>;

    expect((summary.player as { _type?: string })._type).toBe("Player");
    expect((summary.track as { title?: string }).title).toBe("Song");
  });
});
