import type { CacheSetOptions } from "../types";

export class NoopCacheStore {
  clear(): Promise<void> {
    return Promise.resolve();
  }

  delete(): Promise<boolean> {
    return Promise.resolve(false);
  }

  get<T>(): Promise<T | null> {
    return Promise.resolve<T | null>(null);
  }

  has(): Promise<boolean> {
    return Promise.resolve(false);
  }

  set<T>(_key: string, _value: T, _options?: CacheSetOptions): Promise<void> {
    return Promise.resolve();
  }
}
