import { describe, expect, it } from "bun:test";
import * as lyrics from "@lunacord/lyrics";

describe("@lunacord/lyrics public API", () => {
  it("exposes the LyricsClient + fluent builder", () => {
    expect(lyrics).toHaveProperty("LyricsClient");
    expect(lyrics).toHaveProperty("LyricsBuilder");
    expect(typeof lyrics.LyricsClient.create).toBe("function");
  });

  it("exposes every provider", () => {
    expect(lyrics).toHaveProperty("GeniusClient");
    expect(lyrics).toHaveProperty("GeniusOAuthHelper");
    expect(lyrics).toHaveProperty("LyricsOvhClient");
  });
});
