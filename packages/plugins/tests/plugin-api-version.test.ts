import { describe, expect, it } from "bun:test";
import { Lunacord, PluginValidationError } from "@lunacord/core";

describe("Plugin apiVersion compatibility", () => {
  it("should reject unsupported plugin api versions", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(() =>
      lunacord.use({
        apiVersion: "99",
        name: "future-plugin",
        version: "1.0.0",
      })
    ).toThrow(PluginValidationError);
  });

  it("should accept v1 plugins for backward compatibility", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(() =>
      lunacord.use({
        apiVersion: "1",
        name: "legacy-plugin",
        version: "1.0.0",
      })
    ).not.toThrow();
  });

  it("should accept v2 plugins (current)", () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });

    expect(() =>
      lunacord.use({
        apiVersion: "2",
        name: "current-plugin",
        version: "1.0.0",
      })
    ).not.toThrow();
  });
});
