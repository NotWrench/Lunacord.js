import type { RedisClientType } from "redis";
import type { CacheSetOptions } from "../types";

export class RedisCacheStore {
  private readonly client: RedisClientType;

  constructor(client: RedisClientType) {
    this.client = client;
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      throw new Error(
        "RedisCacheStore.clear requires a prefix to avoid deleting unrelated Redis keys"
      );
    }

    const pattern = `${prefix}:*`;
    for await (const keys of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 1000,
    })) {
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    return (await this.client.del(key)) > 0;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async has(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async set<T>(key: string, value: T, options?: CacheSetOptions): Promise<void> {
    const ttlMs = options?.ttlMs;
    if (typeof ttlMs === "number") {
      if (ttlMs <= 0) {
        await this.client.del(key);
        return;
      }

      await this.client.set(key, JSON.stringify(value), {
        PX: ttlMs,
      });
      return;
    }

    await this.client.set(key, JSON.stringify(value));
  }
}
