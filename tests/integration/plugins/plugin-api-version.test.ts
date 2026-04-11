import { describe, expect, it } from "bun:test";
import { Lunacord } from "../../../src/core/Lunacord";
import { PluginValidationError } from "../../../src/errors/PluginValidationError";

describe("Plugin apiVersion compatibility", () => {
  it("should reject unsupported plugin api versions", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(() =>
      lunacord.use({
        apiVersion: "2",
        name: "future-plugin",
        version: "1.0.0",
      })
    ).toThrow(PluginValidationError);
  });
});
