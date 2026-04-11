import type { CacheSetOptions } from "../types";

export class NoopCacheStore {
  async clear(): Promise<void> {}

  async delete(): Promise<boolean> {
    return false;
  }

  async get<T>(): Promise<T | null> {
    return null;
  }

  async has(): Promise<boolean> {
    return false;
  }

  async set<T>(_key: string, _value: T, _options?: CacheSetOptions): Promise<void> {}
}
