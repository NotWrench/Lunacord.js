import { describe, expect, it } from "bun:test";
import { buildSearchIdentifier, SearchProvider } from "../../../src/types";

describe("buildSearchIdentifier", () => {
  it("should prefix non-url queries with the provider", () => {
    const identifier = buildSearchIdentifier("never gonna give you up", SearchProvider.SoundCloud);

    expect(identifier).toBe("scsearch:never gonna give you up");
  });

  it("should return a normalized query URL without provider prefix", () => {
    const identifier = buildSearchIdentifier(
      "  https://www.youtube.com/watch?v=dQw4w9WgXcQ  ",
      SearchProvider.YouTube
    );

    expect(identifier).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });

  it("should accept a provider URL as the identifier", () => {
    const identifier = buildSearchIdentifier(
      "never gonna give you up",
      "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"
    );

    expect(identifier).toBe("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");
  });

  it("should unwrap angle-bracket URLs", () => {
    const identifier = buildSearchIdentifier(
      "<https://soundcloud.com/rickastleyofficial/never-gonna-give-you-up-7>"
    );

    expect(identifier).toBe("https://soundcloud.com/rickastleyofficial/never-gonna-give-you-up-7");
  });
});
