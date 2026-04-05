// tests/rest.test.ts
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { LavalinkRestError, Rest, ValidationError } from "../rest/Rest.ts";

const BASE_URL = "http://localhost:2333";
const PASSWORD = "youshallnotpass";

const MOCK_TRACK = {
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

const originalFetch = globalThis.fetch;

const mockFetch = (fn: () => Promise<Response>): void => {
  globalThis.fetch = mock(fn) as unknown as typeof fetch;
};

describe("Rest", () => {
  let rest: Rest;

  beforeEach(() => {
    rest = new Rest({ baseUrl: BASE_URL, password: PASSWORD });
    globalThis.fetch = originalFetch;
  });

  describe("loadTracks", () => {
    it("should return a validated LoadResult for loadType 'track'", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              loadType: "track",
              data: MOCK_TRACK,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      );

      const result = await rest.loadTracks("ytsearch:never gonna give you up");

      expect(result.loadType).toBe("track");
      if (result.loadType === "track") {
        expect(result.data.encoded).toBe(MOCK_TRACK.encoded);
        expect(result.data.info.title).toBe("Never Gonna Give You Up");
      }
    });

    it("should return a validated LoadResult for loadType 'search'", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              loadType: "search",
              data: [MOCK_TRACK],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      );

      const result = await rest.loadTracks("ytsearch:test");

      expect(result.loadType).toBe("search");
      if (result.loadType === "search") {
        expect(result.data).toHaveLength(1);
        expect(result.data[0]?.info.title).toBe("Never Gonna Give You Up");
      }
    });

    it("should throw LavalinkRestError on non-2xx response", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: "Not Found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      await expect(rest.loadTracks("invalid")).rejects.toThrow(LavalinkRestError);

      try {
        await rest.loadTracks("invalid");
      } catch (err) {
        expect(err).toBeInstanceOf(LavalinkRestError);
        const restError = err as LavalinkRestError;
        expect(restError.status).toBe(404);
      }
    });

    it("should throw ValidationError when response fails Zod validation", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              loadType: "track",
              data: { encoded: 123, info: "bad" },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      );

      await expect(rest.loadTracks("test")).rejects.toThrow(ValidationError);
    });
  });

  describe("decodeTrack", () => {
    it("should return a valid Track-shaped object", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify(MOCK_TRACK), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await rest.decodeTrack("QAABJAMACk5ldmVyIEdvbm5h...");

      expect(result.encoded).toBe(MOCK_TRACK.encoded);
      expect(result.info.title).toBe("Never Gonna Give You Up");
    });

    it("should throw LavalinkRestError on non-2xx response", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: "Bad Request" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      await expect(rest.decodeTrack("invalid")).rejects.toThrow(LavalinkRestError);
    });
  });
});
