import { describe, expect, it } from "bun:test";
import { Lunacord } from "@lunacord/core";

describe("Lunacord builder-first API", () => {
  it("Lunacord.create() returns a fluent builder", () => {
    const builder = Lunacord.create();
    expect(typeof builder.userId).toBe("function");
    expect(typeof builder.shards).toBe("function");
    expect(typeof builder.build).toBe("function");
    expect(typeof builder.nodeSelection.leastLoaded).toBe("function");
    expect(typeof builder.cache.memory).toBe("function");
  });

  it("build() returns a working Lunacord instance", () => {
    const lunacord = Lunacord.create().userId("user-1").shards(1).build();
    expect(typeof lunacord.getNodes).toBe("function");
    expect(typeof lunacord.bindIdentity).toBe("function");
    expect(typeof lunacord.lyrics).toBe("function");
    expect(typeof lunacord.persistence).toBe("function");
    expect(typeof lunacord.emitDebug).toBe("function");
  });
});
