import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { LyricsClient } from "../lyrics/LyricsClient";
import { Track } from "../structures/Track";
import type { RawTrack } from "../types";

const MOCK_TRACK: RawTrack = {
  encoded: "encoded",
  info: {
    identifier: "id",
    isSeekable: true,
    author: "Alan Walker",
    length: 1000,
    isStream: false,
    position: 0,
    title: "Faded",
    uri: "https://example.com",
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const originalFetch = globalThis.fetch;

describe("LyricsClient", () => {
  const track = new Track(MOCK_TRACK);

  beforeEach(() => {
    globalThis.fetch = originalFetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("should short-circuit when lyrics.ovh succeeds", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Primary lyrics" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    ) as unknown as typeof fetch;

    const client = new LyricsClient();

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Primary lyrics",
      },
    });
  });

  it("should use Genius fallback when lyrics.ovh returns not_found", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.lyrics.ovh")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }

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
          '<html><body><div data-lyrics-container="true">I\'m faded</div></body></html>',
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new LyricsClient({
      genius: {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
      },
    });

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "I'm faded",
      },
    });
  });

  it("should use Genius fallback when lyrics.ovh is unavailable", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.lyrics.ovh")) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

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
          '<html><body><div data-lyrics-container="true">Where are you now?</div></body></html>',
          { status: 200, headers: { "Content-Type": "text/html" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new LyricsClient({
      genius: {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
      },
    });

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Where are you now?",
      },
    });
  });

  it("should return not_found when lyrics.ovh misses and Genius is not configured", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(null, { status: 404 }))
    ) as unknown as typeof fetch;

    const client = new LyricsClient();

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("should return not_found when lyrics.ovh is unavailable and Genius returns not_found", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.lyrics.ovh")) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            response: {
              hits: [],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    }) as unknown as typeof fetch;

    const client = new LyricsClient({
      genius: {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
      },
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "not_found",
    });
  });

  it("should return unavailable when both providers are unavailable", async () => {
    globalThis.fetch = mock((input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://api.lyrics.ovh")) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      return Promise.resolve(new Response(null, { status: 429 }));
    }) as unknown as typeof fetch;

    const client = new LyricsClient({
      genius: {
        clientId: "client-id",
        clientSecret: "client-secret",
        accessToken: "access-token",
      },
    });

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "rate_limited",
    });
  });
});
