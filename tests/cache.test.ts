import { describe, expect, it, mock } from "bun:test";
import { Cache } from "../cache/Cache";
import { CacheManager } from "../cache/CacheManager";
import { MemoryCacheStore } from "../cache/stores/MemoryCacheStore";
import { NoopCacheStore } from "../cache/stores/NoopCacheStore";
import type { CacheStore } from "../cache/types";

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
