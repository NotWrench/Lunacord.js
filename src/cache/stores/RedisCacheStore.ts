import type { RedisClientType } from "redis";
import type { CacheSetOptions } from "../types";

export class RedisCacheStore {
  private readonly client: RedisClientType<any, any, any, any, any>;

  constructor(client: RedisClientType<any, any, any, any, any>) {
    this.client = client;
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      throw new Error(
        "RedisCacheStore.clear requires a prefix to avoid deleting unrelated Redis keys"
      );
    }

    const pattern = `${prefix}:*`;
    for await (const scanned of this.client.scanIterator({
      MATCH: pattern,
      COUNT: 1000,
    })) {
      const keys = Array.isArray(scanned) ? scanned : [scanned];
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = await this.client.del(key);
    return Number(deleted) > 0;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (value === null) {
      return null;
    }

    const serialized = typeof value === "string" ? value : value.toString("utf8");
    return JSON.parse(serialized) as T;
  }

  async has(key: string): Promise<boolean> {
    const exists = await this.client.exists(key);
    return Number(exists) > 0;
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
