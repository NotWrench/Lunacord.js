import { describe, expect, it } from "bun:test";
import type { DebugEvent } from "@lunacord/core";
import { Lunacord } from "@lunacord/core";

describe("Unified debug event", () => {
  it("emits a typed debug event from the manager", () => {
    const lunacord = Lunacord.create().userId("u").shards(1).build();
    const received: DebugEvent[] = [];
    lunacord.on("debug", (event) => received.push(event));

    lunacord.emitDebug("manager", "hello", { hint: "world" });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      scope: "manager",
      message: "hello",
      data: { hint: "world" },
    });
  });

  it("forwards node debug events into the unified debug channel", () => {
    const lunacord = new Lunacord({
      userId: "u",
      numShards: 1,
      nodes: [{ id: "n1", host: "h", port: 80, password: "p" }],
    });
    const received: DebugEvent[] = [];
    lunacord.on("debug", (event) => received.push(event));
    const node = lunacord.getNode("n1");

    node?.emit("debug", {
      category: "player",
      message: "ping",
      context: { guildId: "g" },
    });

    expect(received).toHaveLength(1);
    expect(received[0]?.scope).toBe("player");
    expect(received[0]?.nodeId).toBe("n1");
  });
});
