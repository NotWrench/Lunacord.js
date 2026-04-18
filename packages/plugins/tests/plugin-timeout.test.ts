import { describe, expect, it } from "bun:test";
import { Lunacord } from "@lunacord/core";

describe("Plugin timeout isolation", () => {
  it("should emit pluginError when a plugin hook times out", async () => {
    const lunacord = new Lunacord({
      nodes: [],
      numShards: 1,
      userId: "user-123",
    });
    const pluginErrors: string[] = [];

    lunacord.on("pluginError", ({ plugin, hook }) => {
      pluginErrors.push(`${plugin.name}:${hook}`);
    });

    lunacord.use({
      apiVersion: "1",
      name: "slow-observer",
      timeouts: {
        observe: 1,
      },
      version: "1.0.0",
      observe: async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 10);
        });
      },
    });

    (
      lunacord as unknown as {
        emitObserved: (type: "nodeCreate", payload: { node: unknown }) => void;
      }
    ).emitObserved("nodeCreate", {
      node: {},
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    expect(pluginErrors).toContain("slow-observer:observe");
  });
});
