import { describe, expect, it } from "bun:test";
import * as core from "@lunacord/core";

describe("@lunacord/core public API", () => {
  it("exposes the primary manager", () => {
    expect(core).toHaveProperty("Lunacord");
    expect(typeof core.Lunacord.create).toBe("function");
  });

  it("exposes builders", () => {
    expect(core).toHaveProperty("LunacordBuilder");
    expect(core).toHaveProperty("NodeBuilder");
    expect(core).toHaveProperty("PlayerBuilder");
    expect(core).toHaveProperty("PluginBuilder");
  });

  it("exposes search helpers from root (smart URL detection)", () => {
    expect(core).toHaveProperty("SearchProvider");
    expect(core).toHaveProperty("buildSearchIdentifier");
    expect(core).toHaveProperty("buildProviderSequence");
    expect(core).toHaveProperty("detectProviderFromUrl");
  });

  it("exposes the unified plugin API version", () => {
    expect(core.LUNACORD_PLUGIN_API_VERSION).toBe("2");
    expect(core.LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS).toContain("1");
    expect(core.LUNACORD_PLUGIN_SUPPORTED_API_VERSIONS).toContain("2");
  });

  it("exposes error classes with .hint support", () => {
    expect(core).toHaveProperty("LavalinkConnectionError");
    expect(core).toHaveProperty("NodeUnavailableError");
    expect(core).toHaveProperty("InvalidNodeStateError");
    expect(core).toHaveProperty("InvalidPlayerStateError");
    expect(core).toHaveProperty("IdentityError");
  });

  it("exposes persistence + cache primitives", () => {
    expect(core).toHaveProperty("MemoryPersistenceAdapter");
    expect(core).toHaveProperty("MemoryCacheStore");
    expect(core).toHaveProperty("NoopCacheStore");
  });
});
