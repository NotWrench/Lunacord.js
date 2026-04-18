import { describe, expect, it } from "bun:test";
import * as cacheRedis from "@lunacord/cache-redis";

describe("@lunacord/cache-redis public API", () => {
  it("exposes the Redis cache store + fluent builder", () => {
    expect(cacheRedis).toHaveProperty("RedisCacheStore");
    expect(cacheRedis).toHaveProperty("RedisCache");
    expect(cacheRedis).toHaveProperty("RedisCacheBuilder");
    expect(typeof cacheRedis.RedisCache.from).toBe("function");
  });

  it("exposes the Redis persistence adapter", () => {
    expect(cacheRedis).toHaveProperty("RedisPersistenceAdapter");
  });
});
