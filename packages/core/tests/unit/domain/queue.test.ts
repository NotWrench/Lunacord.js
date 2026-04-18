import { afterEach, describe, expect, it, spyOn, vi } from "bun:test";
import type { RawTrack } from "@lunacord/core";
import { Queue, Track } from "@lunacord/core";

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("should insert tracks at a bounded index", () => {
    const queue = new Queue();
    const track1 = Track.from(MOCK_RAW_TRACK);
    const track2 = Track.from(MOCK_RAW_TRACK_2);

    queue.enqueue(track1);
    queue.insert(99, track2);

    expect(queue.toArray().map((track) => track.encoded)).toEqual(["track-1", "track-2"]);
  });

  it("should move tracks inside the queue", () => {
    const queue = new Queue();
    queue.enqueueMany([
      Track.from(MOCK_RAW_TRACK),
      Track.from(MOCK_RAW_TRACK_2),
      Track.from({
        ...MOCK_RAW_TRACK,
        encoded: "track-3",
        info: {
          ...MOCK_RAW_TRACK.info,
          identifier: "id-3",
          title: "Track 3",
        },
      }),
    ]);

    queue.move(0, 2);

    expect(queue.toArray().map((track) => track.encoded)).toEqual([
      "track-2",
      "track-3",
      "track-1",
    ]);
  });

  it("should shuffle while preserving membership", () => {
    const randomSpy = spyOn(Math, "random");
    randomSpy.mockReturnValue(0);

    const queue = new Queue();
    queue.enqueueMany([
      Track.from(MOCK_RAW_TRACK),
      Track.from(MOCK_RAW_TRACK_2),
      Track.from({
        ...MOCK_RAW_TRACK,
        encoded: "track-3",
        info: {
          ...MOCK_RAW_TRACK.info,
          identifier: "id-3",
          title: "Track 3",
        },
      }),
    ]);

    queue.shuffle();

    expect(queue.toArray().map((track) => track.encoded)).toEqual([
      "track-2",
      "track-3",
      "track-1",
    ]);
  });

  it("should accept an injected RNG for deterministic shuffle", () => {
    const queue = new Queue();
    queue.enqueueMany([
      Track.from(MOCK_RAW_TRACK),
      Track.from(MOCK_RAW_TRACK_2),
      Track.from({
        ...MOCK_RAW_TRACK,
        encoded: "track-3",
        info: {
          ...MOCK_RAW_TRACK.info,
          identifier: "id-3",
          title: "Track 3",
        },
      }),
    ]);

    queue.shuffle(() => 0);

    expect(queue.toArray().map((track) => track.encoded)).toEqual([
      "track-2",
      "track-3",
      "track-1",
    ]);
  });

  it("should remove duplicates by encoded track", () => {
    const queue = new Queue();
    queue.enqueueMany([
      Track.from(MOCK_RAW_TRACK),
      Track.from(MOCK_RAW_TRACK_2),
      Track.from(MOCK_RAW_TRACK),
    ]);

    const removed = queue.removeDuplicates();

    expect(removed).toBe(1);
    expect(queue.toArray().map((track) => track.encoded)).toEqual(["track-1", "track-2"]);
  });

  it("should remove duplicates by uri with encoded fallback", () => {
    const queue = new Queue();
    queue.enqueueMany([
      Track.from({
        ...MOCK_RAW_TRACK,
        encoded: "track-a",
        info: {
          ...MOCK_RAW_TRACK.info,
          identifier: "id-a",
          uri: "https://example.com/song",
        },
      }),
      Track.from({
        ...MOCK_RAW_TRACK_2,
        encoded: "track-b",
        info: {
          ...MOCK_RAW_TRACK_2.info,
          identifier: "id-b",
          uri: "https://example.com/song",
        },
      }),
      Track.from({
        ...MOCK_RAW_TRACK_2,
        encoded: "track-c",
        info: {
          ...MOCK_RAW_TRACK_2.info,
          identifier: "id-c",
          uri: null,
        },
      }),
    ]);

    const removed = queue.removeDuplicates({ by: "uri" });

    expect(removed).toBe(1);
    expect(queue.toArray().map((track) => track.encoded)).toEqual(["track-a", "track-c"]);
  });
});
