import type Redis from "ioredis";
import type { CacheSetOptions } from "../types";

export class RedisCacheStore {
  private readonly client: Redis;

  constructor(client: Redis) {
    this.client = client;
  }

  async clear(prefix?: string): Promise<void> {
    if (!prefix) {
      throw new Error(
        "RedisCacheStore.clear requires a prefix to avoid deleting unrelated Redis keys"
      );
    }

    const keys = await this.client.keys(`${prefix}:*`);
    if (keys.length === 0) {
      return;
    }

    await this.client.del(...keys);
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
    if (options?.ttlMs) {
      await this.client.set(key, JSON.stringify(value), "PX", options.ttlMs);
      return;
    }

    await this.client.set(key, JSON.stringify(value));
  }
}
