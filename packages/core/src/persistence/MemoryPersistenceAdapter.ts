import type { PersistenceAdapter, PlayerPersistenceSnapshot } from "./PersistenceAdapter";

/** In-memory persistence adapter. Does not survive process restarts — use for tests. */
export class MemoryPersistenceAdapter implements PersistenceAdapter {
  private readonly snapshots = new Map<string, PlayerPersistenceSnapshot>();

  save(guildId: string, snapshot: PlayerPersistenceSnapshot): void {
    this.snapshots.set(guildId, snapshot);
  }

  load(guildId: string): PlayerPersistenceSnapshot | undefined {
    return this.snapshots.get(guildId);
  }

  delete(guildId: string): void {
    this.snapshots.delete(guildId);
  }

  list(): readonly string[] {
    return [...this.snapshots.keys()];
  }
}
