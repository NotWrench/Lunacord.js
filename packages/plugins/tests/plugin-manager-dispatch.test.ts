import { describe, expect, it } from "bun:test";
import type { LunacordEvents } from "@lunacord/core";
import { CacheManager, TypedEventEmitter } from "@lunacord/core";
import { PluginManager } from "@lunacord/plugins";

describe("PluginManager", () => {
  it("should dispatch observe hooks in registration order", async () => {
    const cacheManager = new CacheManager();
    const events = new TypedEventEmitter<LunacordEvents>();
    const observed: string[] = [];
    const pluginErrors: string[] = [];
    const manager = new PluginManager({
      cacheNamespace: (namespace) => cacheManager.cache(namespace),
      events,
      getNodes: () => [],
      getPlayer: () => undefined,
      onPluginError: (event) => {
        pluginErrors.push(event.plugin.name);
      },
    });

    manager.use({
      apiVersion: "1",
      name: "alpha",
      version: "1.0.0",
      observe: (event) => {
        observed.push(`alpha:${event.type}`);
      },
    });
    manager.use({
      apiVersion: "1",
      name: "beta",
      version: "1.0.0",
      observe: (event) => {
        observed.push(`beta:${event.type}`);
      },
    });

    manager.dispatch({
      type: "nodeCreate",
      node: {} as never,
    });
    await Promise.resolve();

    expect(observed).toEqual(["alpha:nodeCreate", "beta:nodeCreate"]);
    expect(pluginErrors).toHaveLength(0);
  });
});
