import type { Track } from "./Track.ts";

export class Queue {
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
    this.tracks.push(...tracks);
    return this.tracks.length;
  }

  peek(): Track | undefined {
    return this.tracks[0];
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
}
