import { describe, expect, it } from "bun:test";
import { Lunacord } from "../../../src/core/Lunacord";
import { PluginValidationError } from "../../../src/errors/PluginValidationError";

describe("Plugin dependency validation", () => {
  it("should reject plugins with missing dependencies", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(() =>
      lunacord.use({
        apiVersion: "1",
        dependencies: [{ name: "metrics-core", version: "1.0.0" }],
        name: "dependent-plugin",
        version: "1.0.0",
      })
    ).toThrow(PluginValidationError);
  });
});
