import type { Track } from "./Track";

const DEFAULT_HISTORY_MAX_SIZE = 20;

export class QueueHistory {
  private readonly tracks: Track[] = [];
  private readonly maxSize: number;

  constructor(maxSize = DEFAULT_HISTORY_MAX_SIZE) {
    this.maxSize = Math.max(1, maxSize);
  }

  clear(): void {
    this.tracks.length = 0;
  }

  get size(): number {
    return this.tracks.length;
  }

  peek(): Track | undefined {
    return this.tracks[0];
  }

  pop(): Track | undefined {
    return this.tracks.shift();
  }

  push(track: Track): number {
    this.tracks.unshift(track);

    if (this.tracks.length > this.maxSize) {
      this.tracks.length = this.maxSize;
    }

    return this.tracks.length;
  }

  toArray(): Track[] {
    return [...this.tracks];
  }
}
