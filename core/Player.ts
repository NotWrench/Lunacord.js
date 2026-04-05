// core/Player.ts

import type { Rest } from "../rest/Rest.ts";
import { Queue } from "../structures/Queue.ts";
import type { SearchResult } from "../structures/SearchResult.ts";
import { toSearchResult } from "../structures/SearchResult.ts";
import type { Track } from "../structures/Track.ts";
import type { PlayerUpdatePayload, SearchProvider } from "../types.ts";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;

export interface PlayerNodeAdapter {
  resolveVoicePayload?: (
    guildId: string
  ) => Promise<NonNullable<PlayerUpdatePayload["voice"]> | undefined>;
  readonly rest: Pick<Rest, "loadTracks" | "search" | "updatePlayer">;
  readonly sessionId: string | null;
}

export class Player {
  readonly guildId: string;
  readonly queue = new Queue();
  current: Track | null = null;
  paused = false;
  volume = 100;
  position = 0;
  connected = false;

  private readonly node: PlayerNodeAdapter;

  constructor(guildId: string, node: PlayerNodeAdapter) {
    this.guildId = guildId;
    this.node = node;
  }

  private getSessionId(): string {
    const sessionId = this.node.sessionId;
    if (!sessionId) {
      throw new Error("Node is not connected — sessionId is null");
    }
    return sessionId;
  }

  async play(track?: Track): Promise<void> {
    const target = track ?? this.queue.dequeue();

    if (!target) {
      return;
    }

    this.current = target;
    this.paused = false;

    const voicePayload = await this.node.resolveVoicePayload?.(this.guildId);
    const payload: PlayerUpdatePayload = {
      track: { encoded: target.encoded },
    };

    if (voicePayload) {
      payload.voice = voicePayload;
    }

    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, payload);
  }

  async pause(paused: boolean): Promise<void> {
    this.paused = paused;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      paused,
    });
  }

  async stop(): Promise<void> {
    this.current = null;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      track: { encoded: null },
    });
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, volume));
    this.volume = clamped;
    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      volume: clamped,
    });
  }

  async skip(): Promise<void> {
    await this.stop();
    if (!this.queue.isEmpty) {
      await this.play();
    }
  }

  async search(query: string, provider?: SearchProvider): Promise<SearchResult> {
    const result = await this.node.rest.search(query, provider);
    return toSearchResult(result);
  }

  async searchAndPlay(query: string, provider?: SearchProvider): Promise<SearchResult> {
    const result = await this.search(query, provider);

    if (result.loadType === "empty" || result.loadType === "error" || result.tracks.length === 0) {
      return result;
    }

    if (this.current) {
      this.queue.enqueueMany(result.loadType === "playlist" ? result.tracks : [result.tracks[0]!]);
      return result;
    }

    this.queue.enqueueMany(result.loadType === "playlist" ? result.tracks : [result.tracks[0]!]);
    await this.play();
    return result;
  }

  add(track: Track): void {
    this.queue.enqueue(track);
  }

  remove(index: number): Track | undefined {
    return this.queue.remove(index);
  }
}
