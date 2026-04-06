import { describe, expect, it, spyOn } from "bun:test";
import { Track } from "../structures/Track";
import { type RawTrack, TrackSchema } from "../types";

const MOCK_RAW_TRACK: RawTrack = {
  encoded: "encoded-track",
  info: {
    identifier: "track-123",
    isSeekable: true,
    author: "Artist",
    length: 123_000,
    isStream: false,
    position: 0,
    title: "Track",
    uri: null,
    artworkUrl: null,
    isrc: null,
    sourceName: "youtube",
  },
};

describe("Track", () => {
  it("should skip validation for fromValidated", () => {
    const parseSpy = spyOn(TrackSchema, "parse");

    const track = Track.fromValidated(MOCK_RAW_TRACK);

    expect(track.title).toBe("Track");
    expect(parseSpy).not.toHaveBeenCalled();
  });
});
