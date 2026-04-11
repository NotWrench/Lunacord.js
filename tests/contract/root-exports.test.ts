import { describe, expect, it } from "bun:test";
import * as root from "lunacord.js";

describe("Root exports", () => {
  it("should expose the stable high-level public API", () => {
    expect(root).toHaveProperty("Lunacord");
    expect(root).not.toHaveProperty("NodeBuilder");
    expect(root).not.toHaveProperty("PlayerBuilder");
    expect(root).not.toHaveProperty("PluginBuilder");
    expect(root).not.toHaveProperty("SearchProvider");
    expect(root).not.toHaveProperty("lavalinkSchemas");
  });
});
