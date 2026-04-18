import { describe, expect, it, mock } from "bun:test";
import { Cache } from "@lunacord/core";
import type { RedisClientType } from "redis";
import { RedisCacheStore } from "../src";

const createScanIterator = (batches: string[][]): ReturnType<RedisClientType["scanIterator"]> =>
  (async function* () {
    for (const batch of batches) {
      yield batch;
    }
  })() as ReturnType<RedisClientType["scanIterator"]>;

const createScanIteratorFromValues = (
  values: Array<string[] | string>
): ReturnType<RedisClientType["scanIterator"]> =>
  (async function* () {
    for (const value of values) {
      yield value;
    }
  })() as ReturnType<RedisClientType["scanIterator"]>;

describe("RedisCacheStore", () => {
  it("should wrap a redis client with the CacheStore contract", async () => {
    const scanIterator = mock(() => createScanIterator([["prefix:key"]]));
    const store = new RedisCacheStore({
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(1)),
      get: mock(() => Promise.resolve(JSON.stringify({ value: 42 }))),
      scanIterator,
      set: mock(() => Promise.resolve("OK")),
    } as unknown as RedisClientType);
    const cache = new Cache(store, "prefix");

    await expect(cache.get<{ value: number }>("key")).resolves.toEqual({ value: 42 });
    await expect(cache.has("key")).resolves.toBe(true);
    await expect(cache.set("key", { value: 42 }, { ttlMs: 1000 })).resolves.toBeUndefined();
    await expect(cache.delete("key")).resolves.toBe(true);
    await expect(cache.clear()).resolves.toBeUndefined();
    expect(scanIterator).toHaveBeenCalledWith({
      COUNT: 1000,
      MATCH: "prefix:*",
    });
  });

  it("should throw when clear is called without a prefix", async () => {
    const store = new RedisCacheStore({
      del: mock(() => Promise.resolve(1)),
      exists: mock(() => Promise.resolve(1)),
      get: mock(() => Promise.resolve(null)),
      scanIterator: mock(() => createScanIterator([])),
      set: mock(() => Promise.resolve("OK")),
    } as unknown as RedisClientType);

    await expect(store.clear()).rejects.toThrow(
      "RedisCacheStore.clear requires a prefix to avoid deleting unrelated Redis keys"
    );
  });

  it("should handle scanIterator implementations that yield individual keys", async () => {
    const del = mock(() => Promise.resolve(1));
    const store = new RedisCacheStore({
      del,
      exists: mock(() => Promise.resolve(1)),
      get: mock(() => Promise.resolve(null)),
      scanIterator: mock(() => createScanIteratorFromValues(["prefix:key-1", "prefix:key-2"])),
      set: mock(() => Promise.resolve("OK")),
    } as unknown as RedisClientType);

    await store.clear("prefix");

    expect(del).toHaveBeenCalledWith(["prefix:key-1"]);
    expect(del).toHaveBeenCalledWith(["prefix:key-2"]);
  });

  it("should treat ttlMs=0 as immediate expiry", async () => {
    const del = mock(() => Promise.resolve(1));
    const set = mock(() => Promise.resolve("OK"));
    const store = new RedisCacheStore({
      del,
      exists: mock(() => Promise.resolve(0)),
      get: mock(() => Promise.resolve(null)),
      scanIterator: mock(() => createScanIterator([])),
      set,
    } as unknown as RedisClientType);

    await store.set("prefix:key", { value: 42 }, { ttlMs: 0 });

    expect(del).toHaveBeenCalledWith("prefix:key");
    expect(set).not.toHaveBeenCalled();
  });
});
