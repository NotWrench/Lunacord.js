import type { Cache, GeniusOptions, LyricsProvider } from "@lunacord/core";
import { LyricsClient } from "./LyricsClient";

type ProviderName = "genius" | "lyricsOvh";

/**
 * Fluent builder for configuring the composite {@link LyricsClient}.
 *
 * ```ts
 * const lyrics = LyricsClient.create()
 *   .provider.genius({ clientId, clientSecret, accessToken })
 *   .provider.lyricsOvh()
 *   .cache(manager.cache("lyrics"))
 *   .fallbackOrder(["genius", "lyricsOvh"])
 *   .build();
 *
 * lunacord.lyrics(lyrics);
 * ```
 */
export class LyricsBuilder {
  private readonly providerState: {
    geniusOptions?: GeniusOptions;
    lyricsOvhEnabled: boolean;
  } = {
    lyricsOvhEnabled: false,
  };
  private cacheNamespace?: Cache;
  private requestTimeoutMs?: number;
  private order: readonly ProviderName[] = ["lyricsOvh", "genius"];

  readonly provider = {
    genius: (options: GeniusOptions): this => {
      this.providerState.geniusOptions = options;
      return this;
    },
    lyricsOvh: (): this => {
      this.providerState.lyricsOvhEnabled = true;
      return this;
    },
  };

  cache(cache: Cache): this {
    this.cacheNamespace = cache;
    return this;
  }

  timeoutMs(timeoutMs: number): this {
    this.requestTimeoutMs = timeoutMs;
    return this;
  }

  fallbackOrder(order: readonly ProviderName[]): this {
    this.order = order;
    return this;
  }

  build(): LyricsProvider {
    return new LyricsClient(
      {
        ...(this.providerState.geniusOptions ? { genius: this.providerState.geniusOptions } : {}),
        ...(this.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: this.requestTimeoutMs }),
        order: this.order,
        lyricsOvhEnabled: this.providerState.lyricsOvhEnabled,
      } as never,
      this.cacheNamespace ? { cache: this.cacheNamespace } : undefined
    );
  }
}
