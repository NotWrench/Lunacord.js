import { describe, expect, it, mock } from "bun:test";
import { Cache } from "../cache/Cache";
import { CacheManager } from "../cache/CacheManager";
import { MemoryCacheStore } from "../cache/stores/MemoryCacheStore";
import { NoopCacheStore } from "../cache/stores/NoopCacheStore";
import type { CacheStore } from "../cache/types";
import { buildTrackCacheKey } from "../cache/utils";
import { Track } from "../structures/Track";
import type { RawTrack } from "../types";

describe("Cache", () => {
  it("should set, get, has, and delete values in memory store", async () => {
    const cache = new Cache(new MemoryCacheStore(), "test");

    await cache.set("key", { value: 42 });

    await expect(cache.has("key")).resolves.toBe(true);
    await expect(cache.get<{ value: number }>("key")).resolves.toEqual({ value: 42 });
    await expect(cache.delete("key")).resolves.toBe(true);
    await expect(cache.get("key")).resolves.toBeNull();
  });

  it("should expire values after ttl", async () => {
    const cache = new Cache(new MemoryCacheStore(), "ttl");

    await cache.set("key", "value", { ttlMs: 5 });
    await new Promise((resolve) => setTimeout(resolve, 15));

    await expect(cache.get("key")).resolves.toBeNull();
    await expect(cache.has("key")).resolves.toBe(false);
  });

  it("should isolate namespaces and apply prefixes", async () => {
    const root = new Cache(new MemoryCacheStore(), "root");
    const left = root.namespace("left");
    const right = root.namespace("right");

    await left.set("key", "left-value");
    await right.set("key", "right-value");

    await expect(left.get("key")).resolves.toBe("left-value");
    await expect(right.get("key")).resolves.toBe("right-value");
  });

  it("should dedupe concurrent wrap calls", async () => {
    const cache = new Cache(new MemoryCacheStore(), "wrap");
    const resolver = mock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return "value";
    });

    const [first, second] = await Promise.all([
      cache.wrap("key", resolver),
      cache.wrap("key", resolver),
    ]);

    expect(first).toBe("value");
    expect(second).toBe("value");
    expect(resolver).toHaveBeenCalledTimes(1);
    await expect(cache.get("key")).resolves.toBe("value");
  });

  it("should keep wrap dedupe when resolver deletes the same key", async () => {
    const cache = new Cache(new MemoryCacheStore(), "wrap-delete");
    let unblockResolver: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      unblockResolver = resolve;
    });

    let afterDelete: () => void = () => {};
    const deleted = new Promise<void>((resolve) => {
      afterDelete = resolve;
    });

    const resolver = mock(async () => {
      await cache.delete("key");
      afterDelete();
      await blocked;
      return "value";
    });

    const first = cache.wrap("key", resolver);
    await deleted;
    const second = cache.wrap("key", resolver);
    unblockResolver();

    await expect(Promise.all([first, second])).resolves.toEqual(["value", "value"]);
    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("should support getOrSet", async () => {
    const cache = new Cache(new MemoryCacheStore(), "getorset");
    const resolver = mock(() => Promise.resolve("value"));

    await expect(cache.getOrSet("key", resolver)).resolves.toBe("value");
    await expect(cache.getOrSet("key", resolver)).resolves.toBe("value");

    expect(resolver).toHaveBeenCalledTimes(1);
  });

  it("should behave as a no-op when disabled", async () => {
    const cache = new Cache(new NoopCacheStore(), "noop");

    await cache.set("key", "value");

    await expect(cache.get("key")).resolves.toBeNull();
    await expect(cache.has("key")).resolves.toBe(false);
    await expect(cache.delete("key")).resolves.toBe(false);
  });

  it("should gracefully swallow store failures", async () => {
    const brokenStore: CacheStore = {
      clear: () => Promise.reject(new Error("clear failed")),
      delete: () => Promise.reject(new Error("delete failed")),
      get: () => Promise.reject(new Error("get failed")),
      has: () => Promise.reject(new Error("has failed")),
      set: () => Promise.reject(new Error("set failed")),
    };
    const cache = new Cache(brokenStore, "broken");

    await expect(cache.get("key")).resolves.toBeNull();
    await expect(cache.has("key")).resolves.toBe(false);
    await expect(cache.delete("key")).resolves.toBe(false);
    await expect(cache.set("key", "value")).resolves.toBeUndefined();
    await expect(cache.clear()).resolves.toBeUndefined();
  });
});

describe("CacheManager", () => {
  it("should create a default memory store", () => {
    const manager = new CacheManager();

    expect(manager.getStore()).toBeInstanceOf(MemoryCacheStore);
  });

  it("should use a no-op store when disabled", () => {
    const manager = new CacheManager({
      enabled: false,
    });

    expect(manager.getStore()).toBeInstanceOf(NoopCacheStore);
  });
});

describe("MemoryCacheStore", () => {
  it("should unref cleanup timer when available", () => {
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    const unref = mock(() => undefined);
    const timer = {
      unref,
    } as unknown as ReturnType<typeof setInterval>;

    globalThis.setInterval = mock(() => timer) as unknown as typeof setInterval;
    globalThis.clearInterval = mock(() => undefined) as unknown as typeof clearInterval;

    const store = new MemoryCacheStore({ cleanupIntervalMs: 10 });
    expect(unref).toHaveBeenCalledTimes(1);

    store.stop();
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
  });

  it("should evict least recently used entries when maxEntries is reached", async () => {
    const store = new MemoryCacheStore({ maxEntries: 2 });

    await store.set("a", 1);
    await store.set("b", 2);
    await store.get("a");
    await store.set("c", 3);

    await expect(store.has("a")).resolves.toBe(true);
    await expect(store.has("b")).resolves.toBe(false);
    await expect(store.has("c")).resolves.toBe(true);
  });
});

describe("buildTrackCacheKey", () => {
  const createTrack = (overrides: Partial<RawTrack["info"]>): Track =>
    new Track({
      encoded: "encoded-track",
      info: {
        identifier: "identifier",
        isSeekable: true,
        author: "Artist",
        length: 1_000,
        isStream: false,
        position: 0,
        title: "Song",
        uri: "https://example.com",
        artworkUrl: null,
        isrc: null,
        sourceName: "youtube",
        ...overrides,
      },
    });

  it("should use meta fallback only when both artist and title are available", () => {
    const track = createTrack({
      identifier: "",
      sourceName: "",
      author: "alan walker",
      title: "faded",
    });

    expect(buildTrackCacheKey(track)).toBe("meta:alan walker:faded");
  });

  it("should fall back to encoded key when artist or title is missing", () => {
    const missingArtist = createTrack({
      identifier: "",
      sourceName: "",
      author: "",
      title: "Faded",
    });
    const missingTitle = createTrack({
      identifier: "",
      sourceName: "",
      author: "Alan Walker",
      title: "",
    });

    expect(buildTrackCacheKey(missingArtist)).toBe("encoded:encoded-track");
    expect(buildTrackCacheKey(missingTitle)).toBe("encoded:encoded-track");
  });
});
