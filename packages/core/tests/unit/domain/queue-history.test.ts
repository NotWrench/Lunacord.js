import { describe, expect, it } from "bun:test";
import type { RawTrack } from "@lunacord/core";
import { QueueHistory, Track } from "@lunacord/core";

const TRACK = (encoded: string, title: string): RawTrack => ({
  encoded,
  info: {
    identifier: encoded,
    isSeekable: true,
    author: "Artist",
    length: 1000,
    isStream: false,
    position: 0,
    title,
    uri: `https://example.com/${encoded}`,
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
});

describe("QueueHistory", () => {
  it("should keep bounded LIFO history", () => {
    const history = new QueueHistory(2);
    const first = new Track(TRACK("1", "First"));
    const second = new Track(TRACK("2", "Second"));
    const third = new Track(TRACK("3", "Third"));

    history.push(first);
    history.push(second);
    history.push(third);

    expect(history.size).toBe(2);
    expect(history.peek()?.title).toBe("Third");
    expect(history.toArray().map((track) => track.title)).toEqual(["Third", "Second"]);
    expect(history.pop()?.title).toBe("Third");
    expect(history.pop()?.title).toBe("Second");
  });
});
