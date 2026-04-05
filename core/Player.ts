// core/Player.ts
import type { Track } from "../structures/Track.ts";
import type { Node } from "./Node.ts";

const MAX_VOLUME = 1000;
const MIN_VOLUME = 0;

export class Player {
  readonly guildId: string;
  readonly queue: Track[] = [];
  current: Track | null = null;
  paused = false;
  volume = 100;
  position = 0;
  connected = false;

  private readonly node: Node;

  constructor(guildId: string, node: Node) {
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
    const target = track ?? this.queue.shift();

    if (!target) {
      return;
    }

    this.current = target;
    this.paused = false;

    await this.node.rest.updatePlayer(this.getSessionId(), this.guildId, {
      track: { encoded: target.encoded },
    });
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
    if (this.queue.length > 0) {
      await this.play();
    }
  }

  add(track: Track): void {
    this.queue.push(track);
  }

  remove(index: number): Track | undefined {
    if (index < 0 || index >= this.queue.length) {
      return undefined;
    }
    return this.queue.splice(index, 1)[0];
  }
}
