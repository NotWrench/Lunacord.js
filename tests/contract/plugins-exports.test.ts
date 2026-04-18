import { describe, expect, it } from "bun:test";
import * as plugins from "@lunacord/plugins";

describe("@lunacord/plugins public API", () => {
  it("re-exports plugin primitives from core", () => {
    expect(plugins).toHaveProperty("LUNACORD_PLUGIN_API_VERSION");
    expect(plugins).toHaveProperty("PluginBuilder");
  });

  it("exposes all builtins", () => {
    expect(plugins).toHaveProperty("createLoggerPlugin");
    expect(plugins).toHaveProperty("createMetricsPlugin");
    expect(plugins).toHaveProperty("createDebugPlugin");
    expect(plugins).toHaveProperty("createAutoplayPlugin");
    expect(plugins).toHaveProperty("createStatsReporterPlugin");
  });
});
