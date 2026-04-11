import { describe, expect, it } from "bun:test";
import * as cacheExports from "../../src/cache";

describe("Cache exports", () => {
  it("should expose cache entrypoints for subpath consumers", () => {
    expect(cacheExports).toHaveProperty("Cache");
    expect(cacheExports).toHaveProperty("CacheManager");
    expect(cacheExports).toHaveProperty("MemoryCacheStore");
    expect(cacheExports).toHaveProperty("NoopCacheStore");
    expect(cacheExports).toHaveProperty("RedisCacheStore");
  });
});
