import { describe, expect, it } from "bun:test";
import { Lunacord, PluginValidationError } from "@lunacord/core";

describe("Plugin dependency validation", () => {
  it("should reject plugins with missing dependencies", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    try {
      lunacord.use({
        apiVersion: "1",
        dependencies: [{ name: "metrics-core", version: "1.0.0" }],
        name: "dependent-plugin",
        version: "1.0.0",
      });
      throw new Error("Expected lunacord.use to throw PluginValidationError");
    } catch (error) {
      expect(error).toBeInstanceOf(PluginValidationError);
      if (!(error instanceof PluginValidationError)) {
        return;
      }

      expect(error.code).toBe("PLUGIN_DEPENDENCY_MISSING");
    }
  });
});
