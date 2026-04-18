import type { PersistenceAdapter, PlayerPersistenceSnapshot } from "@lunacord/core";
import type { RedisClientType } from "redis";

// biome-ignore lint/suspicious/noExplicitAny: wildcard generics required for redis v5 typings
type AnyRedisClient = RedisClientType<any, any, any, any, any>;

export interface RedisPersistenceAdapterOptions {
  /** Prefix for Redis keys. Default: `"lunacord:player"`. */
  prefix?: string;
}

/**
 * Redis-backed {@link PersistenceAdapter}. Snapshots survive process restarts so
 * `lunacord.rehydrate()` can bring every player back after a crash or deploy.
 */
export class RedisPersistenceAdapter implements PersistenceAdapter {
  private readonly client: AnyRedisClient;
  private readonly prefix: string;

  constructor(client: AnyRedisClient, options: RedisPersistenceAdapterOptions = {}) {
    this.client = client;
    this.prefix = options.prefix ?? "lunacord:player";
  }

  private key(guildId: string): string {
    return `${this.prefix}:${guildId}`;
  }

  async save(guildId: string, snapshot: PlayerPersistenceSnapshot): Promise<void> {
    await this.client.set(this.key(guildId), JSON.stringify(snapshot));
  }

  async load(guildId: string): Promise<PlayerPersistenceSnapshot | undefined> {
    const raw = await this.client.get(this.key(guildId));
    if (raw === null || raw === undefined) {
      return undefined;
    }
    const serialized = typeof raw === "string" ? raw : raw.toString("utf8");
    return JSON.parse(serialized) as PlayerPersistenceSnapshot;
  }

  async delete(guildId: string): Promise<void> {
    await this.client.del(this.key(guildId));
  }

  async list(): Promise<readonly string[]> {
    const guildIds: string[] = [];
    const pattern = `${this.prefix}:*`;
    for await (const scanned of this.client.scanIterator({ MATCH: pattern, COUNT: 1000 })) {
      const keys = Array.isArray(scanned) ? scanned : [scanned];
      for (const key of keys) {
        const keyString = typeof key === "string" ? key : key.toString("utf8");
        const guildId = keyString.slice(this.prefix.length + 1);
        if (guildId) {
          guildIds.push(guildId);
        }
      }
    }
    return guildIds;
  }
}
