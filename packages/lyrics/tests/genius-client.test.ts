import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { RawTrack } from "@lunacord/core";
import { Track } from "@lunacord/core";
import { GeniusClient } from "@lunacord/lyrics";

const MOCK_RAW_TRACK: RawTrack = {
  encoded: "QAABJAMACk5ldmVyIEdvbm5h...",
  info: {
    identifier: "dQw4w9WgXcQ",
    isSeekable: true,
    author: "Rick Astley",
    length: 212_000,
    isStream: false,
    position: 0,
    title: "Never Gonna Give You Up",
    uri: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const FADED_RAW_TRACK: RawTrack = {
  encoded: "QAABJAMACkZhZGVk...",
  info: {
    identifier: "60ItHLz5WEA",
    isSeekable: true,
    author: "Alan Walker",
    length: 212_000,
    isStream: false,
    position: 0,
    title: "Faded",
    uri: "https://www.youtube.com/watch?v=60ItHLz5WEA",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const originalFetch = globalThis.fetch;

describe("GeniusClient", () => {
  const track = new Track(MOCK_RAW_TRACK);

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should resolve lyrics from Genius search and page HTML", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.genius.com/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: {
                hits: [
                  {
                    result: {
                      id: 42,
                      title: "Never Gonna Give You Up",
                      url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
                      song_art_image_url: "https://images.genius.com/cover.jpg",
                      release_date_for_display: "July 27, 1987",
                      primary_artist: {
                        name: "Rick Astley",
                      },
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          '<html><body><div data-lyrics-container="true">Never gonna give you up<br>Never gonna let you down</div></body></html>',
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "found",
      lyrics: {
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
        lyricsText: "Never gonna give you up\nNever gonna let you down",
        albumArtUrl: "https://images.genius.com/cover.jpg",
        releaseDate: "July 27, 1987",
        geniusId: 42,
      },
    });
  });

  it("should keep lyrics after nested div tags inside a lyrics container", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.genius.com/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: {
                hits: [
                  {
                    result: {
                      id: 42,
                      title: "Never Gonna Give You Up",
                      url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
                      song_art_image_url: "https://images.genius.com/cover.jpg",
                      release_date_for_display: "July 27, 1987",
                      primary_artist: {
                        name: "Rick Astley",
                      },
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          '<html><body><div data-lyrics-container="true">Never gonna<div>give you up</div>Never gonna let you down</div></body></html>',
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "found",
      lyrics: {
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
        lyricsText: "Never gonnagive you up\nNever gonna let you down",
        albumArtUrl: "https://images.genius.com/cover.jpg",
        releaseDate: "July 27, 1987",
        geniusId: 42,
      },
    });
  });

  it("should return not_found when Genius search returns no hits", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              hits: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    ) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("should return unavailable for invalid credentials", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 401 }))
    ) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "invalid_token",
    });
  });

  it("should return unavailable when rate limited", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 429 }))
    ) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "rate_limited",
    });
  });

  it("should return unavailable when the provider cannot be reached", async () => {
    globalThis.fetch = mock(() =>
      Promise.reject(new Error("network down"))
    ) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
    });
  });

  it("should return unavailable when Genius page parsing fails", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.genius.com/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: {
                hits: [
                  {
                    result: {
                      id: 42,
                      title: "Never Gonna Give You Up",
                      url: "https://genius.com/Rick-astley-never-gonna-give-you-up-lyrics",
                      song_art_image_url: null,
                      release_date_for_display: null,
                      primary_artist: {
                        name: "Rick Astley",
                      },
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response("<html><body><main>No lyrics here</main></body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        })
      );
    }) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "unsupported",
    });
  });

  it("should strip Genius contributor and translation chrome from lyrics text", async () => {
    const fadedTrack = new Track(FADED_RAW_TRACK);

    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.genius.com/search")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              response: {
                hits: [
                  {
                    result: {
                      id: 42,
                      title: "Faded",
                      url: "https://genius.com/Alan-walker-faded-lyrics",
                      song_art_image_url: null,
                      release_date_for_display: null,
                      primary_artist: {
                        name: "Alan Walker",
                      },
                    },
                  },
                ],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        );
      }

      return Promise.resolve(
        new Response(
          "<html><body><div data-lyrics-container=\"true\">270 ContributorsTranslationsDansk<br>Español<br>Português<br>Français<br>[Pre-Chorus]<br>Where are you now?<br>Where are you now?<br>[Chorus]<br>I'm faded, I'm faded<br>123Embed</div></body></html>",
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new GeniusClient({
      clientId: "client-id",
      clientSecret: "client-secret",
      accessToken: "access-token",
    });

    await expect(
      client.getLyricsForTrack(fadedTrack, { query: "Alan Walker Faded" })
    ).resolves.toEqual({
      status: "found",
      lyrics: {
        title: "Faded",
        artist: "Alan Walker",
        url: "https://genius.com/Alan-walker-faded-lyrics",
        lyricsText:
          "[Pre-Chorus]\nWhere are you now?\nWhere are you now?\n[Chorus]\nI'm faded, I'm faded",
        albumArtUrl: null,
        releaseDate: null,
        geniusId: 42,
      },
    });
  });

  it("should return missing_credentials when Genius is not configured", async () => {
    const client = new GeniusClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "missing_credentials",
    });
  });
});
