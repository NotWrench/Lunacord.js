import { describe, expect, it } from "bun:test";
import * as pluginExports from "../../src/plugins";

describe("Plugin exports", () => {
  it("should expose plugin types, runtime, and builtins from the plugin subpath", () => {
    expect(pluginExports).toHaveProperty("PluginBuilder");
    expect(pluginExports).toHaveProperty("PluginManager");
    expect(pluginExports).toHaveProperty("createLoggerPlugin");
    expect(pluginExports).toHaveProperty("createMetricsPlugin");
    expect(pluginExports).toHaveProperty("LUNACORD_PLUGIN_API_VERSION");
  });
});
