/**
 * Snapshot payload stored by a {@link PersistenceAdapter}. Kept intentionally loose so
 * that `Player.export()`'s return value (used today for migration handoff) is a valid
 * persistence entry without extra massaging.
 */
export interface PlayerPersistenceSnapshot {
  readonly channelId?: string;
  readonly currentTrackEncoded?: string | null;
  readonly endTime?: number;
  readonly filters?: Record<string, unknown>;
  readonly guildId: string;
  readonly nodeId?: string;
  readonly paused?: boolean;
  readonly position?: number;
  readonly queueEncoded?: readonly string[];
  readonly repeatQueue?: boolean;
  readonly repeatTrack?: boolean;
  readonly textChannelId?: string;
  readonly volume?: number;
  readonly [extra: string]: unknown;
}

/**
 * Pluggable persistence contract. Implementations back storage for `player.export()` so
 * bots can rehydrate after a restart. Built-in implementations:
 *
 * - {@link MemoryPersistenceAdapter} (in-memory; good for tests).
 * - `@lunacord/cache-redis` exposes a Redis-backed adapter.
 */
export interface PersistenceAdapter {
  /** Delete the snapshot for a guild (called on `destroyPlayer`). */
  delete(guildId: string): Promise<void> | void;
  /** List all known guild ids that have persisted snapshots (used on boot for rehydrate). */
  list(): Promise<readonly string[]> | readonly string[];
  /** Load a previously saved snapshot, or `undefined` if none exists. */
  load(
    guildId: string
  ): Promise<PlayerPersistenceSnapshot | undefined> | PlayerPersistenceSnapshot | undefined;
  /** Persist or replace the snapshot for a guild. */
  save(guildId: string, snapshot: PlayerPersistenceSnapshot): Promise<void> | void;
}
