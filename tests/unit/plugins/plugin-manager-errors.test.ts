import { describe, expect, it } from "bun:test";
import { CacheManager } from "../../../src/cache/CacheManager";
import type { LunacordEvents } from "../../../src/core/Lunacord";
import { PluginValidationError } from "../../../src/errors/PluginValidationError";
import { PluginManager } from "../../../src/plugins/runtime/PluginManager";
import { TypedEventEmitter } from "../../../src/utils/EventEmitter";

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
