import { describe, expect, it } from "bun:test";
import * as djs from "@lunacord/discordjs";

describe("@lunacord/discordjs public API", () => {
  it("exposes MusicKit + CommandRegistry", () => {
    expect(djs).toHaveProperty("MusicKit");
    expect(djs).toHaveProperty("CommandRegistry");
    expect(typeof djs.MusicKit.create).toBe("function");
  });

  it("exposes default embeds + messages", () => {
    expect(djs).toHaveProperty("defaultEmbedFactory");
    expect(djs).toHaveProperty("DEFAULT_MESSAGES");
    expect(typeof djs.resolveMessage).toBe("function");
  });
});
