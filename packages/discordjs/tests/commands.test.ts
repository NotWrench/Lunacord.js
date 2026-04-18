import { describe, expect, it } from "bun:test";
import { DEFAULT_MESSAGES, resolveMessage } from "../src";
import { getDefaultCommands } from "../src/commands";

describe("@lunacord/discordjs defaults", () => {
  it("ships 18 default slash commands", () => {
    const commands = getDefaultCommands();
    expect(commands.length).toBe(18);
  });

  it("each command has a non-empty name and a description", () => {
    for (const command of getDefaultCommands()) {
      expect(command.data.name).toBeTruthy();
      expect((command.data as { description?: string }).description).toBeTruthy();
      expect(typeof command.execute).toBe("function");
    }
  });

  it("default command names are unique", () => {
    const names = getDefaultCommands().map((c) => c.data.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("resolveMessage interpolates ${var} templates", () => {
    const msg = resolveMessage(DEFAULT_MESSAGES, "nowPlaying", { title: "Song" });
    expect(msg).toBe("Now playing: **Song**");
  });
});
