import { describe, expect, it } from "bun:test";
import type { LunacordEvents } from "@lunacord/core";
import { CacheManager, PluginValidationError, TypedEventEmitter } from "@lunacord/core";
import { PluginManager } from "@lunacord/plugins";

const createManager = () => {
  const cacheManager = new CacheManager();
  return new PluginManager({
    cacheNamespace: (namespace) => cacheManager.cache(namespace),
    events: new TypedEventEmitter<LunacordEvents>(),
    getNodes: () => [],
    getPlayer: () => undefined,
    onPluginError: () => {},
  });
};

describe("PluginManager validation", () => {
  it("should reject duplicate plugin names", () => {
    const manager = createManager();

    manager.use({
      apiVersion: "1",
      name: "dup",
      version: "1.0.0",
    });

    expect(() =>
      manager.use({
        apiVersion: "1",
        name: "dup",
        version: "1.0.1",
      })
    ).toThrow(PluginValidationError);
  });
});
