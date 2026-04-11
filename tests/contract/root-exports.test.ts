import { describe, expect, it } from "bun:test";
import * as root from "../../src/index";

describe("Root exports", () => {
  it("should expose the stable high-level public API", () => {
    expect(root).toHaveProperty("Lunacord");
    expect(root).toHaveProperty("Node");
    expect(root).toHaveProperty("Player");
    expect(root).toHaveProperty("Cache");
    expect(root).toHaveProperty("PluginBuilder");
    expect(root).toHaveProperty("SearchProvider");
    expect(root).toHaveProperty("lavalinkSchemas");
  });
});
