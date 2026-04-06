import type { Track } from "./Track";

export interface QueueRemoveDuplicateOptions {
  by?: "encoded" | "uri";
}

export class Queue {
  constructor() {}

  private readonly tracks: Track[] = [];

  get isEmpty(): boolean {
    return this.tracks.length === 0;
  }

  get size(): number {
    return this.tracks.length;
  }

  clear(): void {
    this.tracks.length = 0;
  }

  dequeue(): Track | undefined {
    return this.tracks.shift();
  }

  enqueue(track: Track): number {
    this.tracks.push(track);
    return this.tracks.length;
  }

  enqueueMany(tracks: Track[]): number {
    for (const track of tracks) {
      this.tracks.push(track);
    }
    return this.tracks.length;
  }

  insert(index: number, track: Track): number {
    const normalizedIndex = Math.max(0, Math.min(index, this.tracks.length));
    this.tracks.splice(normalizedIndex, 0, track);
    return this.tracks.length;
  }

  peek(): Track | undefined {
    return this.tracks[0];
  }

  shuffle(): void {
    for (let index = this.tracks.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [this.tracks[index], this.tracks[randomIndex]] = [
        this.tracks[randomIndex]!,
        this.tracks[index]!,
      ];
    }
  }

  move(from: number, to: number): void {
    if (from < 0 || from >= this.tracks.length) {
      return;
    }

    const normalizedTo = Math.max(0, Math.min(to, this.tracks.length - 1));
    if (from === normalizedTo) {
      return;
    }

    const [track] = this.tracks.splice(from, 1);
    if (!track) {
      return;
    }

    this.tracks.splice(normalizedTo, 0, track);
  }

  remove(index: number): Track | undefined {
    if (index < 0 || index >= this.tracks.length) {
      return undefined;
    }

    return this.tracks.splice(index, 1)[0];
  }

  toArray(): Track[] {
    return [...this.tracks];
  }

  removeDuplicates(options?: QueueRemoveDuplicateOptions): number {
    const by = options?.by ?? "encoded";
    const seen = new Set<string>();
    const deduped: Track[] = [];
    let removed = 0;

    for (const track of this.tracks) {
      const key = by === "uri" ? (track.uri ?? track.encoded) : track.encoded;

      if (seen.has(key)) {
        removed++;
        continue;
      }

      seen.add(key);
      deduped.push(track);
    }

    this.tracks.length = 0;
    this.tracks.push(...deduped);
    return removed;
  }
}
