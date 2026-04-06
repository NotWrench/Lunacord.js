import { describe, expect, it } from "bun:test";
import { Queue } from "../structures/Queue.ts";
import { Track } from "../structures/Track.ts";
import type { RawTrack } from "../types.ts";

const MOCK_RAW_TRACK: RawTrack = {
  encoded: "track-1",
  info: {
    identifier: "id-1",
    isSeekable: true,
    author: "Artist 1",
    length: 100_000,
    isStream: false,
    position: 0,
    title: "Track 1",
    uri: null,
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

const MOCK_RAW_TRACK_2: RawTrack = {
  encoded: "track-2",
  info: {
    identifier: "id-2",
    isSeekable: true,
    author: "Artist 2",
    length: 200_000,
    isStream: false,
    position: 0,
    title: "Track 2",
    uri: null,
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

describe("Queue", () => {
  it("should enqueue, peek, and dequeue tracks", () => {
    const queue = new Queue();
    const track = Track.from(MOCK_RAW_TRACK);

    expect(queue.enqueue(track)).toBe(1);
    expect(queue.peek()).toBe(track);
    expect(queue.dequeue()).toBe(track);
    expect(queue.isEmpty).toBe(true);
  });

  it("should enqueue many tracks and expose size", () => {
    const queue = new Queue();
    const tracks = [Track.from(MOCK_RAW_TRACK), Track.from(MOCK_RAW_TRACK_2)];

    expect(queue.enqueueMany(tracks)).toBe(2);
    expect(queue.size).toBe(2);
    expect(queue.peek()?.title).toBe("Track 1");
  });

  it("should remove tracks by index", () => {
    const queue = new Queue();
    queue.enqueueMany([Track.from(MOCK_RAW_TRACK), Track.from(MOCK_RAW_TRACK_2)]);

    const removed = queue.remove(1);

    expect(removed?.title).toBe("Track 2");
    expect(queue.size).toBe(1);
  });

  it("should clear the queue", () => {
    const queue = new Queue();
    queue.enqueueMany([Track.from(MOCK_RAW_TRACK), Track.from(MOCK_RAW_TRACK_2)]);

    queue.clear();

    expect(queue.isEmpty).toBe(true);
    expect(queue.size).toBe(0);
  });

  it("should return a safe array copy", () => {
    const queue = new Queue();
    queue.enqueue(Track.from(MOCK_RAW_TRACK));

    const snapshot = queue.toArray();
    snapshot.pop();

    expect(snapshot).toHaveLength(0);
    expect(queue.size).toBe(1);
  });

  it("should enqueue large arrays safely", () => {
    const queue = new Queue();
    const tracks = Array.from({ length: 20_000 }, (_, index) =>
      Track.from({
        ...MOCK_RAW_TRACK,
        encoded: `track-${index}`,
        info: {
          ...MOCK_RAW_TRACK.info,
          identifier: `id-${index}`,
          title: `Track ${index}`,
        },
      })
    );

    expect(() => queue.enqueueMany(tracks)).not.toThrow();
    expect(queue.size).toBe(20_000);
  });
});
