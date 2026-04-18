import { describe, expect, it } from "bun:test";
import { Lunacord, MemoryPersistenceAdapter } from "@lunacord/core";

describe("Persistence", () => {
  it("persists a snapshot when a player is created, and removes it on destroy", async () => {
    const adapter = new MemoryPersistenceAdapter();
    const lunacord = new Lunacord({
      userId: "u",
      numShards: 1,
      nodes: [{ id: "n", host: "h", port: 80, password: "p" }],
      persistence: adapter,
    });
    const node = lunacord.getNode("n");
    node!.sessionId = "sess";

    const player = lunacord.createPlayer("g1");
    // playerCreate is emitted via queueMicrotask; flush microtasks.
    await Promise.resolve();

    expect(adapter.list()).toContain("g1");
    const snapshot = adapter.load("g1");
    expect(snapshot?.guildId).toBe("g1");
    expect(snapshot?.nodeId).toBe("n");
    expect(player.guildId).toBe("g1");

    node!.emit("playerDestroy", { guildId: "g1" });
    await Promise.resolve();

    expect(adapter.list()).not.toContain("g1");
  });
});
