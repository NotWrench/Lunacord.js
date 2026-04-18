import {
  LUNACORD_PLUGIN_API_VERSION,
  type LunacordPlugin,
  type Player,
  type PluginMetadata,
  type SearchProviderInput,
  type Track,
} from "@lunacord/core";

export interface AutoplayContext {
  guildId: string;
  /** The track that just finished (if any). */
  lastTrack: Track | undefined;
  player: Player;
}

export interface AutoplayPluginOptions {
  /** Async provider that yields the next track to play when the queue is empty. */
  next: (
    context: AutoplayContext
  ) => Promise<Track | string | null | undefined> | Track | string | null | undefined;
  /** Provider to search with when `next` returns a string. Default: `"ytmsearch"`. */
  searchProvider?: SearchProviderInput;
}

/**
 * Keeps playback going when a guild's queue becomes empty by asking `next()` for another
 * track (or a search query). Returning `null`/`undefined` stops autoplay for that guild.
 */
export const createAutoplayPlugin = (
  metadata: Omit<PluginMetadata, "apiVersion">,
  options: AutoplayPluginOptions
): LunacordPlugin => ({
  ...metadata,
  apiVersion: LUNACORD_PLUGIN_API_VERSION,
  observe: async (event, ctx) => {
    if (event.type !== "playerQueueEmpty") {
      return;
    }
    const eventPayload = event as typeof event & { player: Player; reason?: string };
    const player = eventPayload.player;
    if (!player) {
      return;
    }
    try {
      const next = await options.next({
        guildId: player.guildId,
        lastTrack: player.current ?? undefined,
        player,
      });
      if (next === null || next === undefined) {
        return;
      }
      if (typeof next === "string") {
        await player.searchAndPlay(next, options.searchProvider ?? "ytmsearch");
      } else {
        await player.play(next);
      }
    } catch (error) {
      ctx.logger.warn("Autoplay failed", {
        guildId: player.guildId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
