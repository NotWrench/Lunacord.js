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

  it("should expose userData and pluginInfo metadata", () => {
    const track = Track.from({
      ...MOCK_RAW_TRACK,
      pluginInfo: {
        source: "custom",
      },
      userData: {
        requesterId: "123",
      },
    });

    expect(track.pluginInfo).toEqual({ source: "custom" });
    expect(track.userData).toEqual({ requesterId: "123" });
  });

  it("should default metadata fields to empty objects", () => {
    const track = Track.from(MOCK_RAW_TRACK);

    expect(track.pluginInfo).toEqual({});
    expect(track.userData).toEqual({});
  });
});
