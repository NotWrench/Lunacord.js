import { describe, expect, it } from "bun:test";
import * as lyricsExports from "../../src/integrations/lyrics";

describe("Lyrics exports", () => {
  it("should expose lyrics clients from the lyrics subpath", () => {
    expect(lyricsExports).toHaveProperty("LyricsClient");
    expect(lyricsExports).toHaveProperty("LyricsOvhClient");
    expect(lyricsExports).toHaveProperty("GeniusClient");
    expect(lyricsExports).toHaveProperty("GeniusOAuthHelper");
  });
});
