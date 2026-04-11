import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Cache } from "../../../src/cache/Cache";
import { MemoryCacheStore } from "../../../src/cache/stores/MemoryCacheStore";
import type { CacheStore } from "../../../src/cache/types";
import { Track } from "../../../src/domain/track/Track";
import { LyricsClient } from "../../../src/integrations/lyrics/LyricsClient";
import type { RawTrack } from "../../../src/types";

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
  const createClient = (
    options?: ConstructorParameters<typeof LyricsClient>[0],
    store?: CacheStore
  ): LyricsClient =>
    new LyricsClient(options, {
      cache: new Cache(store ?? new MemoryCacheStore(), "lyrics"),
    });

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

    const client = createClient();

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

    const client = createClient({
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

    const client = createClient({
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

    const client = createClient();

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

    const client = createClient({
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

    const client = createClient({
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

  it("should cache results for active tracks", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Cached lyrics" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createClient();
    client.markTrackActive("guild-a", track);

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Cached lyrics",
      },
    });

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Cached lyrics",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should not cache unavailable results for active tracks", async () => {
    let requestCount = 0;
    globalThis.fetch = mock(() => {
      requestCount += 1;
      if (requestCount === 1) {
        return Promise.resolve(new Response(null, { status: 503 }));
      }

      return Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Recovered lyrics" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    }) as unknown as typeof fetch;

    const client = createClient();
    client.markTrackActive("guild-a", track);

    await expect(client.getLyricsForTrack(track)).resolves.toEqual({
      status: "unavailable",
      reason: "provider_unavailable",
    });

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Recovered lyrics",
      },
    });

    expect(requestCount).toBe(2);
  });

  it("should keep cache while at least one guild is active and evict after the last guild ends", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Shared cache lyrics" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const client = createClient();
    client.markTrackActive("guild-a", track);
    client.markTrackActive("guild-b", track);

    await client.getLyricsForTrack(track);
    await client.getLyricsForTrack(track);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    client.markTrackInactive("guild-a");
    await client.getLyricsForTrack(track);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    client.markTrackInactive("guild-b");
    await client.getLyricsForTrack(track);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should dedupe concurrent requests for the same active track", async () => {
    let callCount = 0;
    globalThis.fetch = mock(() => {
      callCount += 1;
      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(
            new Response(JSON.stringify({ lyrics: "Concurrent lyrics" }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            })
          );
        }, 5);
      });
    }) as unknown as typeof fetch;

    const client = createClient();
    client.markTrackActive("guild-a", track);

    const [first, second] = await Promise.all([
      client.getLyricsForTrack(track),
      client.getLyricsForTrack(track),
    ]);

    expect(first).toEqual(second);
    expect(callCount).toBe(1);
  });

  it("should continue without caching when the cache store fails", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ lyrics: "Uncached lyrics" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const brokenStore: CacheStore = {
      clear: () => Promise.reject(new Error("clear failed")),
      delete: () => Promise.reject(new Error("delete failed")),
      get: () => Promise.reject(new Error("get failed")),
      has: () => Promise.reject(new Error("has failed")),
      set: () => Promise.reject(new Error("set failed")),
    };
    const client = createClient(undefined, brokenStore);
    client.markTrackActive("guild-a", track);

    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Uncached lyrics",
      },
    });
    await expect(client.getLyricsForTrack(track)).resolves.toMatchObject({
      status: "found",
      lyrics: {
        lyricsText: "Uncached lyrics",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
