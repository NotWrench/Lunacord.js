import { beforeEach, describe, expect, it, mock } from "bun:test";
import { LavalinkRestError, Rest, ValidationError } from "../rest/Rest";

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

  it("should reuse the same headers object", () => {
    const headers = Reflect.get(rest, "headers");

    expect(headers).toBe(Reflect.get(rest, "headers"));
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

  describe("metadata endpoints", () => {
    it("should return node info", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              version: {
                semver: "4.0.0",
                major: 4,
                minor: 0,
                patch: 0,
              },
              buildTime: 1,
              git: {
                branch: "main",
                commit: "abc123",
                commitTime: 1,
              },
              jvm: "17",
              lavaplayer: "2.0.0",
              sourceManagers: ["youtube"],
              filters: ["timescale"],
              plugins: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      );

      const result = await rest.getInfo();

      expect(result.version.semver).toBe("4.0.0");
      expect(result.git.commit).toBe("abc123");
    });

    it("should return the server version string", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("4.0.0", { status: 200 }))
      ) as unknown as typeof fetch;

      await expect(rest.getVersion()).resolves.toBe("4.0.0");
    });

    it("should let middleware transform text responses", async () => {
      rest.use({
        afterResponse: () => "5.0.0",
      });
      globalThis.fetch = mock(() =>
        Promise.resolve(new Response("4.0.0", { status: 200 }))
      ) as unknown as typeof fetch;

      await expect(rest.getVersion()).resolves.toBe("5.0.0");
    });

    it("should return route planner status", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              class: "RotatingIpRoutePlanner",
              details: {
                ipBlock: {
                  type: "Inet4Address",
                  size: "10",
                },
                failingAddresses: [],
                blockIndex: "1",
                currentAddressIndex: "2",
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      );

      const result = await rest.getRoutePlannerStatus();

      expect(result.class).toBe("RotatingIpRoutePlanner");
      expect(result.details?.currentAddressIndex).toBe("2");
    });

    it("should fetch all players for a session", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify([
              {
                guildId: "guild-1",
                track: null,
                volume: 100,
                paused: false,
                state: {
                  time: 1,
                  position: 0,
                  connected: true,
                  ping: 10,
                },
                voice: {
                  token: "token",
                  endpoint: "endpoint",
                  sessionId: "session",
                },
                filters: {},
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      ) as unknown as typeof fetch;

      const players = await rest.getPlayers("session-123");

      expect(players).toHaveLength(1);
      expect(players[0]?.guildId).toBe("guild-1");
    });

    it("should fetch a single player for a guild", async () => {
      globalThis.fetch = mock(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              guildId: "guild-1",
              track: null,
              volume: 100,
              paused: false,
              state: {
                time: 1,
                position: 0,
                connected: true,
                ping: 10,
              },
              voice: {
                token: "token",
                endpoint: "endpoint",
                sessionId: "session",
              },
              filters: {},
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      ) as unknown as typeof fetch;

      const player = await rest.getPlayer("session-123", "guild-1");

      expect(player.guildId).toBe("guild-1");
    });

    it("should free a specific route planner address", async () => {
      const bodies: string[] = [];
      globalThis.fetch = mock((_url: string | URL, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return Promise.resolve(new Response(null, { status: 204 }));
      }) as unknown as typeof fetch;

      await rest.freeRoutePlannerAddress("1.2.3.4");

      expect(bodies).toEqual(['{"address":"1.2.3.4"}']);
    });

    it("should free all route planner addresses", async () => {
      const urls: string[] = [];
      globalThis.fetch = mock((url: string | URL) => {
        urls.push(String(url));
        return Promise.resolve(new Response(null, { status: 204 }));
      }) as unknown as typeof fetch;

      await rest.freeAllRoutePlannerAddresses();

      expect(urls).toEqual(["http://localhost:2333/v4/routeplanner/free/all"]);
    });

    it("should decode tracks in batch", async () => {
      mockFetch(() =>
        Promise.resolve(
          new Response(JSON.stringify([MOCK_TRACK, MOCK_TRACK]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
      );

      const result = await rest.decodeTracks(["one", "two"]);

      expect(result).toHaveLength(2);
      expect(result[1]?.info.title).toBe("Never Gonna Give You Up");
    });
  });

  describe("middleware", () => {
    it("should let middleware override request data", async () => {
      const urls: string[] = [];
      const bodies: string[] = [];
      rest.use({
        beforeRequest: () => ({
          path: "/v4/loadtracks?identifier=ytsearch%3Aoverride",
          body: ["patched"],
          method: "POST",
        }),
      });
      globalThis.fetch = mock((url: string | URL, init?: RequestInit) => {
        urls.push(String(url));
        bodies.push(String(init?.body ?? ""));
        return Promise.resolve(
          new Response(JSON.stringify([MOCK_TRACK]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }) as unknown as typeof fetch;

      await rest.decodeTracks(["original"]);

      expect(urls).toEqual(["http://localhost:2333/v4/loadtracks?identifier=ytsearch%3Aoverride"]);
      expect(bodies).toEqual(['["patched"]']);
    });

    it("should let middleware clear request body explicitly", async () => {
      const bodies: string[] = [];
      rest.use({
        beforeRequest: () => ({
          body: undefined,
        }),
      });
      globalThis.fetch = mock((_url: string | URL, init?: RequestInit) => {
        bodies.push(String(init?.body ?? ""));
        return Promise.resolve(
          new Response(JSON.stringify([MOCK_TRACK]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      }) as unknown as typeof fetch;

      await rest.decodeTracks(["original"]);

      expect(bodies).toEqual([""]);
    });

    it("should let middleware transform response data", async () => {
      rest.use({
        afterResponse: () => ({
          loadType: "empty",
          data: {},
        }),
      });
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

      const result = await rest.loadTracks("ytsearch:test");

      expect(result.loadType).toBe("empty");
    });

    it("should notify middleware about errors", async () => {
      const errors: unknown[] = [];
      rest.use({
        onError: (context) => {
          errors.push(context.error);
        },
      });
      globalThis.fetch = mock(() =>
        Promise.reject(new Error("network down"))
      ) as unknown as typeof fetch;

      await expect(rest.loadTracks("ytsearch:test")).rejects.toThrow("network down");
      expect(errors).toHaveLength(1);
    });
  });

  describe("updatePlayer", () => {
    it("should pass noReplace=true when requested", async () => {
      const urls: string[] = [];
      globalThis.fetch = mock((url: string | URL) => {
        urls.push(String(url));
        return Promise.resolve(new Response(null, { status: 204 }));
      }) as unknown as typeof fetch;

      await rest.updatePlayer(
        "session-123",
        "guild-123",
        {
          paused: true,
        },
        { noReplace: true }
      );

      expect(urls).toEqual([
        "http://localhost:2333/v4/sessions/session-123/players/guild-123?noReplace=true",
      ]);
    });

    it("should retry transient failures", async () => {
      let attempts = 0;
      globalThis.fetch = mock(() => {
        attempts++;
        if (attempts === 1) {
          return Promise.resolve(new Response(null, { status: 503, statusText: "Unavailable" }));
        }

        return Promise.resolve(new Response(null, { status: 204 }));
      }) as unknown as typeof fetch;

      await rest.updatePlayer("session-123", "guild-123", { paused: true });

      expect(attempts).toBe(2);
    });

    it("should not retry non-retryable responses", async () => {
      let attempts = 0;
      globalThis.fetch = mock(() => {
        attempts++;
        return Promise.resolve(new Response(null, { status: 400, statusText: "Bad Request" }));
      }) as unknown as typeof fetch;

      await expect(rest.updatePlayer("session-123", "guild-123", { paused: true })).rejects.toThrow(
        LavalinkRestError
      );
      expect(attempts).toBe(1);
    });

    it("should time out hanging requests", async () => {
      const timeoutRest = new Rest({
        baseUrl: BASE_URL,
        password: PASSWORD,
        requestTimeoutMs: 10,
      });

      globalThis.fetch = mock(
        (_url: string | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          })
      ) as unknown as typeof fetch;

      await expect(
        timeoutRest.updatePlayer("session-123", "guild-123", { paused: true })
      ).rejects.toThrow("Request timed out after 10ms");
    });

    it("should not retry deterministic non-network errors", async () => {
      const retryRest = new Rest({
        baseUrl: BASE_URL,
        password: PASSWORD,
        retryAttempts: 3,
      });
      let attempts = 0;

      globalThis.fetch = mock(() => {
        attempts++;
        return Promise.reject(new Error("invalid payload mapping"));
      }) as unknown as typeof fetch;

      await expect(
        retryRest.updatePlayer("session-123", "guild-123", { paused: true })
      ).rejects.toThrow("invalid payload mapping");
      expect(attempts).toBe(1);
    });

    it("should retry transient fetch TypeError failures", async () => {
      const retryRest = new Rest({
        baseUrl: BASE_URL,
        password: PASSWORD,
        retryAttempts: 2,
      });
      let attempts = 0;

      globalThis.fetch = mock(() => {
        attempts++;

        if (attempts === 1) {
          return Promise.reject(new TypeError("Failed to fetch"));
        }

        return Promise.resolve(new Response(null, { status: 204 }));
      }) as unknown as typeof fetch;

      await retryRest.updatePlayer("session-123", "guild-123", { paused: true });
      expect(attempts).toBe(2);
    });

    it("should not retry deterministic fetch TypeError failures", async () => {
      const retryRest = new Rest({
        baseUrl: BASE_URL,
        password: PASSWORD,
        retryAttempts: 3,
      });
      let attempts = 0;

      globalThis.fetch = mock(() => {
        attempts++;
        return Promise.reject(new TypeError("Invalid URL"));
      }) as unknown as typeof fetch;

      await expect(
        retryRest.updatePlayer("session-123", "guild-123", { paused: true })
      ).rejects.toThrow("Invalid URL");
      expect(attempts).toBe(1);
    });
  });
});
