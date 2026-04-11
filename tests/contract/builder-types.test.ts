import { describe, expect, it } from "bun:test";
import { Lunacord } from "../../src/core/Lunacord";

describe("Builder contracts", () => {
  it("should expose fluent builders from Lunacord", () => {
    const client = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(typeof client.createNode().setHost).toBe("function");
    expect(typeof client.createPlayer().setGuild).toBe("function");
    expect(typeof client.createPlugin("contract-plugin", "1.0.0").build).toBe("function");
  });
});
