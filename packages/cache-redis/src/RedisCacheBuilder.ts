import type { RedisClientType } from "redis";
import { RedisCacheStore } from "./RedisCacheStore";

// biome-ignore lint/suspicious/noExplicitAny: wildcard generics required for redis v5 typings
type AnyRedisClient = RedisClientType<any, any, any, any, any>;

/**
 * Fluent builder for {@link RedisCacheStore}.
 *
 * ```ts
 * import { createClient } from "redis";
 * import { RedisCache } from "@lunacord/cache-redis";
 *
 * const redis = createClient({ url: "redis://localhost:6379" });
 * await redis.connect();
 *
 * const store = RedisCache.from(redis).build();
 * const lunacord = Lunacord.create().cache.custom({ enabled: true, store }).build();
 * ```
 */
export class RedisCacheBuilder {
  private readonly client: AnyRedisClient;

  constructor(client: AnyRedisClient) {
    this.client = client;
  }

  build(): RedisCacheStore {
    return new RedisCacheStore(this.client);
  }
}

export const RedisCache = {
  from: (client: AnyRedisClient): RedisCacheBuilder => new RedisCacheBuilder(client),
};
